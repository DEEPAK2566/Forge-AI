"""
Tool Sandbox — runs ONE tool inside a separate Python process.

tool_runner.py starts this file with `python -I tool_sandbox.py`, sends a JSON
message on stdin, and reads one JSON line back from stdout.

Why a separate process?
  - The tool cannot see the server's secrets (DATABASE_URL, GEMINI_API_KEY...):
    this process is started with a minimal environment that only contains the
    workflow's own inputs.
  - A tool that hangs or loops forever is killed by the timeout in tool_runner.
  - Two workflows running tools at the same time no longer overwrite each
    other's environment variables.

Input (stdin):  {"code": "...", "tool_class": "GitHubWriterTool", "input": {...}}
Output (stdout, last line): {"ok": true, "output": "..."} or {"ok": false, "error": "..."}

This file must NOT import anything from `app`, so it never loads the server's config.
"""

import sys
import json
import inspect
import importlib
import traceback

RESULT_MARKER = "__FORGE_TOOL_RESULT__"


def _emit(payload: dict):
    # Tools may print() their own debug lines; our result is the last marked line.
    sys.stdout.write(RESULT_MARKER + json.dumps(payload) + "\n")
    sys.stdout.flush()


def main():
    try:
        message    = json.loads(sys.stdin.read())
        code       = message["code"]
        class_name = (message.get("tool_class") or "").strip()
        input_data = message.get("input") or {}
    except Exception as e:
        _emit({"ok": False, "error": f"Sandbox could not read its input: {e}"})
        return

    # Same convenience pre-loads the old runner offered
    namespace = {"__builtins__": __builtins__}
    for mod_name in ["os", "requests", "json", "base64", "re", "datetime", "time"]:
        try:
            namespace[mod_name] = importlib.import_module(mod_name)
        except ImportError:
            pass
    try:
        from pydantic import BaseModel, Field
        from typing import Optional, List, Dict, Any, Union
        namespace.update({
            "BaseModel": BaseModel, "Field": Field, "Optional": Optional,
            "List": List, "Dict": Dict, "Any": Any, "Union": Union,
        })
    except ImportError:
        pass

    try:
        exec(code, namespace)

        # Find the tool class: by name first, otherwise the first class with run()
        tool_class = namespace.get(class_name) if class_name else None
        if tool_class is None:
            for name, obj in namespace.items():
                if (isinstance(obj, type) and not name.startswith("_")
                        and name not in ("BaseModel", "Field")
                        and callable(getattr(obj, "run", None))):
                    tool_class = obj
                    break
        if tool_class is None:
            _emit({"ok": False, "error":
                   f"Class '{class_name}' not found in tool code. "
                   f"Make sure the 'Tool Class' field matches the class name exactly."})
            return

        instance = tool_class()

        # Pass run() parameters whose names exactly match input keys
        params = list(inspect.signature(instance.run).parameters)
        kwargs = {p: input_data[p] for p in params if input_data.get(p)}

        result = instance.run(**kwargs)
        _emit({"ok": True, "output": str(result)})

    except Exception as e:
        _emit({"ok": False, "error": f"{class_name or 'Tool'} failed: {e}",
               "trace": traceback.format_exc()[-2000:]})


if __name__ == "__main__":
    main()
