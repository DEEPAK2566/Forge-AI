"""
Discover endpoints — returns published artifacts from all users.
This is the "marketplace" view — anyone logged in can browse everything published.

Every item also carries:
  owner_name  first name of the person who built it (shown on the card)
  is_mine     true if the logged-in user owns it → Edit / Delete; otherwise → Clone
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.agent import Agent
from app.models.workflow import Workflow
from app.models.tools import Tool
from app.models.knowledge_base import KnowledgeBase
from app.models.user import User
from app.models.execution import Execution
from app.schemas.agent import AgentOut
from app.schemas.workflow import WorkflowOut
from app.schemas.tools import ToolOut
from app.schemas.knowledge_base import KBOut
from app.api.v1.auth import get_current_user
from app.services.sharing import first_name

router = APIRouter(prefix="/discover", tags=["Discover"])


def _with_owner(rows, schema, db: Session, current_user: User) -> list:
    """Add owner_name and is_mine to each item (one query for all owners)."""
    owner_ids = {r.user_id for r in rows}
    owners = {u.id: u for u in db.query(User).filter(User.id.in_(owner_ids)).all()} if owner_ids else {}
    return [{**schema.model_validate(r).model_dump(),
             "owner_name": "You" if r.user_id == current_user.id else first_name(owners.get(r.user_id)),
             "is_mine": r.user_id == current_user.id}
            for r in rows]


@router.get("/agents", response_model=List[dict])
def discover_agents(
    search: str = "",
    limit:  int = 50,
    db:     Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    GET /discover/agents?search=...
    Returns all published agents from all users.
    The 'search' parameter filters by name (case-insensitive).
    """
    query = db.query(Agent).filter(Agent.status == "published")
    if search.strip():
        query = query.filter(Agent.name.ilike(f"%{search}%"))
    rows = query.order_by(Agent.created_at.desc()).limit(limit).all()
    return _with_owner(rows, AgentOut, db, current_user)


@router.get("/workflows", response_model=List[dict])
def discover_workflows(
    search: str = "",
    limit:  int = 50,
    db:     Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """GET /discover/workflows — all published workflows."""
    query = db.query(Workflow).filter(Workflow.status == "published")
    if search.strip():
        query = query.filter(Workflow.name.ilike(f"%{search}%"))
    rows = query.order_by(Workflow.created_at.desc()).limit(limit).all()
    return _with_owner(rows, WorkflowOut, db, current_user)


@router.get("/tools", response_model=List[dict])
def discover_tools(
    search: str = "",
    limit:  int = 50,
    db:     Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """GET /discover/tools — all published tools."""
    query = db.query(Tool).filter(Tool.status == "published")
    if search.strip():
        query = query.filter(Tool.name.ilike(f"%{search}%"))
    rows = query.order_by(Tool.created_at.desc()).limit(limit).all()
    return _with_owner(rows, ToolOut, db, current_user)


@router.get("/knowledge-bases", response_model=List[dict])
def discover_kbs(
    search: str = "",
    limit:  int = 50,
    db:     Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """GET /discover/knowledge-bases — all published knowledge bases."""
    query = db.query(KnowledgeBase).filter(KnowledgeBase.status == "published")
    if search.strip():
        query = query.filter(KnowledgeBase.name.ilike(f"%{search}%"))
    rows = query.order_by(KnowledgeBase.created_at.desc()).limit(limit).all()
    return _with_owner(rows, KBOut, db, current_user)


@router.get("/stats")
def discover_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    GET /discover/stats
    Published counts (top of Discover) + platform-wide totals (the highlight strip in My Space).
    """
    return {
        "agents":          db.query(Agent).filter(Agent.status == "published").count(),
        "workflows":       db.query(Workflow).filter(Workflow.status == "published").count(),
        "tools":           db.query(Tool).filter(Tool.status == "published").count(),
        "knowledge_bases": db.query(KnowledgeBase).filter(KnowledgeBase.status == "published").count(),
        # everything built by everyone (drafts included) — "N agents built on this platform"
        "platform": {
            "agents":    db.query(Agent).count(),
            "workflows": db.query(Workflow).count(),
            "tools":     db.query(Tool).count(),
            "runs":      db.query(Execution).count(),
            "builders":  db.query(User).count(),
        },
    }