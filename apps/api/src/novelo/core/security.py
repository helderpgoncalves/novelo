"""Passwords (argon2id), JWT de sessão e tokens opacos de uso único."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from novelo.core.config import get_settings

_hasher = PasswordHasher()
_ALGORITHM = "HS256"


def hash_password(plain: str) -> str:
    return _hasher.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _hasher.verify(hashed, plain)
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(hashed: str) -> bool:
    return _hasher.check_needs_rehash(hashed)


def _encode(claims: dict[str, Any], lifetime: timedelta) -> str:
    now = datetime.now(UTC)
    payload = {**claims, "iat": now, "exp": now + lifetime, "jti": uuid.uuid4().hex}
    return jwt.encode(payload, get_settings().secret_key, algorithm=_ALGORITHM)


def create_access_token(user_id: uuid.UUID, role: str) -> str:
    minutes = get_settings().access_token_minutes
    return _encode({"sub": str(user_id), "role": role, "type": "access"}, timedelta(minutes=minutes))


def create_refresh_token(user_id: uuid.UUID, remember: bool = True) -> str:
    """`remember` = "manter sessão iniciada": 30 dias; caso contrário a sessão dura 24 horas."""
    settings = get_settings()
    days, hours = settings.refresh_token_days, settings.session_token_hours
    lifetime = timedelta(days=days) if remember else timedelta(hours=hours)
    return _encode({"sub": str(user_id), "type": "refresh", "remember": remember}, lifetime)


def create_state_token(claims: dict[str, Any], minutes: int = 10) -> str:
    """Token assinado de curta duração (estado do OAuth)."""
    return _encode({**claims, "type": "state"}, timedelta(minutes=minutes))


def decode_token(token: str, expected_type: str) -> dict[str, Any]:
    """Valida assinatura, expiração e tipo. Levanta ValueError em qualquer falha."""
    try:
        payload: dict[str, Any] = jwt.decode(token, get_settings().secret_key, algorithms=[_ALGORITHM])
    except jwt.InvalidTokenError as exc:
        raise ValueError("token inválido") from exc
    if payload.get("type") != expected_type:
        raise ValueError("tipo de token errado")
    return payload


def hash_token(token: str) -> str:
    """SHA-256: na base de dados só guardamos o hash, nunca o token."""
    return hashlib.sha256(token.encode()).hexdigest()


def new_opaque_token() -> str:
    return secrets.token_urlsafe(32)
