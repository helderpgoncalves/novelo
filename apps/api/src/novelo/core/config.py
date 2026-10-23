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


# Chaves de teste da Cloudflare (https://developers.cloudflare.com/turnstile/troubleshooting/testing/).
TURNSTILE_TEST_SITE_KEY_PASS = "1x00000000000000000000AA"
TURNSTILE_TEST_SECRET_PASS = "1x0000000000000000000000000000000AA"
TURNSTILE_TEST_SECRET_FAIL = "2x0000000000000000000000000000000AA"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_REPO_ROOT / ".env", extra="ignore")

    environment: Literal["development", "production"] = Field("development", alias="APP_ENV")
    log_level: str = Field("info", alias="LOG_LEVEL")
    # Cria, uma só vez e em segundo plano, os cenários de referência por locais reais (sala de decisão e demo).
    seed_reference_scenarios: bool = Field(False, alias="SEED_REFERENCE_SCENARIOS")

    database_url: str = Field("postgresql+asyncpg://novelo:novelo@localhost:5590/novelo", alias="DATABASE_URL")
    data_dir: Path = Field(_REPO_ROOT / "data" / "processed", alias="DATA_DIR")
    cors_origins: list[str] = Field(["http://localhost:3190"], alias="CORS_ORIGINS")
    # IP real do cliente (core/ratelimit.py `client_ip`). Nº de proxies de confiança À FRENTE da API que acrescentam
    # o IP que os liga a `X-Forwarded-For` (produção: nginx e Traefik = 2). 0 = ignora cabeçalhos e usa o par TCP.
    trusted_proxy_hops: int = Field(0, ge=0, le=10, alias="TRUSTED_PROXY_HOPS")
    # Aceita `CF-Connecting-IP` só quando o salto mais externo de confiança é um IP publicado da Cloudflare.
    trust_cloudflare_header: bool = Field(False, alias="TRUST_CLOUDFLARE_HEADER")
    web_concurrency: int = Field(1, ge=1, alias="WEB_CONCURRENCY")  # processos do uvicorn (limites valem por processo)

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
    # Tarefas auxiliares (título, sugestões, resumos): o OpenRouter escolhe o fornecedor mais rápido. Vazio = padrão.
    llm_aux_provider_sort: Literal["", "latency", "throughput", "price"] = Field(
        "latency", alias="LLM_AUX_PROVIDER_SORT"
    )

    # Pesquisa na web do copiloto (server tools do OpenRouter, em beta). Tudo atrás de flags: desligado, ou se o
    # fornecedor rejeitar (região sem motor, ZDR), o copiloto responde sem web e avisa. Ver docs/engenharia/ia.md.
    web_search_enabled: bool = Field(True, alias="WEB_SEARCH_ENABLED")
    # tool: ferramenta `web_search` da casa (a consulta passa pelo sanitizador e conta-se por pedido; recomendado);
    # inline: o server tool `openrouter:web_search` vai no mesmo pedido do copiloto e o modelo pesquisa sozinho.
    web_search_mode: Literal["tool", "inline"] = Field("tool", alias="WEB_SEARCH_MODE")
    web_search_engine: Literal["auto", "native", "exa", "parallel", "perplexity", "firecrawl"] = Field(
        "auto", alias="WEB_SEARCH_ENGINE"
    )
    web_search_max_results: int = Field(5, ge=1, le=10, alias="WEB_SEARCH_MAX_RESULTS")
    web_search_max_calls: int = Field(
        3, ge=1, le=10, alias="WEB_SEARCH_MAX_CALLS"
    )  # pesquisas por pedido do utilizador
    web_search_max_cost_usd: float = Field(0.05, ge=0, alias="WEB_SEARCH_MAX_COST_USD")  # teto por pedido (inline)
    web_search_context_size: Literal["low", "medium", "high"] = Field("low", alias="WEB_SEARCH_CONTEXT_SIZE")
    web_search_timeout_s: float = Field(25.0, ge=3, le=120, alias="WEB_SEARCH_TIMEOUT_S")
    web_search_allowed_domains: str = Field("", alias="WEB_SEARCH_ALLOWED_DOMAINS")  # csv; vazio = qualquer
    web_search_excluded_domains: str = Field("", alias="WEB_SEARCH_EXCLUDED_DOMAINS")  # csv; não se combina com allowed
    web_search_guests: bool = Field(False, alias="GUEST_WEB_SEARCH_ENABLED")  # convidados do evento: desligada
    web_fetch_enabled: bool = Field(True, alias="WEB_FETCH_ENABLED")  # só quando a mensagem traz um link https
    web_fetch_allowed_domains: str = Field("", alias="WEB_FETCH_ALLOWED_DOMAINS")
    web_fetch_blocked_domains: str = Field("", alias="WEB_FETCH_BLOCKED_DOMAINS")
    web_fetch_max_content_tokens: int = Field(12000, ge=500, le=100000, alias="WEB_FETCH_MAX_CONTENT_TOKENS")
    server_tools_datetime_enabled: bool = Field(True, alias="SERVER_TOOLS_DATETIME_ENABLED")
    server_tools_timezone: str = Field("Europe/Lisbon", alias="SERVER_TOOLS_TIMEZONE")
    # Declaram o que está ligado na conta do OpenRouter (o código não o consegue ler): com ZDR forçado o motor
    # Firecrawl é rejeitado; um endpoint regional da UE não tem motor de pesquisa (a pesquisa fica indisponível).
    openrouter_zdr_enforced: bool = Field(False, alias="OPENROUTER_ZDR_ENFORCED")

    # --- Sessão e autenticação -------------------------------------------------------
    secret_key: str = Field("dev-only-change-me-dev-only-change-me", alias="SECRET_KEY")
    access_token_minutes: int = Field(15, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_days: int = Field(30, alias="REFRESH_TOKEN_EXPIRE_DAYS")
    session_token_hours: int = Field(24, alias="SESSION_TOKEN_HOURS")  # sem "manter sessão iniciada"
    email_verify_hours: int = Field(48, alias="EMAIL_VERIFY_EXPIRE_HOURS")
    password_reset_minutes: int = Field(60, alias="PASSWORD_RESET_EXPIRE_MINUTES")
    app_url: str = Field("http://localhost:3190", alias="APP_URL")
    allow_registration: bool = Field(True, alias="ALLOW_REGISTRATION")
    magic_link_minutes: int = Field(15, ge=5, le=60, alias="MAGIC_LINK_EXPIRE_MINUTES")
    # Entrada por QR (evento): o convidado só dá nome e email. Em dev liga-se com um código de dev;
    # em produção só fica ativa se QUICK_JOIN_CODE estiver definido.
    quick_join_enabled: bool = Field(True, alias="QUICK_JOIN_ENABLED")
    quick_join_code: str = Field("", alias="QUICK_JOIN_CODE")
    quick_join_consent_version: str = Field("2026-10-20", alias="QUICK_JOIN_CONSENT_VERSION")
    # Limites por convidado (role `guest`), para o IA e o solver não saírem do controlo num evento aberto.
    guest_ai_per_hour: int = Field(20, ge=1, alias="GUEST_AI_REQUESTS_PER_HOUR")
    guest_solver_per_hour: int = Field(10, ge=1, alias="GUEST_SOLVER_RUNS_PER_HOUR")
    guest_ai_budget_usd: float = Field(
        0.5, ge=0, alias="GUEST_AI_BUDGET_USD"
    )  # por convidado, últimas 24 h; 0 = sem limite
    # Tetos GLOBAIS do evento (independentes do IP e do convidado): criação de convidados por hora e gasto de IA
    # de todos os convidados nas últimas 24 h. 0 = sem limite.
    guest_signups_per_hour: int = Field(200, ge=0, alias="GUEST_SIGNUPS_PER_HOUR")
    guest_ai_global_budget_usd: float = Field(5.0, ge=0, alias="GUEST_AI_GLOBAL_BUDGET_USD")
    # Rotas caras: execuções por utilizador e por minuto, e concorrência global (por processo).
    solver_runs_per_minute: int = Field(6, ge=1, alias="SOLVER_RUNS_PER_MINUTE")
    solver_max_concurrency: int = Field(2, ge=1, le=16, alias="SOLVER_MAX_CONCURRENCY")
    pdf_max_concurrency: int = Field(2, ge=1, le=16, alias="PDF_MAX_CONCURRENCY")
    login_account_max_failures: int = Field(10, ge=1, alias="LOGIN_ACCOUNT_MAX_FAILURES")  # por conta, 15 min
    # Anexos do copiloto: teto por utilizador (ficheiros e bytes guardados).
    copilot_attachments_per_user: int = Field(100, ge=1, alias="COPILOT_ATTACHMENTS_PER_USER")
    copilot_attachments_max_mb: int = Field(50, ge=1, alias="COPILOT_ATTACHMENTS_MAX_MB")
    # Administração de utilizadores: convites por email e impersonação (ver docs/engenharia/arquitetura.md, segurança).
    invitation_days: int = Field(7, ge=1, le=30, alias="INVITATION_EXPIRE_DAYS")
    invitations_per_hour: int = Field(30, ge=1, alias="INVITATIONS_PER_HOUR")  # por administrador
    impersonation_minutes: int = Field(30, ge=5, le=120, alias="IMPERSONATION_MINUTES")  # fixo, sem renovação
    admin_email: str = Field("", alias="ADMIN_EMAIL")
    admin_password: str = Field("", alias="ADMIN_PASSWORD")

    google_client_id: str = Field("", alias="GOOGLE_CLIENT_ID")
    google_client_secret: str = Field("", alias="GOOGLE_CLIENT_SECRET")

    # Email transacional via Resend. Sem chave, os emails são escritos no log (dev).
    resend_api_key: str = Field("", alias="RESEND_API_KEY")
    # "auto": Resend se houver chave; "log": nunca envia (caixa de saída de dev); "resend": força o envio real.
    email_transport: str = Field("auto", alias="EMAIL_TRANSPORT")
    email_from: str = Field("Novelo <novelo@heldergoncalves.io>", alias="EMAIL_FROM")
    email_support: str = Field("novelo@heldergoncalves.io", alias="EMAIL_SUPPORT")  # ajuda no rodapé dos emails
    # Reply-To dos emails (vazio = EMAIL_SUPPORT): quem responde chega a uma pessoa.
    email_reply_to: str = Field("", alias="EMAIL_REPLY_TO")
    # Segredo do webhook do Resend (formato `whsec_...`, painel do Resend > Webhooks). Sem ele o endpoint responde 503.
    resend_webhook_secret: str = Field("", alias="RESEND_WEBHOOK_SECRET")
    # Chave do Resend com acesso total, SÓ para consultar o estado dos envios (a de envio não consegue). Opcional.
    resend_read_api_key: str = Field("", alias="RESEND_READ_API_KEY")
    email_send_timeout_s: float = Field(
        4.0, gt=0, le=4.0, alias="EMAIL_SEND_TIMEOUT_S"
    )  # envio em linha: no máximo 4 s
    email_retry_backoff_s: float = Field(0.4, ge=0, le=5, alias="EMAIL_RETRY_BACKOFF_S")
    # Teto GLOBAL de emails «não encontrámos uma conta» por hora (impede usar o login para spam a terceiros).
    email_not_found_per_hour: int = Field(30, ge=0, alias="EMAIL_NOT_FOUND_PER_HOUR")

    # Cloudflare Turnstile (anti-bots nas rotas públicas de escrita). Ver docs/engenharia/ambiente.md.
    turnstile_site_key: str = Field("", alias="TURNSTILE_SITE_KEY")
    turnstile_secret_key: str = Field("", alias="TURNSTILE_SECRET_KEY")
    # "auto": ativo se houver secret (em dev, chaves de teste da Cloudflare); "true"/"false" forçam.
    turnstile_enabled_mode: Literal["auto", "true", "false"] = Field("auto", alias="TURNSTILE_ENABLED")
    # true: as rotas protegidas NUNCA passam sem verificação (sem secret respondem 503 captcha_unavailable).
    turnstile_required: bool = Field(False, alias="TURNSTILE_REQUIRED")
    turnstile_timeout_s: float = Field(5.0, gt=0, le=30, alias="TURNSTILE_TIMEOUT_S")

    rate_limit_enabled: bool = Field(True, alias="RATE_LIMIT_ENABLED")  # só se desliga em dev/E2E

    # Rotas por estrada (OSRM próprio, apps/osrm). Vazio = sem OSRM: km e traçados são estimativa (linha reta × desvio).
    osrm_url: str = Field("", alias="OSRM_URL")
    osrm_timeout_s: float = Field(8.0, gt=0, le=60, alias="OSRM_TIMEOUT_S")
    osrm_max_locations: int = Field(400, ge=2, le=5000, alias="OSRM_MAX_LOCATIONS")  # <= --max-table-size do servidor
    osrm_max_snap_m: float = Field(
        500.0, gt=0, alias="OSRM_MAX_SNAP_M"
    )  # ponto mais longe de uma estrada = sem caminho
    osrm_cache_size: int = Field(256, ge=0, alias="OSRM_CACHE_SIZE")
    osrm_cooldown_s: float = Field(30.0, ge=0, alias="OSRM_COOLDOWN_S")  # pausa depois de uma falha do OSRM
    solver_time_limit_s: int = Field(20, alias="SOLVER_TIME_LIMIT_S")

    # Miniatura opcional por peça de lote (RGPD: minimização no tempo e no tamanho). Ver features/lots/photos.py.
    lot_photo_retention_days: int = Field(90, ge=1, le=365, alias="LOT_PHOTO_RETENTION_DAYS")
    lot_photo_max_bytes: int = Field(153_600, ge=20_000, le=1_000_000, alias="LOT_PHOTO_MAX_BYTES")  # já processada

    @model_validator(mode="after")
    def _require_real_secret_in_production(self) -> "Settings":
        if self.environment == "production" and (self.secret_key.startswith("dev-only") or len(self.secret_key) < 32):
            raise ValueError("SECRET_KEY forte (32+ caracteres) é obrigatória em produção")
        return self

    @property
    def turnstile_secret(self) -> str:
        """Secret em vigor. Só em desenvolvimento há um por omissão (chave de teste da Cloudflare: passa sempre)."""
        if self.turnstile_secret_key:
            return self.turnstile_secret_key
        return TURNSTILE_TEST_SECRET_PASS if self.environment == "development" else ""

    @property
    def turnstile_site(self) -> str | None:
        if self.turnstile_site_key:
            return self.turnstile_site_key
        return TURNSTILE_TEST_SITE_KEY_PASS if self.environment == "development" else None

    @property
    def turnstile_enabled(self) -> bool:
        """As rotas públicas de escrita exigem Turnstile?

        `TURNSTILE_ENABLED=false` desliga (exceto com `TURNSTILE_REQUIRED=true`, que manda); `true` liga; `auto`
        liga se houver secret. Ativo sem secret (só possível em produção) é fail-closed: ver `core/captcha.py`.
        """
        if self.turnstile_required:
            return True
        if self.turnstile_enabled_mode == "false":
            return False
        if self.turnstile_enabled_mode == "true":
            return True
        return bool(self.turnstile_secret)

    @property
    def quick_join_secret(self) -> str:
        """Código do evento em vigor. Em dev há um por omissão; em produção tem de ser definido."""
        if self.quick_join_code:
            return self.quick_join_code
        return "novelo-dev" if self.environment == "development" else ""

    @property
    def quick_join_active(self) -> bool:
        return self.quick_join_enabled and bool(self.quick_join_secret)

    @property
    def magic_link_enabled(self) -> bool:
        """Há transporte de email utilizável: Resend com chave, ou o log de dev."""
        if self.email_transport == "log":
            return True
        if self.email_transport == "resend":
            return bool(self.resend_api_key)
        return bool(self.resend_api_key) or self.environment == "development"

    @property
    def email_provider_configured(self) -> bool:
        """Há um fornecedor real (Resend com chave) para enviar emails?"""
        return self.email_transport != "log" and bool(self.resend_api_key)

    @property
    def email_reply_to_effective(self) -> str:
        return self.email_reply_to or self.email_support

    @property
    def webhook_configured(self) -> bool:
        return bool(self.resend_webhook_secret)

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

    @property
    def web_region_supported(self) -> bool:
        """Sem motor de pesquisa residente na UE (eu.openrouter.ai): nesse endpoint a pesquisa fica desligada."""
        return "eu.openrouter.ai" not in self.openrouter_base_url

    @property
    def web_search_available(self) -> bool:
        """A pesquisa na web pode ser oferecida (flag e região); a chave de IA já é exigida por quem chama o modelo."""
        return self.web_search_enabled and self.web_region_supported

    @property
    def web_search_engine_effective(self) -> str:
        """Com ZDR forçado o Firecrawl é rejeitado pelo OpenRouter: troca-se por `auto` em vez de partir a pesquisa."""
        return (
            "auto" if self.openrouter_zdr_enforced and self.web_search_engine == "firecrawl" else self.web_search_engine
        )

    @staticmethod
    def domains(raw: str) -> list[str]:
        return [d.strip().lower() for d in raw.split(",") if d.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
