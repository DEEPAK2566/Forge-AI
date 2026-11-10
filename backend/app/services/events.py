"""
Execution events — the live feed behind the Execution Monitor.

The engine calls emit() whenever something happens (an agent starts, a tool is
called, a tool fails, an agent finishes...). Each event is one row in the
execution_events table. GET /executions/{id}/stream watches that table and pushes
new rows to the browser, so the monitor updates the moment something happens.

Also here: cancellation. The Cancel button sets the execution's status to
"cancelling"; the engine calls check_cancelled() between steps and stops.
"""

from datetime import datetime, timezone

from app.core.database import SessionLocal
from app.models.execution import Execution, ExecutionEvent
from app.services.guardrail_service import redact_secrets


class RunCancelled(Exception):
    """Raised inside the engine when the user pressed Cancel."""
    forge_stop = True   # tells the LLM layer not to retry on another provider


def _clean(value, limit: int = 600):
    """Redact secrets and trim long text inside event data."""
    if isinstance(value, str):
        return redact_secrets(value)[:limit]
    if isinstance(value, dict):
        return {k: _clean(v, limit) for k, v in value.items()}
    if isinstance(value, list):
        return [_clean(v, limit) for v in value[:20]]
    return value


def emit(execution_id: int, type: str, node_id: str = None, agent_name: str = None,
         message: str = "", data: dict = None):
    """Save one event. Never raises — a lost event must not break a run."""
    db = SessionLocal()
    try:
        db.add(ExecutionEvent(
            execution_id = execution_id,
            type         = type,
            node_id      = node_id,
            agent_name   = agent_name,
            message      = redact_secrets(message or "")[:1000],
            data         = _clean(data or {}),
            created_at   = datetime.now(timezone.utc),
        ))
        db.commit()
    except Exception as e:
        print(f"[Events] could not save '{type}' event: {e}")
    finally:
        db.close()


def is_cancel_requested(execution_id: int) -> bool:
    db = SessionLocal()
    try:
        status = db.query(Execution.status).filter(Execution.id == execution_id).scalar()
        return status in ("cancelling", "cancelled")
    finally:
        db.close()


def check_cancelled(execution_id: int):
    """Call between steps: stops the run if the user pressed Cancel."""
    if is_cancel_requested(execution_id):
        raise RunCancelled()
