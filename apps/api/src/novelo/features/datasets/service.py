import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.errors import NotFoundError
from novelo.domain.vocab import AlertStatus
from novelo.features.datasets.models import DataAlert, DataSource
from novelo.features.datasets.schemas import AlertUpdate, DataAlertOut, DataQuality, DataSourceOut
from novelo.features.users.models import User


def _alert_out(alert: DataAlert, source_key: str) -> DataAlertOut:
    return DataAlertOut(
        id=alert.id,
        number=alert.number,
        kind=alert.kind,
        detail=alert.detail,
        suggestion=alert.suggestion,
        status=alert.status,
        resolution_note=alert.resolution_note,
        resolved_at=alert.resolved_at,
        source_key=source_key,
    )


async def get_quality(db: AsyncSession) -> DataQuality:
    sources = (await db.execute(select(DataSource).order_by(DataSource.received_on, DataSource.key))).scalars().all()
    rows = (
        await db.execute(
            select(DataAlert, DataSource.key)
            .join(DataSource, DataSource.id == DataAlert.source_id)
            .order_by(DataAlert.number)
        )
    ).all()
    alerts = [_alert_out(a, key) for a, key in rows]
    return DataQuality(
        sources=[DataSourceOut.model_validate(s) for s in sources],
        alerts=alerts,
        open_alerts=sum(1 for a in alerts if a.status == AlertStatus.OPEN),
    )


async def update_alert(db: AsyncSession, alert_id: uuid.UUID, body: AlertUpdate, user: User) -> DataAlertOut:
    alert = await db.get(DataAlert, alert_id)
    if alert is None:
        raise NotFoundError("Data alert not found")
    alert.status = body.status
    alert.resolution_note = body.resolution_note
    reopened = body.status == AlertStatus.OPEN
    alert.resolved_at = None if reopened else datetime.now(UTC)
    alert.resolved_by_id = None if reopened else user.id
    await db.commit()
    source = await db.get(DataSource, alert.source_id)
    return _alert_out(alert, source.key if source else "")
