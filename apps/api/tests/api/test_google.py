import httpx
import pytest

from novelo.core import config
from novelo.features.auth import google

AUTH = "/api/v1/auth"


@pytest.fixture
def google_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "secret")
    config.get_settings.cache_clear()
    yield
    config.get_settings.cache_clear()


async def test_google_login_redirects_with_state(client: httpx.AsyncClient, google_on: None) -> None:
    resp = await client.get(f"{AUTH}/google/login?next=/circuitos", follow_redirects=False)
    assert resp.status_code == 302
    assert resp.headers["location"].startswith("https://accounts.google.com/")
    assert "state=" in resp.headers["location"] and "oauth_state" in resp.headers["set-cookie"]


async def test_callback_with_wrong_state_is_refused(client: httpx.AsyncClient, google_on: None) -> None:
    resp = await client.get(f"{AUTH}/google/callback?code=x&state=forjado", follow_redirects=False)
    assert resp.status_code == 302 and "error=google_failed" in resp.headers["location"]


async def test_callback_creates_and_links_user(
    client: httpx.AsyncClient, google_on: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_profile(code: str, transport: object = None) -> dict[str, str]:
        return {"sub": "g-123", "email": "Rita@Vitrus.pt", "name": "Rita", "picture": "https://x/y.png"}

    monkeypatch.setattr(google, "fetch_profile", fake_profile)
    login = await client.get(f"{AUTH}/google/login?next=/circuitos", follow_redirects=False)
    state = httpx.URL(login.headers["location"]).params["state"]
    cb = await client.get(f"{AUTH}/google/callback?code=abc&state={state}", follow_redirects=False)
    # conta nova por Google nunca é aprovada sozinha: vai para o ecrã de espera
    assert cb.status_code == 302 and cb.headers["location"].endswith("/pending-approval")
    me = (await client.get(f"{AUTH}/me")).json()
    assert me["email"] == "rita@vitrus.pt" and me["google_linked"] and not me["has_password"]
    assert me["approval_status"] == "pending"
    assert (await client.get("/api/v1/planning/zones")).json()["code"] == "account_pending"
