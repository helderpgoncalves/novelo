from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.security import hash_password
from novelo.features.users.models import User
from novelo.features.users.schemas import UserAdminOut, UserOut


def to_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        role=user.role,
        has_password=user.hashed_password is not None,
        google_linked=user.google_sub is not None,
        email_verified=user.email_verified,
    )


async def get_by_email(db: AsyncSession, email: str) -> User | None:
    return (await db.execute(select(User).where(User.email == email.lower()))).scalar_one_or_none()


async def get_by_google_sub(db: AsyncSession, sub: str) -> User | None:
    return (await db.execute(select(User).where(User.google_sub == sub))).scalar_one_or_none()


async def create_user(
    db: AsyncSession,
    *,
    email: str,
    password: str | None = None,
    name: str | None = None,
    role: str = "operator",
    google_sub: str | None = None,
    avatar_url: str | None = None,
    email_verified: bool = False,
) -> User:
    user = User(
        email=email.lower(),
        name=name,
        hashed_password=hash_password(password) if password else None,
        role=role,
        google_sub=google_sub,
        avatar_url=avatar_url,
        email_verified=email_verified,
    )
    db.add(user)
    await db.commit()
    return user


def to_admin_out(user: User) -> UserAdminOut:
    return UserAdminOut(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        is_active=user.is_active,
        email_verified=user.email_verified,
        google_linked=user.google_sub is not None,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


async def list_users(db: AsyncSession) -> list[User]:
    return list((await db.execute(select(User).order_by(User.created_at))).scalars())
