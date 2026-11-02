from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class AgentCreate(BaseModel):
    """
    Shape of data the frontend sends when creating an agent.
    Optional fields have defaults — only name is truly required.
    """
    name:               str
    details:            Optional[str]       = None
    avatar_emoji:       Optional[str]       = "🤖"
    avatar_color:       Optional[str]       = "#7C3AED"
    role:               Optional[str]       = None
    goal:               Optional[str]       = None
    backstory:          Optional[str]       = None
    description:        Optional[str]       = None
    practice_area:      Optional[str]       = None
    good_at:            Optional[List[str]] = []
    ai_engine:          Optional[str]       = "gemini"
    model:              Optional[str]       = "gemini-1.5-flash"
    behavior_preset:    Optional[str]       = "balanced"
    temperature:        Optional[float]     = 0.7
    top_p:              Optional[float]     = 0.9
    max_iterations:     Optional[int]       = 5
    max_rpm:            Optional[int]       = 10
    max_execution_time: Optional[int]       = 300
    status:             Optional[str]       = "draft"
    tool_ids: Optional[List[int]] = []
    kb_ids:   Optional[List[int]] = []

class AgentUpdate(BaseModel):
    """
    For updates — every field is optional.
    Only the fields you send get updated. 
    If you don't send temperature, the existing temperature stays.
    """
    name:               Optional[str]       = None
    details:            Optional[str]       = None
    avatar_emoji:       Optional[str]       = None
    avatar_color:       Optional[str]       = None
    role:               Optional[str]       = None
    goal:               Optional[str]       = None
    backstory:          Optional[str]       = None
    description:        Optional[str]       = None
    practice_area:      Optional[str]       = None
    good_at:            Optional[List[str]] = None
    ai_engine:          Optional[str]       = None
    model:              Optional[str]       = None
    behavior_preset:    Optional[str]       = None
    temperature:        Optional[float]     = None
    top_p:              Optional[float]     = None
    max_iterations:     Optional[int]       = None
    max_rpm:            Optional[int]       = None
    max_execution_time: Optional[int]       = None
    status:             Optional[str]       = None
    tool_ids: Optional[List[int]] = None
    kb_ids:   Optional[List[int]] = None
    guardrail_ids: Optional[List[int]] = None

class AgentOut(BaseModel):
    """What we send back to the frontend — full agent data."""
    id:                 int
    user_id:            int
    name:               str
    details:            Optional[str]
    avatar_emoji:       Optional[str]
    avatar_color:       Optional[str]
    role:               Optional[str]
    goal:               Optional[str]
    backstory:          Optional[str]
    description:        Optional[str]
    practice_area:      Optional[str]
    good_at:            Optional[List[str]]
    ai_engine:          Optional[str]
    model:              Optional[str]
    behavior_preset:    Optional[str]
    temperature:        Optional[float]
    top_p:              Optional[float]
    max_iterations:     Optional[int]
    max_rpm:            Optional[int]
    max_execution_time: Optional[int]
    status:             Optional[str]
    created_at:         Optional[datetime]
    tool_ids: Optional[List[int]] = []
    kb_ids:   Optional[List[int]] = []
    guardrail_ids: Optional[List[int]] = []

    model_config = {"from_attributes": True}