"""Verificação de assinatura Svix (o formato dos webhooks do Resend). Sem imports de FastAPI."""

import base64
import binascii
import hashlib
import hmac
import time

from novelo.core.errors import FeatureDisabledError, UnauthenticatedError

TOLERANCE_S = 300  # 5 minutos: um pedido gravado e repetido mais tarde é recusado
MAX_BODY_BYTES = 64 * 1024


def verify_signature(
    secret: str,
    *,
    message_id: str | None,
    timestamp: str | None,
    signature: str | None,
    body: bytes,
    now: float | None = None,
) -> None:
    """Levanta `UnauthenticatedError` se a assinatura não for válida; `FeatureDisabledError` sem segredo."""
    if not secret:
        raise FeatureDisabledError("Webhook is not configured")
    invalid = UnauthenticatedError("Invalid webhook signature")
    if not (message_id and timestamp and signature):
        raise invalid
    try:
        sent_at = int(timestamp)
    except ValueError:
        raise invalid from None
    if abs((now if now is not None else time.time()) - sent_at) > TOLERANCE_S:
        raise invalid
    try:
        key = base64.b64decode(secret.removeprefix("whsec_"), validate=True)
    except (binascii.Error, ValueError):
        raise FeatureDisabledError("Webhook secret is malformed") from None
    signed = f"{message_id}.{timestamp}.".encode() + body
    expected = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()
    for part in signature.split(" "):
        version, _, value = part.partition(",")
        if version == "v1" and hmac.compare_digest(value.encode(), expected.encode()):
            return
    raise invalid
