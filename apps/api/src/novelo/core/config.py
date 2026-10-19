"""Configuração: tudo vem do ambiente (ver `.env.example` na raiz do repositório)."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
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

    database_url: str = Field(
        "postgresql+asyncpg://novelo:novelo@localhost:5590/novelo", alias="DATABASE_URL"
    )
    data_dir: Path = Field(_REPO_ROOT / "data" / "processed", alias="DATA_DIR")
    cors_origins: list[str] = Field(["http://localhost:3190"], alias="CORS_ORIGINS")

    # LLM via OpenRouter (API compatível com OpenAI). Sem chave, as features de IA ficam desligadas.
    openrouter_api_key: str = Field("", alias="OPENROUTER_API_KEY")
    openrouter_base_url: str = Field("https://openrouter.ai/api/v1", alias="OPENROUTER_BASE_URL")
    llm_model_text: str = Field("anthropic/claude-sonnet-4.5", alias="LLM_MODEL_TEXT")
    llm_model_vision: str = Field("anthropic/claude-sonnet-4.5", alias="LLM_MODEL_VISION")
    llm_timeout_s: float = Field(30.0, alias="LLM_TIMEOUT_S")

    osrm_url: str = Field("http://localhost:5000", alias="OSRM_URL")
    solver_time_limit_s: int = Field(20, alias="SOLVER_TIME_LIMIT_S")

    @property
    def llm_enabled(self) -> bool:
        return bool(self.openrouter_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
