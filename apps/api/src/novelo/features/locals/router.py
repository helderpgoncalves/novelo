import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.core.deps import require_role
from novelo.core.ratelimit import passport_limiter
from novelo.core.request_meta import Meta
from novelo.features.audit import service as audit
from novelo.features.locals import service
from novelo.features.locals.schemas import (
    CertificateOptIn,
    LocalAccountAdminOut,
    LocalAccountOut,
    LocalCertificateOut,
    LocalReportOut,
    StopNoticeCreate,
    StopNoticeCurrent,
    StopNoticeOut,
)
from novelo.features.lots.schemas import LotSummary
from novelo.features.users.models import User

router = APIRouter()
public_router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]

# A conta de local só toca no que é dela: o papel é o portão e o local deduz-se da conta.
Local = Annotated[User, Depends(require_role("local"))]


@router.get("/local/account", response_model=LocalAccountOut)
async def get_local_account(user: Local, db: Db) -> LocalAccountOut:
    """A conta de local de quem pede: o sítio, a natureza e o estado do certificado público."""
    return await service.account_out(db, await service.get_account(db, user.id))


# A equipa (admin e operador) gere contas de local: convida, vê quem entra e vê os avisos por local.
Team = Annotated[User, Depends(require_role("admin", "operator"))]


@router.get("/locals", response_model=list[LocalAccountAdminOut])
async def list_local_accounts(user: Team, db: Db) -> list[LocalAccountAdminOut]:
    """As contas de local, com o aviso ativo de cada sítio — a mesa da equipa para despachar rondas."""
    return await service.list_account_outs(db)


# --- leitura: o que o local entregou -----------------------------------------------------------


@router.get("/local/lots", response_model=list[LotSummary])
async def list_local_lots(user: Local, db: Db) -> list[LotSummary]:
    """Os lotes das paragens do próprio local, com o peso medido (`weight_source` diz de onde vem)."""
    account = await service.get_account(db, user.id)
    return await service.list_local_lots(db, account)


@router.get("/local/report", response_model=LocalReportOut)
async def get_local_report(user: Local, db: Db) -> LocalReportOut:
    """Relatório do local em kg medidos por destino. Sem CO₂ e sem dados de doadores — nunca."""
    account = await service.get_account(db, user.id)
    return await service.local_report(db, account)


@router.put("/local/certificate", response_model=LocalAccountOut)
async def set_local_certificate(body: CertificateOptIn, user: Local, db: Db, meta: Meta) -> LocalAccountOut:
    """Opt-in do certificado público: ligar ou desligar. Só o próprio local decide — a equipa vê, não muda."""
    account = await service.get_account(db, user.id)
    await service.set_certificate_opt_in(db, account=account, user=user, opt_in=body.opt_in)
    await audit.record(
        db,
        "local_certificate.opt_in" if body.opt_in else "local_certificate.opt_out",
        actor_id=user.id,
        target_type="local_account",
        target_id=account.id,
        meta=meta,
        details={"locality_id": str(account.locality_id) if account.locality_id else None},
    )
    return await service.account_out(db, account)


@public_router.get(
    "/locals/{account_id}/certificate",
    response_model=LocalCertificateOut,
    dependencies=[Depends(passport_limiter)],
)
async def get_public_local_certificate(account_id: uuid.UUID, db: Db) -> LocalCertificateOut:
    """Página pública do certificado de um local (opt-in). 404 quando desligado: sem opt-in não há página."""
    return await service.public_certificate(db, account_id)


# --- o aviso «sacos prontos»: a única escrita do local no MVP ---------------------------------


@router.post("/local/notices", response_model=StopNoticeOut, status_code=201)
async def create_local_notice(body: StopNoticeCreate, user: Local, db: Db, meta: Meta) -> StopNoticeOut:
    """Avisa «sacos prontos»: o sinal que garante paragem no dia (ADR: política de paragem). 409 se já houver um."""
    account = await service.get_account(db, user.id)
    notice = await service.raise_notice(db, account=account, user=user, bag_count=body.bag_count, note=body.note)
    await audit.record(
        db,
        "local_notice.create",
        actor_id=user.id,
        target_type="stop_notice",
        target_id=notice.id,
        meta=meta,
        details={"locality_id": str(account.locality_id) if account.locality_id else None, **body.model_dump()},
    )
    return service.notice_out(notice)


@router.get("/local/notices/active", response_model=StopNoticeCurrent)
async def get_active_local_notice(user: Local, db: Db) -> StopNoticeCurrent:
    """O aviso ativo do local, ou `null` quando não há nenhum."""
    account = await service.get_account(db, user.id)
    notice = await service.active_notice(db, account.locality_id)
    return StopNoticeCurrent(notice=service.notice_out(notice) if notice else None)


@router.delete("/local/notices/active", status_code=204)
async def cancel_local_notice(user: Local, db: Db, meta: Meta) -> Response:
    """Anula o aviso ativo (o histórico fica). 404 quando não há aviso ativo."""
    account = await service.get_account(db, user.id)
    notice = await service.cancel_notice(db, account=account, user=user)
    await audit.record(
        db,
        "local_notice.cancel",
        actor_id=user.id,
        target_type="stop_notice",
        target_id=notice.id,
        meta=meta,
        details={"locality_id": str(account.locality_id) if account.locality_id else None},
    )
    return Response(status_code=204)
