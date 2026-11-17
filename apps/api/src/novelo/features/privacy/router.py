"""Rotas do RGPD do doador: política pública, consentimentos, exportação e apagamento.

Routers finos — as regras estão no serviço. O papel `donor` é o portão das rotas pessoais (a política
é pública, sem sessão); o apagamento exige também não estar sob impersonação, como toda a ação
irreversível de conta.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.database import get_db
from novelo.core.deps import NotImpersonating, require_role
from novelo.core.ratelimit import donor_bags_limiter
from novelo.core.request_meta import Meta
from novelo.features.privacy import service
from novelo.features.privacy.policy import PolicyOut
from novelo.features.privacy.schemas import (
    AccountExportOut,
    ConsentsOut,
    ConsentUpdate,
    DeletionPreviewOut,
    DeletionRequest,
)
from novelo.features.users.models import User

router = APIRouter()
public_router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]

# A conta de doador só toca no que é dela (como nos sacos e nos pontos).
Donor = Annotated[User, Depends(require_role("donor"))]


@public_router.get("/privacy-policy", response_model=PolicyOut)
async def get_public_privacy_policy(db: Db, response: Response) -> PolicyOut:
    """A política de privacidade por finalidades, com prazos por categoria — pública e sem sessão.

    UMA fonte (`features/privacy/policy.py`): o web desenha-a tal e qual; mudou algo, muda-se lá.
    Cache curta no cliente: a política só muda quando a equipa muda a versão.
    """
    response.headers["Cache-Control"] = "public, max-age=300"
    return service.get_policy()  # type: ignore[return-value]


@router.get("/cidadao/consents", response_model=ConsentsOut)
async def get_donor_consents(user: Donor, db: Db) -> ConsentsOut:
    """As duas camadas de consentimento (marketing da Vitrus e ofertas de parceiros), desligadas por
    defeito — cada uma com o momento e a versão da política em que foi dada ou retirada."""
    return await service.list_consents(db, user)


@router.put(
    "/cidadao/consents",
    response_model=ConsentsOut,
    dependencies=[Depends(donor_bags_limiter)],
)
async def set_donor_consent(body: ConsentUpdate, user: Donor, db: Db, meta: Meta) -> ConsentsOut:
    """Dar ou retirar UMA camada de consentimento: linha nova append-only + trilha de auditoria (a
    prova do art. 7.º/1 RGPD). Retirar é tão fácil como dar; a outra camada não se mexe."""
    return await service.record_consent(db, user, body.purpose, body.granted, meta, source=body.source)


@router.get("/cidadao/account/export", response_model=AccountExportOut)
async def export_donor_account(user: Donor, db: Db, response: Response) -> AccountExportOut:
    """Portabilidade (art. 20.º): a conta inteira em JSON legível por máquina — perfil, consentimentos,
    sacos, pedidos e livro de pontos. Nunca inclui dados derivados (calibração, pontuações)."""
    export = await service.export_account(db, user)
    response.headers["Content-Disposition"] = f'attachment; filename="novelo-dados-{user.id}.json"'
    return export


@router.get("/cidadao/account/delete-preview", response_model=DeletionPreviewOut)
async def get_donor_deletion_preview(user: Donor, db: Db) -> DeletionPreviewOut:
    """O pré-aviso OBRIGATÓRIO antes de apagar: saldo atual, prazos FIFO e o que se perde. O web usa-o
    para as três proteções do ADR (aviso, resgatar antes, «pontos não são dinheiro nem conversíveis»)."""
    return await service.deletion_preview(db, user)


@router.post(
    "/cidadao/account/delete",
    status_code=204,
    dependencies=[Depends(donor_bags_limiter), NotImpersonating],
)
async def delete_donor_account(body: DeletionRequest, user: Donor, db: Db, meta: Meta) -> Response:
    """Apagar a própria conta (art. 17.º): exige o email da conta escrito à mão. A pessoa desaparece;
    sacos, livro de pontos, pedidos e consentimentos ficam anónimos (os agregados sobrevivem) e o
    facto fica na auditoria, sem email nem IP do próprio."""
    await service.delete_account(db, user, body.confirm_email, meta)
    return Response(status_code=204)
