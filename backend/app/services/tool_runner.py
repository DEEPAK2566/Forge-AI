"""
Tool Runner — generic executor for any FORGE tool.

This file knows NOTHING about specific tools (GitHub, Jira, Databricks etc).

What changed from the old version:
  OLD: exec() ran the tool's code INSIDE the FastAPI server process, and the
       inputs were written into the server's os.environ.
       → a tool could read DATABASE_URL / GEMINI_API_KEY,
       → a hanging tool froze the worker,
       → two runs at the same time overwrote each other's env vars.
  NEW: the code runs in a separate Python process (tool_sandbox.py) with
       - its own environment containing ONLY the workflow inputs (uppercased),
       - a hard timeout,
       - a temporary working folder.

Tools are written exactly as before: they still read os.environ.get("GITHUB_TOKEN")
and can still receive run() arguments that match input keys by exact name.
"""

import os
import sys
import json
import re
import tempfile
import subprocess

SANDBOX_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tool_sandbox.py")
RESULT_MARKER  = "__FORGE_TOOL_RESULT__"
TOOL_TIMEOUT_SECONDS = 60

# Only these server variables are passed through — the OS needs them to run Python
# and make HTTPS calls. Nothing from backend/.env is in this list.
_PASSTHROUGH_ENV = ["PATH", "SYSTEMROOT", "TEMP", "TMP", "LANG", "LC_ALL",
                    "SSL_CERT_FILE", "REQUESTS_CA_BUNDLE", "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY"]

# Never let a workflow input overwrite these
_FORBIDDEN_KEYS = {"PATH", "SYSTEMROOT", "PYTHONPATH", "PYTHONHOME", "LD_PRELOAD"}


def _error(message: str) -> str:
    return json.dumps({"error": True, "message": message})


def _call_sandbox(tool_record, input_data: dict, mode: str = "run"):
    """Start tool_sandbox.py and return its result dict (or None on crash/timeout)."""
    env = {k: os.environ[k] for k in _PASSTHROUGH_ENV if k in os.environ}
    for key, value in input_data.items():
        env_key = key.upper()
        if env_key not in _FORBIDDEN_KEYS:
            env[env_key] = value

    message = json.dumps({
        "code":       tool_record.code,
        "tool_class": tool_record.tool_class or "",
        "input":      input_data,
        "mode":       mode,
    })
    with tempfile.TemporaryDirectory(prefix="forge_tool_") as workdir:
        proc = subprocess.run(
            [sys.executable, "-I", SANDBOX_SCRIPT],   # -I = isolated mode
            input=message, capture_output=True, text=True, encoding="utf-8",
            env=env, cwd=workdir, timeout=TOOL_TIMEOUT_SECONDS,
        )
    result_line = None
    for line in (proc.stdout or "").splitlines():
        if line.startswith(RESULT_MARKER):
            result_line = line[len(RESULT_MARKER):]
    if result_line is None:
        return {"ok": False, "error": f"crashed without a result. {(proc.stderr or '')[-800:]}"}
    return json.loads(result_line)


# Parameter names the LLM must never fill in — credentials come from the
# workflow inputs (env vars), never from the model.
_SECRET_PARAM_HINTS = ("token", "password", "secret", "api_key", "apikey", "credential")


def is_secret_name(name: str) -> bool:
    lowered = (name or "").lower()
    return any(h in lowered for h in _SECRET_PARAM_HINTS)


def function_name_for(tool_record) -> str:
    """Tool name -> a valid function name for Gemini/Groq (letters, digits, _)."""
    base = re.sub(r"[^A-Za-z0-9_]", "_", (tool_record.name or "tool")).strip("_") or "tool"
    if not re.match(r"[A-Za-z_]", base[0]):
        base = "t_" + base
    return f"{base[:50]}_{tool_record.id}"


def describe_tool(tool_record, auto_keys: set) -> dict:
    """
    Build a function definition the LLM can call, from the tool's run() signature.

    auto_keys: input names FORGE already supplies (workflow inputs such as
               github_token, jira_base_url). These are hidden from the LLM.
    Returns {"name", "description", "params": [{"name", "required"}]}.
    """
    info = {"params": [], "doc": ""}
    try:
        result = _call_sandbox(tool_record, {}, mode="describe")
        if result.get("ok"):
            info = json.loads(result["output"])
    except Exception as e:
        print(f"[ToolRunner] describe failed for {tool_record.name}: {e}")

    params = []
    for p in info.get("params", []):
        if p["name"] in auto_keys or is_secret_name(p["name"]):
            continue
        params.append(p)

    description = (tool_record.description or "").strip()
    if info.get("doc"):
        description = f"{description}\n{info['doc']}".strip()
    return {
        "name":        function_name_for(tool_record),
        "description": (description or f"Run the {tool_record.name} tool.")[:1000],
        "params":      params,
    }


def run_tool(tool_record, input_text: str) -> str:
    """
    Execute a tool's Python code with the provided JSON input.

    tool_record : SQLAlchemy Tool object (.code, .tool_class, .name)
    input_text  : JSON string from the execution engine
                  (workflow variables + 'content' + 'query')

    Returns the tool's string output, or a JSON error message.
    """
    if not tool_record or not tool_record.code:
        return _error(f"Tool '{getattr(tool_record, 'name', '?')}' has no code saved.")

    name = tool_record.name
    print(f"\n[ToolRunner] ── Executing in sandbox: {name} (class: {tool_record.tool_class})")

    # ── 1. Parse JSON input ───────────────────────────────────────────────
    try:
        parsed = json.loads((input_text or "").strip())
        input_data = ({k: str(v).strip() for k, v in parsed.items() if v is not None}
                      if isinstance(parsed, dict) else {})
    except Exception:
        text = (input_text or "").strip()
        input_data = {"content": text, "query": text}
    print(f"[ToolRunner] Input keys: {list(input_data.keys())}")

    # ── 2. Run it in the sandbox process ──────────────────────────────────
    try:
        result = _call_sandbox(tool_record, input_data, mode="run")
    except subprocess.TimeoutExpired:
        print(f"[ToolRunner] ✗ {name} timed out after {TOOL_TIMEOUT_SECONDS}s")
        return _error(f"{name} timed out after {TOOL_TIMEOUT_SECONDS} seconds.")
    except Exception as e:
        return _error(f"Could not start sandbox for {name}: {e}")

    # ── 3. Return the output (or a JSON error) ────────────────────────────
    if result.get("ok"):
        output = result.get("output", "")
        print(f"[ToolRunner] ✓ {name} completed — {len(output)} chars")
        return output

    print(f"[ToolRunner] ✗ {name} error: {result.get('error')}\n{result.get('trace', '')}")
    return _error(f"{name}: {result.get('error', 'failed')}")
