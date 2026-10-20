import uuid
from datetime import datetime
from typing import Literal

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, TimestampMixin, UuidPkMixin

Role = Literal["admin", "operator", "guest"]
JoinedVia = Literal["password", "google", "quick_join", "magic_link"]


class User(Base, UuidPkMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255))
    # Nulo em contas criadas só com Google.
    hashed_password: Mapped[str | None] = mapped_column(String(255))
    google_sub: Mapped[str | None] = mapped_column(String(64), unique=True)
    avatar_url: Mapped[str | None] = mapped_column(String(1024))
    role: Mapped[str] = mapped_column(String(20), default="operator")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    locale: Mapped[str] = mapped_column(String(8), default="pt-PT", server_default="pt-PT")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Como a conta nasceu; e, para o convidado do evento, o consentimento RGPD (quando e que texto aceitou).
    joined_via: Mapped[str] = mapped_column(String(20), default="password", server_default="password")
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consent_version: Mapped[str | None] = mapped_column(String(20))


__all__ = ["Role", "User", "uuid"]
