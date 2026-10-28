from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.agent import Agent
from app.models.user import User
from app.schemas.agent import AgentCreate, AgentUpdate, AgentOut
from app.api.v1.auth import get_current_user
from app.models.execution import ExecutionLog

# prefix="/agents" means all routes here start with /agents1
router = APIRouter(prefix="/agents", tags=["Agents"])


@router.post("/", response_model=AgentOut, status_code=201)
def create_agent(
    data: AgentCreate,
    db:   Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    POST /agents/
    Creates a new agent linked to the logged-in user.
    **data.model_dump() unpacks all fields from the schema into keyword arguments.
    """
    agent = Agent(user_id=current_user.id, **data.model_dump())
    db.add(agent)
    db.commit()
    db.refresh(agent)   # reload to get auto-generated id and created_at
    return agent


@router.get("/", response_model=List[AgentOut])
def list_agents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    GET /agents/
    Returns all agents that belong to the logged-in user.
    .filter() ensures users only see their own agents.
    .order_by(desc) shows newest first.
    """
    return (
        db.query(Agent)
        .filter(Agent.user_id == current_user.id)
        .order_by(Agent.created_at.desc())
        .all()
    )


@router.get("/count")
def count_agents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    GET /agents/count
    Returns just the number — used by MySpace dashboard stats.
    Faster than fetching all agents just to count them.
    """
    count = db.query(Agent).filter(Agent.user_id == current_user.id).count()
    return {"count": count}


@router.get("/{agent_id}", response_model=AgentOut)
def get_agent(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    GET /agents/{id}
    Returns one agent by ID.
    Checks both agent_id AND user_id — so a user cannot access another user's agents.
    """
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.user_id == current_user.id
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.put("/{agent_id}", response_model=AgentOut)
def update_agent(
    agent_id: int,
    data: AgentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    PUT /agents/{id}
    Updates only the fields that were sent.
    exclude_unset=True means: only include fields the user explicitly provided.
    """
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.user_id == current_user.id
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(agent, key, value)  # setattr = set a Python attribute dynamically

    db.commit()
    db.refresh(agent)
    return agent

@router.delete("/{agent_id}", status_code=204)
def delete_agent(agent_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.user_id == current_user.id
    ).first()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Delete any execution_logs that reference this agent
    db.query(ExecutionLog).filter(ExecutionLog.agent_id == agent_id).delete(synchronize_session=False)

    db.delete(agent)
    db.commit()
    return None