import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import OpenRouterClient
from novelo.core.database import get_db
from novelo.core.deps import CurrentUser
from novelo.features.lots.router import get_llm
from novelo.features.reports import service
from novelo.features.reports.schemas import ReportOut, ReportRequest

router = APIRouter()
Db = Annotated[AsyncSession, Depends(get_db)]
Llm = Annotated[OpenRouterClient, Depends(get_llm)]


@router.post("/rap", response_model=ReportOut, status_code=201)
async def create_rap_report(body: ReportRequest, user: CurrentUser, db: Db, llm: Llm) -> ReportOut:
    """Gera o relatório RAP em PDF para 1 a 3 cenários (custo por território, material, marcas, método).

    Inclui um briefing executivo: da IA, verificado contra os números, ou texto fixo sem IA."""
    try:
        return await service.create_rap(db, body, user, llm)
    finally:
        await llm.aclose()


@router.get("", response_model=list[ReportOut])
async def list_reports(db: Db) -> list[ReportOut]:
    return await service.list_reports(db)


@router.get("/{report_id}/pdf", response_class=Response, responses={200: {"content": {"application/pdf": {}}}})
async def download_report(report_id: uuid.UUID, db: Db) -> Response:
    filename, pdf = await service.get_pdf(db, report_id)
    return Response(
        content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="{filename}"'}
    )
