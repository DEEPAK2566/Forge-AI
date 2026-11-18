from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.tools import Tool
from app.models.user import User
from app.schemas.tools import ToolCreate, ToolUpdate, ToolOut
from app.api.v1.auth import get_current_user
from app.services.sharing import clone_row

router = APIRouter(prefix="/tools", tags=["Tools"])


@router.post("/", response_model=ToolOut, status_code=201)
def create_tool(
    data: ToolCreate,
    db:   Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    POST /tools/
    Saves a new tool (name + description + Python code) to the database.
    """
    tool = Tool(user_id=current_user.id, **data.model_dump())
    db.add(tool)
    db.commit()
    db.refresh(tool)
    return tool


@router.get("/", response_model=List[ToolOut])
def list_tools(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """GET /tools/ — all tools belonging to the logged-in user."""
    return (
        db.query(Tool)
        .filter(Tool.user_id == current_user.id)
        .order_by(Tool.created_at.desc())
        .all()
    )


@router.get("/count")
def count_tools(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """GET /tools/count — for dashboard stats."""
    count = db.query(Tool).filter(Tool.user_id == current_user.id).count()
    return {"count": count}


@router.get("/{tool_id}", response_model=ToolOut)
def get_tool(
    tool_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tool = db.query(Tool).filter(
        Tool.id == tool_id,
        Tool.user_id == current_user.id
    ).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool


@router.put("/{tool_id}", response_model=ToolOut)
def update_tool(
    tool_id: int,
    data: ToolUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tool = db.query(Tool).filter(
        Tool.id == tool_id,
        Tool.user_id == current_user.id
    ).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(tool, key, value)

    db.commit()
    db.refresh(tool)
    return tool


@router.delete("/{tool_id}", status_code=204)
def delete_tool(
    tool_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tool = db.query(Tool).filter(
        Tool.id == tool_id,
        Tool.user_id == current_user.id
    ).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    db.delete(tool)
    db.commit()


@router.post("/{tool_id}/clone", response_model=ToolOut, status_code=201)
def clone_tool(
    tool_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    POST /tools/{id}/clone
    Copies your own or someone else's PUBLISHED tool into your account as a draft
    named "<name> (copy)". You edit the copy; the original stays untouched.
    """
    return clone_row(db, Tool, tool_id, current_user)
