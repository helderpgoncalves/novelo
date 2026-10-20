"""Webhook do Resend: assinatura Svix, repetição, idempotência, ordem dos eventos e supressão."""

import base64
import hashlib
import hmac
import json
import time

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.config import get_settings
from novelo.features.email_log import service
from novelo.features.email_log.models import EmailDelivery, EmailSuppression
from novelo.features.email_log.webhook import MAX_BODY_BYTES, verify_signature
from tests.conftest import OutboxSender

URL = "/api/v1/webhooks/resend"
KEY = b"segredo-de-teste-do-webhook-0123"
SECRET = "whsec_" + base64.b64encode(KEY).decode()


def sign(body: bytes, *, msg_id: str = "msg_1", ts: int | None = None, key: bytes = KEY) -> dict[str, str]:
    stamp = str(int(time.time()) if ts is None else ts)
    digest = hmac.new(key, f"{msg_id}.{stamp}.".encode() + body, hashlib.sha256).digest()
    return {
        "svix-id": msg_id,
        "svix-timestamp": stamp,
        "svix-signature": "v1," + base64.b64encode(digest).decode(),
        "content-type": "application/json",
    }


def event(kind: str, email_id: str, **data: object) -> bytes:
    return json.dumps(
        {"type": kind, "created_at": "2026-10-20T10:00:00Z", "data": {"email_id": email_id, **data}}
    ).encode()


@pytest.fixture(autouse=True)
def _secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "resend_webhook_secret", SECRET)


_SENDER = OutboxSender()  # partilhado: cada envio tem um id de fornecedor diferente


@pytest.fixture(autouse=True)
def _fresh_sender() -> None:
    global _SENDER  # noqa: PLW0603
    _SENDER = OutboxSender()


async def sent_email(session: AsyncSession, to: str = "ana@x.pt") -> EmailDelivery:
    return await service.deliver(session, _SENDER, "magic_link", to, "s", "<p>", "t")


async def post(client: httpx.AsyncClient, body: bytes, headers: dict[str, str] | None = None) -> httpx.Response:
    return await client.post(URL, content=body, headers=headers if headers is not None else sign(body))


async def test_disabled_without_a_secret(client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "resend_webhook_secret", "")
    body = event("email.delivered", "msg-1")
    resp = await post(client, body)
    assert resp.status_code == 503 and resp.json()["code"] == "feature_disabled"


async def test_valid_signature_updates_the_delivery(client: httpx.AsyncClient, session: AsyncSession) -> None:
    row = await sent_email(session)
    resp = await post(client, event("email.delivered", row.provider_message_id or ""))
    assert resp.status_code == 200 and resp.json() == {"status": "updated"}
    await session.refresh(row)
    assert row.status == "delivered" and row.delivered_at is not None


async def test_invalid_or_missing_signature_is_refused(client: httpx.AsyncClient, session: AsyncSession) -> None:
    row = await sent_email(session)
    body = event("email.delivered", row.provider_message_id or "")
    wrong_key = await post(client, body, sign(body, key=b"outra-chave-qualquer-0123456789"))
    tampered = await post(client, body + b" ", sign(body))
    missing = await post(client, body, {"content-type": "application/json"})
    garbage = await post(client, body, {**sign(body), "svix-signature": "v1,AAAA"})
    for resp in (wrong_key, tampered, missing, garbage):
        assert resp.status_code == 401 and resp.json()["code"] == "unauthenticated"
    await session.refresh(row)
    assert row.status == "sent"


async def test_replay_outside_the_tolerance_is_refused(client: httpx.AsyncClient, session: AsyncSession) -> None:
    row = await sent_email(session)
    body = event("email.delivered", row.provider_message_id or "")
    old = await post(client, body, sign(body, ts=int(time.time()) - 6 * 60))
    future = await post(client, body, sign(body, ts=int(time.time()) + 6 * 60))
    assert old.status_code == 401 and future.status_code == 401
    inside = await post(client, body, sign(body, ts=int(time.time()) - 4 * 60))
    assert inside.status_code == 200


async def test_idempotent_and_never_regresses(client: httpx.AsyncClient, session: AsyncSession) -> None:
    row = await sent_email(session)
    pid = row.provider_message_id or ""
    assert (await post(client, event("email.delivered", pid))).json() == {"status": "updated"}
    assert (await post(client, event("email.delivered", pid))).json() == {"status": "ignored"}  # repetido
    late_sent = await post(client, event("email.sent", pid), sign(event("email.sent", pid), msg_id="msg_2"))
    assert late_sent.json() == {"status": "ignored"}  # o `sent` chegou depois do `delivered`
    await session.refresh(row)
    assert row.status == "delivered"


async def test_delayed_then_delivered_and_failed_events(client: httpx.AsyncClient, session: AsyncSession) -> None:
    row, other = await sent_email(session), await sent_email(session, "b@x.pt")
    pid = row.provider_message_id or ""
    assert (await post(client, event("email.delivery_delayed", pid))).json() == {"status": "updated"}
    await session.refresh(row)
    assert row.status == "delayed"
    await post(client, event("email.delivered", pid))
    await session.refresh(row)
    assert row.status == "delivered"
    await post(client, event("email.failed", other.provider_message_id or ""))
    await session.refresh(other)
    assert other.status == "failed" and other.error_code == "failed"


async def test_unknown_events_and_ids_are_ignored_with_200(client: httpx.AsyncClient, session: AsyncSession) -> None:
    row = await sent_email(session)
    for body in (
        event("email.opened", row.provider_message_id or ""),
        event("email.delivered", "id-de-outra-app"),
        event("email.delivered", ""),
        b"not json at all",
        b"[]",
    ):
        resp = await post(client, body)
        assert resp.status_code == 200 and resp.json() == {"status": "ignored"}, body
    await session.refresh(row)
    assert row.status == "sent"


async def test_permanent_bounce_and_complaint_suppress_but_transient_does_not(
    client: httpx.AsyncClient, session: AsyncSession
) -> None:
    hard, soft, spam = (
        await sent_email(session, "hard@x.pt"),
        await sent_email(session, "soft@x.pt"),
        await sent_email(session, "spam@x.pt"),
    )
    await post(
        client, event("email.bounced", hard.provider_message_id or "", bounce={"type": "Permanent", "message": "x"})
    )
    await post(client, event("email.bounced", soft.provider_message_id or "", bounce={"type": "Transient"}))
    await post(client, event("email.complained", spam.provider_message_id or ""))
    suppressed = {s.to_email: s.reason for s in (await session.execute(select(EmailSuppression))).scalars()}
    assert suppressed == {"hard@x.pt": "bounced", "spam@x.pt": "complained"}
    await session.refresh(hard)
    assert hard.status == "bounced" and hard.error_code == "bounced_permanent"
    # o endereço suprimido deixa de receber: fica `skipped`
    again = await service.deliver(session, _SENDER, "magic_link", "hard@x.pt", "s", "<p>", "t")
    assert again.status == "skipped" and again.error_code == "suppressed_bounced"


async def test_oversized_body_is_refused(client: httpx.AsyncClient) -> None:
    body = b"x" * (MAX_BODY_BYTES + 1)
    resp = await post(client, body)
    assert resp.status_code == 400


async def test_webhook_is_rate_limited(client: httpx.AsyncClient) -> None:
    body = event("email.delivered", "x")
    codes = {(await post(client, body, {"content-type": "application/json"})).status_code for _ in range(305)}
    assert codes == {401, 429}


def test_verify_signature_accepts_any_of_several_signatures() -> None:
    body = b"{}"
    good = sign(body)
    header = f"v1,AAAA {good['svix-signature']} v2,BBBB"
    verify_signature(SECRET, message_id="msg_1", timestamp=good["svix-timestamp"], signature=header, body=body)
