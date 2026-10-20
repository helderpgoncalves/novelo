"""Adaptador do Resend: id do fornecedor, classificação de erros, cabeçalhos e leitura do estado; DoH."""

import json

import httpx
import pytest

from novelo.adapters.dns import DOH_URL, DohResolver
from novelo.adapters.email import EmailSendError, LogSender, ResendReader, ResendSender, UnavailableSender
from novelo.core.config import Settings
from novelo.core.errors import EmailUnavailableError, FeatureDisabledError

SETTINGS = Settings(RESEND_API_KEY="re_send_key", RESEND_READ_API_KEY="re_read_key", EMAIL_REPLY_TO="")  # type: ignore[call-arg]


def sender(handler: httpx.MockTransport) -> ResendSender:
    return ResendSender(SETTINGS, transport=handler, timeout_s=1)


async def send(s: ResendSender) -> str | None:
    return await s.send(to="a@x.pt", subject="s", html="<p>x</p>", text="x", idempotency_key="k-1")


async def test_returns_provider_id_and_sends_deliverability_headers() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["headers"] = dict(request.headers)
        seen["json"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "re_123"})

    assert await send(sender(httpx.MockTransport(handler))) == "re_123"
    headers, body = seen["headers"], seen["json"]
    assert isinstance(headers, dict) and isinstance(body, dict)
    assert headers["idempotency-key"] == "k-1" and headers["authorization"] == "Bearer re_send_key"
    assert body["reply_to"] == SETTINGS.email_support  # por omissão responde ao suporte
    assert body["headers"] == {"X-Entity-Ref-ID": "k-1"} and body["text"] == "x" and body["html"] == "<p>x</p>"


@pytest.mark.parametrize(
    ("status", "body", "headers", "code", "transient"),
    [
        (500, {}, {}, "provider_down", True),
        (503, {}, {}, "provider_down", True),
        (429, {"name": "rate_limit_exceeded"}, {"retry-after": "2"}, "rate_limited", True),
        (429, {"name": "daily_quota_exceeded"}, {}, "quota_exceeded", False),
        (401, {"name": "missing_api_key"}, {}, "provider_auth", False),
        (
            403,
            {"name": "validation_error", "message": "The novelo.test domain is not verified."},
            {},
            "domain_not_verified",
            False,
        ),
        (422, {"name": "invalid_to_address", "message": "Invalid `to` field"}, {}, "invalid_recipient", False),
        (422, {"name": "validation_error", "message": "something else"}, {}, "provider_422", False),
    ],
)
async def test_errors_are_classified(
    status: int, body: dict[str, str], headers: dict[str, str], code: str, transient: bool
) -> None:
    transport = httpx.MockTransport(lambda _: httpx.Response(status, json=body, headers=headers))
    with pytest.raises(EmailSendError) as info:
        await send(sender(transport))
    assert info.value.error_code == code and info.value.transient is transient
    if "retry-after" in headers:
        assert info.value.retry_after_s == 2.0


async def test_timeout_and_network_errors_are_transient() -> None:
    def slow(_: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow")

    def down(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    for handler, code in ((slow, "timeout"), (down, "network")):
        with pytest.raises(EmailSendError) as info:
            await send(sender(httpx.MockTransport(handler)))
        assert info.value.error_code == code and info.value.transient


async def test_dev_and_unavailable_senders() -> None:
    assert (await LogSender().send(to="a@x.pt", subject="s", html="h", text="t") or "").startswith("dev-")
    with pytest.raises(EmailUnavailableError) as info:
        await UnavailableSender().send(to="a@x.pt", subject="s", html="h", text="t")
    assert isinstance(info.value, FeatureDisabledError) and info.value.code == "email_unavailable"


async def test_reader_returns_last_event_and_never_raises() -> None:
    def ok(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/emails/re_9") and request.headers["authorization"] == "Bearer re_read_key"
        return httpx.Response(200, json={"id": "re_9", "last_event": "delivered"})

    assert await ResendReader(SETTINGS, transport=httpx.MockTransport(ok)).last_event("re_9") == "delivered"
    restricted = httpx.MockTransport(lambda _: httpx.Response(401, json={"name": "restricted_api_key"}))
    assert await ResendReader(SETTINGS, transport=restricted).last_event("re_9") is None
    assert not ResendReader(Settings(RESEND_READ_API_KEY=""), transport=restricted).configured  # type: ignore[call-arg]


async def test_doh_resolver_parses_txt_and_failures() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url).startswith(DOH_URL) and request.url.params["type"] == "TXT"
        return httpx.Response(
            200, json={"Status": 0, "Answer": [{"type": 16, "data": '"v=spf1 " "include:amazonses.com ~all"'}]}
        )

    values = await DohResolver(transport=httpx.MockTransport(handler)).query("send.x.pt", "TXT")
    assert values == ["v=spf1 include:amazonses.com ~all"]
    broken = httpx.MockTransport(lambda _: httpx.Response(500))
    assert await DohResolver(transport=broken).query("x.pt", "TXT") is None
    empty = httpx.MockTransport(lambda _: httpx.Response(200, json={"Status": 3}))
    assert await DohResolver(transport=empty).query("x.pt", "TXT") == []
