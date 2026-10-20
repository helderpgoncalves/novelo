# ruff: noqa: E501
"""Emails transacionais com a identidade Novelo, em pt-PT e inglês (idioma da conta).

Cada função devolve `(assunto, html, texto)`. O esqueleto está em `email_layout.py`; aqui vivem os textos.
Os links e o logótipo vêm de `APP_URL` (derivado de `DOMAIN`), nunca de URLs fixos.
"""

from collections.abc import Callable

from novelo.core.config import get_settings
from novelo.core.ratelimit import parse_ip
from novelo.features.auth.email_layout import Brand, Chrome, Content, render_html, render_text

_CHROME: dict[str, Chrome] = {
    "pt-PT": Chrome(
        lang="pt-PT",
        logo_alt="Novelo",
        fallback="Se o botão não abrir, copia esta ligação para o navegador:",
        footer_project="Novelo, recolha de têxteis de Guimarães.",
        footer_help="Precisas de ajuda?",
    ),
    "en": Chrome(
        lang="en",
        logo_alt="Novelo",
        fallback="If the button does not open, copy this link into your browser:",
        footer_project="Novelo, textile collection in Guimarães.",
        footer_help="Need help?",
    ),
}

_TEXTS: dict[str, dict[str, str]] = {
    "pt-PT": {
        "reset_subject": "Redefine a tua password · Novelo",
        "reset_preheader": "Escolhe uma nova password. A ligação é válida durante {validity} e só funciona uma vez.",
        "reset_eyebrow": "Segurança da conta",
        "reset_title": "Redefine a tua password",
        "reset_p1": "Recebemos um pedido para redefinir a password da conta do Novelo associada a este email. Usa o botão abaixo para escolher uma nova.",
        "reset_button": "Escolher nova password",
        "reset_notice_title": "Não foste tu?",
        "reset_notice": "Ignora este email: a tua password mantém-se. Se suspeitas que alguém tem acesso à tua conta, escreve-nos para o suporte.",
        "reset_reason": "Recebeste este email porque foi pedida a recuperação da password para este endereço.",
        "verify_subject": "Confirma o teu email · Novelo",
        "verify_preheader": "Falta um passo para ativares a tua conta. A ligação é válida durante {validity}.",
        "verify_eyebrow": "Confirmação de email",
        "verify_title": "Confirma o teu email",
        "verify_p1": "Criaste uma conta no Novelo com este endereço. Confirma-o para ativares a conta e começares a desenhar a rede de recolha de têxteis.",
        "verify_button": "Confirmar email",
        "verify_notice_title": "Não criaste uma conta?",
        "verify_notice": "Ignora este email: sem confirmação a conta não fica ativa.",
        "verify_reason": "Recebeste este email porque este endereço foi usado para criar uma conta no Novelo.",
        "magic_subject": "A tua ligação de acesso · Novelo",
        "magic_preheader": "Entra no Novelo sem password. A ligação é válida durante {validity} e só funciona uma vez.",
        "magic_eyebrow": "Acesso seguro",
        "magic_title": "Entra no Novelo",
        "magic_p1": "Usa o botão abaixo para iniciar sessão sem password. Por segurança, não encaminhes este email: quem tiver a ligação entra na tua conta.",
        "magic_button": "Entrar no Novelo",
        "magic_notice_title": "Não pediste este acesso?",
        "magic_notice": "Ignora este email: ninguém entra sem usar a ligação. Se receberes vários destes emails que não pediste, escreve-nos para o suporte.",
        "magic_reason": "Recebeste este email porque foi pedido um acesso por ligação para este endereço.",
        "guest_subject": "O teu acesso está pronto · Novelo",
        "guest_preheader": "Foi criado um acesso para explorares o simulador, os cenários e o relatório RAP.",
        "guest_eyebrow": "Bem-vindo",
        "guest_title": "Já tens acesso ao Novelo",
        "hello": "Olá, {name}.",
        "guest_p1": "A equipa do Novelo criou um acesso para ti. O Novelo desenha a rede de recolha de têxteis de Guimarães ao menor custo, com cenários comparáveis em euros, toneladas e euros por tonelada.",
        "guest_p2": "Podes começar por aqui:",
        "guest_b1": "Simulador da rede e comparação de cenários",
        "guest_b2": "«E se...?» em português, com os números verificados",
        "guest_b3": "Relatório RAP em PDF e mapa da rede",
        "guest_button": "Abrir o Novelo",
        "guest_notice_title": "Não esperavas este convite?",
        "guest_notice": "Podes ignorar este email ou avisar-nos pelo suporte.",
        "guest_reason": "Recebeste este email porque alguém da equipa Novelo criou um acesso para este endereço.",
        "invite_subject": "{inviter} convidou-te · Novelo",
        "invite_preheader": "Cria a tua conta com o papel {role}. O convite é válido durante {validity}.",
        "invite_eyebrow": "Convite",
        "invite_title": "Foste convidado para o Novelo",
        "invite_p1": "{inviter} convidou-te para a equipa do Novelo, a ferramenta que desenha a rede de recolha de têxteis de Guimarães ao menor custo. Vais entrar com o papel {role}.",
        "invite_p2": "Aceita o convite para escolher o teu nome e, se quiseres, uma password. Também podes entrar sempre por uma ligação enviada para este email.",
        "invite_message": "Mensagem de {inviter}: “{message}”",
        "invite_button": "Aceitar o convite",
        "invite_notice_title": "Não conheces esta pessoa ou não esperavas o convite?",
        "invite_notice": "Ignora este email: sem aceitar, nenhuma conta é criada e o convite expira sozinho. Não reencaminhes esta mensagem, porque quem tiver a ligação pode aceitar o convite.",
        "invite_reason": "Recebeste este email porque um administrador do Novelo convidou este endereço.",
        "fact_role": "Papel",
        "fact_invited_by": "Convidado por",
        "role_admin": "Administrador",
        "role_operator": "Operador",
        "role_guest": "Convidado",
        "days": "{n} dias",
        "day": "1 dia",
        "appr_subject": "Conta aprovada · Novelo",
        "appr_preheader": "Já podes entrar no Novelo com o papel {role}.",
        "appr_eyebrow": "Conta aprovada",
        "appr_title": "A tua conta foi aprovada",
        "appr_p1": "Um administrador aprovou o teu registo no Novelo. Já podes entrar com o papel {role} e explorar o simulador, os cenários e o relatório RAP.",
        "appr_button": "Entrar no Novelo",
        "appr_notice_title": "Não pediste esta conta?",
        "appr_notice": "Podes ignorar este email ou avisar-nos pelo suporte.",
        "appr_reason": "Recebeste este email porque este endereço foi usado para pedir uma conta no Novelo.",
        "rej_subject": "Pedido de conta · Novelo",
        "rej_preheader": "Não foi possível aprovar o teu pedido de acesso neste momento.",
        "rej_eyebrow": "Pedido de conta",
        "rej_title": "Não foi possível aprovar o teu acesso",
        "rej_p1": "Neste momento não conseguimos aprovar o teu pedido de conta no Novelo.",
        "rej_p2": "Nota da equipa: {reason}",
        "rej_p3": "Se achas que houve um engano, escreve-nos para o suporte.",
        "rej_button": "Abrir o Novelo",
        "rej_notice_title": "Não pediste esta conta?",
        "rej_notice": "Podes ignorar este email.",
        "rej_reason": "Recebeste este email porque este endereço foi usado para pedir uma conta no Novelo.",
        "req_subject_one": "Novo pedido de conta · Novelo",
        "req_subject_many": "{n} pedidos de conta por rever · Novelo",
        "req_preheader": "Há contas à espera da tua aprovação.",
        "req_eyebrow": "Aprovação de contas",
        "req_title_one": "Há 1 conta à espera de aprovação",
        "req_title_many": "Há {n} contas à espera de aprovação",
        "req_p1": "Alguém pediu uma conta no Novelo e só entra depois de um administrador aprovar. O pedido mais recente é de {who}.",
        "req_p2": "Para não encher a tua caixa de entrada, enviamos no máximo um aviso destes a cada 10 minutos.",
        "req_button": "Rever pedidos",
        "req_notice_title": "Porque recebo isto?",
        "req_notice": "Recebes este aviso por seres administrador do Novelo. Podes ignorá-lo se o pedido já estiver tratado.",
        "req_reason": "Recebeste este email porque és administrador do Novelo.",
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
        "reset_subject": "Reset your password · Novelo",
        "reset_preheader": "Choose a new password. The link is valid for {validity} and works once.",
        "reset_eyebrow": "Account security",
        "reset_title": "Reset your password",
        "reset_p1": "We received a request to reset the password of the Novelo account linked to this email. Use the button below to choose a new one.",
        "reset_button": "Choose a new password",
        "reset_notice_title": "Was this not you?",
        "reset_notice": "Ignore this email: your password stays the same. If you think someone has access to your account, write to support.",
        "reset_reason": "You received this email because a password reset was requested for this address.",
        "verify_subject": "Confirm your email · Novelo",
        "verify_preheader": "One step left to activate your account. The link is valid for {validity}.",
        "verify_eyebrow": "Email confirmation",
        "verify_title": "Confirm your email",
        "verify_p1": "You created a Novelo account with this address. Confirm it to activate the account and start designing the textile collection network.",
        "verify_button": "Confirm email",
        "verify_notice_title": "Did you not create an account?",
        "verify_notice": "Ignore this email: without confirmation the account is not activated.",
        "verify_reason": "You received this email because this address was used to create a Novelo account.",
        "magic_subject": "Your sign-in link · Novelo",
        "magic_preheader": "Sign in to Novelo without a password. The link is valid for {validity} and works once.",
        "magic_eyebrow": "Secure sign-in",
        "magic_title": "Sign in to Novelo",
        "magic_p1": "Use the button below to sign in without a password. For your security, do not forward this email: anyone with the link can enter your account.",
        "magic_button": "Sign in to Novelo",
        "magic_notice_title": "Did you not request this?",
        "magic_notice": "Ignore this email: nobody gets in without using the link. If you keep receiving these emails without asking, write to support.",
        "magic_reason": "You received this email because a sign-in link was requested for this address.",
        "guest_subject": "Your access is ready · Novelo",
        "guest_preheader": "An account was created so you can explore the simulator, the scenarios and the RAP report.",
        "guest_eyebrow": "Welcome",
        "guest_title": "You now have access to Novelo",
        "hello": "Hello, {name}.",
        "guest_p1": "The Novelo team created an account for you. Novelo designs Guimarães' textile collection network at the lowest cost, with scenarios you can compare in euros, tonnes and euros per tonne.",
        "guest_p2": "A good place to start:",
        "guest_b1": "Network simulator and scenario comparison",
        "guest_b2": "“What if...?” questions, with verified numbers",
        "guest_b3": "RAP report in PDF and network map",
        "guest_button": "Open Novelo",
        "guest_notice_title": "Not expecting this invitation?",
        "guest_notice": "You can ignore this email or let us know through support.",
        "guest_reason": "You received this email because someone on the Novelo team created an account for this address.",
        "invite_subject": "{inviter} invited you · Novelo",
        "invite_preheader": "Create your account with the {role} role. The invitation is valid for {validity}.",
        "invite_eyebrow": "Invitation",
        "invite_title": "You have been invited to Novelo",
        "invite_p1": "{inviter} invited you to the Novelo team. Novelo designs Guimarães' textile collection network at the lowest cost. You will join with the {role} role.",
        "invite_p2": "Accept the invitation to choose your name and, if you want, a password. You can also always sign in with a link sent to this email.",
        "invite_message": "Message from {inviter}: “{message}”",
        "invite_button": "Accept the invitation",
        "invite_notice_title": "Do not know this person or not expecting it?",
        "invite_notice": "Ignore this email: without accepting, no account is created and the invitation expires on its own. Do not forward this message, because anyone with the link can accept the invitation.",
        "invite_reason": "You received this email because a Novelo administrator invited this address.",
        "fact_role": "Role",
        "fact_invited_by": "Invited by",
        "role_admin": "Administrator",
        "role_operator": "Operator",
        "role_guest": "Guest",
        "days": "{n} days",
        "day": "1 day",
        "appr_subject": "Account approved · Novelo",
        "appr_preheader": "You can now sign in to Novelo with the {role} role.",
        "appr_eyebrow": "Account approved",
        "appr_title": "Your account was approved",
        "appr_p1": "An administrator approved your Novelo registration. You can now sign in with the {role} role and explore the simulator, the scenarios and the RAP report.",
        "appr_button": "Sign in to Novelo",
        "appr_notice_title": "Did you not request this account?",
        "appr_notice": "You can ignore this email or let us know through support.",
        "appr_reason": "You received this email because this address was used to request a Novelo account.",
        "rej_subject": "Account request · Novelo",
        "rej_preheader": "We could not approve your access request at this time.",
        "rej_eyebrow": "Account request",
        "rej_title": "We could not approve your access",
        "rej_p1": "We are not able to approve your Novelo account request at the moment.",
        "rej_p2": "Note from the team: {reason}",
        "rej_p3": "If you think this is a mistake, write to support.",
        "rej_button": "Open Novelo",
        "rej_notice_title": "Did you not request this account?",
        "rej_notice": "You can ignore this email.",
        "rej_reason": "You received this email because this address was used to request a Novelo account.",
        "req_subject_one": "New account request · Novelo",
        "req_subject_many": "{n} account requests to review · Novelo",
        "req_preheader": "Accounts are waiting for your approval.",
        "req_eyebrow": "Account approval",
        "req_title_one": "1 account is waiting for approval",
        "req_title_many": "{n} accounts are waiting for approval",
        "req_p1": "Someone requested a Novelo account and can only sign in once an administrator approves. The latest request is from {who}.",
        "req_p2": "To keep your inbox quiet, we send at most one of these notices every 10 minutes.",
        "req_button": "Review requests",
        "req_notice_title": "Why am I getting this?",
        "req_notice": "You get this notice because you are a Novelo administrator. You can ignore it if the request is already handled.",
        "req_reason": "You received this email because you are a Novelo administrator.",
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
    """Duração legível e coerente entre emails: 60 minutos = 1 hora, 48 horas = 2 dias."""
    if unit == "minutes" and n >= 60 and n % 60 == 0:
        n, unit = n // 60, "hours"
    if unit == "hours" and n >= 24 and n % 24 == 0:
        n, unit = n // 24, "days"
    return t[unit[:-1]] if n == 1 else t[unit].format(n=n)


def _first_name(value: str | None) -> str:
    """Só o primeiro nome (sem apelido) para a saudação; vazio se não houver nome utilizável."""
    parts = _clean(value or "").split(" ")
    return parts[0][:40] if parts and parts[0] else ""


def _greet(t: dict[str, str], name: str | None) -> list[str]:
    first = _first_name(name)
    return [t["hello"].format(name=first)] if first else []


def _clean(value: str) -> str:
    """Uma linha, sem caracteres de controlo (o texto vem de cabeçalhos do pedido: nunca é de confiança)."""
    return " ".join("".join(c for c in value if c.isprintable() or c.isspace()).split())


def _context(t: dict[str, str], ip: str | None, device: str | None) -> list[tuple[str, str]]:
    rows = []
    valid_ip = parse_ip(ip)  # só IPs válidos chegam ao email
    if valid_ip:
        rows.append((t["ctx_ip"], valid_ip))
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
    paragraphs = [*_greet(t, name), t["verify_p1"]]
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
    paragraphs = [*_greet(t, name), t["guest_p1"], t["guest_p2"]]
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


def invitation(
    locale: str,
    url: str,
    *,
    inviter: str,
    role: str,
    days: int,
    invitee_name: str | None = None,
    message: str | None = None,
) -> EmailParts:
    """Convite de um administrador. `inviter`, `invitee_name` e `message` são texto livre: vão escapados no HTML."""
    t = _t(locale)
    inviter = _clean(inviter)[:80] or "Novelo"
    role_label = t.get(f"role_{role}", role)
    validity = _duration(t, days, "days")
    paragraphs = [*_greet(t, invitee_name), t["invite_p1"].format(inviter=inviter, role=role_label)]
    if message and _clean(message):
        paragraphs.append(t["invite_message"].format(inviter=inviter, message=_clean(message)[:500]))
    paragraphs.append(t["invite_p2"])
    content = Content(
        preheader=t["invite_preheader"].format(role=role_label, validity=validity),
        eyebrow=t["invite_eyebrow"],
        title=t["invite_title"],
        paragraphs=paragraphs,
        cta_label=t["invite_button"],
        url=url,
        facts=[
            (t["fact_invited_by"], inviter),
            (t["fact_role"], role_label),
            (t["fact_validity"], validity),
        ],
        notice_title=t["invite_notice_title"],
        notice=t["invite_notice"],
        reason=t["invite_reason"],
    )
    return _finish(locale, t["invite_subject"].format(inviter=inviter[:30]), content)


def approval_granted(locale: str, url: str, name: str | None, role: str) -> EmailParts:
    t = _t(locale)
    role_label = t.get(f"role_{role}", role)
    paragraphs = [*_greet(t, name), t["appr_p1"].format(role=role_label)]
    content = Content(
        preheader=t["appr_preheader"].format(role=role_label),
        eyebrow=t["appr_eyebrow"],
        title=t["appr_title"],
        paragraphs=paragraphs,
        cta_label=t["appr_button"],
        url=url,
        facts=[(t["fact_role"], role_label)],
        notice_title=t["appr_notice_title"],
        notice=t["appr_notice"],
        reason=t["appr_reason"],
    )
    return _finish(locale, t["appr_subject"], content)


def approval_rejected(locale: str, url: str, name: str | None, reason: str | None) -> EmailParts:
    """Neutro: não diz mais do que a equipa escreveu em `reason`."""
    t = _t(locale)
    paragraphs = [*_greet(t, name), t["rej_p1"]]
    if reason and _clean(reason):
        paragraphs.append(t["rej_p2"].format(reason=_clean(reason)[:300]))
    paragraphs.append(t["rej_p3"])
    content = Content(
        preheader=t["rej_preheader"],
        eyebrow=t["rej_eyebrow"],
        title=t["rej_title"],
        paragraphs=paragraphs,
        cta_label=t["rej_button"],
        url=url,
        notice_title=t["rej_notice_title"],
        notice=t["rej_notice"],
        reason=t["rej_reason"],
    )
    return _finish(locale, t["rej_subject"], content)


def approval_requested(locale: str, url: str, count: int, who: str) -> EmailParts:
    """Aviso aos administradores de contas por aprovar (`count` = total à espera)."""
    t = _t(locale)
    many = count != 1
    content = Content(
        preheader=t["req_preheader"],
        eyebrow=t["req_eyebrow"],
        title=t["req_title_many"].format(n=count) if many else t["req_title_one"],
        paragraphs=[t["req_p1"].format(who=_clean(who)[:80]), t["req_p2"]],
        cta_label=t["req_button"],
        url=url,
        notice_title=t["req_notice_title"],
        notice=t["req_notice"],
        reason=t["req_reason"],
    )
    subject = t["req_subject_many"].format(n=count) if many else t["req_subject_one"]
    return _finish(locale, subject, content)


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
        "approval-granted": lambda: approval_granted(locale, f"{base}/login", SAMPLE_NAME, "operator"),
        "approval-rejected": lambda: approval_rejected(
            locale, base, SAMPLE_NAME, "Só aceitamos contas de entidades parceiras."
        ),
        "approval-requested": lambda: approval_requested(locale, f"{base}/users?tab=pending", 3, "ana@exemplo.pt"),
        "invitation": lambda: invitation(
            locale,
            f"{base}/accept-invite?token=EXEMPLO",
            inviter="Hélder Gonçalves",
            role="operator",
            days=7,
            invitee_name=SAMPLE_NAME,
            message="Precisamos de ti para validar os cenários da Vitrus.",
        ),
    }
    return {name: build() for name, build in samples.items()}
