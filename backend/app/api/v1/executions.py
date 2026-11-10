import json
import asyncio
import threading
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, Body, Request
from fastapi.responses import StreamingResponse
from jose import JWTError
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db, SessionLocal
from app.models.execution import Execution, ExecutionLog, ExecutionEvent
from app.models.workflow import Workflow
from app.models.user import User
from app.schemas.execution import ExecutionOut, RunRequest, ExecutionSummary, HistoryPage
from app.api.v1.auth import get_current_user, oauth2_scheme
from app.services.auth_service import decode_access_token
from app.services.execution_engine import run_workflow
from app.services.guardrail_service import redact_secrets
from app.services.events import emit

router = APIRouter(prefix="/executions", tags=["Executions"])

FINISHED = ("completed", "failed", "cancelled", "interrupted")


def _redact_run_input(user_input: str) -> str:
    """
    What we STORE about the Run-window input: credentials replaced by [REDACTED].
    The real values are only passed to the running workflow in memory.
    """
    from app.services.tool_runner import is_secret_name
    try:
        data = json.loads(user_input or "")
        if isinstance(data, dict):
            return json.dumps({k: ("[REDACTED]" if is_secret_name(k) else redact_secrets(str(v)))
                               for k, v in data.items()})
    except Exception:
        pass
    return redact_secrets(user_input or "")


@router.post("/run/{workflow_id}", response_model=ExecutionOut, status_code=201)
def start_execution(
    workflow_id:  int,
    payload:      Optional[RunRequest] = Body(None),
    user_input:   str = "",
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """
    POST /executions/run/{workflow_id}     body: {"user_input": "..."}

    The input goes in the request BODY (not the URL), because URLs are written to
    server and proxy logs — and the input often contains tokens.
    (?user_input=... still works for old clients.)

    Creates an execution record, starts the workflow in a background thread and
    returns immediately. The monitor then follows GET /executions/{id}/stream.
    """
    raw_input = payload.user_input if payload is not None else user_input

    workflow = db.query(Workflow).filter(
        Workflow.id == workflow_id,
        Workflow.user_id == current_user.id
    ).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    execution = Execution(
        user_id       = current_user.id,
        workflow_id   = workflow_id,
        workflow_name = workflow.name,
        user_input    = _redact_run_input(raw_input),   # stored WITHOUT secrets
        status        = "pending",
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)

    exec_id = execution.id
    print(f"[API] Created execution {exec_id} for workflow '{workflow.name}'")

    # The real input (with tokens) goes to the engine in memory only
    thread = threading.Thread(
        target = run_workflow,
        args   = (exec_id, workflow_id, raw_input),
        daemon = True,
    )
    thread.start()

    execution.logs = []
    return execution


@router.post("/{execution_id}/cancel", response_model=ExecutionOut)
def cancel_execution(
    execution_id: int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """
    POST /executions/{id}/cancel
    Asks a running workflow to stop. The engine checks between steps, so the agent
    that is mid-answer finishes its current model call, then the run stops.
    """
    execution = db.query(Execution).filter(
        Execution.id == execution_id, Execution.user_id == current_user.id
    ).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    if execution.status in ("pending", "running"):
        execution.status = "cancelling"
        db.commit()
        emit(execution_id, "cancel_requested", message="Cancel requested — stopping after the current step")
    execution.logs = db.query(ExecutionLog).filter(
        ExecutionLog.execution_id == execution_id).order_by(ExecutionLog.id.asc()).all()
    return execution


@router.get("/{execution_id}/stream")
async def stream_execution(
    execution_id: int,
    request:      Request,
    after:        int = 0,
    token:        str = Depends(oauth2_scheme),
):
    """
    GET /executions/{id}/stream?after=<last event id>     (Server-Sent Events)

    Sends every event of this run as it happens:
        id: 42
        data: {"id": 42, "type": "tool_started", "agent_name": "Log Reader", ...}

    Replays everything after `after`, so a refresh or reconnect loses nothing.
    Ends a few seconds after the run finishes. Sends a heartbeat every 15s so
    proxies (Render, Vercel) don't close an idle connection.

    Uses a short database session per check — an open stream never holds a
    connection from the pool.
    """
    try:
        user_id = int(decode_access_token(token).get("sub"))
    except (JWTError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token. Please log in again.")

    def owns_it() -> bool:
        db = SessionLocal()
        try:
            return db.query(Execution.id).filter(
                Execution.id == execution_id, Execution.user_id == user_id).first() is not None
        finally:
            db.close()

    if not await asyncio.to_thread(owns_it):
        raise HTTPException(status_code=404, detail="Execution not found")

    def fetch(last_id: int):
        db = SessionLocal()
        try:
            rows = (db.query(ExecutionEvent)
                    .filter(ExecutionEvent.execution_id == execution_id, ExecutionEvent.id > last_id)
                    .order_by(ExecutionEvent.id.asc()).limit(200).all())
            status = db.query(Execution.status).filter(Execution.id == execution_id).scalar()
            return [{
                "id": r.id, "type": r.type, "node_id": r.node_id, "agent_name": r.agent_name,
                "message": r.message, "data": r.data or {},
                "created_at": r.created_at.isoformat() if r.created_at else None,
            } for r in rows], status
        finally:
            db.close()

    async def events():
        last_id, idle, finished_for = after, 0.0, 0.0
        yield "retry: 3000\n\n"                      # browser reconnect delay
        while True:
            if await request.is_disconnected():
                break
            rows, status = await asyncio.to_thread(fetch, last_id)
            for row in rows:
                last_id = row["id"]
                yield f"id: {row['id']}\ndata: {json.dumps(row)}\n\n"
            if rows:
                idle = 0.0
            if status in FINISHED and not rows:
                finished_for += 0.5
                if finished_for >= 2.0:              # give late events a moment, then close
                    yield f"event: end\ndata: {json.dumps({'status': status})}\n\n"
                    break
            idle += 0.5
            if idle >= 15:
                yield ": heartbeat\n\n"
                idle = 0.0
            await asyncio.sleep(0.5)

    return StreamingResponse(events(), media_type="text/event-stream", headers={
        "Cache-Control":     "no-cache",
        "X-Accel-Buffering": "no",                   # don't let proxies buffer the stream
    })


@router.get("/", response_model=List[ExecutionOut])
def list_executions(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
    limit:        int     = 20,
):
    """
    GET /executions/
    Returns recent executions for the dashboard Action Zone.
    """
    executions = (
        db.query(Execution)
        .filter(Execution.user_id == current_user.id)
        .order_by(Execution.started_at.desc())
        .limit(limit)
        .all()
    )
    for exe in executions:
        exe.logs = db.query(ExecutionLog).filter(
            ExecutionLog.execution_id == exe.id
        ).all()
    return executions


@router.get("/history", response_model=HistoryPage)
def execution_history(
    limit:        int = 25,
    offset:       int = 0,
    status:       str = "",
    workflow_id:  Optional[int] = None,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """
    GET /executions/history?limit=25&offset=0&status=failed&workflow_id=3

    Powers the Runs page. Returns run summaries WITHOUT agent outputs (those can
    be large), newest first, plus the total count for "Load more".
    Declared before /{execution_id} so "history" isn't read as an id.
    """
    limit = max(1, min(limit, 100))
    query = db.query(Execution).filter(Execution.user_id == current_user.id)
    if status:
        statuses = [s.strip() for s in status.split(",") if s.strip()]
        query = query.filter(Execution.status.in_(statuses))
    if workflow_id:
        query = query.filter(Execution.workflow_id == workflow_id)

    total = query.count()
    rows  = query.order_by(Execution.id.desc()).offset(max(0, offset)).limit(limit).all()

    # Agent-card count per run, in one query
    counts = dict(
        db.query(ExecutionLog.execution_id, func.count(ExecutionLog.id))
        .filter(ExecutionLog.execution_id.in_([r.id for r in rows] or [0]))
        .group_by(ExecutionLog.execution_id).all()
    )
    items = [ExecutionSummary(
        id=r.id, workflow_id=r.workflow_id, workflow_name=r.workflow_name, user_input=r.user_input,
        status=r.status, error=r.error, started_at=r.started_at, finished_at=r.finished_at,
        agents=counts.get(r.id, 0),
    ) for r in rows]
    return HistoryPage(items=items, total=total)


@router.get("/{execution_id}", response_model=ExecutionOut)
def get_execution(
    execution_id: int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """
    GET /executions/{id}
    Returns execution status + all agent logs (full inputs/outputs).
    The monitor calls it once on open and again whenever an agent finishes.
    """
    execution = db.query(Execution).filter(
        Execution.id      == execution_id,
        Execution.user_id == current_user.id,
    ).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")

    execution.logs = db.query(ExecutionLog).filter(
        ExecutionLog.execution_id == execution_id
    ).order_by(ExecutionLog.id.asc()).all()

    return execution


@router.get("/workflow/{workflow_id}", response_model=List[ExecutionOut])
def get_workflow_executions(
    workflow_id:  int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """GET /executions/workflow/{id} — all runs for a specific workflow."""
    executions = (
        db.query(Execution)
        .filter(
            Execution.workflow_id == workflow_id,
            Execution.user_id     == current_user.id,
        )
        .order_by(Execution.started_at.desc())
        .limit(10)
        .all()
    )
    for exe in executions:
        exe.logs = db.query(ExecutionLog).filter(
            ExecutionLog.execution_id == exe.id
        ).all()
    return executions
