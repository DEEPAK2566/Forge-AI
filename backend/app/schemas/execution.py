from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

class ExecutionLogOut(BaseModel):
    id:             int
    execution_id:   int
    node_id:        Optional[str]
    agent_id:       Optional[int]
    agent_name:     Optional[str]
    agent_emoji:    Optional[str]
    execution_type: Optional[str]
    status:         Optional[str]
    input:          Optional[str]
    output:         Optional[str]
    error:          Optional[str]
    tool_calls:     Optional[List[Any]] = []
    started_at:     Optional[datetime]
    finished_at:    Optional[datetime]
    model_config = {"from_attributes": True}

class RunRequest(BaseModel):
    """Body of POST /executions/run/{id}. The Run-window text or JSON of variables."""
    user_input: str = ""

class ExecutionOut(BaseModel):
    id:            int
    user_id:       int
    workflow_id:   Optional[int]
    workflow_name: Optional[str]
    user_input:    Optional[str]
    status:        Optional[str]
    error:         Optional[str]
    started_at:    Optional[datetime]
    finished_at:   Optional[datetime]
    logs:          Optional[List[ExecutionLogOut]] = []
    model_config = {"from_attributes": True}