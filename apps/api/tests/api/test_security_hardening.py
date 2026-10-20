"""Correções da auditoria de segurança (A–K): IP real, limites, convidados, CSRF, cookies, consumo atómico."""

import asyncio
import logging
import re
import threading
import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import httpx
import pytest
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.email import LogSender, UnavailableSender, get_email_sender
from novelo.core import config, security
from novelo.core.config import get_settings
from novelo.core.errors import AiBudgetExceededError, FeatureDisabledError
from novelo.core.guest import guest_ai_guard, solver_slots
from novelo.core.ratelimit import RateLimiter, passport_limiter
from novelo.features.ai_admin.models import AiUsage
from novelo.features.ai_admin.service import build_runtime
from novelo.features.auth import google, service
from novelo.features.auth.models import EmailVerificationToken, LoginToken, PasswordResetToken, RefreshToken
from novelo.features.copilot.models import CopilotAttachment
from novelo.features.email_log import service as email_log
from novelo.features.users import service as users
from novelo.features.users.models import User
from tests.conftest import PASSWORD, OutboxSender

AUTH = "/api/v1/auth"
Maker = Callable[..., Any]
CODE = "evento-teste-123"


@pytest.fixture
def behind_proxy(monkeypatch: pytest.MonkeyPatch) -> None:
    """Um proxy de confiança à frente da API: o cliente é o último valor de `X-Forwarded-For`."""
    monkeypatch.setattr(get_settings(), "trusted_proxy_hops", 1)


def xff(ip: str) -> dict[str, str]:
    return {"X-Forwarded-For": ip}


@pytest.fixture
def event(monkeypatch: pytest.MonkeyPatch) -> None:
    s = get_settings()
    monkeypatch.setattr(s, "quick_join_enabled", True)
    monkeypatch.setattr(s, "quick_join_code", CODE)
    monkeypatch.setattr(s, "email_transport", "log")


def join_body(email: str) -> dict[str, object]:
    return {"name": "Rui", "email": email, "code": CODE, "consent": True}


# --- A: o IP vem do proxy de confiança, não do primeiro valor forjável ---------------------------------------


async def test_forged_leading_xff_values_do_not_dodge_the_ip_limiter(
    client: httpx.AsyncClient, behind_proxy: None
) -> None:
    for i in range(10):  # o atacante muda o início do cabeçalho; o proxy acrescenta sempre o mesmo IP real
        resp = await client.post(
            f"{AUTH}/login", json={"email": f"x{i}@x.pt", "password": "errada"}, headers=xff(f"1.1.1.{i}, 203.0.113.9")
        )
        assert resp.status_code == 401
    blocked = await client.post(
        f"{AUTH}/login", json={"email": "novo@x.pt", "password": "errada"}, headers=xff("9.9.9.9, 203.0.113.9")
    )
    assert blocked.status_code == 429
    other = await client.post(
        f"{AUTH}/login", json={"email": "novo@x.pt", "password": "errada"}, headers=xff("203.0.113.10")
    )
    assert other.status_code == 401  # outro IP real não é afetado


async def test_turnstile_and_audit_use_the_validated_ip(
    client: httpx.AsyncClient,
    behind_proxy: None,
    turnstile: Any,
    session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    s = get_settings()
    monkeypatch.setattr(s, "turnstile_enabled_mode", "auto")
    monkeypatch.setattr(s, "turnstile_secret_key", "real-secret")
    await client.post(
        f"{AUTH}/login",
        json={"email": "a@x.pt", "password": "errada"},
        headers={**xff("<script>, 198.51.100.4"), "X-Turnstile-Token": "good"},
    )
    assert turnstile.seen == [("good", "198.51.100.4")]


# --- B: limiter ----------------------------------------------------------------------------------------------


async def test_production_runs_one_process_so_in_memory_limits_are_global() -> None:
    assert get_settings().web_concurrency == 1  # por omissão; o entrypoint.sh usa o mesmo valor


# --- C: hash fora do event loop, limite por conta -----------------------------------------------------------


async def test_password_hashing_runs_off_the_event_loop(
    client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    threads: list[bool] = []
    real_hash, real_verify = security.hash_password, security.verify_password

    def spy_hash(plain: str) -> str:
        threads.append(threading.current_thread() is threading.main_thread())
        return real_hash(plain)

    def spy_verify(plain: str, hashed: str) -> bool:
        threads.append(threading.current_thread() is threading.main_thread())
        return real_verify(plain, hashed)

    monkeypatch.setattr(security, "hash_password", spy_hash)
    monkeypatch.setattr(security, "verify_password", spy_verify)
    reg = await client.post(f"{AUTH}/register", json={"email": "ana@x.pt", "password": PASSWORD})
    assert reg.status_code == 201
    await client.post(f"{AUTH}/login", json={"email": "ana@x.pt", "password": PASSWORD})
    await client.post(f"{AUTH}/login", json={"email": "ninguem@x.pt", "password": PASSWORD})  # hash fictício
    assert len(threads) >= 3 and not any(threads)  # nenhuma chamada correu na thread do event loop


async def test_login_failures_are_limited_per_account_whatever_the_ip(
    client: httpx.AsyncClient, session: AsyncSession, behind_proxy: None
) -> None:
    await users.create_user(session, email="ana@x.pt", password=PASSWORD)
    await session.commit()
    for i in range(10):
        resp = await client.post(
            f"{AUTH}/login", json={"email": "Ana@x.pt", "password": "errada"}, headers=xff(f"203.0.113.{i}")
        )
        assert resp.status_code == 401
    # IP novo, password CERTA: a conta está bloqueada na mesma
    locked = await client.post(
        f"{AUTH}/login", json={"email": "ana@x.pt", "password": PASSWORD}, headers=xff("198.51.100.1")
    )
    assert locked.status_code == 429 and locked.json()["code"] == "rate_limited"
    # a mesma resposta para um email que não existe (sem enumeração)
    for i in range(10):
        await client.post(
            f"{AUTH}/login", json={"email": "fantasma@x.pt", "password": "errada"}, headers=xff(f"192.0.2.{i}")
        )
    ghost = await client.post(
        f"{AUTH}/login", json={"email": "fantasma@x.pt", "password": "errada"}, headers=xff("198.51.100.2")
    )
    assert ghost.status_code == 429
    other = await client.post(
        f"{AUTH}/login", json={"email": "outra@x.pt", "password": "errada"}, headers=xff("198.51.100.3")
    )
    assert other.status_code == 401


# --- D: tetos globais dos convidados -----------------------------------------------------------------------


async def test_global_guest_signup_cap_does_not_depend_on_the_ip(
    client: httpx.AsyncClient, event: None, behind_proxy: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "guest_signups_per_hour", 2)
    for i in range(2):
        ok = await client.post(f"{AUTH}/quick-join", json=join_body(f"g{i}@x.pt"), headers=xff(f"203.0.113.{i}"))
        assert ok.status_code == 200 and ok.json()["status"] == "signed_in"
    full = await client.post(f"{AUTH}/quick-join", json=join_body("g9@x.pt"), headers=xff("198.51.100.77"))
    assert full.status_code == 429 and full.json()["code"] == "rate_limited"


async def test_quick_join_guests_start_with_an_unverified_email(
    client: httpx.AsyncClient, event: None, session: AsyncSession
) -> None:
    assert (await client.post(f"{AUTH}/quick-join", json=join_body("jurado@x.pt"))).status_code == 200
    guest = (await session.execute(select(User).where(User.email == "jurado@x.pt"))).scalar_one()
    assert guest.role == "guest" and guest.email_verified is False


async def test_global_guest_ai_budget_and_monthly_budget(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    s = get_settings()
    monkeypatch.setattr(s, "guest_ai_budget_usd", 0)  # só o teto global
    monkeypatch.setattr(s, "guest_ai_global_budget_usd", 5.0)
    g1 = await users.create_user(session, email="g1@x.pt", role="guest")
    g2 = await users.create_user(session, email="g2@x.pt", role="guest")
    op = await users.create_user(session, email="op@x.pt", password=PASSWORD)

    def usage(user: User, cost: str) -> AiUsage:
        return AiUsage(
            task="chat", model="m", cost_source="provider", latency_ms=1, success=True, user_id=user.id,
            cost_usd=Decimal(cost),
        )  # fmt: skip

    session.add_all([usage(g1, "3"), usage(op, "50")])  # o gasto de um operador não conta para o teto dos convidados
    await session.commit()
    await guest_ai_guard(g2, session)  # 3 USD de 5: passa
    session.add(usage(g1, "2.5"))
    await session.commit()
    with pytest.raises(AiBudgetExceededError):
        await guest_ai_guard(g2, session)  # outro convidado, sem gasto próprio, esbarra no teto do evento
    await guest_ai_guard(op, session)  # operadores não são afetados

    # LLM_MONTHLY_BUDGET_USD é global e aplicado antes de qualquer chamada
    monkeypatch.setattr(s, "llm_monthly_budget_usd", 10.0)
    runtime = await build_runtime(session, op)
    assert runtime.budget_usd == 10.0
    with pytest.raises(AiBudgetExceededError):
        runtime.check_budget()


# --- E: emails em produção --------------------------------------------------------------------------------


async def test_email_never_goes_to_the_log_outside_development(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture, session: AsyncSession
) -> None:
    s = get_settings()
    monkeypatch.setattr(s, "resend_api_key", "")
    monkeypatch.setattr(s, "environment", "development")
    assert isinstance(get_email_sender(), LogSender)
    monkeypatch.setattr(s, "environment", "production")
    sender = get_email_sender()
    assert isinstance(sender, UnavailableSender)
    with pytest.raises(FeatureDisabledError):
        await sender.send(to="a@x.pt", subject="s", html="<p>", text="https://x/reset-password?token=SEGREDO")
    monkeypatch.setattr(s, "email_transport", "log")  # nem forçando o transporte de log
    assert isinstance(get_email_sender(), UnavailableSender)
    with caplog.at_level(logging.DEBUG):
        row = await email_log.deliver(
            session, sender, "password_reset", "a@x.pt", "s", "<p>", "https://x/reset-password?token=SEGREDO"
        )
    assert row.status == "failed" and row.error_code == "not_configured"  # a falha fica registada, sem corpo
    assert "SEGREDO" not in caplog.text and "a@x.pt" not in caplog.text


# --- F: pré-sequestro de conta ---------------------------------------------------------------------------


@pytest.fixture
def google_on(monkeypatch: pytest.MonkeyPatch) -> Any:
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "secret")
    config.get_settings.cache_clear()
    yield
    config.get_settings.cache_clear()


async def test_linking_google_to_an_unverified_account_drops_the_squatters_password_and_sessions(
    client: httpx.AsyncClient, session: AsyncSession, google_on: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    squatter = httpx.AsyncClient(
        transport=client._transport, base_url="http://test", headers={"X-Turnstile-Token": "good"}
    )  # google_on recria as definições: o Turnstile volta ao modo "auto"
    await users.create_user(session, email="vitima@x.pt", password=PASSWORD)  # criada por um atacante, não verificada
    await session.commit()
    assert (
        await squatter.post(f"{AUTH}/login", json={"email": "vitima@x.pt", "password": PASSWORD})
    ).status_code == 200

    async def fake_profile(code: str, transport: object = None) -> dict[str, str]:
        return {"sub": "g-victim", "email": "Vitima@x.pt", "name": "Vítima"}

    monkeypatch.setattr(google, "fetch_profile", fake_profile)
    login = await client.get(f"{AUTH}/google/login", follow_redirects=False)
    state = httpx.URL(login.headers["location"]).params["state"]
    cb = await client.get(f"{AUTH}/google/callback?code=abc&state={state}", follow_redirects=False)
    assert cb.status_code == 302
    user = (await session.execute(select(User).where(User.email == "vitima@x.pt"))).scalar_one()
    await session.refresh(user)
    assert user.google_sub == "g-victim" and user.email_verified is True
    assert user.hashed_password is None  # a password do atacante desapareceu
    tokens = (await session.execute(select(RefreshToken).where(RefreshToken.user_id == user.id))).scalars().all()
    old = [t for t in tokens if t.revoked]
    assert old, "a sessão do atacante tem de ficar revogada"
    assert (await squatter.post(f"{AUTH}/refresh")).status_code == 401
    await squatter.aclose()


async def test_magic_link_on_an_unverified_account_drops_password_and_sessions(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "email_transport", "log")
    squatter = httpx.AsyncClient(transport=client._transport, base_url="http://test")
    await users.create_user(session, email="vitima@x.pt", password=PASSWORD)
    await session.commit()
    await squatter.post(f"{AUTH}/login", json={"email": "vitima@x.pt", "password": PASSWORD})
    await client.post(f"{AUTH}/magic-link", json={"email": "vitima@x.pt"})
    token = re.search(r"token=([\w-]+)", outbox.sent[-1]["text"]).group(1)  # type: ignore[union-attr]
    assert (await client.post(f"{AUTH}/magic-link/verify", json={"token": token})).status_code == 200
    user = (await session.execute(select(User).where(User.email == "vitima@x.pt"))).scalar_one()
    await session.refresh(user)
    assert user.hashed_password is None and user.email_verified is True
    assert (await squatter.post(f"{AUTH}/refresh")).status_code == 401  # a sessão antiga já não renova
    assert (await client.get(f"{AUTH}/me")).status_code == 200  # a nova (do dono) funciona
    await squatter.aclose()


async def test_verified_accounts_keep_their_password_on_magic_link(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "email_transport", "log")
    await users.create_user(session, email="ok@x.pt", password=PASSWORD, email_verified=True)
    await session.commit()
    await client.post(f"{AUTH}/magic-link", json={"email": "ok@x.pt"})
    token = re.search(r"token=([\w-]+)", outbox.sent[-1]["text"]).group(1)  # type: ignore[union-attr]
    await client.post(f"{AUTH}/magic-link/verify", json={"token": token})
    user = (await session.execute(select(User).where(User.email == "ok@x.pt"))).scalar_one()
    assert user.hashed_password is not None


# --- G: convidados são só de leitura nos dados partilhados --------------------------------------------------


async def test_guests_cannot_write_shared_data(make_user: Maker) -> None:
    guest = await make_user("g@x.pt", "guest")
    some = str(uuid.uuid4())
    attempts = [
        ("POST", "/api/v1/lots", {"fibre": "cotton"}),
        ("POST", "/api/v1/lots/ABC/items", {}),
        ("POST", "/api/v1/lots/ABC/state", {"state": "sorted"}),
        ("POST", "/api/v1/market/ABC/reserve", {"buyer": "x"}),
        ("PATCH", f"/api/v1/datasets/alerts/{some}", {"status": "resolved"}),
        ("PATCH", f"/api/v1/planning/scenarios/{some}", {"label": "novo"}),
        ("GET", "/api/v1/copilot/shared/abc", None),
    ]
    for method, path, body in attempts:
        resp = await guest.request(method, path, json=body) if body is not None else await guest.request(method, path)
        assert resp.status_code == 403 and resp.json()["code"] == "forbidden", (method, path, resp.text)


async def test_attachment_quota_per_user(
    logged_in: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch, session: AsyncSession
) -> None:
    s = get_settings()
    url = "/api/v1/copilot/attachments"
    one = [("files", ("a.txt", b"ola", "text/plain"))]
    monkeypatch.setattr(s, "copilot_attachments_per_user", 2)
    assert (await logged_in.post(url, files=one)).status_code == 201
    assert (await logged_in.post(url, files=one)).status_code == 201
    over = await logged_in.post(url, files=one)
    assert over.status_code == 400 and "limit" in over.json()["message"]
    monkeypatch.setattr(s, "copilot_attachments_per_user", 100)
    await session.execute(update(CopilotAttachment).values(size_bytes=s.copilot_attachments_max_mb * 1024 * 1024))
    await session.commit()
    full = await logged_in.post(url, files=one)
    assert full.status_code == 400 and "storage" in full.json()["message"]


# --- H: rotas caras ------------------------------------------------------------------------------------------


async def test_solver_routes_are_limited_per_user_and_by_global_concurrency(
    make_user: Maker, monkeypatch: pytest.MonkeyPatch
) -> None:
    s = get_settings()
    monkeypatch.setattr(s, "solver_runs_per_minute", 2)
    ana = await make_user("ana@x.pt")
    rui = await make_user("rui@x.pt")
    url = f"/api/v1/planning/compare-robustness?recommended_id={uuid.uuid4()}&alternative_id={uuid.uuid4()}"
    assert (await ana.get(url)).status_code == 404  # passou a guarda (o cenário é que não existe)
    assert (await ana.get(url)).status_code == 404
    limited = await ana.get(url)
    assert limited.status_code == 429 and limited.json()["code"] == "rate_limited"
    assert (await rui.get(url)).status_code == 404  # o limite é por utilizador
    assert solver_slots.busy == 0  # a vaga é devolvida mesmo quando o pedido falha

    monkeypatch.setattr(s, "solver_runs_per_minute", 100)
    monkeypatch.setattr(s, "solver_max_concurrency", 1)
    assert solver_slots.acquire()
    try:
        busy = await rui.get(url)
        assert busy.status_code == 429 and "busy" in busy.json()["message"]
    finally:
        solver_slots.release()
    assert (await rui.get(url)).status_code == 404


async def test_pdf_routes_are_limited_per_user(make_user: Maker, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "solver_runs_per_minute", 1)
    ana = await make_user("ana@x.pt")
    url = f"/api/v1/copilot/threads/{uuid.uuid4()}/export.pdf"
    assert (await ana.get(url)).status_code == 404
    assert (await ana.get(url)).status_code == 429


# --- I: registo e enumeração -------------------------------------------------------------------------------


async def test_registration_attempts_are_limited_per_ip(client: httpx.AsyncClient, behind_proxy: None) -> None:
    codes = []
    for i in range(12):
        resp = await client.post(
            f"{AUTH}/register", json={"email": f"n{i}@x.pt", "password": PASSWORD}, headers=xff("203.0.113.50")
        )
        codes.append(resp.status_code)
    assert codes[:10] == [201] * 10 and codes[10:] == [429, 429]


async def test_magic_link_for_unknown_accounts_leaves_no_token_and_answers_the_same(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "email_transport", "log")
    resp = await client.post(f"{AUTH}/magic-link", json={"email": "fantasma@x.pt"})
    assert resp.status_code == 204
    assert (
        await session.scalar(select(func.count()).select_from(LoginToken))
    ) == 0  # nenhum token para quem não existe
    assert len(outbox.sent) == 1 and "token=" not in outbox.sent[0]["text"]  # só o email neutro


# --- J: CSRF, cookies __Host- e cabeçalhos ---------------------------------------------------------------


async def test_cross_site_writes_are_refused(client: httpx.AsyncClient, make_user: Maker) -> None:
    body = {"email": "a@x.pt", "password": "errada"}
    for headers in ({"Origin": "https://evil.example"}, {"Origin": "null"}, {"Referer": "https://evil.example/x"}):
        resp = await client.post(f"{AUTH}/login", json=body, headers=headers)
        assert resp.status_code == 403 and resp.json()["code"] == "forbidden", headers
    for headers in ({"Origin": "http://localhost:3190"}, {"Referer": "http://localhost:3190/login"}, {}):
        assert (await client.post(f"{AUTH}/login", json=body, headers=headers)).status_code == 401, headers
    # leituras nunca são bloqueadas por esta guarda
    assert (await client.get(f"{AUTH}/config", headers={"Origin": "https://evil.example"})).status_code == 200
    ana = await make_user("ana@x.pt")
    bad = await ana.post(f"{AUTH}/logout-all", headers={"Origin": "https://evil.example"})
    assert bad.status_code == 403
    assert (await ana.get(f"{AUTH}/me")).status_code == 200  # nada foi feito


async def test_production_cookies_use_the_host_prefix_and_everything_still_works(
    client: httpx.AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "app_url", "https://novelo.test")
    monkeypatch.setattr(get_settings(), "cors_origins", ["https://novelo.test"])
    await users.create_user(session, email="boss@x.pt", password=PASSWORD, role="admin", email_verified=True)
    await users.create_user(session, email="rui@x.pt", password=PASSWORD, email_verified=True)
    await session.commit()
    c = httpx.AsyncClient(
        transport=client._transport, base_url="https://novelo.test", headers={"Origin": "https://novelo.test"}
    )
    login = await c.post(f"{AUTH}/login", json={"email": "boss@x.pt", "password": PASSWORD})
    assert login.status_code == 200
    raw = login.headers.get_list("set-cookie")
    assert any(h.startswith("__Host-access_token=") for h in raw) and any(
        h.startswith("__Host-refresh_token=") for h in raw
    )
    for h in raw:
        assert "Path=/;" in h + ";" and "Secure" in h and "domain" not in h.lower()
    assert (await c.get(f"{AUTH}/me")).json()["email"] == "boss@x.pt"
    assert (await c.post(f"{AUTH}/refresh")).status_code == 204  # o refresh também viaja com o prefixo
    assert (await c.get(f"{AUTH}/me")).status_code == 200

    rui = (await session.execute(select(User.id).where(User.email == "rui@x.pt"))).scalar_one()
    started = await c.post(f"/api/v1/users/{rui}/impersonate", json={"reason": "Apoio ao utilizador: teste"})
    assert started.status_code == 200
    assert (await c.get(f"{AUTH}/me")).json()["impersonation"]["active"] is True
    assert (await c.post(f"{AUTH}/impersonation/stop")).status_code == 200
    assert (await c.get(f"{AUTH}/me")).json()["email"] == "boss@x.pt"

    assert (await c.post(f"{AUTH}/logout")).status_code == 204
    assert (await c.get(f"{AUTH}/me")).status_code == 401
    await c.aclose()


async def test_api_adds_only_the_headers_nginx_lacks_in_production(
    client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    dev = await client.get(f"{AUTH}/config")
    assert dev.headers["x-content-type-options"] == "nosniff" and dev.headers["cache-control"] == "no-store"
    monkeypatch.setattr(get_settings(), "environment", "production")
    prod = await client.get(f"{AUTH}/config")
    assert "x-content-type-options" not in prod.headers and "x-frame-options" not in prod.headers
    assert prod.headers["cache-control"] == "no-store"
    assert "cache-control" not in (await client.get("/api/v1/health")).headers


# --- K: consumo atómico, passaporte, seed_admin, impersonação -----------------------------------------------


async def test_reset_and_verify_tokens_are_single_use(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    user = await users.create_user(session, email="ana@x.pt", password=PASSWORD)
    await session.commit()
    await client.post(f"{AUTH}/forgot-password", json={"email": "ana@x.pt"})
    reset = re.search(r"token=([\w-]+)", outbox.sent[-1]["text"]).group(1)  # type: ignore[union-attr]
    new = "outra-password-segura-1"
    assert (await client.post(f"{AUTH}/reset-password", json={"token": reset, "password": new})).status_code == 204
    again = await client.post(f"{AUTH}/reset-password", json={"token": reset, "password": "mais-uma-password-2"})
    assert again.status_code == 400 and again.json()["code"] == "invalid_token"
    row = (await session.execute(select(PasswordResetToken))).scalar_one()
    assert row.used_at is not None
    assert (await client.post(f"{AUTH}/login", json={"email": "ana@x.pt", "password": new})).status_code == 200

    await service.send_verification(session, outbox, user)
    verify = re.search(r"token=([\w-]+)", outbox.sent[-1]["text"]).group(1)  # type: ignore[union-attr]
    assert (await client.post(f"{AUTH}/verify-email", json={"token": verify})).status_code == 204
    assert (await client.post(f"{AUTH}/verify-email", json={"token": verify})).status_code == 400
    assert (await session.execute(select(EmailVerificationToken))).scalar_one().used_at is not None
    expired = (await session.execute(select(PasswordResetToken))).scalar_one()
    expired.used_at = None
    expired.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    await session.commit()
    RateLimiter.reset_all()
    stale = await client.post(f"{AUTH}/reset-password", json={"token": reset, "password": "mais-uma-password-2"})
    assert stale.status_code == 400


async def test_refresh_token_is_consumed_once_and_replay_revokes_everything(
    client: httpx.AsyncClient, session: AsyncSession
) -> None:
    await users.create_user(session, email="ana@x.pt", password=PASSWORD)
    await session.commit()
    first = await client.post(f"{AUTH}/login", json={"email": "ana@x.pt", "password": PASSWORD})
    old = first.cookies["refresh_token"]
    assert (await client.post(f"{AUTH}/refresh")).status_code == 204
    replay = httpx.AsyncClient(transport=client._transport, base_url="http://test", cookies={"refresh_token": old})
    assert (await replay.post(f"{AUTH}/refresh")).status_code == 401
    assert (await client.post(f"{AUTH}/refresh")).status_code == 401  # o reuso terminou todas as sessões
    live = (await session.execute(select(RefreshToken).where(RefreshToken.revoked.is_(False)))).scalars().all()
    assert live == []
    await replay.aclose()


async def test_concurrent_refresh_with_the_same_token_rotates_only_once(
    client: httpx.AsyncClient, session: AsyncSession
) -> None:
    await users.create_user(session, email="ana@x.pt", password=PASSWORD)
    await session.commit()
    token = (await client.post(f"{AUTH}/login", json={"email": "ana@x.pt", "password": PASSWORD})).cookies[
        "refresh_token"
    ]
    results = await asyncio.gather(
        service.rotate_refresh(session, token), service.rotate_refresh(session, token), return_exceptions=True
    )
    assert sum(not isinstance(r, BaseException) for r in results) == 1


async def test_public_passport_is_rate_limited_per_ip(
    client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(passport_limiter, "limit", 2)
    codes = [(await client.get("/api/v1/public/lots/NAOEXISTE")).status_code for _ in range(3)]
    assert codes == [404, 404, 429]
    qr = await client.get("/api/v1/public/lots/NAOEXISTE/qr")
    assert qr.status_code == 429


async def test_seed_admin_refuses_weak_passwords(session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    s = get_settings()
    monkeypatch.setattr(s, "admin_email", "root@x.pt")
    monkeypatch.setattr(s, "admin_password", "curta")
    await service.seed_admin(session)
    assert await users.get_by_email(session, "root@x.pt") is None
    monkeypatch.setattr(s, "admin_password", "uma-password-forte-123")
    await service.seed_admin(session)
    admin = await users.get_by_email(session, "root@x.pt")
    assert admin is not None and admin.role == "admin"


async def test_impersonating_admins_cannot_read_copilot_routes(make_user: Maker, session: AsyncSession) -> None:
    admin = await make_user("boss@x.pt", "admin")
    await make_user("rui@x.pt")
    rui = (await session.execute(select(User.id).where(User.email == "rui@x.pt"))).scalar_one()
    assert (await admin.get("/api/v1/copilot/threads")).status_code == 200  # fora da impersonação funciona
    started = await admin.post(f"/api/v1/users/{rui}/impersonate", json={"reason": "Apoio ao utilizador: teste"})
    assert started.status_code == 200
    for path in ("/api/v1/copilot/threads", "/api/v1/copilot/memory/entries", "/api/v1/copilot/history"):
        resp = await admin.get(path)
        assert resp.status_code == 403 and resp.json()["code"] == "impersonation_blocked", path
