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
        "reg_subject": "Recebemos o teu pedido · Novelo",
        "reg_preheader": "Um administrador vai rever o teu pedido. Avisamos-te por email.",
        "reg_eyebrow": "Pedido de conta",
        "reg_title": "Recebemos o teu pedido",
        "reg_p1": "Obrigado por te registares no Novelo. Um administrador vai rever o teu pedido e só depois podes entrar.",
        "reg_p2": "Não precisas de fazer mais nada: quando houver uma decisão, avisamos-te por email para este endereço.",
        "reg_button": "Ver o estado do pedido",
        "reg_notice_title": "Não pediste esta conta?",
        "reg_notice": "Podes ignorar este email.",
        "reg_reason": "Recebeste este email porque este endereço foi usado para pedir uma conta no Novelo.",
        "una_subject": "Não conseguimos dar-te acesso · Novelo",
        "una_preheader": "A conta ou o pedido associado a este email não permite entrar.",
        "una_eyebrow": "Acesso",
        "una_title": "Não podemos dar-te acesso",
        "una_inactive": "Pediste acesso ao Novelo, mas a conta associada a este email não está ativa.",
        "una_rejected": "Pediste acesso ao Novelo, mas o pedido de conta associado a este email foi recusado.",
        "una_p2": "Se achas que houve um engano, fala com o administrador do Novelo ou escreve-nos para o suporte.",
        "una_button": "Abrir o Novelo",
        "una_notice_title": "Não foste tu?",
        "una_notice": "Podes ignorar este email: ninguém entra na conta sem um acesso válido.",
        "una_reason": "Recebeste este email porque foi pedido um acesso para este endereço.",
        "nf_subject": "Não encontrámos uma conta · Novelo",
        "nf_preheader": "Não existe nenhuma conta do Novelo com este email.",
        "nf_eyebrow": "Acesso",
        "nf_title": "Não encontrámos uma conta com este email",
        "nf_p1": "Pediste um acesso ao Novelo, mas não existe nenhuma conta nem convite para este endereço. Podes ter escrito o email de outra forma ou usado outro endereço.",
        "nf_open": "Podes criar uma conta. Depois de um administrador a aprovar, já podes entrar.",
        "nf_closed": "O registo está fechado. Pede acesso a um administrador do Novelo, que te pode enviar um convite.",
        "nf_button_open": "Criar conta",
        "nf_button_closed": "Abrir o Novelo",
        "nf_notice_title": "Não pediste isto?",
        "nf_notice": "Ignora este email: não foi criada nenhuma conta.",
        "nf_reason": "Recebeste este email porque foi pedido um acesso para este endereço.",
        "rem_subject": "Há contas por rever há mais de um dia · Novelo",
        "rem_preheader": "Pedidos de conta à espera de aprovação há mais de 24 horas.",
        "rem_eyebrow": "Lembrete",
        "rem_title_one": "1 conta espera há mais de um dia",
        "rem_title_many": "{n} contas esperam há mais de um dia",
        "rem_p1": "Estes pedidos esperam por aprovação há mais de 24 horas. Cada pessoa continua à espera de uma resposta.",
        "rem_p2": "Enviamos no máximo um lembrete por dia.",
        "alert_subject": "Os emails precisam de atenção · Novelo",
        "alert_preheader": "Detetámos problemas no envio de emails do Novelo.",
        "alert_eyebrow": "Monitorização",
        "alert_title": "Os emails do Novelo precisam de atenção",
        "alert_p1": "Detetámos o seguinte no envio de emails:",
        "alert_p2": "Enquanto isto durar, há pessoas que podem não receber convites nem links de acesso. Envia o link do convite por outro canal.",
        "alert_button": "Ver o estado dos emails",
        "alert_notice_title": "Porque recebo isto?",
        "alert_notice": "Enviamos no máximo um destes avisos a cada 6 horas, ao administrador mais antigo.",
        "alert_provider_not_configured": "O fornecedor de email não está configurado: nenhum email sai.",
        "alert_provider_auth_invalid": "A chave do fornecedor foi recusada.",
        "alert_domain_not_verified": "O domínio do remetente não está verificado no fornecedor.",
        "alert_failures_last_hour": "Houve 3 ou mais falhas de envio na última hora.",
        "alert_high_failure_rate": "Mais de 20% dos envios da última hora falharam.",
        "alert_webhook_silent": "O webhook está configurado mas não recebe eventos há mais de 24 horas.",
        "alert_no_admin_recipients": "Não há administradores com email para receber os avisos de contas novas.",
        "test_subject": "Email de teste · Novelo",
        "test_preheader": "Se estás a ler isto, o envio de emails do Novelo funciona.",
        "test_eyebrow": "Teste",
        "test_title": "O envio de emails funciona",
        "test_p1": "Este é um email de teste enviado pelo painel de administração. Chegou à tua caixa de entrada.",
        "test_button": "Abrir o Novelo",
        "test_notice_title": "Não pediste este teste?",
        "test_notice": "Podes ignorar este email.",
        "test_reason": "Recebeste este email porque um administrador do Novelo fez um teste de envio.",
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
        "reg_subject": "We received your request · Novelo",
        "reg_preheader": "An administrator will review it. We will let you know by email.",
        "reg_eyebrow": "Account request",
        "reg_title": "We received your request",
        "reg_p1": "Thank you for signing up to Novelo. An administrator will review your request and only then can you sign in.",
        "reg_p2": "There is nothing else to do: once there is a decision, we will tell you by email at this address.",
        "reg_button": "See the request status",
        "reg_notice_title": "Did you not request this account?",
        "reg_notice": "You can ignore this email.",
        "reg_reason": "You received this email because this address was used to request a Novelo account.",
        "una_subject": "We could not give you access · Novelo",
        "una_preheader": "The account or request linked to this email does not allow signing in.",
        "una_eyebrow": "Access",
        "una_title": "We cannot give you access",
        "una_inactive": "You asked for access to Novelo, but the account linked to this email is not active.",
        "una_rejected": "You asked for access to Novelo, but the account request linked to this email was declined.",
        "una_p2": "If you think this is a mistake, talk to a Novelo administrator or write to support.",
        "una_button": "Open Novelo",
        "una_notice_title": "Was this not you?",
        "una_notice": "You can ignore this email: nobody gets into the account without valid access.",
        "una_reason": "You received this email because access was requested for this address.",
        "nf_subject": "We could not find an account · Novelo",
        "nf_preheader": "There is no Novelo account with this email.",
        "nf_eyebrow": "Access",
        "nf_title": "We could not find an account with this email",
        "nf_p1": "You asked for access to Novelo, but there is no account or invitation for this address. You may have typed the email differently or used another address.",
        "nf_open": "You can create an account. Once an administrator approves it, you can sign in.",
        "nf_closed": "Registration is closed. Ask a Novelo administrator for access; they can send you an invitation.",
        "nf_button_open": "Create an account",
        "nf_button_closed": "Open Novelo",
        "nf_notice_title": "Did you not ask for this?",
        "nf_notice": "Ignore this email: no account was created.",
        "nf_reason": "You received this email because access was requested for this address.",
        "rem_subject": "Accounts waiting for over a day · Novelo",
        "rem_preheader": "Account requests have been waiting for approval for more than 24 hours.",
        "rem_eyebrow": "Reminder",
        "rem_title_one": "1 account has been waiting for over a day",
        "rem_title_many": "{n} accounts have been waiting for over a day",
        "rem_p1": "These requests have been waiting for approval for more than 24 hours. Each person is still waiting for an answer.",
        "rem_p2": "We send at most one reminder per day.",
        "alert_subject": "Emails need attention · Novelo",
        "alert_preheader": "We detected problems sending Novelo emails.",
        "alert_eyebrow": "Monitoring",
        "alert_title": "Novelo emails need attention",
        "alert_p1": "We detected the following with email delivery:",
        "alert_p2": "While this lasts, people may not receive invitations or sign-in links. Send the invitation link through another channel.",
        "alert_button": "See the email status",
        "alert_notice_title": "Why am I getting this?",
        "alert_notice": "We send at most one of these notices every 6 hours, to the longest-standing administrator.",
        "alert_provider_not_configured": "The email provider is not configured: no email is sent.",
        "alert_provider_auth_invalid": "The provider rejected the API key.",
        "alert_domain_not_verified": "The sender domain is not verified at the provider.",
        "alert_failures_last_hour": "There were 3 or more send failures in the last hour.",
        "alert_high_failure_rate": "More than 20% of the emails sent in the last hour failed.",
        "alert_webhook_silent": "The webhook is configured but has received no events for over 24 hours.",
        "alert_no_admin_recipients": "There are no administrators with an email to receive new-account notices.",
        "test_subject": "Test email · Novelo",
        "test_preheader": "If you are reading this, Novelo email delivery works.",
        "test_eyebrow": "Test",
        "test_title": "Email delivery works",
        "test_p1": "This is a test email sent from the administration panel. It reached your inbox.",
        "test_button": "Open Novelo",
        "test_notice_title": "Did you not ask for this test?",
        "test_notice": "You can ignore this email.",
        "test_reason": "You received this email because a Novelo administrator ran a delivery test.",
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


def registration_received(locale: str, name: str | None, url: str) -> EmailParts:
    """Para quem se registou: o pedido foi recebido e um administrador vai rever."""
    t = _t(locale)
    content = Content(
        preheader=t["reg_preheader"],
        eyebrow=t["reg_eyebrow"],
        title=t["reg_title"],
        paragraphs=[*_greet(t, name), t["reg_p1"], t["reg_p2"]],
        cta_label=t["reg_button"],
        url=url,
        notice_title=t["reg_notice_title"],
        notice=t["reg_notice"],
        reason=t["reg_reason"],
    )
    return _finish(locale, t["reg_subject"], content)


def account_unavailable(locale: str, url: str, *, rejected: bool) -> EmailParts:
    """Pediram acesso para uma conta desativada ou recusada: sem link de entrada, só a saída (falar com o admin)."""
    t = _t(locale)
    content = Content(
        preheader=t["una_preheader"],
        eyebrow=t["una_eyebrow"],
        title=t["una_title"],
        paragraphs=[t["una_rejected" if rejected else "una_inactive"], t["una_p2"]],
        cta_label=t["una_button"],
        url=url,
        notice_title=t["una_notice_title"],
        notice=t["una_notice"],
        reason=t["una_reason"],
    )
    return _finish(locale, t["una_subject"], content)


def account_not_found(locale: str, url: str, *, registration_open: bool) -> EmailParts:
    """Pediram acesso para um email sem conta nem convite: neutro, sem revelar nada a terceiros."""
    t = _t(locale)
    content = Content(
        preheader=t["nf_preheader"],
        eyebrow=t["nf_eyebrow"],
        title=t["nf_title"],
        paragraphs=[t["nf_p1"], t["nf_open" if registration_open else "nf_closed"]],
        cta_label=t["nf_button_open" if registration_open else "nf_button_closed"],
        url=url,
        notice_title=t["nf_notice_title"],
        notice=t["nf_notice"],
        reason=t["nf_reason"],
    )
    return _finish(locale, t["nf_subject"], content)


def pending_reminder(locale: str, url: str, count: int) -> EmailParts:
    """Resumo diário aos administradores: contas por aprovar há mais de 24 horas."""
    t = _t(locale)
    content = Content(
        preheader=t["rem_preheader"],
        eyebrow=t["rem_eyebrow"],
        title=t["rem_title_many"].format(n=count) if count != 1 else t["rem_title_one"],
        paragraphs=[t["rem_p1"], t["rem_p2"]],
        cta_label=t["req_button"],
        url=url,
        notice_title=t["req_notice_title"],
        notice=t["req_notice"],
        reason=t["req_reason"],
    )
    return _finish(locale, t["rem_subject"], content)


def email_alert(locale: str, url: str, kinds: list[str]) -> EmailParts:
    """Aviso ao administrador de que o envio de emails tem problemas (`kinds` = códigos de alerta)."""
    t = _t(locale)
    content = Content(
        preheader=t["alert_preheader"],
        eyebrow=t["alert_eyebrow"],
        title=t["alert_title"],
        paragraphs=[t["alert_p1"], t["alert_p2"]],
        bullets=[t[f"alert_{k}"] for k in kinds if f"alert_{k}" in t],
        cta_label=t["alert_button"],
        url=url,
        notice_title=t["alert_notice_title"],
        notice=t["alert_notice"],
        reason=t["req_reason"],
    )
    return _finish(locale, t["alert_subject"], content)


def test_email(locale: str, name: str | None) -> EmailParts:
    """Email de teste do painel de administração."""
    t = _t(locale)
    content = Content(
        preheader=t["test_preheader"],
        eyebrow=t["test_eyebrow"],
        title=t["test_title"],
        paragraphs=[*_greet(t, name), t["test_p1"]],
        cta_label=t["test_button"],
        url=_brand().base,
        notice_title=t["test_notice_title"],
        notice=t["test_notice"],
        reason=t["test_reason"],
    )
    return _finish(locale, t["test_subject"], content)


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
        "registration-received": lambda: registration_received(locale, SAMPLE_NAME, f"{base}/pending-approval"),
        "account-inactive": lambda: account_unavailable(locale, base, rejected=False),
        "account-rejected": lambda: account_unavailable(locale, base, rejected=True),
        "account-not-found": lambda: account_not_found(locale, f"{base}/register", registration_open=True),
        "account-not-found-closed": lambda: account_not_found(locale, base, registration_open=False),
        "pending-reminder": lambda: pending_reminder(locale, f"{base}/users?tab=pending", 2),
        "email-alert": lambda: email_alert(
            locale, f"{base}/users?tab=emails", ["provider_auth_invalid", "high_failure_rate"]
        ),
        "test-email": lambda: test_email(locale, SAMPLE_NAME),
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
