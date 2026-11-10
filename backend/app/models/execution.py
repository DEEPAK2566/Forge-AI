from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.core.database import Base

class Execution(Base):
    """
    One record per workflow run.
    
        status flow:  pending → running → completed
                                   → failed
                                   → cancelling → cancelled   (Cancel button)
                                   → interrupted              (server restarted mid-run)
    
    The actual per-agent logs are in ExecutionLog.
    """
    __tablename__ = "executions"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    workflow_id   = Column(Integer, ForeignKey("workflows.id"), nullable=True)
    workflow_name = Column(String(200), nullable=True)

    # The text the user typed before clicking Run
    user_input    = Column(Text, nullable=True)

    # Overall execution status
    status        = Column(String(20), default="pending")
    error         = Column(Text, nullable=True)

    started_at    = Column(DateTime(timezone=True), server_default=func.now())
    finished_at   = Column(DateTime(timezone=True), nullable=True)


class ExecutionLog(Base):
    """
    One record per agent run within an execution.
    Stores input, output, status, and timing for each agent node.
    """
    __tablename__ = "execution_logs"

    id             = Column(Integer, primary_key=True, index=True)
    execution_id   = Column(Integer, ForeignKey("executions.id"), nullable=False, index=True)

    node_id        = Column(String(100), nullable=True)  # React Flow node ID
    agent_id       = Column(Integer, nullable=True)
    agent_name     = Column(String(200), nullable=True)
    agent_emoji    = Column(String(10),  nullable=True)
    execution_type = Column(String(50),  nullable=True)

    status         = Column(String(20), default="pending")
    input          = Column(Text, nullable=True)
    output         = Column(Text, nullable=True)
    error          = Column(Text, nullable=True)
     # Every tool the LLM called: [{"tool", "args", "result"}]
    tool_calls     = Column(JSON, default=list)


    started_at     = Column(DateTime(timezone=True), nullable=True)
    finished_at    = Column(DateTime(timezone=True), nullable=True)


class ExecutionEvent(Base):
    """
    Live feed of what happened during a run, in order:
    node started, tool called, tool failed, node finished, run cancelled...

    The engine writes one row per event; GET /executions/{id}/stream sends new
    rows to the browser as they appear. Stored in the database (not memory) so a
    page refresh or a second browser tab can replay the whole run.
    """
    __tablename__ = "execution_events"

    id           = Column(Integer, primary_key=True, index=True)
    execution_id = Column(Integer, ForeignKey("executions.id"), nullable=False, index=True)
    type         = Column(String(40), nullable=False)      # e.g. tool_started, node_completed
    node_id      = Column(String(100), nullable=True)
    agent_name   = Column(String(200), nullable=True)
    message      = Column(Text, nullable=True)             # short human-readable line
    data         = Column(JSON, default=dict)              # details (tool args, status...)
    created_at   = Column(DateTime(timezone=True), nullable=True)