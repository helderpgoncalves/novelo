"""IP real do cliente, limiter em memória, texto de contexto dos emails, CSV injection e erros do OpenRouter."""

import httpx
import pytest
from pydantic import BaseModel

from novelo.adapters.openrouter import OpenRouterClient
from novelo.core.config import Settings
from novelo.core.errors import RateLimitError, UpstreamError
from novelo.core.ratelimit import RateLimiter, parse_ip, resolve_client_ip
from novelo.features.auth import emails
from novelo.features.municipal.exports import _cell


class Delta(BaseModel):
    zones: list[str]


CF_EDGE = "172.69.10.20"  # intervalo da Cloudflare (172.64.0.0/13)


def ip(peer: str | None, xff: str | None = None, cf: str | None = None, hops: int = 2, trust_cf: bool = False) -> str:
    return resolve_client_ip(peer, xff, cf, hops=hops, trust_cloudflare=trust_cf)


# --- A: IP real --------------------------------------------------------------------------------------------


def test_without_trusted_hops_headers_are_ignored() -> None:
    assert ip("203.0.113.5", "1.2.3.4", "9.9.9.9", hops=0) == "203.0.113.5"


def test_xff_is_counted_from_the_right_so_forged_values_do_not_count() -> None:
    # nginx (par TCP) e Traefik (acrescentou o IP de quem lhe ligou): o cliente é o 3.º a contar do fim
    assert ip("172.18.0.5", "6.6.6.6, 198.51.100.7, 172.18.0.3") == "198.51.100.7"
    assert ip("172.18.0.5", "198.51.100.7, 172.18.0.3") == "198.51.100.7"


def test_short_chain_uses_the_leftmost_known_hop_and_garbage_never_wins() -> None:
    assert ip("172.18.0.5", None) == "172.18.0.5"
    assert ip("172.18.0.5", "not-an-ip, 172.18.0.3") == "172.18.0.5"  # lixo na posição de confiança: cai no par TCP
    assert ip("172.18.0.5", "x" * 5000 + ", 198.51.100.7, 172.18.0.3") == "198.51.100.7"
    assert ip(None, None) == "unknown"


def test_cloudflare_header_only_counts_when_the_outer_hop_is_cloudflare() -> None:
    chain = f"{CF_EDGE}, 172.18.0.3"
    assert ip("172.18.0.5", chain, "203.0.113.9", trust_cf=True) == "203.0.113.9"
    assert ip("172.18.0.5", chain, "garbage", trust_cf=True) == CF_EDGE
    assert ip("172.18.0.5", chain, "203.0.113.9", trust_cf=False) == CF_EDGE
    # origem exposta sem Cloudflare: o cabeçalho forjado não vale
    assert ip("172.18.0.5", "198.51.100.7, 172.18.0.3", "203.0.113.9", trust_cf=True) == "198.51.100.7"


def test_parse_ip_validates_and_normalises() -> None:
    assert parse_ip(" 203.0.113.5 ") == "203.0.113.5"
    assert parse_ip("::ffff:203.0.113.5") == "203.0.113.5"
    assert parse_ip("2001:db8::1") == "2001:db8::1"
    for bad in ("", None, "999.1.1.1", "<script>", "1.2.3.4; DROP", "a" * 100):
        assert parse_ip(bad) is None


def test_email_context_shows_only_valid_ips_and_clean_devices() -> None:
    _, html, text = emails.magic_link(
        "pt-PT", "https://x/y", 15, ip="<script>alert(1)</script>", device="Chrome\x00\n<b>"
    )
    assert "<script>" not in html and "<script>" not in text
    assert "&lt;b&gt;" in html and "\x00" not in text
    _, _, ok = emails.magic_link("pt-PT", "https://x/y", 15, ip="203.0.113.5", device=None)
    assert "203.0.113.5" in ok


# --- B: limiter --------------------------------------------------------------------------------------------


def test_limiter_blocks_and_drops_empty_keys() -> None:
    lim = RateLimiter(limit=2, window_s=0, name="t-empty")  # janela 0: tudo expira de imediato
    lim.check("a")
    lim.check("a")  # a janela já expirou: nunca bloqueia
    assert lim.is_blocked("a") is False
    assert "a" not in lim._hits  # chave vazia apagada
    strict = RateLimiter(limit=1, window_s=60, name="t-strict")
    strict.check("k")
    with pytest.raises(RateLimitError):
        strict.check("k")


def test_limiter_never_grows_past_max_keys() -> None:
    lim = RateLimiter(limit=5, window_s=3600, name="t-cap", max_keys=100)
    for i in range(1000):
        lim.check(f"ip-{i}")
    assert len(lim._hits) <= 100
    lim.check("ip-999")  # as chaves recentes sobrevivem
    assert len(lim._hits["ip-999"]) == 2


def test_reset_all_clears_every_limiter() -> None:
    lim = RateLimiter(limit=1, window_s=60, name="t-reset")
    lim.check("x")
    RateLimiter.reset_all()
    lim.check("x")


# --- K: CSV injection e erros do OpenRouter -----------------------------------------------------------------


def test_csv_cells_that_look_like_formulas_are_neutralised() -> None:
    assert _cell('=HYPERLINK("http://evil")') == '\'=HYPERLINK("http://evil")'
    for start in ("+1", "-1", "@SUM(A1)", "\tx", "\rx"):
        assert _cell(start).startswith("'")
    assert _cell("Rua das Flores") == "Rua das Flores" and _cell(None) == "" and _cell(-3.5) == -3.5


async def test_openrouter_errors_never_leak_provider_details() -> None:
    secret = "sk-or-SECRET-DETAIL"
    handler = httpx.MockTransport(lambda _: httpx.Response(400, json={"error": {"message": secret}}))
    client = OpenRouterClient(Settings(OPENROUTER_API_KEY="k"), transport=handler)
    with pytest.raises(UpstreamError) as err:
        await client.structured(system="s", user="u", schema=Delta)
    assert secret not in err.value.message and "400" in err.value.message
