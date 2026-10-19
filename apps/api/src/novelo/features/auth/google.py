"""Google OAuth 2.0 (authorization code) com `state` assinado e preso a um cookie."""

from urllib.parse import urlencode

import httpx

from novelo.core.config import get_settings
from novelo.core.errors import UpstreamError

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def authorization_url(state: str) -> str:
    s = get_settings()
    query = {
        "client_id": s.google_client_id,
        "redirect_uri": s.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    return f"{AUTH_URL}?{urlencode(query)}"


async def fetch_profile(code: str, transport: httpx.AsyncBaseTransport | None = None) -> dict[str, str]:
    """Troca o código por um token e lê o perfil. Só aceita emails verificados pela Google."""
    s = get_settings()
    try:
        async with httpx.AsyncClient(timeout=10, transport=transport) as http:
            token = await http.post(
                TOKEN_URL,
                data={
                    "code": code,
                    "client_id": s.google_client_id,
                    "client_secret": s.google_client_secret,
                    "redirect_uri": s.google_redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            token.raise_for_status()
            info = await http.get(USERINFO_URL, headers={"Authorization": f"Bearer {token.json()['access_token']}"})
            info.raise_for_status()
            profile: dict[str, str] = info.json()
    except (httpx.HTTPError, KeyError) as exc:
        raise UpstreamError("Não foi possível entrar com a Google") from exc
    if not profile.get("email_verified") or not profile.get("email") or not profile.get("sub"):
        raise UpstreamError("A conta Google não tem email verificado")
    return profile
