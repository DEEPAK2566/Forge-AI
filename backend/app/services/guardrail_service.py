"""
Guardrail Service — safety rules applied around every agent run.

Two layers:

1. ALWAYS-ON secret redaction (no setup needed)
   Tokens like ghp_..., ATATT..., AIza..., gsk_... are replaced with
   [REDACTED] before text is sent to the LLM or saved in execution logs.
   Tools still receive the real values — only the LLM and the logs don't.

2. User guardrails (built in the Guardrail Builder, attached to an agent)
   - Every rule line is injected into the prompt as a non-negotiable rule.
   - Lines that start with "BLOCK:" are ALSO enforced in code after the LLM
     answers. If the output contains that text (case-insensitive), the agent
     fails with a "blocked by guardrail" error.

   Example guardrail rules text:
       Never reveal credentials or tokens.
       Only answer about data engineering topics.
       BLOCK: DROP TABLE
       BLOCK: DELETE FROM
"""

import re

# ── Layer 1: secret patterns ──────────────────────────────────────────────
SECRET_PATTERNS = [
    re.compile(r"ghp_[A-Za-z0-9]{20,}"),                    # GitHub classic token
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),            # GitHub fine-grained token
    re.compile(r"ATATT[A-Za-z0-9_\-=]{20,}"),               # Atlassian / Jira API token
    re.compile(r"AIza[0-9A-Za-z_\-]{30,}"),                 # Google / Gemini API key
    re.compile(r"gsk_[A-Za-z0-9]{20,}"),                    # Groq API key
    re.compile(r"sk-[A-Za-z0-9]{20,}"),                     # OpenAI-style key
    re.compile(r"dapi[0-9a-f]{30,}"),                       # Databricks token
    re.compile(r"postgres(?:ql)?://[^:\s]+:[^@\s]+@"),      # DB URL with password
]


def redact_secrets(text: str) -> str:
    """Replace anything that looks like a credential with [REDACTED]."""
    if not text:
        return text or ""
    for pattern in SECRET_PATTERNS:
        text = pattern.sub("[REDACTED]", text)
    return text


# ── Layer 2: user guardrails ──────────────────────────────────────────────

def load_guardrails(db, guardrail_ids: list) -> list:
    """Load Guardrail rows for the given IDs (skips IDs that no longer exist)."""
    if not guardrail_ids:
        return []
    from app.models.guardrail import Guardrail
    return db.query(Guardrail).filter(Guardrail.id.in_(guardrail_ids)).all()


def build_guardrail_prompt(guardrails: list) -> str:
    """Turn guardrail rules into a block of text placed at the top of the prompt."""
    lines = []
    for g in guardrails:
        for raw in (g.rules or "").splitlines():
            rule = raw.strip()
            if not rule:
                continue
            if rule.upper().startswith("BLOCK:"):
                phrase = rule[6:].strip()
                rule = f'Never output the text "{phrase}".'
            lines.append(f"- [{g.name}] {rule}")
    return "\n".join(lines)


def check_output(guardrails: list, output: str):
    """
    Enforce BLOCK: rules in code.
    Returns (True, "") if the output is allowed,
    or (False, reason) if a BLOCK rule matched.
    """
    lowered = (output or "").lower()
    for g in guardrails:
        for raw in (g.rules or "").splitlines():
            rule = raw.strip()
            if rule.upper().startswith("BLOCK:"):
                phrase = rule[6:].strip()
                if phrase and phrase.lower() in lowered:
                    return False, f"Output blocked by guardrail '{g.name}' (contains \"{phrase}\")"
    return True, ""
