"""
LLM Service — uses the new google-genai SDK (replaces deprecated google-generativeai).
Free models: gemini-2.0-flash (default), gemini-1.5-flash, gemini-1.5-pro
"""

from app.core.config import settings


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


def build_agent_prompt(agent, input_text: str, guardrail_text: str = "", context_text: str = "") -> str:
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
    # Try to parse input as JSON variable map
    variables    = {}
    display_input = input_text or ''

    try:
        parsed = json.loads(input_text or '{}')
        if isinstance(parsed, dict) and parsed:
            variables     = parsed
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
                temperature: float = 0.7, top_p: float = 0.9) -> str:    """
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
                response = client.models.generate_content(
                    model    = candidate,
                    contents = prompt,
                    config = gen_config
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
             guardrail_text: str = "", context_text: str = "") -> str:
    """
    Main entry point — routes to the right LLM based on agent config.

    guardrail_text : rules from attached guardrails (top of the prompt)
    context_text   : knowledge-base chunks + real tool outputs
    fallback=True  : if the primary LLM fails, tries the other one.
    """
    prompt = build_agent_prompt(agent, input_text, guardrail_text, context_text)
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