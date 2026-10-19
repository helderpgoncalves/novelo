"""Modelos de email com a identidade Novelo (pt-PT). HTML simples, compatível com clientes de email."""

from html import escape

_STYLE = "font-family:Inter,Arial,sans-serif;background:#F4F1EA;padding:32px;color:#14211D;"
_CARD = "max-width:480px;margin:0 auto;background:#fff;border:1px solid #DCD5C8;border-radius:12px;padding:32px;"
_BUTTON = (
    "display:inline-block;background:#2E6B57;color:#fff;text-decoration:none;"
    "padding:12px 22px;border-radius:8px;font-weight:600;"
)


def _layout(title: str, body: str, button_label: str, url: str, footer: str) -> str:
    return f"""<div style="{_STYLE}"><div style="{_CARD}">
<p style="font-family:Georgia,serif;font-size:22px;margin:0 0 24px;">Novelo</p>
<h1 style="font-family:Georgia,serif;font-size:24px;font-weight:500;margin:0 0 12px;">{escape(title)}</h1>
<p style="font-size:15px;line-height:1.6;color:#5E6B66;margin:0 0 24px;">{body}</p>
<p style="margin:0 0 24px;"><a href="{escape(url)}" style="{_BUTTON}">{escape(button_label)}</a></p>
<p style="font-size:13px;line-height:1.5;color:#5E6B66;margin:0;">{footer}</p>
</div></div>"""


def password_reset(url: str, minutes: int) -> tuple[str, str, str]:
    """(assunto, html, texto)"""
    subject = "Recuperar a password do Novelo"
    body = (
        "Recebemos um pedido para redefinir a password. "
        f"O link é válido durante {minutes} minutos e só pode ser usado uma vez."
    )
    footer = "Se não fizeste este pedido, ignora este email: a tua password não muda."
    text = f"{body}\n\nRedefinir password: {url}\n\n{footer}"
    return subject, _layout("Redefinir a password", body, "Redefinir password", url, footer), text


def verify_email(url: str, name: str | None, hours: int) -> tuple[str, str, str]:
    subject = "Confirma o teu email no Novelo"
    greeting = f"Olá, {escape(name)}. " if name else ""
    body = f"{greeting}Falta só confirmar o teu email para ativares a conta. O link é válido durante {hours} horas."
    footer = "Se não criaste uma conta no Novelo, ignora este email."
    text = f"{body}\n\nConfirmar email: {url}\n\n{footer}"
    return subject, _layout("Confirma o teu email", body, "Confirmar email", url, footer), text
