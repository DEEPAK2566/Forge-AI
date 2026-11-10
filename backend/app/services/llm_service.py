"""
LLM Service — uses the new google-genai SDK (replaces deprecated google-generativeai).
Free models: gemini-2.0-flash (default), gemini-1.5-flash, gemini-1.5-pro
"""

import random
import re as _re
import threading
import time

from app.core.config import settings


# ── Retry on rate limits ──────────────────────────────────────────────────
# Gemini's free tier allows ~10–15 requests/minute. Parallel agents, loops and
# tool steps can hit that, and Gemini answers "429 RESOURCE_EXHAUSTED".
# Instead of failing the agent, wait and try again (up to 3 times), using the
# wait time Gemini suggests when it gives one. (Groq's SDK already retries 429s.)
# A DAILY quota that is used up is not retried — waiting seconds won't help.

_RETRYABLE  = ("429", "resource_exhausted", "rate limit", "rate_limit", "too many requests",
               "503", "unavailable", "overloaded")
_NOT_WORTH  = ("per day", "perday", "limit: 0")
RETRY_WAITS = [3, 8, 20]          # seconds, used when the error gives no hint
MAX_WAIT    = 30                  # never wait longer than this for one retry

# The engine sets retry_listener.fn (per thread) to show "retrying..." on the live feed
retry_listener = threading.local()


def _retry_wait(error: Exception, attempt: int) -> float:
    text = str(error)
    hint = _re.search(r"retry in ([0-9.]+)\s*s", text, _re.I) or \
           _re.search(r"retryDelay['\"]?\s*[:=]\s*['\"]?([0-9.]+)s", text)
    wait = float(hint.group(1)) if hint else RETRY_WAITS[min(attempt, len(RETRY_WAITS) - 1)]
    return min(MAX_WAIT, wait) + random.uniform(0, 1)


def with_retry(call, label: str, retries: int = 3):
    """Run call(); on a rate-limit/overload error wait and try again, up to `retries` times."""
    for attempt in range(retries + 1):
        try:
            return call()
        except Exception as e:
            low = str(e).lower()
            if attempt >= retries or not any(k in low for k in _RETRYABLE) or any(k in low for k in _NOT_WORTH):
                raise
            wait = _retry_wait(e, attempt)
            msg  = f"{label} is rate-limited — retrying in {wait:.0f}s (attempt {attempt + 2} of {retries + 1})"
            print(f"[LLM] {msg}")
            notify = getattr(retry_listener, "fn", None)
            if notify:
                notify(msg)
            time.sleep(wait)


# ── Model name map ────────────────────────────────────────────────────────
# Some agents were saved with old model names before the SDK switch.
# This maps old names to working equivalents so old agents still run.
MODEL_MAP = {
    "gemini-pro":            "gemini-pro-latest",
    "gemini-1.5-flash":      "gemini-2.5-flash",
    "gemini-1.5-pro":        "gemini-2.5-pro",
    "gemini-2.0-flash":      "gemini-2.0-flash",
    "gemini-2.0-flash-lite": "gemini-2.0-flash-lite",
}

GEMINI_MODEL_CANDIDATES = [
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.5-pro",
    "gemini-pro-latest",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
]

GROQ_MODEL_CANDIDATES = [
    "groq/compound",
    "allam-2-7b",
    "llama3-8b",
    "llama3-8b-8192",
    "mixtral-8x7b-32768",
    "llama3-70b-8192",
]


def _model_candidates(model: str, engine: str) -> list[str]:
    if engine == "gemini":
        candidates = [MODEL_MAP.get(model, model)] if model else []
        candidates += [m for m in GEMINI_MODEL_CANDIDATES if m not in candidates]
        return candidates
    if engine == "groq":
        candidates = [model] if model else []
        candidates += [m for m in GROQ_MODEL_CANDIDATES if m not in candidates]
        return candidates
    return [model] if model else []


import re
import json

def _sub(text: str, variables: dict) -> str:
    """
    Replace {{ variable_name }} placeholders with values from variables dict.
    
    Example:
      text = "Fetch files from {{ repo_url }} on branch {{ branch_name }}"
      variables = {"repo_url": "https://github.com/org/repo", "branch_name": "main"}
      result = "Fetch files from https://github.com/org/repo on branch main"
    
    If a variable is not in the dict, the placeholder is kept as-is.
    """
    if not text or not variables:
        return text or ''
    def repl(m):
        key = m.group(1).strip()
        return str(variables.get(key, m.group(0)))
    return re.sub(r'\{\{\s*([^}]+?)\s*\}\}', repl, text)


def build_agent_prompt(agent, input_text: str, guardrail_text: str = "", context_text: str = "",
                       workflow_vars: dict = None) -> str:
    """
    Build the full LLM prompt from agent config + runtime input.
    
    If input_text is a JSON object (from {{ variable }} workflow inputs),
    the variables are substituted into the agent's description, goal, etc.
    
    Example flow:
      1. User creates agent with description: "Read {{ repo_url }} on {{ branch_name }}"
      2. When workflow runs, user fills: repo_url="..", branch_name="main"
      3. These are passed as JSON: {"repo_url": "..", "branch_name": "main"}
      4. This function substitutes them into the agent's instructions
      5. The LLM receives fully-resolved text
    """
    # Variables typed in the Run window reach EVERY agent (not just the first),
    # so {{ job_name }} works in any agent's instructions.
    variables    = dict(workflow_vars or {})
    display_input = input_text or ''

    try:
        parsed = json.loads(input_text or '{}')
        if isinstance(parsed, dict) and parsed:
            variables.update(parsed)
            display_input = '\n'.join(f"  {k}: {v}" for k, v in parsed.items())
    except (json.JSONDecodeError, TypeError, ValueError):
        pass

    # Substitute {{ variable }} patterns in all agent fields
    role        = _sub(agent.role        or '', variables)
    goal        = _sub(agent.goal        or '', variables)
    backstory   = _sub(agent.backstory   or '', variables)
    description = _sub(agent.description or '', variables)

    parts = []

    # Guardrails go FIRST so the model reads them before anything else
    if guardrail_text:
        parts.append("NON-NEGOTIABLE RULES (you must follow these in every answer):")
        parts.append(guardrail_text)
        parts.append("")

    if role:
        parts.append(f"You are {role}.")
    else:
        parts.append("You are a helpful AI assistant.")

    if goal:
        parts.append(f"\nYour goal: {goal}")

    if backstory:
        parts.append(f"\nBackground: {backstory}")

    if description:
        parts.append(f"\nInstructions:\n{description}")

    parts.append("\n---")

    if variables:
        parts.append(f"Runtime inputs provided:\n{display_input}")
    else:
        parts.append(f"Input:\n{input_text or 'Begin.'}")

    parts.append("---")
        

    # Knowledge-base chunks and REAL tool outputs, kept separate from the input
    # so a JSON input still parses and {{ variables }} still get substituted
    if context_text:
        parts.append(context_text)
        parts.append("---")

    parts.append("Provide a clear, structured response.")

    return "\n".join(parts)

def call_gemini(prompt: str, model: str = "gemini-2.5-flash",
                temperature: float = 0.7, top_p: float = 0.9) -> str:
    """
    Call Gemini using the new google-genai SDK.
    
    Free tier limits (as of 2025):
      - gemini-2.0-flash:      15 req/min, 1500 req/day
      - gemini-2.0-flash-lite: 30 req/min, 1500 req/day  (lighter, faster)
      - gemini-1.5-flash:      15 req/min, 1500 req/day
      - gemini-1.5-pro:        2 req/min,  50 req/day     (smarter, slower)
    
    Get a free key at: aistudio.google.com
    """
    if not settings.GEMINI_API_KEY:
        raise ValueError(
            "GEMINI_API_KEY is not set in backend/.env\n"
            "Get a free key at: aistudio.google.com → Get API key"
        )

    # Normalize model name and build a fallback candidate list.
    candidates = _model_candidates(MODEL_MAP.get(model, model), "gemini")
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        gen_config = types.GenerateContentConfig(temperature=temperature, top_p=top_p)
        last_error = None

        for candidate in candidates:
            try:
                response = with_retry(
                    lambda: client.models.generate_content(
                        model    = candidate,
                        contents = prompt,
                        config   = gen_config,
                    ),
                    f"Gemini ({candidate})",
                )
                if candidate != model:
                    print(f"[LLM] Gemini model {model} unavailable, using fallback {candidate}")
                return response.text
            except Exception as e:
                last_error = e
                err_text = str(e).lower()
                if any(keyword in err_text for keyword in ["not found", "not supported", "decommissioned", "resource_exhausted"]):
                    print(f"[LLM] Gemini model {candidate} failed: {e}; trying next fallback")
                    continue
                raise

        raise RuntimeError(
            f"Gemini API error: all candidate models failed for requested model {model}: {last_error}"
        )

    except Exception as e:
        raise RuntimeError(f"Gemini API error: {str(e)}")


def call_groq(prompt: str, model: str = "groq/compound",temperature: float = 0.7, top_p: float = 0.9) -> str:   
    """
    Call Groq API.
    Free tier: ~30 req/min. Very fast.
    Get a free key at: console.groq.com
    """
    if not settings.GROQ_API_KEY:
        raise ValueError(
            "GROQ_API_KEY is not set in backend/.env\n"
            "Get a free key at: console.groq.com"
        )

    candidates = _model_candidates(model, "groq")
    try:
        from groq import Groq
        client = Groq(api_key=settings.GROQ_API_KEY)
        last_error = None

        for candidate in candidates:
            try:
                response = client.chat.completions.create(
                    messages   = [{"role": "user", "content": prompt}],
                    model      = candidate,
                    max_tokens  = 2048,
                    temperature = temperature,
                    top_p       = top_p,
                )
                
                if candidate != model:
                    print(f"[LLM] Groq model {model} unavailable, using fallback {candidate}")
                return response.choices[0].message.content
            except Exception as e:
                last_error = e
                err_text = str(e).lower()
                if any(keyword in err_text for keyword in ["decommissioned", "not supported", "invalid_request_error", "not found"]):
                    print(f"[LLM] Groq model {candidate} failed: {e}; trying next fallback")
                    continue
                raise

        raise RuntimeError(
            f"Groq API error: all candidate models failed for requested model {model}: {last_error}"
        )

    except Exception as e:
        raise RuntimeError(f"Groq API error: {str(e)}")
    
def call_llm(agent, input_text: str, fallback: bool = True,
             guardrail_text: str = "", context_text: str = "", workflow_vars: dict = None) -> str:
    """
    Main entry point — routes to the right LLM based on agent config.

    guardrail_text : rules from attached guardrails (top of the prompt)
    context_text   : knowledge-base chunks + real tool outputs
    fallback=True  : if the primary LLM fails, tries the other one.
    workflow_vars  : values from the Run window, for {{ variable }} substitution
    """
    prompt = build_agent_prompt(agent, input_text, guardrail_text, context_text, workflow_vars)
    engine = (agent.ai_engine or "gemini").lower()
    model  = agent.model or ("gemini-2.5-flash" if engine == "gemini" else "groq/compound")

    # The sliders in the Agent Builder — previously saved but never used
    temperature = agent.temperature if agent.temperature is not None else 0.7
    top_p       = agent.top_p       if agent.top_p       is not None else 0.9

    print(f"[LLM] Calling {engine} / {model} | temperature={temperature} top_p={top_p}")

    if engine == "groq":
        try:
            result = call_groq(prompt, model, temperature, top_p)
            print(f"[LLM] ✓ Groq responded ({len(result)} chars)")
            return result
        except Exception as e:
            if fallback and settings.GEMINI_API_KEY:
                print(f"[LLM] Groq failed ({e}) — trying Gemini fallback")
                return call_gemini(prompt, temperature=temperature, top_p=top_p)
            raise

    # "gemini" and any unknown engine
    try:
        result = call_gemini(prompt, model, temperature, top_p)
        print(f"[LLM] ✓ Gemini responded ({len(result)} chars)")
        return result
    except Exception as e:
        if fallback and settings.GROQ_API_KEY:
            print(f"[LLM] Gemini failed ({e}) — trying Groq fallback")
            return call_groq(prompt, temperature=temperature, top_p=top_p)
        raise

# ══════════════════════════════════════════════════════════════════════════
# NATIVE TOOL CALLING (agentic loop)
#
# Instead of running every tool BEFORE the LLM, we describe the tools to the
# model as functions. The model decides when to call one and with which
# arguments; we run it for real and send the result back. This repeats until
# the model gives a final answer or max_iterations is reached.
#
#   tool_specs   : [{"name", "description", "params": [{"name", "required"}]}]
#   execute_tool : function(name: str, args: dict) -> str   (provided by the engine)
#
# Returns (final_text, calls) where calls is a list of
#   {"tool", "args", "result"} for the Execution Monitor.
# ══════════════════════════════════════════════════════════════════════════

class ToolsAlreadyRan(RuntimeError):
    """The model failed after tools had already run — do not retry or re-run tools."""


# Groq models that support custom tools (groq/compound does not)
GROQ_TOOL_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]

TOOL_USE_INSTRUCTIONS = (
    "You have functions (tools) available. Call a tool whenever you need real data "
    "or need to perform an action. Never write code that pretends to call a tool and "
    "never invent tool results. Credentials are supplied automatically — do not ask "
    "for them. When you have what you need, reply with the final answer as plain text."
)


def _json_schema(spec: dict) -> dict:
    return {
        "type": "object",
        "properties": {
            p["name"]: {"type": "string", "description": f"Value for '{p['name']}'"}
            for p in spec["params"]
        },
        "required": [p["name"] for p in spec["params"] if p["required"]],
    }


def _gemini_tool_loop(prompt, model, temperature, top_p, tool_specs, execute_tool, max_iter):
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    declarations = []
    for spec in tool_specs:
        schema = _json_schema(spec)
        declarations.append(types.FunctionDeclaration(
            name        = spec["name"],
            description = spec["description"],
            parameters  = types.Schema(
                type       = "OBJECT",
                properties = {k: types.Schema(type="STRING", description=v["description"])
                              for k, v in schema["properties"].items()},
                required   = schema["required"],
            ) if schema["properties"] else None,
        ))
    config = types.GenerateContentConfig(
        temperature = temperature,
        top_p       = top_p,
        tools       = [types.Tool(function_declarations=declarations)],
        # we run the tools ourselves (in the sandbox), not the SDK
        automatic_function_calling = types.AutomaticFunctionCallingConfig(disable=True),
    )
    contents = [types.Content(role="user", parts=[types.Part.from_text(text=prompt)])]
    calls    = []
    model    = MODEL_MAP.get(model, model)

    for step in range(max_iter):
        response = with_retry(
            lambda: client.models.generate_content(model=model, contents=contents, config=config),
            f"Gemini ({model})")
        function_calls = response.function_calls or []
        if not function_calls:
            return (response.text or ""), calls

        contents.append(response.candidates[0].content)   # the model's request
        result_parts = []
        for fc in function_calls:
            args   = {k: str(v) for k, v in (fc.args or {}).items()}
            result = execute_tool(fc.name, args)
            calls.append({"tool": fc.name, "args": args, "result": result})
            result_parts.append(types.Part.from_function_response(
                name=fc.name, response={"result": result[:8000]},
            ))
        contents.append(types.Content(role="user", parts=result_parts))
        print(f"[LLM] Gemini tool step {step + 1}: {[c.name for c in function_calls]}")

    # Out of iterations — ask for a final answer without tools
    contents.append(types.Content(role="user", parts=[types.Part.from_text(
        text="Tool-call limit reached. Give your final answer now using the results above.")]))
    final = with_retry(lambda: client.models.generate_content(
        model=model, contents=contents,
        config=types.GenerateContentConfig(temperature=temperature, top_p=top_p),
    ), f"Gemini ({model})")
    return (final.text or ""), calls


def _groq_tool_loop(prompt, model, temperature, top_p, tool_specs, execute_tool, max_iter):
    from groq import Groq

    client = Groq(api_key=settings.GROQ_API_KEY)
    tools  = [{"type": "function", "function": {
                 "name": s["name"], "description": s["description"],
                 "parameters": _json_schema(s)}} for s in tool_specs]
    model    = model if model in GROQ_TOOL_MODELS else GROQ_TOOL_MODELS[0]
    messages = [{"role": "user", "content": prompt}]
    calls    = []

    for step in range(max_iter):
        response = client.chat.completions.create(
            model=model, messages=messages, tools=tools, tool_choice="auto",
            temperature=temperature, top_p=top_p, max_tokens=2048,
        )
        msg = response.choices[0].message
        if not msg.tool_calls:
            return (msg.content or ""), calls

        messages.append({
            "role": "assistant", "content": msg.content or "",
            "tool_calls": [{"id": tc.id, "type": "function",
                            "function": {"name": tc.function.name,
                                         "arguments": tc.function.arguments}}
                           for tc in msg.tool_calls],
        })
        for tc in msg.tool_calls:
            try:
                args = {k: str(v) for k, v in json.loads(tc.function.arguments or "{}").items()}
            except Exception:
                args = {}
            result = execute_tool(tc.function.name, args)
            calls.append({"tool": tc.function.name, "args": args, "result": result})
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": result[:8000]})
        print(f"[LLM] Groq tool step {step + 1}: {[tc.function.name for tc in msg.tool_calls]}")

    messages.append({"role": "user",
                     "content": "Tool-call limit reached. Give your final answer now using the results above."})
    final = client.chat.completions.create(
        model=model, messages=messages, temperature=temperature, top_p=top_p, max_tokens=2048,
    )
    return (final.choices[0].message.content or ""), calls


def call_llm_with_tools(agent, input_text: str, guardrail_text: str, context_text: str,
                        tool_specs: list, execute_tool, workflow_vars: dict = None) -> tuple:
    """
    Agentic entry point used when an agent has tools attached.
    Gemini agents use Gemini; Groq agents use a Groq model that supports tools.
    If the chosen provider fails BEFORE any tool ran, the other provider is tried.
    Once a tool has run, we never start over on another provider — that would
    repeat side effects (a second commit, a duplicate ticket).
    """
    ran = {"count": 0}

    def counted_execute(name, args):
        ran["count"] += 1
        return execute_tool(name, args)

    prompt = build_agent_prompt(agent, input_text, guardrail_text, context_text, workflow_vars)
    prompt = f"{TOOL_USE_INSTRUCTIONS}\n\n{prompt}"
    engine      = (agent.ai_engine or "gemini").lower()
    model       = agent.model or ("gemini-2.5-flash" if engine == "gemini" else GROQ_TOOL_MODELS[0])
    temperature = agent.temperature if agent.temperature is not None else 0.7
    top_p       = agent.top_p       if agent.top_p       is not None else 0.9
    max_iter    = max(1, min(agent.max_iterations or 5, 10))

    order = ["groq", "gemini"] if engine == "groq" else ["gemini", "groq"]
    last_error = None
    for provider in order:
        try:
            if provider == "gemini" and settings.GEMINI_API_KEY:
                use_model = model if engine == "gemini" else "gemini-2.5-flash"
                print(f"[LLM] Tool-calling with Gemini / {use_model} (max {max_iter} steps)")
                return _gemini_tool_loop(prompt, use_model, temperature, top_p,
                                         tool_specs, counted_execute, max_iter)
            if provider == "groq" and settings.GROQ_API_KEY:
                print(f"[LLM] Tool-calling with Groq (max {max_iter} steps)")
                return _groq_tool_loop(prompt, model, temperature, top_p,
                                       tool_specs, counted_execute, max_iter)
        except Exception as e:
            if getattr(e, "forge_stop", False):     # user pressed Cancel
                raise
            last_error = e
            print(f"[LLM] Tool-calling with {provider} failed: {e}")
            if ran["count"]:
                raise ToolsAlreadyRan(
                    f"{provider} failed after {ran['count']} tool call(s) had already run: {e}")
    raise RuntimeError(f"Tool-calling failed on all providers: {last_error}")
