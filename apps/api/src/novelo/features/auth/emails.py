# ruff: noqa: E501
"""Emails transacionais com a identidade Novelo, em pt-PT e inglês (idioma da conta)."""

from html import escape

_STYLE = "font-family:Inter,Arial,sans-serif;background:#F4F1EA;padding:32px;color:#14211D;"
_CARD = "max-width:480px;margin:0 auto;background:#fff;border:1px solid #DCD5C8;border-radius:12px;padding:32px;"
_BUTTON = (
    "display:inline-block;background:#2E6B57;color:#fff;text-decoration:none;"
    "padding:12px 22px;border-radius:8px;font-weight:600;"
)
_H1 = "font-family:Georgia,serif;font-size:24px;font-weight:500;margin:0 0 12px;"
_P = "font-size:15px;line-height:1.6;color:#5E6B66;margin:0 0 24px;"

_TEXTS: dict[str, dict[str, str]] = {
    "pt-PT": {
        "reset_subject": "Recuperar a password do Novelo",
        "reset_title": "Redefinir a password",
        "reset_body": "Recebemos um pedido para redefinir a password. O link é válido durante {n} minutos e só pode ser usado uma vez.",
        "reset_button": "Redefinir password",
        "reset_footer": "Se não fizeste este pedido, ignora este email: a tua password não muda.",
        "verify_subject": "Confirma o teu email no Novelo",
        "verify_title": "Confirma o teu email",
        "verify_body": "Falta só confirmar o teu email para ativares a conta. O link é válido durante {n} horas.",
        "verify_button": "Confirmar email",
        "verify_footer": "Se não criaste uma conta no Novelo, ignora este email.",
        "hello": "Olá, {name}. ",
    },
    "en": {
        "reset_subject": "Reset your Novelo password",
        "reset_title": "Reset your password",
        "reset_body": "We received a request to reset your password. The link is valid for {n} minutes and can be used once.",
        "reset_button": "Reset password",
        "reset_footer": "If you did not make this request, ignore this email: your password stays the same.",
        "verify_subject": "Confirm your email on Novelo",
        "verify_title": "Confirm your email",
        "verify_body": "Just one step left: confirm your email to activate your account. The link is valid for {n} hours.",
        "verify_button": "Confirm email",
        "verify_footer": "If you did not create a Novelo account, ignore this email.",
        "hello": "Hi {name}. ",
    },
}


def _t(locale: str) -> dict[str, str]:
    return _TEXTS.get(locale, _TEXTS["pt-PT"])


def _layout(title: str, body: str, button_label: str, url: str, footer: str) -> str:
    return f"""<div style="{_STYLE}"><div style="{_CARD}">
<p style="font-family:Georgia,serif;font-size:22px;margin:0 0 24px;">Novelo</p>
<h1 style="{_H1}">{escape(title)}</h1>
<p style="{_P}">{body}</p>
<p style="margin:0 0 24px;"><a href="{escape(url)}" style="{_BUTTON}">{escape(button_label)}</a></p>
<p style="font-size:13px;line-height:1.5;color:#5E6B66;margin:0;">{footer}</p>
</div></div>"""


def password_reset(locale: str, url: str, minutes: int) -> tuple[str, str, str]:
    """(assunto, html, texto)"""
    t = _t(locale)
    body = t["reset_body"].format(n=minutes)
    text = f"{body}\n\n{t['reset_button']}: {url}\n\n{t['reset_footer']}"
    html = _layout(t["reset_title"], body, t["reset_button"], url, t["reset_footer"])
    return t["reset_subject"], html, text


def verify_email(locale: str, url: str, name: str | None, hours: int) -> tuple[str, str, str]:
    t = _t(locale)
    greeting = t["hello"].format(name=escape(name)) if name else ""
    body = f"{greeting}{t['verify_body'].format(n=hours)}"
    text = f"{body}\n\n{t['verify_button']}: {url}\n\n{t['verify_footer']}"
    html = _layout(t["verify_title"], body, t["verify_button"], url, t["verify_footer"])
    return t["verify_subject"], html, text
