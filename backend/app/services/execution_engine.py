"""
Execution Engine — runs workflow graphs.

Flow:
1. Load workflow nodes + edges
2. Topological sort
3. Execute nodes in order
4. For each node: run tools first with REAL execution,
   then pass real tool output to the LLM
5. Pass each node's LLM output to its children as input
"""
import traceback
import json as _json
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, TimeoutError as _FutureTimeout

from app.core.database import SessionLocal
from app.models.execution import Execution, ExecutionLog
from app.models.agent import Agent
from app.models.workflow import Workflow
from app.services.llm_service import call_llm
from app.services.guardrail_service import (
    redact_secrets, load_guardrails, build_guardrail_prompt, check_output,
)

KB_CHUNKS_PER_KB = 4     # how many chunks to retrieve from each attached KB

# ── Helpers ───────────────────────────────────────────────────────────────────

def _mark_execution_failed(execution_id: int, error: str, db):
    exec_rec = db.query(Execution).filter(Execution.id == execution_id).first()
    if exec_rec:
        exec_rec.status      = "failed"
        exec_rec.error       = error
        exec_rec.finished_at = datetime.now(timezone.utc)
        db.commit()
    print(f"[Engine] Execution {execution_id} FAILED: {error}")


def _topological_sort(nodes: list, edges: list) -> list:
    if not nodes:
        return []
    in_degree = {n["id"]: 0 for n in nodes}
    outgoing  = {n["id"]: [] for n in nodes}
    for edge in edges:
        src = edge.get("source", "")
        tgt = edge.get("target", "")
        if src in in_degree and tgt in in_degree:
            in_degree[tgt] += 1
            outgoing[src].append(tgt)
    queue  = [nid for nid, deg in in_degree.items() if deg == 0]
    result = []
    while queue:
        current = queue.pop(0)
        result.append(current)
        for child in outgoing[current]:
            in_degree[child] -= 1
            if in_degree[child] == 0:
                queue.append(child)
    return result


def _get_incoming(node_id: str, edges: list) -> list:
    return [e["source"] for e in edges if e.get("target") == node_id]


def _build_tool_input(original_input: str, current_input: str) -> str:
    """
    Merge the original workflow input (credentials/variables) with the
    current agent input (data produced by previous agents) into one JSON.

    The merged JSON is what gets passed to each tool so it has access to
    both the user-supplied credentials AND the data it needs to process.

    Keys in the merged dict:
      - Everything from original_input JSON (github_token, jira_base_url, etc.)
      - 'content' = current_input  (data to write, process, or analyze)
      - 'query'   = current_input  (alias for reader tools)

    The tool_runner sets ALL these as env vars (uppercased) before calling run().
    The tool's run() method then reads them via os.environ.get().
    """
    merged = {}

    # Load credentials and variables from original workflow input
    if original_input:
        try:
            parsed = _json.loads(original_input.strip())
            if isinstance(parsed, dict):
                merged = {k: str(v).strip() for k, v in parsed.items() if v is not None}
        except Exception:
            pass

    # Inject current agent input as content and query
    if current_input and current_input.strip():
        merged["content"] = current_input.strip()
        if "query" not in merged:
            merged["query"] = current_input.strip()

    return _json.dumps(merged)


# ── Single node executor ──────────────────────────────────────────────────────

def _run_single_node(
    node:           dict,
    input_text:     str,
    execution_id:   int,
    position:       int,
    original_input: str = "",
) -> dict:

    node_id     = node["id"]
    agent_id    = node["data"].get("agent_id")
    agent_name  = node["data"].get("agent_name", "Unknown")
    agent_emoji = node["data"].get("avatar_emoji", "🤖")
    exec_type   = node["data"].get("execution_type", "sequential")

    db = SessionLocal()

    log = ExecutionLog(
        execution_id   = execution_id,
        node_id        = node_id,
        agent_id       = agent_id,
        agent_name     = agent_name,
        agent_emoji    = agent_emoji,
        execution_type = exec_type,
        status         = "running",
        input          = redact_secrets(input_text)[:3000],
        started_at     = datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    print(f"\n[Engine] ── Running: {agent_name} | exec_type: {exec_type}")

    try:
        from app.models.tools import Tool
        from app.models.knowledge_base import KnowledgeBase
        from app.services.tool_runner import run_tool, describe_tool, is_secret_name
        from app.services.rag_service import search_collection
        from app.services.llm_service import call_llm_with_tools

        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            raise ValueError(f"Agent ID {agent_id} not found")

        context_sections = []

        # ── 1. Knowledge bases: retrieve relevant chunks ──────────────────
        for kb_id in (agent.kb_ids or []):
            kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
            if not kb or not kb.collection_name:
                print(f"[Engine] KB {kb_id} not found — skipping")
                continue
            chunks = search_collection(kb.collection_name, input_text[:2000], KB_CHUNKS_PER_KB)
            print(f"[Engine] KB '{kb.name}': {len(chunks)} chunks retrieved")
            if chunks:
                numbered = "\n\n".join(f"[{i+1}] {c}" for i, c in enumerate(chunks))
                context_sections.append(
                    f"=== KNOWLEDGE BASE: {kb.name} (use this as reference, cite [n]) ===\n{numbered}"
                )

        # ── 2. Guardrails attached to this agent ──────────────────────────
        guardrails     = load_guardrails(db, getattr(agent, "guardrail_ids", None) or [])
        guardrail_text = build_guardrail_prompt(guardrails)
        if guardrails:
            print(f"[Engine] Guardrails applied: {[g.name for g in guardrails]}")

        # ── 3. Tools attached to this agent ───────────────────────────────
        tool_records = []
        for tool_id in (agent.tool_ids or []):
            t = db.query(Tool).filter(Tool.id == tool_id).first()
            if t:
                tool_records.append(t)
            else:
                print(f"[Engine] Tool ID {tool_id} not found — skipping")

        # Workflow inputs (credentials, variables) + content/query, as a dict
        base_tool_input = _json.loads(_build_tool_input(original_input, input_text))
        safe_input      = redact_secrets(input_text)
        tool_calls      = []
        display_names   = {}   # function name -> tool name, for the monitor

        def think():
            """Everything the LLM does for this node — runs under the time limit."""
            context = "\n\n".join(context_sections)

            if not tool_records:
                return call_llm(agent, safe_input, True, guardrail_text, context), []

            # ── 3a. Native tool calling: the LLM decides when/how to call ──
            try:
                auto_keys = {k for k in base_tool_input if k not in ("content", "query")}
                specs, by_name = [], {}
                for t in tool_records:
                    spec = describe_tool(t, auto_keys)
                    specs.append(spec)
                    by_name[spec["name"]] = t
                    display_names[spec["name"]] = t.name
                print(f"[Engine] Tools offered to LLM: {[s['name'] for s in specs]}")

                def execute_tool(function_name: str, args: dict) -> str:
                    t = by_name.get(function_name)
                    if not t:
                        return _json.dumps({"error": True, "message": f"Unknown tool {function_name}"})
                    merged = dict(base_tool_input)
                    for k, v in args.items():
                        if not is_secret_name(k):        # the LLM may never set credentials
                            merged[k] = v
                    print(f"[Engine] LLM called {t.name} with {list(args.keys())}")
                    return redact_secrets(run_tool(t, _json.dumps(merged)))

                return call_llm_with_tools(agent, safe_input, guardrail_text, context,
                                           specs, execute_tool)

            # ── 3b. Fallback: old behaviour — run every tool first ────────
            except Exception as e:
                print(f"[Engine] Tool calling unavailable ({e}) — running tools up-front instead")
                calls, sections = [], list(context_sections)
                for t in tool_records:
                    out = redact_secrets(run_tool(t, _json.dumps(base_tool_input)))
                    calls.append({"tool": t.name, "args": {"mode": "pre-run"}, "result": out})
                    sections.append(
                        f"=== REAL OUTPUT FROM TOOL: {t.name} ===\n{out}\n"
                        f"(This tool has ALREADY been executed. Use its real output above. "
                        f"Do NOT write code to call it again and do NOT simulate it.)"
                    )
                return call_llm(agent, safe_input, True, guardrail_text,
                                "\n\n".join(sections)), calls

        # ── 4. Run it with a time limit (max_execution_time) ──────────────
        time_limit = agent.max_execution_time or 300
        pool = ThreadPoolExecutor(max_workers=1)
        future = pool.submit(think)
        try:
            output, tool_calls = future.result(timeout=time_limit)
        except _FutureTimeout:
            raise TimeoutError(f"Agent exceeded max execution time ({time_limit}s)")
        finally:
            pool.shutdown(wait=False)

        # Save every tool call (redacted, trimmed) for the Execution Monitor
        log.tool_calls = [
            {"tool": display_names.get(c["tool"], c["tool"]),
             "args": {k: redact_secrets(str(v))[:300] for k, v in c["args"].items()
                      if not is_secret_name(k)},
             "result": redact_secrets(c["result"])[:1500]}
            for c in tool_calls
        ]

        # ── 5. Enforce BLOCK: rules in code, then redact before saving ────
        allowed, reason = check_output(guardrails, output)
        if not allowed:
            raise ValueError(reason)
        output = redact_secrets(output)

        log.status      = "completed"
        log.output      = output[:5000]
        log.finished_at = datetime.now(timezone.utc)
        db.commit()

        print(f"[Engine] ✓ {agent_name} completed ({len(output)} chars)")
        return {"node_id": node_id, "output": output, "success": True}

    except Exception as e:
        tb = traceback.format_exc()
        print(f"[Engine] ✗ {agent_name} failed:\n{tb}")
        log.status      = "failed"
        log.error       = str(e)
        log.finished_at = datetime.now(timezone.utc)
        db.commit()
        return {"node_id": node_id, "output": "", "success": False, "error": str(e)}

    finally:
        db.close()

# ── Graph helpers: branch conditions, skipped nodes, loops ────────────────────

from app.core.config import settings

# Limits come from backend/.env (or Render → Environment), with these defaults:
#   MAX_PARALLEL_AGENTS = 0   → no limit: every ready agent runs at once
#   MAX_LOOP_ITERATIONS = 50  → highest "Max loops" a Loop node may use
DEFAULT_LOOPS = 3


def _edge_condition(edge: dict) -> str:
    return ((edge.get("data") or {}).get("condition") or "").strip()


def _active_children(output: str, out_edges: list) -> set:
    """
    Decide which outgoing connections fire after a node finishes.

    Condition on a connection (set by clicking the connection in the builder):
      ""                  → always runs
      "FAILED"            → runs if the output contains FAILED (case-insensitive)
      "FAILED | ERROR"    → runs if the output contains FAILED or ERROR
      "else"              → runs only if no other condition matched
    """
    text      = (output or "").lower()
    active    = set()
    matched   = False
    else_ones = []
    for e in out_edges:
        cond = _edge_condition(e)
        if not cond:
            active.add(e["target"])
        elif cond.lower() == "else":
            else_ones.append(e["target"])
        elif any(alt.strip().lower() in text for alt in cond.split("|") if alt.strip()):
            active.add(e["target"])
            matched = True
    if not matched:
        active.update(else_ones)
    return active


def _log_skipped(node: dict, execution_id: int, reason: str):
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        db.add(ExecutionLog(
            execution_id   = execution_id,
            node_id        = node["id"],
            agent_id       = node["data"].get("agent_id"),
            agent_name     = node["data"].get("agent_name", "Unknown"),
            agent_emoji    = node["data"].get("avatar_emoji", "🤖"),
            execution_type = node["data"].get("execution_type", "sequential"),
            status         = "skipped",
            output         = reason,
            started_at     = now,
            finished_at    = now,
        ))
        db.commit()
    finally:
        db.close()


def _run_node(node: dict, input_text: str, execution_id: int, position: int, original_input: str) -> dict:
    """Run a node once — or, for loop nodes, repeatedly until the stop text appears."""
    if node["data"].get("execution_type") != "loop":
        return _run_single_node(node, input_text, execution_id, position, original_input)

    until     = str(node["data"].get("loop_until") or "").strip()
    try:
        max_loops = int(node["data"].get("max_loops") or DEFAULT_LOOPS)
    except (TypeError, ValueError):
        max_loops = DEFAULT_LOOPS
    max_loops = max(1, min(max_loops, settings.MAX_LOOP_ITERATIONS))
    name   = node["data"].get("agent_name", "Agent")
    result = None
    current_input = input_text

    for i in range(1, max_loops + 1):
        loop_node = {**node, "data": {**node["data"], "agent_name": f"{name} (loop {i}/{max_loops})"}}
        result = _run_single_node(loop_node, current_input, execution_id, position, original_input)
        if not result["success"]:
            return result
        if until and until.lower() in result["output"].lower():
            print(f"[Engine] Loop '{name}' finished at iteration {i} (found '{until}')")
            return result
        current_input = (
            f"{input_text}\n\n=== YOUR PREVIOUS ATTEMPT (iteration {i}) ===\n{result['output']}\n\n"
            f"Review and improve your previous attempt."
            + (f" When it fully satisfies the task, include the word {until} in your answer." if until else "")
        )
    print(f"[Engine] Loop '{name}' stopped at max {max_loops} iterations")
    return result


# ── Main workflow runner ──────────────────────────────────────────────────────

def run_workflow(execution_id: int, workflow_id: int, user_input: str):
    """
    Runs the workflow graph wave by wave:
      - a node is READY when every node feeding into it has finished or been skipped
      - all ready nodes run at the same time (PARALLEL; no limit unless MAX_PARALLEL_AGENTS is set)
      - a node with several inputs receives all of them combined (MERGE)
      - connection conditions decide which children run (BRANCH); the rest are skipped
      - loop nodes repeat on their own output (LOOP)
    """
    db = SessionLocal()
    try:
        print(f"\n[Engine] ═══ Execution {execution_id} starting ═══")

        exec_rec = db.query(Execution).filter(Execution.id == execution_id).first()
        if not exec_rec:
            return
        exec_rec.status = "running"
        db.commit()

        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if not workflow:
            _mark_execution_failed(execution_id, "Workflow not found", db)
            return

        nodes = workflow.nodes or []
        edges = [e for e in (workflow.edges or []) if e.get("source") and e.get("target")]
        if not nodes:
            _mark_execution_failed(execution_id, "Workflow has no agents", db)
            return
        db.close()

        node_map = {n["id"]: n for n in nodes}
        edges    = [e for e in edges if e["source"] in node_map and e["target"] in node_map]
        if len(_topological_sort(nodes, edges)) != len(nodes):
            db = SessionLocal()
            _mark_execution_failed(
                execution_id,
                "The workflow has a cycle. Use a Loop node to repeat an agent instead of connecting back.",
                db)
            return

        parents   = {nid: [e["source"] for e in edges if e["target"] == nid] for nid in node_map}
        out_edges = {nid: [e for e in edges if e["source"] == nid] for nid in node_map}
        print(f"[Engine] '{workflow.name}' | {len(nodes)} nodes | {len(edges)} edges")

        outputs   = {}        # node_id -> output text
        state     = {}        # node_id -> "done" | "skipped"
        fired     = set()     # (source, target) connections that fired
        remaining = list(node_map)   # keeps canvas order for ties
        position  = 0

        while remaining:
            ready = [nid for nid in remaining if all(p in state for p in parents[nid])]
            if not ready:
                break

            to_run = []
            for nid in ready:
                remaining.remove(nid)
                node = node_map[nid]
                ps   = parents[nid]
                if not ps:
                    to_run.append((node, user_input or "Begin."))
                    continue
                live = [p for p in ps if (p, nid) in fired]
                if not live:
                    state[nid] = "skipped"
                    _log_skipped(node, execution_id, "Skipped — no incoming branch condition matched.")
                    print(f"[Engine] ↷ {node['data'].get('agent_name')} skipped")
                    continue
                if len(live) == 1:
                    input_text = outputs[live[0]]
                else:   # MERGE: combine every input that reached this node
                    input_text = "\n\n---\n\n".join(
                        f"Result from {node_map[p]['data'].get('agent_name', p)}:\n{outputs[p]}"
                        for p in live
                    )
                to_run.append((node, input_text))

            if not to_run:
                continue

            names = [n["data"].get("agent_name") for n, _ in to_run]
            print(f"[Engine] ▶ Wave: {names}" + (" (parallel)" if len(to_run) > 1 else ""))

            results = []
            if len(to_run) == 1:
                node, inp = to_run[0]
                results.append((node, _run_node(node, inp, execution_id, position, user_input or "")))
            else:
                limit   = settings.MAX_PARALLEL_AGENTS
                workers = len(to_run) if limit <= 0 else min(limit, len(to_run))
                with ThreadPoolExecutor(max_workers=workers) as pool:
                    futures = [(node, pool.submit(_run_node, node, inp, execution_id,
                                                  position + i, user_input or ""))
                               for i, (node, inp) in enumerate(to_run)]
                    results = [(node, f.result()) for node, f in futures]
            position += len(to_run)

            failed = [(n, r) for n, r in results if not r["success"]]
            if failed:
                node, r = failed[0]
                db = SessionLocal()
                _mark_execution_failed(
                    execution_id,
                    f"Agent '{node['data'].get('agent_name', node['id'])}' failed: {r.get('error', 'Unknown')}",
                    db)
                return

            for node, r in results:
                nid = node["id"]
                outputs[nid] = r["output"]
                state[nid]   = "done"
                for target in _active_children(r["output"], out_edges[nid]):
                    fired.add((nid, target))

        db = SessionLocal()
        exec_rec = db.query(Execution).filter(Execution.id == execution_id).first()
        if exec_rec:
            exec_rec.status      = "completed"
            exec_rec.finished_at = datetime.now(timezone.utc)
            db.commit()
        print(f"[Engine] ═══ Execution {execution_id} COMPLETED ═══\n")

    except Exception as e:
        print(f"[Engine] UNEXPECTED ERROR:\n{traceback.format_exc()}")
        try:
            db = SessionLocal()
            _mark_execution_failed(execution_id, f"Unexpected: {str(e)}", db)
        except Exception:
            pass
    finally:
        try:
            db.close()
        except Exception:
            pass