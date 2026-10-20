"""Cookies de sessão (HttpOnly, SameSite=Lax, Secure em HTTPS). Partilhados pela autenticação e pela impersonação.

Em HTTPS (produção) usam o prefixo `__Host-`: o browser só os aceita com `Secure`, `Path=/` e sem `Domain`, o que
impede que um subdomínio ou um canal HTTP os substitua. Em HTTP (dev/testes) mantêm os nomes simples e o refresh
fica restrito a `/api/v1/auth`.
"""

from fastapi import Request, Response

from novelo.core.config import get_settings

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
STATE_COOKIE = "oauth_state"
REFRESH_PATH = "/api/v1/auth"
HOST_PREFIX = "__Host-"


def cookie_name(base: str) -> str:
    return f"{HOST_PREFIX}{base}" if get_settings().secure_cookies else base


def cookie_path(path: str) -> str:
    """`__Host-` obriga a `Path=/`."""
    return "/" if get_settings().secure_cookies else path


def read_cookie(request: Request, base: str) -> str | None:
    return request.cookies.get(cookie_name(base))


def set_cookie(response: Response, key: str, value: str, max_age: int | None, path: str) -> None:
    # max_age=None cria um cookie de sessão: some quando o browser fecha ("não manter sessão").
    response.set_cookie(
        cookie_name(key),
        value,
        max_age=max_age,
        path=cookie_path(path),
        httponly=True,
        secure=get_settings().secure_cookies,
        samesite="lax",
    )


def delete_cookie(response: Response, key: str, path: str) -> None:
    secure = get_settings().secure_cookies
    response.delete_cookie(cookie_name(key), path=cookie_path(path), httponly=True, secure=secure, samesite="lax")
    if secure:  # restos de antes do prefixo (a sessão antiga deixa de valer, mas o cookie não fica a viajar)
        response.delete_cookie(key, path=path, httponly=True, secure=True, samesite="lax")


def set_session(response: Response, access: str, refresh: str, remember: bool = True) -> None:
    s = get_settings()
    set_cookie(response, ACCESS_COOKIE, access, s.access_token_minutes * 60, "/")
    max_age = s.refresh_token_days * 86400 if remember else None
    set_cookie(response, REFRESH_COOKIE, refresh, max_age, REFRESH_PATH)


def set_access(response: Response, access: str, max_age_s: int) -> None:
    """Só o cookie de acesso (impersonação: o refresh do administrador não se toca)."""
    set_cookie(response, ACCESS_COOKIE, access, max_age_s, "/")


def clear_session(response: Response) -> None:
    delete_cookie(response, ACCESS_COOKIE, "/")
    delete_cookie(response, REFRESH_COOKIE, REFRESH_PATH)
