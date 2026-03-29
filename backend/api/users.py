from datetime import datetime
from typing import Literal, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth.dependencies import require_admin, require_admin_read
from backend.auth.jwt import hash_password
from backend.models.user import User

router = APIRouter(prefix="/api/admin/users", tags=["users"])


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    full_name: Optional[str] = None
    role: Literal["presenter", "admin", "auditor"] = "presenter"
    user_type: Optional[str] = None
    organization: Optional[str] = None


class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[Literal["presenter", "admin", "auditor"]] = None
    user_type: Optional[str] = None
    organization: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


@router.post("")
async def create_user(body: UserCreate, _=Depends(require_admin)):
    if await User.find_one({"username": body.username}):
        raise HTTPException(status_code=400, detail="Username already exists")
    if await User.find_one({"email": body.email}):
        raise HTTPException(status_code=400, detail="Email already exists")

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
        user_type=body.user_type,
        organization=body.organization,
    )
    await user.insert()
    return {"id": str(user.id), **user.dict(exclude={"hashed_password"})}


@router.get("")
async def list_users(_=Depends(require_admin_read)):
    users = await User.find_all().to_list()
    return [{"id": str(u.id), **u.dict(exclude={"hashed_password"})} for u in users]


@router.get("/{user_id}")
async def get_user(user_id: PydanticObjectId, _=Depends(require_admin_read)):
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": str(user.id), **user.dict(exclude={"hashed_password"})}


@router.put("/{user_id}")
async def update_user(
    user_id: PydanticObjectId,
    body: UserUpdate,
    current_user: User = Depends(require_admin),
):
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = body.dict(exclude_none=True)
    if update_data.get("is_active") is False:
        if user.id == current_user.id:
            raise HTTPException(
                status_code=400,
                detail="You cannot deactivate your own account while signed in. Use another admin, or reactivate via the database.",
            )
        if user.role == "admin":
            others = await User.find(
                {
                    "role": "admin",
                    "is_active": True,
                    "_id": {"$ne": user.id},
                }
            ).count()
            if others == 0:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot deactivate the last active administrator.",
                )
    if "password" in update_data:
        update_data["hashed_password"] = hash_password(update_data.pop("password"))
    update_data["updated_at"] = datetime.utcnow()

    await user.set(update_data)
    return {"id": str(user.id), **user.dict(exclude={"hashed_password"})}


@router.delete("/{user_id}")
async def delete_user(user_id: PydanticObjectId, current_user: User = Depends(require_admin)):
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")
    if user.role == "admin":
        others = await User.find(
            {"role": "admin", "is_active": True, "_id": {"$ne": user.id}}
        ).count()
        if others == 0:
            raise HTTPException(status_code=400, detail="Cannot delete the last active administrator.")
    await user.delete()
    return {"detail": "User deleted"}
