"""Magic link e entrada por QR (convidados)."""

import re
import uuid
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.config import get_settings
from novelo.core.security import hash_token
from novelo.features.auth.models import LoginToken
from novelo.features.auth.passwordless import safe_next
from novelo.features.copilot.actions import ACTIONS, forbidden_for
from novelo.features.copilot.schemas_actions import ActionType
from novelo.features.users import service as users
from tests.conftest import PASSWORD, OutboxSender

AUTH = "/api/v1/auth"
CODE = "evento-teste-123"


@pytest.fixture(autouse=True)
def _event(monkeypatch: pytest.MonkeyPatch) -> None:
    s = get_settings()
    monkeypatch.setattr(s, "quick_join_enabled", True)
    monkeypatch.setattr(s, "quick_join_code", CODE)
    monkeypatch.setattr(s, "email_transport", "log")


def _token(outbox: OutboxSender, index: int = -1) -> str:
    match = re.search(r"token=([\w-]+)", outbox.sent[index]["text"])
    assert match
    return match.group(1)


def _join(email: str = "jurado@x.pt", **over: object) -> dict[str, object]:
    return {"name": "Rui Jurado", "email": email, "code": CODE, "consent": True, **over}


# --- magic link -----------------------------------------------------------------------------------


async def test_magic_link_happy_path(client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender) -> None:
    await users.create_user(session, email="ana@x.pt", password=PASSWORD)  # email por verificar
    resp = await client.post(f"{AUTH}/magic-link", json={"email": "Ana@X.pt", "next": "/scenarios"})
    assert resp.status_code == 204
    assert len(outbox.sent) == 1 and outbox.sent[0]["to"] == "ana@x.pt"
    token = _token(outbox)
    # Só o hash fica na base de dados.
    rows = (await session.execute(select(LoginToken))).scalars().all()
    assert len(rows) == 1 and rows[0].token_hash == hash_token(token) and token not in rows[0].token_hash
    assert rows[0].purpose == "magic_link" and rows[0].next_path == "/scenarios"
    assert timedelta(minutes=14) < rows[0].expires_at - datetime.now(UTC) <= timedelta(minutes=15)

    verified = await client.post(f"{AUTH}/magic-link/verify", json={"token": token})
    assert verified.status_code == 200
    body = verified.json()
    assert body["next"] == "/scenarios" and body["user"]["email"] == "ana@x.pt" and body["user"]["email_verified"]
    # Sessão longa (30 dias) nos cookies HttpOnly.
    cookies = verified.headers.get_list("set-cookie")
    refresh = next(c for c in cookies if c.startswith("refresh_token="))
    assert f"Max-Age={get_settings().refresh_token_days * 86400}" in refresh and "HttpOnly" in refresh
    assert (await client.get(f"{AUTH}/me")).json()["email"] == "ana@x.pt"


async def test_magic_link_is_single_use(client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender) -> None:
    await users.create_user(session, email="ana@x.pt", password=PASSWORD)
    await client.post(f"{AUTH}/magic-link", json={"email": "ana@x.pt"})
    token = _token(outbox)
    assert (await client.post(f"{AUTH}/magic-link/verify", json={"token": token})).status_code == 200
    again = await client.post(f"{AUTH}/magic-link/verify", json={"token": token})
    assert again.status_code == 400 and again.json()["code"] == "invalid_token"


async def test_magic_link_expired(client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender) -> None:
    await users.create_user(session, email="ana@x.pt", password=PASSWORD)
    await client.post(f"{AUTH}/magic-link", json={"email": "ana@x.pt"})
    token = _token(outbox)
    await session.execute(update(LoginToken).values(expires_at=datetime.now(UTC) - timedelta(seconds=1)))
    await session.commit()
    resp = await client.post(f"{AUTH}/magic-link/verify", json={"token": token})
    assert resp.status_code == 400 and resp.json()["code"] == "invalid_token"
    assert (await client.get(f"{AUTH}/me")).status_code == 401


async def test_magic_link_unknown_token_and_unknown_email(client: httpx.AsyncClient, outbox: OutboxSender) -> None:
    bad = await client.post(f"{AUTH}/magic-link/verify", json={"token": "x" * 43})
    assert bad.status_code == 400 and bad.json()["code"] == "invalid_token"
    # Email sem conta: 204, nenhum email, nenhum token.
    resp = await client.post(f"{AUTH}/magic-link", json={"email": "ninguem@x.pt"})
    assert resp.status_code == 204 and resp.content == b"" and outbox.sent == []


async def test_magic_link_inactive_account_gets_nothing(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    user = await users.create_user(session, email="off@x.pt", password=PASSWORD)
    user.is_active = False
    await session.commit()
    assert (await client.post(f"{AUTH}/magic-link", json={"email": "off@x.pt"})).status_code == 204
    assert outbox.sent == []


async def test_magic_link_rate_limits(client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender) -> None:
    await users.create_user(session, email="ana@x.pt", password=PASSWORD)
    # Por email: o 4.º pedido é ignorado em silêncio (mesma resposta, sem email).
    for _ in range(5):
        assert (await client.post(f"{AUTH}/magic-link", json={"email": "ana@x.pt"})).status_code == 204
    assert len(outbox.sent) == 3
    # Por IP: depois do limite responde 429.
    codes = [(await client.post(f"{AUTH}/magic-link", json={"email": f"u{i}@x.pt"})).status_code for i in range(10)]
    assert codes[-1] == 429 and codes[0] == 204


@pytest.mark.parametrize(
    "value",
    ["https://evil.pt", "//evil.pt", "/\\evil.pt", "javascript:alert(1)", "evil.pt/x", "/a\nb", "/" + "a" * 300],
)
def test_safe_next_blocks_open_redirect(value: str) -> None:
    assert safe_next(value) == "/"


def test_safe_next_keeps_relative_paths() -> None:
    assert safe_next("/scenarios/1?tab=map") == "/scenarios/1?tab=map"
    assert safe_next(None) == "/"


async def test_open_redirect_never_stored(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    await users.create_user(session, email="ana@x.pt", password=PASSWORD)
    await client.post(f"{AUTH}/magic-link", json={"email": "ana@x.pt", "next": "https://evil.pt/x"})
    verified = await client.post(f"{AUTH}/magic-link/verify", json={"token": _token(outbox)})
    assert verified.json()["next"] == "/"


async def test_magic_link_disabled_without_transport(
    client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    s = get_settings()
    monkeypatch.setattr(s, "email_transport", "resend")
    monkeypatch.setattr(s, "resend_api_key", "")
    assert (await client.get(f"{AUTH}/config")).json()["magic_link_enabled"] is False
    resp = await client.post(f"{AUTH}/magic-link", json={"email": "ana@x.pt"})
    assert resp.status_code == 503 and resp.json()["code"] == "feature_disabled"


# --- quick join -----------------------------------------------------------------------------------


async def test_quick_join_info_and_config(client: httpx.AsyncClient) -> None:
    info = (await client.get(f"{AUTH}/quick-join/info")).json()
    assert info["enabled"] is True and info["consent_version"]
    assert (await client.get(f"{AUTH}/config")).json()["quick_join_enabled"] is True


async def test_quick_join_new_guest_signs_in(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    resp = await client.post(f"{AUTH}/quick-join", json=_join("Jurado@X.pt"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "signed_in" and body["user"]["role"] == "guest"
    assert body["user"]["email"] == "jurado@x.pt" and body["user"]["email_verified"] is False
    assert body["user"]["joined_via"] == "quick_join"
    me = await client.get(f"{AUTH}/me")
    assert me.json()["role"] == "guest"
    # Sessão longa e email de boas-vindas.
    assert any(f"Max-Age={get_settings().refresh_token_days * 86400}" in c for c in resp.headers.get_list("set-cookie"))
    assert len(outbox.sent) == 1 and outbox.sent[0]["to"] == "jurado@x.pt"
    # RGPD: consentimento com data e versão do texto.
    user = await users.get_by_email(session, "jurado@x.pt")
    assert user and user.consent_at and user.consent_version == get_settings().quick_join_consent_version
    assert user.hashed_password is None


async def test_quick_join_existing_account_does_not_sign_in(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    await users.create_user(session, email="chefe@x.pt", password=PASSWORD, role="admin", email_verified=True)
    resp = await client.post(f"{AUTH}/quick-join", json=_join("chefe@x.pt", name="Impostor"))
    assert resp.status_code == 200 and resp.json() == {"status": "check_email", "user": None}
    assert not any(c.startswith(("access_token=", "refresh_token=")) for c in resp.headers.get_list("set-cookie"))
    assert (await client.get(f"{AUTH}/me")).status_code == 401
    # Só chega um magic link à caixa do dono; o nome e o role da conta ficam intactos.
    assert len(outbox.sent) == 1 and outbox.sent[0]["to"] == "chefe@x.pt"
    owner = await users.get_by_email(session, "chefe@x.pt")
    assert owner and owner.role == "admin" and owner.name is None
    token = (await session.execute(select(LoginToken))).scalar_one()
    assert token.purpose == "quick_join"
    verified = await client.post(f"{AUTH}/magic-link/verify", json={"token": _token(outbox)})
    assert verified.status_code == 200 and verified.json()["user"]["role"] == "admin"


async def test_quick_join_wrong_code_and_consent(client: httpx.AsyncClient, outbox: OutboxSender) -> None:
    wrong = await client.post(f"{AUTH}/quick-join", json=_join(code="errado"))
    assert wrong.status_code == 403 and wrong.json()["code"] == "invalid_event_code"
    assert outbox.sent == []
    no_consent = await client.post(f"{AUTH}/quick-join", json=_join(consent=False))
    assert no_consent.status_code == 422
    blank = await client.post(f"{AUTH}/quick-join", json=_join(name="   "))
    assert blank.status_code == 422


async def test_quick_join_code_guessing_is_limited(client: httpx.AsyncClient) -> None:
    codes = [(await client.post(f"{AUTH}/quick-join", json=_join(code=f"x{i}"))).status_code for i in range(12)]
    assert codes[0] == 403 and codes[-1] == 429
    # Bloqueado: nem o código certo entra enquanto durar a janela.
    assert (await client.post(f"{AUTH}/quick-join", json=_join())).status_code == 429


async def test_quick_join_disabled(client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "quick_join_enabled", False)
    assert (await client.get(f"{AUTH}/quick-join/info")).json()["enabled"] is False
    resp = await client.post(f"{AUTH}/quick-join", json=_join())
    assert resp.status_code == 503 and resp.json()["code"] == "feature_disabled"


async def test_quick_join_needs_code_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    s = get_settings()
    monkeypatch.setattr(s, "quick_join_code", "")
    monkeypatch.setattr(s, "environment", "production")
    assert s.quick_join_active is False
    monkeypatch.setattr(s, "environment", "development")
    assert s.quick_join_active is True  # código de dev por omissão


async def test_quick_join_same_email_twice_is_rate_limited(client: httpx.AsyncClient) -> None:
    results = [(await client.post(f"{AUTH}/quick-join", json=_join())).status_code for _ in range(4)]
    assert results[:3] == [200, 200, 200] and results[3] == 429


async def test_quick_join_qr_admin_only(client: httpx.AsyncClient, make_user) -> None:  # type: ignore[no-untyped-def]
    assert (await client.get(f"{AUTH}/quick-join/qr")).status_code == 401
    op = await make_user("op@x.pt")
    assert (await op.get(f"{AUTH}/quick-join/qr")).status_code == 403
    admin = await make_user("admin@x.pt", "admin")
    qr = await admin.get(f"{AUTH}/quick-join/qr")
    assert qr.status_code == 200 and qr.headers["content-type"].startswith("application/json")
    body = qr.json()
    assert body["svg"].lstrip().startswith("<svg")
    assert body["url"].endswith(f"/join?c={body['code']}") and body["code"]


async def test_guest_list_admin_only_with_pagination(
    client: httpx.AsyncClient,
    make_user,
    session: AsyncSession,  # type: ignore[no-untyped-def]
) -> None:
    for i in range(3):
        await client.post(f"{AUTH}/quick-join", json=_join(f"g{i}@x.pt", name=f"Convidado {i}"))
    guest_forbidden = await client.get(f"{AUTH}/quick-join/guests")
    assert guest_forbidden.status_code == 403  # o próprio convidado não vê a lista
    admin = await make_user("admin@x.pt", "admin")
    page = (await admin.get(f"{AUTH}/quick-join/guests", params={"limit": 2})).json()
    assert page["total"] == 3 and len(page["items"]) == 2 and page["limit"] == 2 and page["offset"] == 0
    assert page["items"][0]["actions_count"] == 0
    assert {"name", "email", "joined_at", "last_login_at", "consent_version"} <= page["items"][0].keys()
    rest = (await admin.get(f"{AUTH}/quick-join/guests", params={"offset": 2, "limit": 2})).json()
    assert len(rest["items"]) == 1
    # Sem repetidos entre páginas (a ordenação desempata por id).
    assert {g["email"] for g in page["items"]} | {g["email"] for g in rest["items"]} == {
        "g0@x.pt",
        "g1@x.pt",
        "g2@x.pt",
    }
    found = (await admin.get(f"{AUTH}/quick-join/guests", params={"q": "convidado 1"})).json()
    assert found["total"] == 1
    # Operadores e administradores não aparecem como convidados.
    assert all(g["email"].startswith("g") for g in page["items"])


# --- permissões do guest ---------------------------------------------------------------------------


async def test_guest_has_no_admin_access(client: httpx.AsyncClient) -> None:
    await client.post(f"{AUTH}/quick-join", json=_join())
    assert (await client.get("/api/v1/users")).status_code == 403
    assert (await client.get("/api/v1/ai/settings")).status_code == 403
    assert (await client.put("/api/v1/planning/parameters", json={})).status_code == 403
    assert (await client.get(f"{AUTH}/quick-join/qr")).status_code == 403
    # Mas lê dados normalmente, como um operador.
    assert (await client.get("/api/v1/planning/scenarios")).status_code == 200


async def test_guest_cannot_delete_scenarios(client: httpx.AsyncClient) -> None:
    await client.post(f"{AUTH}/quick-join", json=_join())
    resp = await client.delete(f"/api/v1/planning/scenarios/{uuid.uuid4()}")
    assert resp.status_code == 403 and resp.json()["code"] == "forbidden"


async def test_guest_solver_runs_are_limited(client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "guest_solver_per_hour", 2)
    await client.post(f"{AUTH}/quick-join", json=_join())
    url = "/api/v1/planning/benchmarks/inexistente/scenario"
    codes = [(await client.post(url, json={})).status_code for _ in range(3)]
    assert codes[-1] == 429 and 429 not in codes[:2]


async def test_guest_blocked_from_critical_copilot_actions() -> None:
    blocked = {t for t, d in ACTIONS.items() if forbidden_for(d, "guest")}
    assert {
        ActionType.DELETE_SCENARIO,
        ActionType.DELETE_MY_COPILOT_DATA,
        ActionType.RESERVE_LOT,
        ActionType.SET_USER_ROLE,
        ActionType.UPDATE_PARAMETER,
    } <= blocked
    assert not forbidden_for(ACTIONS[ActionType.CREATE_SCENARIO], "guest")
    assert not any(forbidden_for(d, "operator") for t, d in ACTIONS.items() if not d.admin_only)
