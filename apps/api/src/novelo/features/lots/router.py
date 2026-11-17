import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import OpenRouterClient
from novelo.core.database import get_db
from novelo.core.deps import CurrentUser
from novelo.core.guest import AiGuard, NotGuestDep
from novelo.core.ratelimit import lot_photo_limiter, passport_limiter, triage_limiter
from novelo.core.request_meta import Meta
from novelo.domain.vocab import Fibre, LotState
from novelo.features.lots import photo_store, photos, service, triage
from novelo.features.lots.schemas import (
    BrandsOut,
    LotDetail,
    LotItemIn,
    LotItemOut,
    LotOpen,
    LotStateChange,
    LotSummary,
    LotUnitIn,
    LotUnitOut,
    LotUnitWeight,
    MarketEntry,
    Passport,
    ReserveRequest,
    StopLotOpen,
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
    """Abre um lote ancorado só à freguesia (caminho antigo, antes do lote nascer na paragem)."""
    return await service.open_lot(db, user, body.parish_code)


@router.post("/lots/stops", response_model=LotSummary, status_code=201, dependencies=[NotGuestDep])
async def open_stop_lot(body: StopLotOpen, user: CurrentUser, db: Db) -> LotSummary:
    """Abre o lote na paragem («Cheguei»): um lote por paragem, ancorado ao local e à freguesia.

    Na recolha a pedido a paragem é 1:1 com o saco; nas rondas acumula os sacos do local. O peso só fica
    completo quando as unidades passam pela balança e a viatura parte (`POST /lots/{code}/departure`).
    """
    return await service.open_stop_lot(db, user, body.locality_id, body.parish_code)


@router.get("/lots", response_model=list[LotSummary])
async def list_lots(
    db: Db,
    fibre: Fibre | None = None,
    state: LotState | None = None,
    parish_code: Annotated[str | None, Query(max_length=6)] = None,
    locality_id: Annotated[uuid.UUID | None, Query(description="Lotes de um local (conta de local, #59)")] = None,
) -> list[LotSummary]:
    return await service.list_lots(db, fibre, state, parish_code, locality_id)


@router.get("/lots/{code}", response_model=LotDetail)
async def get_lot(code: str, db: Db) -> LotDetail:
    return await service.get_lot(db, code)


@router.post("/lots/{code}/items", response_model=LotItemOut, status_code=201, dependencies=[NotGuestDep])
async def add_lot_item(code: str, body: LotItemIn, user: CurrentUser, db: Db) -> LotItemOut:
    """Acrescenta ao lote uma peça confirmada pelo operador."""
    return await service.add_item(db, user, code, body)


@router.post("/lots/{code}/units", response_model=LotUnitOut, status_code=201, dependencies=[NotGuestDep])
async def add_lot_unit(code: str, body: LotUnitIn, user: CurrentUser, db: Db) -> LotUnitOut:
    """Regista uma unidade física na paragem: o QR do saco da plataforma, ou etiqueta impressa com UUID.

    Sem `bag_code` o servidor gera o UUID da etiqueta (o QR imprime-se em `GET /lots/{code}/units/{id}/qr`).
    """
    return await service.add_unit(db, user, code, body)


@router.put("/lots/{code}/units/{unit_id}", response_model=LotUnitOut, dependencies=[NotGuestDep])
async def set_lot_unit_weight(
    code: str, unit_id: uuid.UUID, body: LotUnitWeight, user: CurrentUser, db: Db
) -> LotUnitOut:
    """Peso medido da unidade na balança da viatura (pratos ≤ 15 kg: aqui entra a soma dos pratos)."""
    return await service.set_unit_weight(db, user, code, unit_id, body.weight_g)


@router.delete("/lots/{code}/units/{unit_id}", status_code=204, dependencies=[NotGuestDep])
async def delete_lot_unit(code: str, unit_id: uuid.UUID, user: CurrentUser, db: Db) -> Response:
    """Retira uma unidade do lote (scan enganado); fica no histórico e é impossível depois de partir."""
    await service.remove_unit(db, user, code, unit_id)
    return Response(status_code=204)


@router.get(
    "/lots/{code}/units/{unit_id}/qr",
    response_class=Response,
    responses={200: {"content": {"image/svg+xml": {}}}},
)
async def get_lot_unit_qr(code: str, unit_id: uuid.UUID, db: Db) -> Response:
    """QR em SVG da unidade física: o que vai na etiqueta impressa na viatura (UUID quando o saco não tem QR)."""
    return Response(content=await service.unit_qr(db, code, unit_id), media_type="image/svg+xml")


@router.post("/lots/{code}/departure", response_model=LotDetail, dependencies=[NotGuestDep])
async def close_stop_lot(code: str, user: CurrentUser, db: Db) -> LotDetail:
    """Fecha a paragem («Partir»): exige todas as unidades pesadas; o peso do lote passa a ser o medido."""
    return await service.close_stop_lot(db, user, code)


PHOTO_RESPONSES: dict[int | str, dict[str, object]] = {
    200: {"content": {"image/jpeg": {}}, "description": "Miniatura JPEG sem metadados"},
    304: {"description": "O cliente já tem esta versão (If-None-Match)"},
}


def _photo_response(request: Request, etag: str, *, cache_control: str) -> Response | None:
    """304 se o cliente já tem esta versão; senão `None` e o chamador envia os bytes."""
    sent = request.headers.get("if-none-match", "")
    tags = {t.strip().removeprefix("W/") for t in sent.split(",")}
    if sent.strip() == "*" or etag in tags:
        return Response(status_code=304, headers={"ETag": etag, "Cache-Control": cache_control})
    return None


async def _serve_photo(
    db: AsyncSession, request: Request, code: str, item_id: uuid.UUID, *, cache_control: str, vary: str | None
) -> Response:
    etag = await photo_store.photo_etag(db, code, item_id)  # 404 antes de ler os bytes
    not_modified = _photo_response(request, etag, cache_control=cache_control)
    if not_modified is not None:
        return not_modified
    blob = await photo_store.read_photo(db, code, item_id)
    headers = {"ETag": blob.etag, "Cache-Control": cache_control, "Content-Disposition": "inline"}
    if vary:
        headers["Vary"] = vary
    return Response(content=blob.content, media_type=blob.mime, headers=headers)


@router.put(
    "/lots/{code}/items/{item_id}/photo",
    status_code=204,
    dependencies=[NotGuestDep, Depends(lot_photo_limiter)],
)
async def upload_item_photo(
    code: str,
    item_id: uuid.UUID,
    user: CurrentUser,
    db: Db,
    meta: Meta,
    photo: Annotated[UploadFile, File(description="Foto da peça (JPEG, PNG ou WebP, até 5 MB)")],
    confirm_no_people: Annotated[
        bool,
        Form(
            description="Obrigatório e verdadeiro: o operador confirma que a foto não mostra pessoas, rostos, "
            "documentos nem informação pessoal"
        ),
    ] = False,
    credit: Annotated[
        str | None,
        Form(max_length=240, description="Atribuição da licença se a foto for de terceiros; texto simples, sem HTML"),
    ] = None,
) -> Response:
    """Guarda (ou substitui) a miniatura da peça: sem metadados, JPEG até 640 px, apagada ao fim da retenção."""
    data = await photo.read(photos.MAX_INPUT_BYTES + 1)
    await photo_store.save_photo(
        db, user, code, item_id, data, confirm_no_people=confirm_no_people, credit=credit, meta=meta
    )
    return Response(status_code=204)


@router.delete(
    "/lots/{code}/items/{item_id}/photo", status_code=204, dependencies=[NotGuestDep, Depends(lot_photo_limiter)]
)
async def delete_item_photo(code: str, item_id: uuid.UUID, user: CurrentUser, db: Db, meta: Meta) -> Response:
    """Apaga já a miniatura da peça (direito ao apagamento), em qualquer estado do lote."""
    await photo_store.delete_photo(db, user, code, item_id, meta=meta)
    return Response(status_code=204)


@router.get(
    "/lots/{code}/items/{item_id}/photo",
    response_class=Response,
    responses=PHOTO_RESPONSES,
)
async def get_item_photo(code: str, item_id: uuid.UUID, request: Request, db: Db) -> Response:
    """Miniatura da peça para a sessão autenticada (cache privada, revalida com ETag)."""
    return await _serve_photo(db, request, code, item_id, cache_control="private, no-cache", vary="Cookie")


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


@public_router.get(
    "/lots/{code}/items/{item_id}/photo",
    response_class=Response,
    responses=PHOTO_RESPONSES,
    dependencies=[Depends(passport_limiter)],
)
async def get_public_item_photo(code: str, item_id: uuid.UUID, request: Request, db: Db) -> Response:
    """Miniatura pública de uma peça do passaporte. 404 se não existe ou já expirou."""
    return await _serve_photo(db, request, code, item_id, cache_control="public, max-age=3600", vary=None)
