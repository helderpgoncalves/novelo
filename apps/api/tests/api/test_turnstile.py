"""Cloudflare Turnstile: guarda das rotas públicas, adapter e honeypot."""

import httpx
import pytest

from novelo.adapters.turnstile import SITEVERIFY_URL, CloudflareTurnstile, TurnstileUnavailableError
from novelo.core.config import TURNSTILE_TEST_SECRET_PASS, get_settings
from novelo.core.hardening import AUTH_BODY_LIMIT
from tests.conftest import PASSWORD, FakeTurnstile

AUTH = "/api/v1/auth"
HEADER = "X-Turnstile-Token"
CODE = "evento-teste-123"


@pytest.fixture(autouse=True)
def _on(monkeypatch: pytest.MonkeyPatch) -> None:
    s = get_settings()
    monkeypatch.setattr(s, "turnstile_enabled_mode", "auto")
    monkeypatch.setattr(s, "turnstile_secret_key", "real-secret")
    monkeypatch.setattr(s, "turnstile_site_key", "site-key")
    monkeypatch.setattr(s, "quick_join_enabled", True)
    monkeypatch.setattr(s, "quick_join_code", CODE)
    monkeypatch.setattr(s, "email_transport", "log")


PUBLIC_POSTS: list[tuple[str, dict[str, object]]] = [
    ("/register", {"email": "a@x.pt", "password": PASSWORD}),
    ("/login", {"email": "a@x.pt", "password": PASSWORD}),
    ("/forgot-password", {"email": "a@x.pt"}),
    ("/reset-password", {"token": "x" * 30, "password": PASSWORD}),
    ("/magic-link", {"email": "a@x.pt"}),
    ("/quick-join", {"name": "Rui", "email": "a@x.pt", "code": CODE, "consent": True}),
]


@pytest.mark.parametrize(("path", "body"), PUBLIC_POSTS)
async def test_protected_routes_need_a_token(client: httpx.AsyncClient, path: str, body: dict[str, object]) -> None:
    resp = await client.post(AUTH + path, json=body)
    assert resp.status_code == 400 and resp.json()["code"] == "captcha_required"


@pytest.mark.parametrize(("path", "body"), PUBLIC_POSTS)
async def test_protected_routes_reject_bad_token(client: httpx.AsyncClient, path: str, body: dict[str, object]) -> None:
    resp = await client.post(AUTH + path, json=body, headers={HEADER: "bad"})
    assert resp.status_code == 403 and resp.json()["code"] == "captcha_failed"


@pytest.mark.parametrize(("path", "body"), PUBLIC_POSTS)
async def test_protected_routes_report_cloudflare_down(
    client: httpx.AsyncClient, path: str, body: dict[str, object]
) -> None:
    resp = await client.post(AUTH + path, json=body, headers={HEADER: "down"})
    assert resp.status_code == 503 and resp.json()["code"] == "captcha_unavailable"


@pytest.mark.parametrize(("path", "body"), PUBLIC_POSTS)
async def test_protected_routes_pass_the_guard_with_a_valid_token(
    client: httpx.AsyncClient, turnstile: FakeTurnstile, path: str, body: dict[str, object]
) -> None:
    resp = await client.post(AUTH + path, json=body, headers={HEADER: "good"})
    assert resp.content == b"" or not str(resp.json().get("code", "")).startswith("captcha_")
    assert [t for t, _ in turnstile.seen] == ["good"]


async def test_register_and_login_work_end_to_end(client: httpx.AsyncClient) -> None:
    ok = {HEADER: "good"}
    assert (await client.post(f"{AUTH}/register", json=PUBLIC_POSTS[0][1], headers=ok)).status_code == 201
    assert (await client.post(f"{AUTH}/login", json=PUBLIC_POSTS[1][1], headers=ok)).status_code == 200


async def test_resend_verification_needs_a_token(client: httpx.AsyncClient) -> None:
    logged_in = client
    await client.post(f"{AUTH}/register", json=PUBLIC_POSTS[0][1], headers={HEADER: "good"})
    resp = await logged_in.post(f"{AUTH}/resend-verification")
    assert resp.status_code == 400 and resp.json()["code"] == "captcha_required"
    assert (await logged_in.post(f"{AUTH}/resend-verification", headers={HEADER: "good"})).status_code == 204


async def test_token_is_checked_on_every_request(client: httpx.AsyncClient, turnstile: FakeTurnstile) -> None:
    for _ in range(2):
        await client.post(f"{AUTH}/login", json=PUBLIC_POSTS[1][1], headers={HEADER: "good"})
    assert len(turnstile.seen) == 2  # nada é guardado em cache: a Cloudflare recusa a reutilização


async def test_authenticated_and_token_routes_are_not_guarded(
    client: httpx.AsyncClient, turnstile: FakeTurnstile
) -> None:
    assert (await client.get(f"{AUTH}/config")).status_code == 200
    assert (await client.post(f"{AUTH}/verify-email", json={"token": "x" * 30})).json()["code"] == "invalid_token"
    assert (await client.post(f"{AUTH}/magic-link/verify", json={"token": "x" * 30})).json()[
        "code"
    ] != "captcha_required"
    assert turnstile.seen == []


async def test_wrong_action_or_hostname_is_rejected(client: httpx.AsyncClient, turnstile: FakeTurnstile) -> None:
    turnstile.action = "register"
    resp = await client.post(f"{AUTH}/login", json=PUBLIC_POSTS[1][1], headers={HEADER: "good"})
    assert resp.status_code == 403 and resp.json()["code"] == "captcha_failed"
    turnstile.action = ""
    turnstile.hostname = "evil.example"
    resp = await client.post(f"{AUTH}/login", json=PUBLIC_POSTS[1][1], headers={HEADER: "good"})
    assert resp.status_code == 403 and resp.json()["code"] == "captcha_failed"


async def test_oversized_token_is_required_error(client: httpx.AsyncClient) -> None:
    resp = await client.post(f"{AUTH}/login", json=PUBLIC_POSTS[1][1], headers={HEADER: "x" * 3000})
    assert resp.json()["code"] == "captcha_required"


# --- configuração: auto, desligado, obrigatório --------------------------------------------------


async def test_config_exposes_turnstile(client: httpx.AsyncClient) -> None:
    body = (await client.get(f"{AUTH}/config")).json()
    assert body["turnstile_enabled"] is True and body["turnstile_site_key"] == "site-key"


async def test_disabled_skips_the_guard(client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "turnstile_enabled_mode", "false")
    body = (await client.get(f"{AUTH}/config")).json()
    assert body["turnstile_enabled"] is False and body["turnstile_site_key"] is None
    resp = await client.post(f"{AUTH}/login", json=PUBLIC_POSTS[1][1])
    assert resp.json()["code"] == "invalid_credentials"


async def test_auto_without_secret_in_production_is_off_with_a_warning(monkeypatch: pytest.MonkeyPatch) -> None:
    s = get_settings()
    monkeypatch.setattr(s, "environment", "production")
    monkeypatch.setattr(s, "turnstile_secret_key", "")
    monkeypatch.setattr(s, "turnstile_site_key", "")
    assert s.turnstile_enabled is False and s.turnstile_secret == "" and s.turnstile_site is None


async def test_required_without_secret_fails_closed(client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    s = get_settings()
    monkeypatch.setattr(s, "environment", "production")
    monkeypatch.setattr(s, "turnstile_secret_key", "")
    monkeypatch.setattr(s, "turnstile_required", True)
    resp = await client.post(f"{AUTH}/login", json=PUBLIC_POSTS[1][1], headers={HEADER: "good"})
    assert resp.status_code == 503 and resp.json()["code"] == "captcha_unavailable"
    assert (await client.get(f"{AUTH}/config")).json()["turnstile_site_key"] is None


async def test_development_defaults_to_cloudflare_test_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    s = get_settings()
    monkeypatch.setattr(s, "environment", "development")
    monkeypatch.setattr(s, "turnstile_secret_key", "")
    monkeypatch.setattr(s, "turnstile_site_key", "")
    assert s.turnstile_secret == TURNSTILE_TEST_SECRET_PASS
    assert s.turnstile_site == "1x00000000000000000000AA" and s.turnstile_enabled is True


# --- honeypot, limites e cabeçalhos ----------------------------------------------------------------


async def test_honeypot_register_is_rejected(client: httpx.AsyncClient) -> None:
    body = {**PUBLIC_POSTS[0][1], "website": "http://spam.example"}
    resp = await client.post(f"{AUTH}/register", json=body, headers={HEADER: "good"})
    assert resp.status_code == 400
    assert (await client.post(f"{AUTH}/login", json=PUBLIC_POSTS[1][1], headers={HEADER: "good"})).status_code == 401


async def test_honeypot_quick_join_pretends_success(client: httpx.AsyncClient) -> None:
    body = {**PUBLIC_POSTS[5][1], "website": "x"}
    resp = await client.post(f"{AUTH}/quick-join", json=body, headers={HEADER: "good"})
    assert resp.status_code == 200 and resp.json()["status"] == "check_email"
    assert "set-cookie" not in resp.headers


async def test_auth_body_limit_and_security_headers(client: httpx.AsyncClient) -> None:
    big = await client.post(f"{AUTH}/login", content=b"x" * (AUTH_BODY_LIMIT + 1))
    assert big.status_code == 413 and big.json()["code"] == "bad_request"
    resp = await client.get(f"{AUTH}/config")
    assert resp.headers["x-content-type-options"] == "nosniff" and resp.headers["x-frame-options"] == "DENY"


# --- adapter Cloudflare ------------------------------------------------------------------------------


def _adapter(handler: httpx.MockTransport) -> CloudflareTurnstile:
    return CloudflareTurnstile("secret", 2.0, transport=handler)


async def test_adapter_posts_secret_response_and_ip() -> None:
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == SITEVERIFY_URL
        seen.update(dict(p.split("=", 1) for p in request.content.decode().split("&")))
        return httpx.Response(200, json={"success": True, "hostname": "novelo.helder.si", "action": "login"})

    result = await _adapter(httpx.MockTransport(handler)).verify("tok", "1.2.3.4")
    assert result.success and result.hostname == "novelo.helder.si" and result.action == "login"
    assert seen == {"secret": "secret", "response": "tok", "remoteip": "1.2.3.4"}


async def test_adapter_failure_and_outage() -> None:
    fail = httpx.MockTransport(
        lambda _: httpx.Response(200, json={"success": False, "error-codes": ["timeout-or-duplicate"]})
    )
    result = await _adapter(fail).verify("tok", None)
    assert not result.success and result.error_codes == ["timeout-or-duplicate"]

    for transport in (
        httpx.MockTransport(lambda _: httpx.Response(502)),
        httpx.MockTransport(lambda _: httpx.Response(200, text="<html>")),
        httpx.MockTransport(lambda _: httpx.Response(200, json={"success": False, "error-codes": ["internal-error"]})),
        httpx.MockTransport(
            lambda _: httpx.Response(200, json={"success": False, "error-codes": ["invalid-input-secret"]})
        ),
    ):
        with pytest.raises(TurnstileUnavailableError):
            await _adapter(transport).verify("tok", None)

    def boom(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("slow")

    with pytest.raises(TurnstileUnavailableError):
        await _adapter(httpx.MockTransport(boom)).verify("tok", None)
