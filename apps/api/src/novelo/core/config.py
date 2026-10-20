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
    llm_model_text: str = Field("openai/gpt-6-luna", alias="LLM_MODEL_TEXT")
    llm_model_vision: str = Field("openai/gpt-6-luna", alias="LLM_MODEL_VISION")
    llm_timeout_s: float = Field(30.0, alias="LLM_TIMEOUT_S")
    # Valores iniciais da tabela `ai_settings`: depois de criada, a base de dados manda (painel /admin/ai).
    llm_model_fallback: str = Field("", alias="LLM_MODEL_FALLBACK")
    llm_max_output_tokens: int = Field(0, ge=0, le=8000, alias="LLM_MAX_OUTPUT_TOKENS")  # 0 = limite de cada tarefa
    llm_reasoning_effort: Literal["low", "medium", "high"] = Field("low", alias="LLM_REASONING_EFFORT")
    llm_monthly_budget_usd: float = Field(0.0, ge=0, alias="LLM_MONTHLY_BUDGET_USD")  # 0 = sem limite
    copilot_context_cap_tokens: int = Field(64000, ge=4000, le=1_000_000, alias="COPILOT_CONTEXT_CAP_TOKENS")
    # Copilot: limites de sistema (cada utilizador gere o resto nas suas definições).
    copilot_memory_char_limit: int = Field(2200, ge=200, le=20000, alias="COPILOT_MEMORY_CHAR_LIMIT")
    copilot_user_char_limit: int = Field(1375, ge=200, le=20000, alias="COPILOT_USER_CHAR_LIMIT")
    copilot_default_persona: Literal["default", "analyst", "mentor", "executive", "storyteller"] = Field(
        "default", alias="COPILOT_DEFAULT_PERSONA"
    )
    copilot_max_retention_days: int = Field(0, ge=0, alias="COPILOT_MAX_RETENTION_DAYS")  # 0 = sem máximo
    copilot_review_every_turns: int = Field(3, ge=1, le=50, alias="COPILOT_REVIEW_EVERY_TURNS")
    llm_max_concurrency: int = Field(4, ge=1, le=32, alias="LLM_MAX_CONCURRENCY")
    llm_chat_timeout_s: float = Field(90.0, alias="LLM_CHAT_TIMEOUT_S")  # limite total de uma conversa com ferramentas
    llm_max_retries: int = Field(2, ge=0, le=5, alias="LLM_MAX_RETRIES")  # falhas transitórias (timeout, 429, 5xx)
    llm_retry_backoff_s: float = Field(0.5, ge=0, alias="LLM_RETRY_BACKOFF_S")

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

    rate_limit_enabled: bool = Field(True, alias="RATE_LIMIT_ENABLED")  # só se desliga em dev/E2E

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
