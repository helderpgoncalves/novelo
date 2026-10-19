import re
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.security import hash_token
from novelo.features.auth.models import PasswordResetToken
from tests.conftest import PASSWORD, OutboxSender

AUTH = "/api/v1/auth"


async def test_register_login_me_logout(client: httpx.AsyncClient) -> None:
    resp = await client.post(f"{AUTH}/register", json={"email": "Ana@Vitrus.pt", "password": PASSWORD, "name": "Ana"})
    assert resp.status_code == 201
    assert resp.json()["email"] == "ana@vitrus.pt"  # normalizado
    assert "access_token" in resp.cookies and "refresh_token" in resp.cookies
    assert "HttpOnly" in resp.headers["set-cookie"]

    me = await client.get(f"{AUTH}/me")
    assert me.json()["name"] == "Ana"

    assert (await client.post(f"{AUTH}/logout")).status_code == 204
    assert (await client.get(f"{AUTH}/me")).status_code == 401


async def test_register_rejects_weak_password_and_duplicates(client: httpx.AsyncClient) -> None:
    weak = await client.post(f"{AUTH}/register", json={"email": "a@b.pt", "password": "curta"})
    assert weak.status_code == 422
    ok = {"email": "a@b.pt", "password": PASSWORD}
    assert (await client.post(f"{AUTH}/register", json=ok)).status_code == 201
    assert (await client.post(f"{AUTH}/register", json=ok)).status_code == 409


async def test_login_wrong_password_is_generic(client: httpx.AsyncClient) -> None:
    await client.post(f"{AUTH}/register", json={"email": "a@b.pt", "password": PASSWORD})
    wrong = await client.post(f"{AUTH}/login", json={"email": "a@b.pt", "password": "errada-errada-1"})
    unknown = await client.post(f"{AUTH}/login", json={"email": "x@b.pt", "password": "errada-errada-1"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["message"] == unknown.json()["message"]


async def test_refresh_rotates_and_detects_reuse(client: httpx.AsyncClient) -> None:
    await client.post(f"{AUTH}/register", json={"email": "a@b.pt", "password": PASSWORD})
    old_refresh = client.cookies.get("refresh_token", path="/api/v1/auth")
    assert old_refresh
    assert (await client.post(f"{AUTH}/refresh")).status_code == 204
    new_refresh = client.cookies.get("refresh_token", path="/api/v1/auth")
    assert new_refresh and new_refresh != old_refresh

    # Reutilizar o token antigo termina todas as sessões.
    client.cookies.set("refresh_token", old_refresh, path="/api/v1/auth")
    assert (await client.post(f"{AUTH}/refresh")).status_code == 401
    client.cookies.set("refresh_token", new_refresh, path="/api/v1/auth")
    assert (await client.post(f"{AUTH}/refresh")).status_code == 401


async def test_password_reset_flow(client: httpx.AsyncClient, outbox: OutboxSender) -> None:
    await client.post(f"{AUTH}/register", json={"email": "a@b.pt", "password": PASSWORD})
    outbox.sent.clear()

    # Conta inexistente: mesma resposta, nenhum email.
    assert (await client.post(f"{AUTH}/forgot-password", json={"email": "nao@existe.pt"})).status_code == 204
    assert outbox.sent == []

    assert (await client.post(f"{AUTH}/forgot-password", json={"email": "a@b.pt"})).status_code == 204
    assert len(outbox.sent) == 1
    token = re.search(r"token=([\w-]+)", outbox.sent[0]["text"]).group(1)  # type: ignore[union-attr]

    new_password = "outra-password-segura-9"
    assert (
        await client.post(f"{AUTH}/reset-password", json={"token": token, "password": new_password})
    ).status_code == 204
    # Uso único.
    assert (
        await client.post(f"{AUTH}/reset-password", json={"token": token, "password": new_password})
    ).status_code == 400
    # A password antiga deixa de funcionar e a nova entra.
    assert (await client.post(f"{AUTH}/login", json={"email": "a@b.pt", "password": PASSWORD})).status_code == 401
    assert (await client.post(f"{AUTH}/login", json={"email": "a@b.pt", "password": new_password})).status_code == 200


async def test_expired_reset_token_is_rejected(
    client: httpx.AsyncClient, session: AsyncSession, outbox: OutboxSender
) -> None:
    await client.post(f"{AUTH}/register", json={"email": "a@b.pt", "password": PASSWORD})
    await client.post(f"{AUTH}/forgot-password", json={"email": "a@b.pt"})
    token = re.search(r"token=([\w-]+)", outbox.sent[-1]["text"]).group(1)  # type: ignore[union-attr]
    row = (
        await session.execute(select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(token)))
    ).scalar_one()
    row.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    await session.commit()
    resp = await client.post(f"{AUTH}/reset-password", json={"token": token, "password": "outra-password-segura-9"})
    assert resp.status_code == 400


async def test_change_password_requires_current(logged_in: httpx.AsyncClient) -> None:
    bad = await logged_in.post(
        f"{AUTH}/change-password",
        json={"current_password": "errada-errada-1", "new_password": "nova-password-segura-1"},
    )
    assert bad.status_code == 400 and bad.json()["code"] == "current_password_incorrect"
    ok = await logged_in.post(
        f"{AUTH}/change-password", json={"current_password": PASSWORD, "new_password": "nova-password-segura-1"}
    )
    assert ok.status_code == 204
    assert (await logged_in.get(f"{AUTH}/me")).status_code == 401  # sessões terminadas


async def test_login_is_rate_limited(client: httpx.AsyncClient) -> None:
    codes = [
        (await client.post(f"{AUTH}/login", json={"email": "a@b.pt", "password": "x"})).status_code for _ in range(12)
    ]
    assert codes[-1] == 429


async def test_auth_config(client: httpx.AsyncClient) -> None:
    body = (await client.get(f"{AUTH}/config")).json()
    assert body == {"google_enabled": False, "registration_open": True, "password_min_length": 10}


async def test_remember_me_controls_cookie_lifetime(client: httpx.AsyncClient) -> None:
    await client.post(f"{AUTH}/register", json={"email": "a@b.pt", "password": PASSWORD})
    persistent = await client.post(f"{AUTH}/login", json={"email": "a@b.pt", "password": PASSWORD, "remember_me": True})
    session_only = await client.post(
        f"{AUTH}/login", json={"email": "a@b.pt", "password": PASSWORD, "remember_me": False}
    )
    refresh_header = lambda r: next(h for h in r.headers.get_list("set-cookie") if h.startswith("refresh_token"))  # noqa: E731
    assert "Max-Age" in refresh_header(persistent)
    assert "Max-Age" not in refresh_header(session_only)
    # O refresh mantém a escolha ao rodar.
    rotated = await client.post(f"{AUTH}/refresh")
    assert rotated.status_code == 204
    assert "Max-Age" not in refresh_header(rotated)


async def test_email_verification_flow(client: httpx.AsyncClient, outbox: OutboxSender) -> None:
    await client.post(f"{AUTH}/register", json={"email": "a@b.pt", "password": PASSWORD})
    assert (await client.get(f"{AUTH}/me")).json()["email_verified"] is False
    assert len(outbox.sent) == 1 and "verify-email?token=" in outbox.sent[0]["text"]
    token = re.search(r"token=([\w-]+)", outbox.sent[0]["text"]).group(1)  # type: ignore[union-attr]

    assert (await client.post(f"{AUTH}/verify-email", json={"token": token})).status_code == 204
    assert (await client.get(f"{AUTH}/me")).json()["email_verified"] is True
    assert (await client.post(f"{AUTH}/verify-email", json={"token": token})).status_code == 400  # uso único

    outbox.sent.clear()
    assert (await client.post(f"{AUTH}/resend-verification")).status_code == 204
    assert outbox.sent == []  # já confirmado: nada a enviar


async def test_resend_verification_sends_new_link(client: httpx.AsyncClient, outbox: OutboxSender) -> None:
    await client.post(f"{AUTH}/register", json={"email": "a@b.pt", "password": PASSWORD})
    outbox.sent.clear()
    assert (await client.post(f"{AUTH}/resend-verification")).status_code == 204
    assert len(outbox.sent) == 1


async def test_update_profile_and_logout_all(logged_in: httpx.AsyncClient) -> None:
    resp = await logged_in.patch(f"{AUTH}/me", json={"name": "  Ana Silva "})
    assert resp.json()["name"] == "Ana Silva"
    assert (await logged_in.post(f"{AUTH}/logout-all")).status_code == 204
    assert (await logged_in.post(f"{AUTH}/refresh")).status_code == 401


async def test_errors_have_stable_typed_codes(client: httpx.AsyncClient) -> None:
    wrong = await client.post(f"{AUTH}/login", json={"email": "x@b.pt", "password": "x"})
    assert wrong.json() == {"code": "invalid_credentials", "message": "Wrong email or password"}

    invalid = await client.post(f"{AUTH}/register", json={"email": "no-es-email", "password": "curta"})
    body = invalid.json()
    assert invalid.status_code == 422 and body["code"] == "validation_error"
    assert {f["field"] for f in body["fields"]} == {"email", "password"}

    token = await client.post(f"{AUTH}/reset-password", json={"token": "x" * 30, "password": PASSWORD})
    assert token.json()["code"] == "invalid_token"


async def test_emails_follow_the_account_language(client: httpx.AsyncClient, outbox: OutboxSender) -> None:
    await client.post(f"{AUTH}/register", json={"email": "a@b.pt", "password": PASSWORD, "locale": "en"})
    assert outbox.sent[0]["subject"] == "Confirm your email on Novelo"
    assert (await client.get(f"{AUTH}/me")).json()["locale"] == "en"
    patched = await client.patch(f"{AUTH}/me", json={"locale": "pt-PT"})
    assert patched.json()["locale"] == "pt-PT"
    outbox.sent.clear()
    await client.post(f"{AUTH}/forgot-password", json={"email": "a@b.pt", "locale": "en"})
    assert outbox.sent[0]["subject"] == "Recuperar a password do Novelo"  # a preferência da conta tem prioridade
