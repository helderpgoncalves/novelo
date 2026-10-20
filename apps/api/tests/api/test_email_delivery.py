"""`deliver()`: registo, repetições, erros permanentes, idempotência, disjuntor e supressão."""

import logging

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.email import EmailSendError
from novelo.core.errors import EmailSuppressedError, EmailUnavailableError
from novelo.features.email_log import service
from novelo.features.email_log.models import EmailDelivery, EmailSuppression

BODY = "https://x/reset-password?token=SEGREDO-123"


class ScriptedSender:
    """Cada envio consome o primeiro passo: uma exceção é levantada; `None` aceita (com id `msg-<n>`)."""

    def __init__(self, *steps: Exception | None) -> None:
        self.steps = list(steps)
        self.calls: list[str | None] = []

    async def send(
        self, *, to: str, subject: str, html: str, text: str, idempotency_key: str | None = None
    ) -> str | None:
        self.calls.append(idempotency_key)
        step = self.steps.pop(0) if self.steps else None
        if step is not None:
            raise step
        return f"msg-{len(self.calls)}"


def transient(code: str = "timeout") -> EmailSendError:
    return EmailSendError(code, transient=True)


async def deliver(session: AsyncSession, sender: ScriptedSender, **kw: bool) -> EmailDelivery:
    return await service.deliver(session, sender, "magic_link", "Ana@X.pt", "assunto", "<p>x</p>", BODY, **kw)  # type: ignore[arg-type]


async def test_success_is_recorded_without_content(session: AsyncSession, caplog: pytest.LogCaptureFixture) -> None:
    sender = ScriptedSender()
    with caplog.at_level(logging.DEBUG):
        row = await deliver(session, sender)
    assert (row.status, row.attempts, row.error_code, row.provider_message_id) == ("sent", 1, None, "msg-1")
    assert row.to_email == "ana@x.pt" and row.sent_at is not None and row.delivered_at is None
    assert sender.calls == [f"novelo-magic_link-{row.id}"]
    assert "SEGREDO" not in caplog.text and "ana@x.pt" not in caplog.text and "a***@x.pt" in caplog.text
    columns = {c.name for c in EmailDelivery.__table__.columns}  # só metadados: nenhuma coluna de conteúdo
    assert not columns & {"subject", "body", "html", "text", "url", "token"}


async def test_transient_errors_are_retried_with_the_same_idempotency_key(session: AsyncSession) -> None:
    sender = ScriptedSender(transient(), transient("provider_down"))
    row = await deliver(session, sender)
    assert row.status == "sent" and row.attempts == 3 and row.error_code is None
    assert len(set(sender.calls)) == 1  # um reenvio nunca duplica o email (mesma Idempotency-Key)


async def test_gives_up_after_three_attempts_and_keeps_the_error(session: AsyncSession) -> None:
    sender = ScriptedSender(transient(), transient(), transient("provider_down"), None)
    row = await deliver(session, sender)
    assert (row.status, row.attempts, row.error_code, row.provider_message_id) == ("failed", 3, "provider_down", None)
    assert len(sender.calls) == 3


@pytest.mark.parametrize("code", ["provider_auth", "invalid_recipient", "domain_not_verified", "quota_exceeded"])
async def test_permanent_errors_are_not_retried(session: AsyncSession, code: str) -> None:
    sender = ScriptedSender(EmailSendError(code, transient=False))
    row = await deliver(session, sender)
    assert (row.status, row.attempts, row.error_code) == ("failed", 1, code) and len(sender.calls) == 1


async def test_retry_after_is_respected_and_backoff_grows(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    delays: list[float] = []

    async def record(seconds: float) -> None:
        delays.append(seconds)

    monkeypatch.setattr(service, "sleep", record)
    sender = ScriptedSender(EmailSendError("rate_limited", transient=True, retry_after_s=3.0), transient())
    await deliver(session, sender)
    assert len(delays) == 2 and delays[0] >= 3.0 and delays[1] > 0


async def test_unexpected_errors_never_escape(session: AsyncSession) -> None:
    row = await deliver(session, ScriptedSender(RuntimeError("boom")))
    assert row.status == "failed" and row.error_code == "unexpected"


async def test_strict_raises_503_after_recording_the_failure(session: AsyncSession) -> None:
    with pytest.raises(EmailUnavailableError):
        await deliver(session, ScriptedSender(EmailSendError("provider_auth", transient=False)), strict=True)
    [row] = (await session.execute(select(EmailDelivery))).scalars()
    assert row.status == "failed" and row.error_code == "provider_auth"


async def test_circuit_breaker_opens_after_repeated_provider_failures(session: AsyncSession) -> None:
    for _ in range(5):
        await deliver(session, ScriptedSender(EmailSendError("provider_down", transient=False)))
    sender = ScriptedSender()
    row = await deliver(session, sender)
    assert row.status == "failed" and row.error_code == "circuit_open" and row.attempts == 0 and sender.calls == []
    with pytest.raises(EmailUnavailableError):
        await deliver(session, sender, strict=True)
    # passado o período, deixa passar uma tentativa; se funcionar, fecha
    service.breaker.opened_at = (service.breaker.opened_at or 0) - 31
    assert (await deliver(session, sender)).status == "sent"
    assert (await deliver(session, sender)).status == "sent"


async def test_recipient_errors_do_not_open_the_breaker(session: AsyncSession) -> None:
    for _ in range(8):
        await deliver(session, ScriptedSender(EmailSendError("invalid_recipient", transient=False)))
    assert (await deliver(session, ScriptedSender())).status == "sent"


async def test_suppressed_recipient_is_skipped_with_the_reason(session: AsyncSession) -> None:
    session.add_all(
        [
            EmailSuppression(to_email="ana@x.pt", reason="complained"),
            EmailSuppression(to_email="b@x.pt", reason="manual"),
        ]
    )
    await session.commit()
    sender = ScriptedSender()
    row = await deliver(session, sender)
    assert (row.status, row.error_code, row.attempts) == ("skipped", "suppressed_complained", 0) and sender.calls == []
    with pytest.raises(EmailSuppressedError):
        await deliver(session, sender, strict=True)
    assert service.warning_of(row) == ("email_skipped", "suppressed_complained")


def test_mask_email() -> None:
    assert service.mask_email("lucas.nascimento@vitrusambiente.pt") == "l***@vitrusambiente.pt"
    assert service.mask_email("sem-arroba") == "***"


async def test_events_only_move_forward_and_transient_ones_do_not_suppress(session: AsyncSession) -> None:
    row = await deliver(session, ScriptedSender())
    pid = row.provider_message_id or ""
    assert await service.apply_event(session, pid, "email.delivered") is True
    assert await service.apply_event(session, pid, "email.sent") is False  # nunca regride
    assert await service.apply_event(session, pid, "email.delivered") is False  # idempotente
    assert await service.apply_event(session, pid, "email.delivery_delayed") is False
    assert await service.apply_event(session, pid, "email.bounced", "Transient") is True
    assert row.status == "bounced" and row.error_code == "bounced_transient"
    assert (await session.execute(select(EmailSuppression))).first() is None  # soft bounce não suprime
    assert await service.apply_event(session, pid, "email.something_else") is False
    assert await service.apply_event(session, "nao-existe", "email.delivered") is False
