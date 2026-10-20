import hashlib
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import defer

from novelo.adapters.openrouter import OpenRouterClient
from novelo.core.errors import NotFoundError
from novelo.features.reports import builder
from novelo.features.reports.models import Report
from novelo.features.reports.schemas import ReportOut, ReportRequest
from novelo.features.users.models import User


def _out(r: Report) -> ReportOut:
    return ReportOut(
        id=r.id,
        title=r.title,
        locale=r.locale,
        scenario_ids=[uuid.UUID(s) for s in r.scenario_ids],
        size_bytes=r.size_bytes,
        sha256=r.sha256,
        created_at=r.created_at,
    )


async def create_rap(
    db: AsyncSession, body: ReportRequest, user: User, llm: OpenRouterClient | None = None
) -> ReportOut:
    title, pdf, summary = await builder.build_rap(db, body.scenario_ids, body.locale, llm)
    report = Report(
        title=title,
        locale=body.locale,
        scenario_ids=[str(s) for s in body.scenario_ids],
        summary=summary,
        pdf=pdf,
        size_bytes=len(pdf),
        sha256=hashlib.sha256(pdf).hexdigest(),
        created_by_id=user.id,
    )
    db.add(report)
    await db.commit()
    return _out(report)


async def list_reports(db: AsyncSession) -> list[ReportOut]:
    # Só metadados: o PDF (centenas de KB por linha) e o resumo ficam na base até ao download.
    stmt = select(Report).options(defer(Report.pdf), defer(Report.summary)).order_by(Report.created_at.desc())
    rows = (await db.execute(stmt)).scalars().all()
    return [_out(r) for r in rows]


async def get_pdf(db: AsyncSession, report_id: uuid.UUID) -> tuple[str, bytes]:
    report = await db.get(Report, report_id)
    if report is None:
        raise NotFoundError("Report not found")
    return f"novelo-rap-{report.created_at.date()!s}-{str(report.id)[:8]}.pdf", report.pdf
