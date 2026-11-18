"""
Sharing helpers — used by Discover, the clone endpoints and the community Action Zone.

Rule: you can EDIT and DELETE only your own items. Anyone can see published items in
Discover and CLONE them: the clone is a private draft copy in your own account that you
can open and change freely, so nobody can change somebody else's work.
"""
from fastapi import HTTPException

# Columns that belong to the original row, never copied into a clone
_SKIP = {"id", "user_id", "created_at", "updated_at", "status", "name"}


def first_name(user) -> str:
    """'Deepak Ponasanapalli' -> 'Deepak'. Falls back to the part of the email before @."""
    if not user:
        return "Someone"
    name = (user.full_name or "").strip() or (user.email or "").split("@")[0]
    return (name.split() or ["Someone"])[0][:30]


def clone_row(db, model, item_id: int, current_user):
    """
    Copy one row of `model` (Agent / Tool / Workflow) into the current user's account.
    Allowed when the item is yours, or when its owner published it.
    """
    original = db.query(model).filter(model.id == item_id).first()
    if not original or (original.user_id != current_user.id and original.status != "published"):
        raise HTTPException(status_code=404, detail="Not found, or not published by its owner")

    data = {c.name: getattr(original, c.name) for c in model.__table__.columns if c.name not in _SKIP}
    copy = model(**data, user_id=current_user.id, name=f"{original.name} (copy)"[:200], status="draft")
    db.add(copy)
    db.commit()
    db.refresh(copy)
    return copy
