"""Avatares: só se devolvem URLs https (o Google serve `https://lh3.googleusercontent.com/...`)."""

from urllib.parse import urlparse


def safe_avatar_url(url: str | None) -> str | None:
    """Devolve o URL se for https com anfitrião; qualquer outro valor guardado (http, data:, vazio) dá `None`."""
    if not url:
        return None
    try:
        parsed = urlparse(url.strip())
    except ValueError:
        return None
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        return None
    return url.strip()
