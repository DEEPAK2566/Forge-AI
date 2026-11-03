from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """
    All environment variables for FORGE.
    pydantic_settings reads backend/.env and fills these in automatically.
    If DATABASE_URL is missing from .env and has no default, the app crashes
    with a clear error: "field required". This is intentional — better than
    silently running with a broken config.
    """

    # ── Database ──────────────────────────────────────────────
    # Full PostgreSQL URL from Supabase
    # Format: postgresql://postgres:password@host:5432/postgres
    DATABASE_URL: str = ""

    # ── Security ──────────────────────────────────────────────
    # Used to sign JWT tokens. Keep it secret. Change in production.
    SECRET_KEY: str = "forge-dev-secret-change-this"

    # Cryptographic algorithm for JWT — HS256 is the standard
    ALGORITHM: str = "HS256"

    # How many minutes before a login token expires (user must re-login)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── AI APIs ───────────────────────────────────────────────
    GEMINI_API_KEY: str = ""   # from aistudio.google.com
    GROQ_API_KEY:   str = ""   # from console.groq.com

    # ── App ───────────────────────────────────────────────────
    # The React app URL — used in CORS to allow requests from it
    FRONTEND_URL: str = "http://localhost:5173"
        

    # ── Workflow limits ───────────────────────────────────────
    # How many agents may run at the same time. 0 = no limit (every ready agent at once).
    # Set a number on Render if you hit Gemini/Groq rate limits or run out of memory.
    MAX_PARALLEL_AGENTS: int = 0

    # Highest "Max loops" value a Loop node may use.
    MAX_LOOP_ITERATIONS: int = 50

    class Config:
        env_file = ".env"
        extra    = "ignore"  # if .env has extra keys we didn't define, ignore them

# One global settings object — imported everywhere in the app
settings = Settings()
