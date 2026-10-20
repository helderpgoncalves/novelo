import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from novelo.features.users.models import JoinedVia, Role

Locale = Literal["pt-PT", "en"]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str | None
    avatar_url: str | None
    role: Role
    joined_via: JoinedVia
    has_password: bool
    google_linked: bool
    email_verified: bool
    locale: Locale


class UserAdminOut(BaseModel):
    """Visão de administração: inclui estado da conta e último acesso."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str | None
    role: Role
    joined_via: JoinedVia
    is_active: bool
    email_verified: bool
    google_linked: bool
    last_login_at: datetime | None
    created_at: datetime


class UserAdminUpdate(BaseModel):
    role: Role | None = None
    is_active: bool | None = None


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    locale: Locale | None = None
