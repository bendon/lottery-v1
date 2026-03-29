from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from backend.auth.jwt import decode_token
from backend.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

STAFF_READ_ROLES = frozenset({"admin", "auditor"})


def is_staff_reader(role: str) -> bool:
    return role in STAFF_READ_ROLES


def is_staff_writer(role: str) -> bool:
    return role == "admin"


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if not payload:
        raise credentials_exception

    user_id: str = payload.get("sub")
    if not user_id:
        raise credentials_exception

    user = await User.get(user_id)
    if not user or not user.is_active:
        raise credentials_exception
    return user


async def require_admin_read(current_user: User = Depends(get_current_user)) -> User:
    if not is_staff_reader(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not is_staff_writer(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
