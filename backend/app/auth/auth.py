"""Authentication — JWT tokens with role-based access.

Roles:
  admin   — full access, manage users, edit catalog
  planner — create/view plans, edit prices, export reports
  viewer  — view plans only (for external stakeholders)

Install: pip install python-jose[cryptography] passlib[bcrypt]
"""
import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.db.database import get_db, User

SECRET_KEY = os.getenv("JWT_SECRET", "atlas-secret-key-change-in-production-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(data: dict, expires_hours: int = ACCESS_TOKEN_EXPIRE_HOURS) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.utcnow() + timedelta(hours=expires_hours)
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Get current user from JWT token. Returns None if no token (allows anonymous)."""
    if not credentials:
        return None
    payload = decode_token(credentials.credentials)
    email = payload.get("sub")
    if not email:
        return None
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def require_role(*roles):
    """Dependency that requires a specific role."""
    async def check(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        db: Session = Depends(get_db),
    ):
        if not credentials:
            raise HTTPException(status_code=401, detail="Authentication required")
        payload = decode_token(credentials.credentials)
        email = payload.get("sub")
        user = db.query(User).filter(User.email == email).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found")
        if user.role not in roles:
            raise HTTPException(status_code=403, detail=f"Role '{user.role}' not authorized. Need: {roles}")
        return user
    return check


def create_default_admin(db: Session):
    """Create default admin user if none exists."""
    admin = db.query(User).filter(User.role == "admin").first()
    if not admin:
        admin = User(
            email="admin@atlas.local",
            name="ATLAS Admin",
            hashed_password=hash_password("admin123"),
            role="admin",
        )
        db.add(admin)
        db.commit()
        return True
    return False
