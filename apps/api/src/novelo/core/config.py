"""Configuração: tudo vem do ambiente (ver `.env.example` na raiz do repositório)."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _find_repo_root() -> Path:
    """Raiz do repositório (tem data/processed); no Docker não existe e usa-se DATA_DIR."""
    for parent in Path(__file__).resolve().parents:
        if (parent / "data" / "processed").is_dir():
            return parent
    return Path.cwd()


_REPO_ROOT = _find_repo_root()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_REPO_ROOT / ".env", extra="ignore")

    environment: Literal["development", "production"] = Field("development", alias="APP_ENV")
    log_level: str = Field("info", alias="LOG_LEVEL")

    database_url: str = Field("postgresql+asyncpg://novelo:novelo@localhost:5590/novelo", alias="DATABASE_URL")
    data_dir: Path = Field(_REPO_ROOT / "data" / "processed", alias="DATA_DIR")
    cors_origins: list[str] = Field(["http://localhost:3190"], alias="CORS_ORIGINS")

    # LLM via OpenRouter (API compatível com OpenAI). Sem chave, as features de IA ficam desligadas.
    openrouter_api_key: str = Field("", alias="OPENROUTER_API_KEY")
    openrouter_base_url: str = Field("https://openrouter.ai/api/v1", alias="OPENROUTER_BASE_URL")
    llm_model_text: str = Field("anthropic/claude-sonnet-4.5", alias="LLM_MODEL_TEXT")
    llm_model_vision: str = Field("anthropic/claude-sonnet-4.5", alias="LLM_MODEL_VISION")
    llm_timeout_s: float = Field(30.0, alias="LLM_TIMEOUT_S")

    # --- Sessão e autenticação -------------------------------------------------------
    secret_key: str = Field("dev-only-change-me-dev-only-change-me", alias="SECRET_KEY")
    access_token_minutes: int = Field(15, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_days: int = Field(30, alias="REFRESH_TOKEN_EXPIRE_DAYS")
    session_token_hours: int = Field(24, alias="SESSION_TOKEN_HOURS")  # sem "manter sessão iniciada"
    email_verify_hours: int = Field(48, alias="EMAIL_VERIFY_EXPIRE_HOURS")
    password_reset_minutes: int = Field(60, alias="PASSWORD_RESET_EXPIRE_MINUTES")
    app_url: str = Field("http://localhost:3190", alias="APP_URL")
    allow_registration: bool = Field(True, alias="ALLOW_REGISTRATION")
    admin_email: str = Field("", alias="ADMIN_EMAIL")
    admin_password: str = Field("", alias="ADMIN_PASSWORD")

    google_client_id: str = Field("", alias="GOOGLE_CLIENT_ID")
    google_client_secret: str = Field("", alias="GOOGLE_CLIENT_SECRET")

    # Email transacional via Resend. Sem chave, os emails são escritos no log (dev).
    resend_api_key: str = Field("", alias="RESEND_API_KEY")
    email_from: str = Field("Novelo <noreply@bitsapiens.io>", alias="EMAIL_FROM")

    osrm_url: str = Field("http://localhost:5000", alias="OSRM_URL")
    solver_time_limit_s: int = Field(20, alias="SOLVER_TIME_LIMIT_S")

    @model_validator(mode="after")
    def _require_real_secret_in_production(self) -> "Settings":
        if self.environment == "production" and (self.secret_key.startswith("dev-only") or len(self.secret_key) < 32):
            raise ValueError("SECRET_KEY forte (32+ caracteres) é obrigatória em produção")
        return self

    @property
    def secure_cookies(self) -> bool:
        return self.app_url.startswith("https://")

    @property
    def google_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def google_redirect_uri(self) -> str:
        return f"{self.app_url.rstrip('/')}/api/v1/auth/google/callback"

    @property
    def llm_enabled(self) -> bool:
        return bool(self.openrouter_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
