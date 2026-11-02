from sqlalchemy import Column, Integer, String, Text, Float, JSON, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class Agent(Base):
    """
    The agents table in PostgreSQL.
    Each row = one agent a user created.
    user_id links the agent to whoever created it — users cannot see each other's agents.
    """
    __tablename__ = "agents"

    id      = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # ForeignKey("users.id") means: this column references the id column in the users table
    # index=True: makes looking up agents by user_id fast

    # ── Identity ─────────────────────────────────────
    name          = Column(String(200), nullable=False)    # required
    details       = Column(Text, nullable=True)
    avatar_emoji  = Column(String(10),  default="🤖")
    avatar_color  = Column(String(20),  default="#7C3AED")

    # ── Behaviour (the "brain" of the agent) ─────────
    role        = Column(String(500), nullable=True)   # e.g. "Senior Data Pipeline Analyst"
    goal        = Column(Text,        nullable=True)   # primary outcome
    backstory   = Column(Text,        nullable=True)   # context / background
    description = Column(Text,        nullable=True)   # full instructions with example

    # ── Categorization ────────────────────────────────
    practice_area = Column(String(100), nullable=True)
    # JSON column stores a Python list as JSON in PostgreSQL
    # e.g. ["classification", "retrieval", "generation"]
    good_at = Column(JSON, default=list)

    # ── LLM Config ────────────────────────────────────
    ai_engine          = Column(String(50),  default="gemini")
    model              = Column(String(100), default="gemini-1.5-flash")
    behavior_preset    = Column(String(50),  default="balanced")
    temperature        = Column(Float,   default=0.7)
    top_p              = Column(Float,   default=0.9)
    max_iterations     = Column(Integer, default=5)
    max_rpm            = Column(Integer, default=10)
    max_execution_time = Column(Integer, default=300)

    # ── Status ────────────────────────────────────────
    # draft = saved but not visible in Discover
    # published = visible to everyone in Discover
    tool_ids   = Column(JSON, default=list)   # list of tool IDs attached to this agent
    kb_ids     = Column(JSON, default=list)   # list of knowledge base IDs attached
    guardrail_ids = Column(JSON, default=list)   # list of guardrail IDs attached
    status     = Column(String(20), default="draft")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())