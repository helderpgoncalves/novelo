# ruff: noqa: E501
"""Emails transacionais com a identidade Novelo, em pt-PT e inglês (idioma da conta).

Cada função devolve `(assunto, html, texto)`. O esqueleto está em `email_layout.py`; aqui vivem os textos.
Os links e o logótipo vêm de `APP_URL` (derivado de `DOMAIN`), nunca de URLs fixos.
"""

from collections.abc import Callable

from novelo.core.config import get_settings
from novelo.features.auth.email_layout import Brand, Chrome, Content, render_html, render_text

_CHROME: dict[str, Chrome] = {
    "pt-PT": Chrome(
        lang="pt-PT",
        logo_alt="Novelo",
        fallback="Se o botão não abrir, copia esta ligação para o navegador:",
        footer_project="Novelo · Rede de recolha de têxteis de Guimarães",
        footer_team="Projeto da equipa Novelo para o Desafio 5 TexVitrus, Hack4Guimarães 2035.",
        footer_help="Precisas de ajuda?",
    ),
    "en": Chrome(
        lang="en",
        logo_alt="Novelo",
        fallback="If the button does not open, copy this link into your browser:",
        footer_project="Novelo · Guimarães textile collection network",
        footer_team="A project by the Novelo team for Challenge 5 TexVitrus, Hack4Guimarães 2035.",
        footer_help="Need help?",
    ),
}

_TEXTS: dict[str, dict[str, str]] = {
    "pt-PT": {
        "reset_subject": "Redefine a tua password do Novelo",
        "reset_preheader": "Escolhe uma nova password. A ligação é válida durante {validity} e só funciona uma vez.",
        "reset_eyebrow": "Segurança da conta",
        "reset_title": "Redefine a tua password",
        "reset_p1": "Recebemos um pedido para redefinir a password da conta do Novelo associada a este email. Usa o botão abaixo para escolher uma nova.",
        "reset_button": "Escolher nova password",
        "reset_notice_title": "Não foste tu?",
        "reset_notice": "Ignora este email: a tua password mantém-se. Se suspeitas que alguém tem acesso à tua conta, escreve-nos para o suporte.",
        "reset_reason": "Recebeste este email porque foi pedida a recuperação da password para este endereço.",
        "verify_subject": "Confirma o teu email no Novelo",
        "verify_preheader": "Falta um passo para ativares a tua conta. A ligação é válida durante {validity}.",
        "verify_eyebrow": "Confirmação de email",
        "verify_title": "Confirma o teu email",
        "verify_p1": "Criaste uma conta no Novelo com este endereço. Confirma-o para ativares a conta e começares a desenhar a rede de recolha de têxteis.",
        "verify_button": "Confirmar email",
        "verify_notice_title": "Não criaste uma conta?",
        "verify_notice": "Ignora este email: sem confirmação a conta não fica ativa.",
        "verify_reason": "Recebeste este email porque este endereço foi usado para criar uma conta no Novelo.",
        "magic_subject": "A tua ligação de acesso ao Novelo",
        "magic_preheader": "Entra no Novelo sem password. A ligação é válida durante {validity} e só funciona uma vez.",
        "magic_eyebrow": "Acesso seguro",
        "magic_title": "Entra no Novelo",
        "magic_p1": "Usa o botão abaixo para iniciar sessão sem password. Por segurança, não encaminhes este email: quem tiver a ligação entra na tua conta.",
        "magic_button": "Entrar no Novelo",
        "magic_notice_title": "Não pediste este acesso?",
        "magic_notice": "Ignora este email: ninguém entra sem usar a ligação. Se receberes vários destes emails que não pediste, escreve-nos para o suporte.",
        "magic_reason": "Recebeste este email porque foi pedido um acesso por ligação para este endereço.",
        "guest_subject": "Já tens acesso ao Novelo",
        "guest_preheader": "Foi criado um acesso para explorares o simulador, os cenários e o relatório RAP.",
        "guest_eyebrow": "Bem-vindo",
        "guest_title": "Já tens acesso ao Novelo",
        "hello": "Olá, {name}.",
        "guest_p1": "A equipa do Novelo criou um acesso para ti. O Novelo desenha a rede de recolha de têxteis de Guimarães ao menor custo: indicas o orçamento e a meta, e comparas cenários em euros, toneladas e euros por tonelada.",
        "guest_p2": "Podes começar por aqui:",
        "guest_b1": "Simulador da rede e comparação de cenários",
        "guest_b2": '"E se...?" em português, com os números verificados',
        "guest_b3": "Relatório RAP em PDF e mapa da rede",
        "guest_button": "Abrir o Novelo",
        "guest_notice_title": "Não esperavas este convite?",
        "guest_notice": "Podes ignorar este email ou avisar-nos através do suporte.",
        "guest_reason": "Recebeste este email porque alguém da equipa Novelo criou um acesso para este endereço.",
        "fact_validity": "Validade",
        "fact_use": "Utilização",
        "fact_once": "Uma só vez",
        "ctx_title": "Pedido feito a partir de",
        "ctx_ip": "Endereço IP",
        "ctx_device": "Dispositivo",
        "minutes": "{n} minutos",
        "minute": "1 minuto",
        "hours": "{n} horas",
        "hour": "1 hora",
    },
    "en": {
        "reset_subject": "Reset your Novelo password",
        "reset_preheader": "Choose a new password. The link is valid for {validity} and works once.",
        "reset_eyebrow": "Account security",
        "reset_title": "Reset your password",
        "reset_p1": "We received a request to reset the password of the Novelo account linked to this email. Use the button below to choose a new one.",
        "reset_button": "Choose a new password",
        "reset_notice_title": "Was this not you?",
        "reset_notice": "Ignore this email: your password stays the same. If you think someone has access to your account, write to support.",
        "reset_reason": "You received this email because a password reset was requested for this address.",
        "verify_subject": "Confirm your email on Novelo",
        "verify_preheader": "One step left to activate your account. The link is valid for {validity}.",
        "verify_eyebrow": "Email confirmation",
        "verify_title": "Confirm your email",
        "verify_p1": "You created a Novelo account with this address. Confirm it to activate the account and start designing the textile collection network.",
        "verify_button": "Confirm email",
        "verify_notice_title": "Did you not create an account?",
        "verify_notice": "Ignore this email: without confirmation the account is not activated.",
        "verify_reason": "You received this email because this address was used to create a Novelo account.",
        "magic_subject": "Your Novelo sign-in link",
        "magic_preheader": "Sign in to Novelo without a password. The link is valid for {validity} and works once.",
        "magic_eyebrow": "Secure sign-in",
        "magic_title": "Sign in to Novelo",
        "magic_p1": "Use the button below to sign in without a password. For your security, do not forward this email: anyone with the link can enter your account.",
        "magic_button": "Sign in to Novelo",
        "magic_notice_title": "Did you not request this?",
        "magic_notice": "Ignore this email: nobody gets in without using the link. If you keep receiving these emails without asking, write to support.",
        "magic_reason": "You received this email because a sign-in link was requested for this address.",
        "guest_subject": "You now have access to Novelo",
        "guest_preheader": "An account was created so you can explore the simulator, the scenarios and the RAP report.",
        "guest_eyebrow": "Welcome",
        "guest_title": "You now have access to Novelo",
        "hello": "Hello, {name}.",
        "guest_p1": "The Novelo team created an account for you. Novelo designs Guimarães' textile collection network at the lowest cost: you set the budget and the target, and compare scenarios in euros, tonnes and euros per tonne.",
        "guest_p2": "A good place to start:",
        "guest_b1": "Network simulator and scenario comparison",
        "guest_b2": '"What if...?" questions, with verified numbers',
        "guest_b3": "RAP report in PDF and network map",
        "guest_button": "Open Novelo",
        "guest_notice_title": "Not expecting this invitation?",
        "guest_notice": "You can ignore this email or let us know through support.",
        "guest_reason": "You received this email because someone on the Novelo team created an account for this address.",
        "fact_validity": "Valid for",
        "fact_use": "Use",
        "fact_once": "Single use",
        "ctx_title": "Request made from",
        "ctx_ip": "IP address",
        "ctx_device": "Device",
        "minutes": "{n} minutes",
        "minute": "1 minute",
        "hours": "{n} hours",
        "hour": "1 hour",
    },
}

EmailParts = tuple[str, str, str]


def _brand() -> Brand:
    s = get_settings()
    return Brand(app_url=s.app_url, support_email=s.email_support)


def _t(locale: str) -> dict[str, str]:
    return _TEXTS.get(locale, _TEXTS["pt-PT"])


def _chrome(locale: str) -> Chrome:
    return _CHROME.get(locale, _CHROME["pt-PT"])


def _duration(t: dict[str, str], n: int, unit: str) -> str:
    return t[unit[:-1]] if n == 1 else t[unit].format(n=n)


def _clean(value: str) -> str:
    return " ".join(value.split())


def _context(t: dict[str, str], ip: str | None, device: str | None) -> list[tuple[str, str]]:
    rows = []
    if ip and _clean(ip):
        rows.append((t["ctx_ip"], _clean(ip)))
    if device and _clean(device):
        rows.append((t["ctx_device"], _clean(device)[:120]))
    return rows


def _finish(locale: str, subject: str, content: Content) -> EmailParts:
    brand, chrome = _brand(), _chrome(locale)
    return subject, render_html(content, chrome, brand), render_text(content, chrome, brand)


def _timed(t: dict[str, str], validity: str) -> list[tuple[str, str]]:
    return [(t["fact_validity"], validity), (t["fact_use"], t["fact_once"])]


def password_reset(
    locale: str, url: str, minutes: int, *, ip: str | None = None, device: str | None = None
) -> EmailParts:
    """(assunto, html, texto). `ip` e `device` só aparecem se existirem."""
    t = _t(locale)
    validity = _duration(t, minutes, "minutes")
    content = Content(
        preheader=t["reset_preheader"].format(validity=validity),
        eyebrow=t["reset_eyebrow"],
        title=t["reset_title"],
        paragraphs=[t["reset_p1"]],
        cta_label=t["reset_button"],
        url=url,
        facts=_timed(t, validity),
        context_title=t["ctx_title"],
        context=_context(t, ip, device),
        notice_title=t["reset_notice_title"],
        notice=t["reset_notice"],
        reason=t["reset_reason"],
    )
    return _finish(locale, t["reset_subject"], content)


def verify_email(locale: str, url: str, name: str | None, hours: int) -> EmailParts:
    t = _t(locale)
    validity = _duration(t, hours, "hours")
    paragraphs = [t["verify_p1"]]
    if name and _clean(name):
        paragraphs.insert(0, t["hello"].format(name=_clean(name)))
    content = Content(
        preheader=t["verify_preheader"].format(validity=validity),
        eyebrow=t["verify_eyebrow"],
        title=t["verify_title"],
        paragraphs=paragraphs,
        cta_label=t["verify_button"],
        url=url,
        facts=_timed(t, validity),
        notice_title=t["verify_notice_title"],
        notice=t["verify_notice"],
        reason=t["verify_reason"],
    )
    return _finish(locale, t["verify_subject"], content)


def magic_link(locale: str, url: str, minutes: int, *, ip: str | None = None, device: str | None = None) -> EmailParts:
    t = _t(locale)
    validity = _duration(t, minutes, "minutes")
    content = Content(
        preheader=t["magic_preheader"].format(validity=validity),
        eyebrow=t["magic_eyebrow"],
        title=t["magic_title"],
        paragraphs=[t["magic_p1"]],
        cta_label=t["magic_button"],
        url=url,
        facts=_timed(t, validity),
        context_title=t["ctx_title"],
        context=_context(t, ip, device),
        notice_title=t["magic_notice_title"],
        notice=t["magic_notice"],
        reason=t["magic_reason"],
    )
    return _finish(locale, t["magic_subject"], content)


def guest_welcome(locale: str, name: str | None, url: str) -> EmailParts:
    t = _t(locale)
    paragraphs = [t["guest_p1"], t["guest_p2"]]
    if name and _clean(name):
        paragraphs.insert(0, t["hello"].format(name=_clean(name)))
    content = Content(
        preheader=t["guest_preheader"],
        eyebrow=t["guest_eyebrow"],
        title=t["guest_title"],
        paragraphs=paragraphs,
        bullets=[t["guest_b1"], t["guest_b2"], t["guest_b3"]],
        cta_label=t["guest_button"],
        url=url,
        notice_title=t["guest_notice_title"],
        notice=t["guest_notice"],
        reason=t["guest_reason"],
    )
    return _finish(locale, t["guest_subject"], content)


SAMPLE_NAME = "Ana Ferreira"


def sample_emails(locale: str) -> dict[str, EmailParts]:
    """Todos os emails com dados de exemplo (pré-visualização e testes)."""
    base = _brand().base
    samples: dict[str, Callable[[], EmailParts]] = {
        "verify-email": lambda: verify_email(locale, f"{base}/verify-email?token=EXEMPLO", SAMPLE_NAME, 48),
        "password-reset": lambda: password_reset(
            locale, f"{base}/reset-password?token=EXEMPLO", 60, ip="85.240.12.34", device="Chrome em macOS"
        ),
        "magic-link": lambda: magic_link(
            locale, f"{base}/magic-link?token=EXEMPLO", 15, ip="85.240.12.34", device="Safari em iPhone"
        ),
        "guest-welcome": lambda: guest_welcome(locale, SAMPLE_NAME, f"{base}/login"),
    }
    return {name: build() for name, build in samples.items()}
