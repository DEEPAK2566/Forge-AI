from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import test_connection, engine, Base
from contextlib import asynccontextmanager
import asyncio

# Import ALL models — create_all needs all of them
from app.models.user           import User           # noqa: F401
from app.models.agent          import Agent          # noqa: F401
from app.models.tools          import Tool           # noqa: F401
from app.models.knowledge_base import KnowledgeBase, KBDocument  # noqa: F401
from app.models.workflow       import Workflow       # noqa: F401
from app.models.execution      import Execution, ExecutionLog  # noqa: F401
from app.models.guardrail  import Guardrail  # noqa: F401
from app.api.v1.guardrail import router as guardrails_router

# Import routers
from app.api.v1.auth            import router as auth_router
from app.api.v1.agent           import router as agents_router
from app.api.v1.tools           import router as tools_router
from app.api.v1.knowledge_base import router as kb_router
from app.api.v1.workflow       import router as workflows_router
from app.api.v1.executions      import router as executions_router
from app.api.v1.discover        import router as discover_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background keep-alive task when app starts
    task = asyncio.create_task(_keep_alive())
    yield
    task.cancel()

async def _keep_alive():
    """
    Pings the database every 5 minutes.
    Prevents Supabase from pausing due to inactivity on the free tier.
    """
    await asyncio.sleep(60)  # wait 1 min after startup
    while True:
        try:
            from app.core.database import test_connection
            ok, msg = test_connection()
            print(f"[KeepAlive] DB ping: {msg}")
        except Exception as e:
            print(f"[KeepAlive] Ping failed: {e}")
        await asyncio.sleep(300)  # ping every 5 minutes

app = FastAPI(
    title="FORGE API",
    description="Agentic AI Platform — built from scratch",
    version="1.0.0",
    docs_url="/docs",
    lifespan=lifespan,   # ← add this
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://forge-platform-silk.vercel.app",
        "https://forge-ai-lime-three.vercel.app",
        settings.FRONTEND_URL,
    ],
    allow_origin_regex = r"https://forge-ai.*\.vercel\.app",
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

if engine:
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables verified / created")

app.include_router(auth_router)        # /auth/...
app.include_router(agents_router)      # /agents/...
app.include_router(tools_router)       # /tools/...
app.include_router(kb_router)          # /knowledge-bases/...
app.include_router(workflows_router)   # /workflows/...
app.include_router(executions_router)  # /executions/...
app.include_router(discover_router)    # /discover/...
app.include_router(guardrails_router)  # /guardrails/...

@app.get("/")
def root():
    return {"platform": "FORGE", "message": "API running ⚡", "docs": "/docs"}

@app.get("/health")
def health_check():
    db_ok, db_msg = test_connection()
    return {
        "status":   "ok",
        "database": "connected ✓" if db_ok else f"error: {db_msg}",
    }