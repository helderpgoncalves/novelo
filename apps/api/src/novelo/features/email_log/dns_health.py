"""Verifica os registos DNS do domínio do remetente (DKIM, SPF/return-path e DMARC do Resend). Cache de 10 min."""

import time
from datetime import UTC, datetime
from email.utils import parseaddr

from novelo.adapters.dns import DnsResolver
from novelo.core.config import get_settings
from novelo.features.email_log.schemas import DnsCheck, DnsStatus, EmailDnsHealth

CACHE_S = 600.0
_cache: tuple[float, EmailDnsHealth] | None = None


def reset_cache() -> None:
    global _cache  # noqa: PLW0603
    _cache = None


def sender_domain() -> str:
    address = parseaddr(get_settings().email_from)[1]
    return address.rpartition("@")[2].lower()


def _txt(values: list[str] | None, needle: str) -> list[str]:
    return [v for v in (values or []) if needle.lower() in v.lower()]


async def _dkim(dns: DnsResolver, d: str) -> DnsCheck:
    values = await dns.query(f"resend._domainkey.{d}", "TXT")
    if values is None:
        return DnsCheck(key="dkim", status="unknown", detail="lookup_failed", hint="The DNS lookup failed; try again")
    if _txt(values, "p="):
        return DnsCheck(key="dkim", status="ok", detail="found", hint="")
    return DnsCheck(
        key="dkim",
        status="fail",
        detail="missing",
        hint=f"Add the TXT record resend._domainkey.{d} shown in the Resend domain page",
    )


async def _spf(dns: DnsResolver, d: str) -> DnsCheck:
    send = await dns.query(f"send.{d}", "TXT")
    root = await dns.query(d, "TXT")
    if send is None and root is None:
        return DnsCheck(key="spf", status="unknown", detail="lookup_failed", hint="The DNS lookup failed; try again")
    if _txt(send, "v=spf1") and _txt(send, "amazonses.com"):
        return DnsCheck(key="spf", status="ok", detail="found", hint="")
    if _txt(root, "v=spf1") and _txt(root, "amazonses.com"):
        return DnsCheck(key="spf", status="ok", detail="found_on_root", hint="")
    if _txt(root, "v=spf1"):
        return DnsCheck(
            key="spf",
            status="warn",
            detail="no_provider",
            hint=f"The SPF record of {d} does not include amazonses.com; Resend uses send.{d} for the return path",
        )
    return DnsCheck(
        key="spf",
        status="fail",
        detail="missing",
        hint=f"Add the TXT record send.{d} with v=spf1 include:amazonses.com ~all (see the Resend domain page)",
    )


async def _return_path(dns: DnsResolver, d: str) -> DnsCheck:
    values = await dns.query(f"send.{d}", "MX")
    if values is None:
        return DnsCheck(
            key="return_path", status="unknown", detail="lookup_failed", hint="The DNS lookup failed; try again"
        )
    if _txt(values, "amazonses.com"):
        return DnsCheck(key="return_path", status="ok", detail="found", hint="")
    return DnsCheck(
        key="return_path",
        status="fail",
        detail="missing",
        hint=f"Add the MX record send.{d} pointing to feedback-smtp.<region>.amazonses.com (Resend domain page)",
    )


async def _dmarc(dns: DnsResolver, d: str) -> DnsCheck:
    values = await dns.query(f"_dmarc.{d}", "TXT")
    if values is None:
        return DnsCheck(key="dmarc", status="unknown", detail="lookup_failed", hint="The DNS lookup failed; try again")
    found = _txt(values, "v=DMARC1")
    if not found:
        return DnsCheck(
            key="dmarc",
            status="warn",
            detail="missing",
            hint=f"Add a TXT record _dmarc.{d} such as v=DMARC1; p=quarantine; rua=mailto:...",
        )
    if "p=none" in found[0].replace(" ", "").lower():
        return DnsCheck(
            key="dmarc",
            status="warn",
            detail="policy_none",
            hint="DMARC policy is p=none: it works, but p=quarantine protects the domain better",
        )
    return DnsCheck(key="dmarc", status="ok", detail="found", hint="")


async def check(dns: DnsResolver, *, force: bool = False) -> EmailDnsHealth:
    global _cache  # noqa: PLW0603
    now = time.monotonic()
    if not force and _cache is not None and now - _cache[0] < CACHE_S:
        return _cache[1]
    d = sender_domain()
    checks = [await _dkim(dns, d), await _spf(dns, d), await _return_path(dns, d), await _dmarc(dns, d)]
    statuses = {c.status for c in checks}
    overall: DnsStatus = "fail" if "fail" in statuses else "warn" if statuses & {"warn", "unknown"} else "ok"
    result = EmailDnsHealth(domain=d, checked_at=datetime.now(UTC), overall=overall, checks=checks)
    if "unknown" not in statuses:  # uma falha de rede não fica em cache 10 min
        _cache = (now, result)
    return result
