from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.workflow import Workflow
from app.models.user import User
from app.schemas.workflow import WorkflowCreate, WorkflowUpdate, WorkflowOut
from app.api.v1.auth import get_current_user
from app.models.execution import Execution, ExecutionLog, ExecutionEvent

router = APIRouter(prefix="/workflows", tags=["Workflows"])


@router.post("/", response_model=WorkflowOut, status_code=201)
def create_workflow(
    data: WorkflowCreate,
    db:   Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    POST /workflows/
    Saves a workflow including its full canvas state (nodes + edges).
    """
    workflow = Workflow(user_id=current_user.id, **data.model_dump())
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return workflow


@router.get("/", response_model=List[WorkflowOut])
def list_workflows(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """GET /workflows/ — all workflows for the logged-in user."""
    return (
        db.query(Workflow)
        .filter(Workflow.user_id == current_user.id)
        .order_by(Workflow.created_at.desc())
        .all()
    )


@router.get("/count")
def count_workflows(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """GET /workflows/count — for MySpace dashboard stats."""
    count = db.query(Workflow).filter(
        Workflow.user_id == current_user.id
    ).count()
    return {"count": count}


@router.get("/{workflow_id}", response_model=WorkflowOut)
def get_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    wf = db.query(Workflow).filter(
        Workflow.id == workflow_id,
        Workflow.user_id == current_user.id
    ).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return wf


@router.put("/{workflow_id}", response_model=WorkflowOut)
def update_workflow(
    workflow_id: int,
    data: WorkflowUpdate,
    db:   Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    PUT /workflows/{id}
    Updates workflow metadata and/or canvas state.
    Called every time user saves changes to the canvas.
    """
    wf = db.query(Workflow).filter(
        Workflow.id == workflow_id,
        Workflow.user_id == current_user.id
    ).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(wf, key, value)

    db.commit()
    db.refresh(wf)
    return wf

@router.delete("/{workflow_id}", status_code=204)
def delete_workflow(workflow_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    workflow = db.query(Workflow).filter(
        Workflow.id == workflow_id,
        Workflow.user_id == current_user.id
    ).first()

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Find all executions tied to this workflow
    execution_ids = [
        e.id for e in db.query(Execution.id).filter(Execution.workflow_id == workflow_id).all()
    ]

    if execution_ids:
        # Delete logs first (they reference execution_id)

                # Delete events and logs first (they reference execution_id)
        db.query(ExecutionEvent).filter(ExecutionEvent.execution_id.in_(execution_ids)).delete(synchronize_session=False)
        db.query(ExecutionLog).filter(ExecutionLog.execution_id.in_(execution_ids)).delete(synchronize_session=False)
        # Then delete the executions themselves
        db.query(Execution).filter(Execution.id.in_(execution_ids)).delete(synchronize_session=False)

    db.delete(workflow)
    db.commit()
    return None