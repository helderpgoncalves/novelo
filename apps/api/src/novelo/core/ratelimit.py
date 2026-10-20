"""Limite de pedidos em memória (janela deslizante) e IP real do cliente.

Os contadores vivem no processo: com N processos do uvicorn os limites multiplicam por N. Por isso a produção corre
UM processo (`WEB_CONCURRENCY=1`, ver docs/engenharia/ambiente.md). Os tetos que protegem dinheiro (convidados,
gasto de IA) não dependem daqui: contam-se na base de dados.
"""

import ipaddress
import time
from collections import OrderedDict, deque
from typing import ClassVar

from fastapi import Request

from novelo.core.config import get_settings
from novelo.core.errors import RateLimitError

_MAX_XFF_CHARS = 2048
_MAX_XFF_ENTRIES = 20

# Intervalos publicados pela Cloudflare (https://www.cloudflare.com/ips/). Mudam raramente.
_CLOUDFLARE_NETS = tuple(
    ipaddress.ip_network(n)
    for n in (
        "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18",
        "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17",
        "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
        "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32",
        "2a06:98c0::/29", "2c0f:f248::/32",
    )
)  # fmt: skip


def parse_ip(raw: str | None) -> str | None:
    """Endereço IP válido e normalizado, ou `None` (lixo, vazio, demasiado longo). IPv4-mapeado vira IPv4."""
    if not raw:
        return None
    raw = raw.strip()
    if not raw or len(raw) > 45:
        return None
    try:
        ip = ipaddress.ip_address(raw)
    except ValueError:
        return None
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return str(ip)


def _is_cloudflare(ip: str | None) -> bool:
    if ip is None:
        return False
    addr = ipaddress.ip_address(ip)
    return any(addr.version == net.version and addr in net for net in _CLOUDFLARE_NETS)


def resolve_client_ip(
    peer: str | None, forwarded_for: str | None, cf_connecting_ip: str | None, *, hops: int, trust_cloudflare: bool
) -> str:
    """IP do cliente a partir do par TCP, de `X-Forwarded-For` e de `CF-Connecting-IP`.

    `hops` = nº de proxies de confiança entre o cliente e a API (cada um acrescenta o IP de quem lhe ligou). A cadeia
    é `XFF + par TCP` e o cliente é o elemento `hops` posições antes do fim: o que um atacante põe à esquerda do
    cabeçalho nunca conta. Com `hops == 0` os cabeçalhos são ignorados. Se o salto mais externo é da Cloudflare
    (e `trust_cloudflare`), vale o `CF-Connecting-IP`, que só a Cloudflare pode definir.
    """
    peer_ip = parse_ip(peer) or "unknown"
    if hops <= 0:
        return peer_ip
    # o fim do cabeçalho manda: é onde estão os nossos proxies
    entries = (forwarded_for or "")[-_MAX_XFF_CHARS:].split(",")[-_MAX_XFF_ENTRIES:]
    chain = [parse_ip(e) for e in entries if e.strip()]
    chain.append(None if peer_ip == "unknown" else peer_ip)
    candidate = chain[max(len(chain) - 1 - hops, 0)] or peer_ip
    if trust_cloudflare and _is_cloudflare(candidate):
        return parse_ip(cf_connecting_ip) or candidate
    return candidate


def client_ip(request: Request) -> str:
    s = get_settings()
    return resolve_client_ip(
        request.client.host if request.client else None,
        request.headers.get("x-forwarded-for"),
        request.headers.get("cf-connecting-ip"),
        hops=s.trusted_proxy_hops,
        trust_cloudflare=s.trust_cloudflare_header,
    )


class RateLimiter:
    """Janela deslizante por chave. Chaves vazias apagam-se e o total de chaves é limitado (`max_keys`)."""

    registry: ClassVar[list["RateLimiter"]] = []

    def __init__(self, limit: int, window_s: int, name: str, max_keys: int = 20_000) -> None:
        self.limit, self.window_s, self.name, self.max_keys = limit, window_s, name, max_keys
        self._hits: OrderedDict[str, deque[float]] = OrderedDict()
        RateLimiter.registry.append(self)

    def _prune(self, key: str, now: float) -> deque[float] | None:
        hits = self._hits.get(key)
        if hits is None:
            return None
        while hits and now - hits[0] > self.window_s:
            hits.popleft()
        if not hits:
            del self._hits[key]
            return None
        return hits

    def _make_room(self, now: float) -> None:
        """Acima do teto: apaga as chaves expiradas e, se ainda for preciso, as mais antigas."""
        if len(self._hits) < self.max_keys:
            return
        for key in [k for k, h in self._hits.items() if not h or now - h[-1] > self.window_s]:
            del self._hits[key]
        while len(self._hits) >= self.max_keys:
            self._hits.popitem(last=False)

    def check(self, key: str, limit: int | None = None) -> None:
        if not get_settings().rate_limit_enabled:
            return
        now = time.monotonic()
        hits = self._prune(key, now)
        if hits is not None and len(hits) >= (limit or self.limit):
            raise RateLimitError("Too many attempts. Try again in a few minutes.")
        if hits is None:
            self._make_room(now)
            hits = self._hits[key] = deque()
        else:
            self._hits.move_to_end(key)
        hits.append(now)

    def is_blocked(self, key: str, limit: int | None = None) -> bool:
        """Já chegou ao limite? Não regista nenhum pedido."""
        if not get_settings().rate_limit_enabled:
            return False
        hits = self._prune(key, time.monotonic())
        return hits is not None and len(hits) >= (limit or self.limit)

    def reset(self) -> None:
        self._hits.clear()

    @classmethod
    def reset_all(cls) -> None:
        for limiter in cls.registry:
            limiter.reset()

    async def __call__(self, request: Request) -> None:
        self.check(f"{self.name}:{client_ip(request)}")


auth_limiter = RateLimiter(limit=10, window_s=60, name="auth")
reset_limiter = RateLimiter(limit=5, window_s=600, name="reset")
triage_limiter = RateLimiter(limit=20, window_s=60, name="triage")  # cada chamada ao modelo de visão custa dinheiro
whatif_limiter = RateLimiter(limit=15, window_s=60, name="whatif")
copilot_limiter = RateLimiter(limit=12, window_s=60, name="copilot")  # chaves por utilizador (ver copilot/router.py)
alerts_limiter = RateLimiter(limit=10, window_s=60, name="alerts")

# Entrada sem password. Por IP (rota) e por email (chave explícita, ver features/auth/router.py).
magic_link_limiter = RateLimiter(limit=8, window_s=600, name="magic")
magic_verify_limiter = RateLimiter(limit=20, window_s=600, name="magic-verify")
magic_email_limiter = RateLimiter(limit=3, window_s=600, name="magic-email")
# Num evento muitos convidados partilham o mesmo IP (wifi): o limite por IP é largo; o por email é estrito.
quick_join_limiter = RateLimiter(limit=40, window_s=600, name="quick-join")
quick_join_email_limiter = RateLimiter(limit=3, window_s=600, name="quick-join-email")
quick_join_code_limiter = RateLimiter(limit=10, window_s=600, name="quick-join-code")  # só falhas de código
# Convidados: por utilizador, por hora (ver core/guest.py).
guest_ai_limiter = RateLimiter(limit=20, window_s=3600, name="guest-ai")
guest_solver_limiter = RateLimiter(limit=10, window_s=3600, name="guest-solver")

# Administração de utilizadores (chave por administrador, ver features/users/router.py) e convites.
invite_resend_limiter = RateLimiter(limit=3, window_s=3600, name="invite-resend")  # por convite
invite_email_limiter = RateLimiter(limit=3, window_s=3600, name="invite-email")  # por email convidado
admin_invite_limiter = RateLimiter(limit=30, window_s=3600, name="admin-invite")  # o limite real vem da configuração
admin_impersonate_limiter = RateLimiter(limit=10, window_s=3600, name="admin-impersonate")
admin_approval_limiter = RateLimiter(limit=60, window_s=3600, name="admin-approval")
admin_delete_limiter = RateLimiter(limit=20, window_s=3600, name="admin-delete")
invite_accept_limiter = RateLimiter(limit=20, window_s=600, name="invite-accept")  # por IP (rota pública)
invite_preview_limiter = RateLimiter(limit=30, window_s=600, name="invite-preview")  # por IP (rota pública)

# Registo público: o email já existir é visível na resposta (ver docs), por isso o limite é estreito.
register_limiter = RateLimiter(limit=10, window_s=3600, name="register")
# Login: falhas por CONTA (hash do email), independente do IP.
login_account_limiter = RateLimiter(limit=10, window_s=900, name="login-account")
# Rotas caras: execuções por utilizador (a chave inclui o id; o limite real vem da configuração).
solver_user_limiter = RateLimiter(limit=6, window_s=60, name="solver")
pdf_user_limiter = RateLimiter(limit=6, window_s=60, name="pdf")
passport_limiter = RateLimiter(limit=60, window_s=60, name="passport")  # passaporte público do lote, por IP
