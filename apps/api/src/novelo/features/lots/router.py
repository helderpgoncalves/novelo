from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import OpenRouterClient
from novelo.core.database import get_db
from novelo.core.deps import CurrentUser
from novelo.core.guest import AiGuard, NotGuestDep
from novelo.core.ratelimit import passport_limiter, triage_limiter
from novelo.domain.vocab import Fibre, LotState
from novelo.features.lots import service, triage
from novelo.features.lots.schemas import (
    BrandsOut,
    LotDetail,
    LotItemIn,
    LotItemOut,
    LotOpen,
    LotStateChange,
    LotSummary,
    MarketEntry,
    Passport,
    ReserveRequest,
    TriageResult,
)
from novelo.features.users.schemas import Locale

router = APIRouter()
public_router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]


async def get_llm(db: Db, user: CurrentUser) -> OpenRouterClient:
    """Cliente do OpenRouter ligado à configuração da base de dados (modelo por tarefa, orçamento, registo de uso)."""
    from novelo.features.ai_admin.service import build_client  # noqa: PLC0415  (evita import circular)

    return await build_client(db, user)


@router.post("/lots", response_model=LotSummary, status_code=201, dependencies=[NotGuestDep])
async def open_lot(body: LotOpen, user: CurrentUser, db: Db) -> LotSummary:
    """Abre um lote no ponto de recolha: gera o código que vai no QR."""
    return await service.open_lot(db, user, body.parish_code)


@router.get("/lots", response_model=list[LotSummary])
async def list_lots(
    db: Db,
    fibre: Fibre | None = None,
    state: LotState | None = None,
    parish_code: Annotated[str | None, Query(max_length=6)] = None,
) -> list[LotSummary]:
    return await service.list_lots(db, fibre, state, parish_code)


@router.get("/lots/{code}", response_model=LotDetail)
async def get_lot(code: str, db: Db) -> LotDetail:
    return await service.get_lot(db, code)


@router.post("/lots/{code}/items", response_model=LotItemOut, status_code=201, dependencies=[NotGuestDep])
async def add_lot_item(code: str, body: LotItemIn, user: CurrentUser, db: Db) -> LotItemOut:
    """Acrescenta ao lote uma peça confirmada pelo operador."""
    return await service.add_item(db, user, code, body)


@router.post("/lots/{code}/state", response_model=LotDetail, dependencies=[NotGuestDep])
async def change_lot_state(code: str, body: LotStateChange, user: CurrentUser, db: Db) -> LotDetail:
    """Fecha o lote (triado) ou regista a entrega. O estado só avança."""
    return await service.change_state(db, user, code, body.state)


@router.post("/triage", response_model=TriageResult, dependencies=[Depends(triage_limiter), AiGuard])
async def analyse_garment(
    user: CurrentUser,
    llm: Annotated[OpenRouterClient, Depends(get_llm)],
    item_photo: Annotated[UploadFile, File(description="Foto da peça")],
    label_photo: Annotated[UploadFile | None, File(description="Foto da etiqueta de composição")] = None,
    locale: Locale = "pt-PT",
) -> TriageResult:
    """Analisa as fotos com o modelo de visão. Não grava nada: o operador confirma e só então a peça entra no lote."""
    try:
        return await triage.analyse(
            llm,
            await item_photo.read(triage.MAX_BYTES + 1),
            await label_photo.read(triage.MAX_BYTES + 1) if label_photo else None,
            locale=locale,
        )
    finally:
        await llm.aclose()


@router.get("/market", response_model=list[MarketEntry])
async def get_fibre_market(db: Db, fibre: Fibre | None = None) -> list[MarketEntry]:
    """Bolsa de fibra: lotes triados agregados por fibra, para os recicladores do Vale do Ave."""
    return await service.market(db, fibre)


@router.post("/market/{code}/reserve", response_model=LotDetail, dependencies=[NotGuestDep])
async def reserve_lot(code: str, body: ReserveRequest, user: CurrentUser, db: Db) -> LotDetail:
    """Reserva um lote em nome de um reciclador. Sem preços nem pagamentos no MVP."""
    return await service.reserve(db, user, code, body)


@router.get("/brands", response_model=BrandsOut)
async def get_brand_evidence(db: Db) -> BrandsOut:
    """Quilos e composição por marca, com o tamanho da amostra (evidência para a RAP)."""
    return await service.brands(db)


@public_router.get("/lots/{code}", response_model=Passport, dependencies=[Depends(passport_limiter)])
async def get_passport(code: str, db: Db) -> Passport:
    """Passaporte público do lote: o QR aponta para aqui. Sem dados pessoais e sem sessão."""
    return await service.passport(db, code)


@public_router.get(
    "/lots/{code}/qr",
    response_class=Response,
    responses={200: {"content": {"image/svg+xml": {}}}},
    dependencies=[Depends(passport_limiter)],
)
async def get_lot_qr(code: str, db: Db) -> Response:
    """QR em SVG do passaporte."""
    await service.passport(db, code)  # 404 se não existir
    return Response(content=service.qr_svg(code.upper()), media_type="image/svg+xml")
