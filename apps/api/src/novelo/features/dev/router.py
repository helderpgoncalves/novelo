"""Ferramentas só de desenvolvimento (APP_ENV=development). Nunca montadas em produção nem no OpenAPI."""

from fastapi import APIRouter

from novelo.adapters.email import DEV_OUTBOX

router = APIRouter()


@router.get("/emails")
def list_dev_emails(to: str | None = None) -> list[dict[str, str]]:
    """Emails que seriam enviados pelo Resend (links de recuperação e de confirmação), para testes E2E."""
    emails = list(DEV_OUTBOX)
    return [e for e in emails if not to or e["to"] == to.lower()][::-1]
