import uuid
from typing import Any

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from novelo.core.database import Base, TimestampMixin, UuidPkMixin, enum_check, enum_column
from novelo.domain.vocab import WhatIfStatus


class WhatIfRun(Base, UuidPkMixin, TimestampMixin):
    """Pergunta "E se...?" e tudo o que a tornou auditável: alteração entendida, cenário novo e explicação."""

    __tablename__ = "whatif_runs"
    __table_args__ = (enum_check("status", WhatIfStatus),)

    base_scenario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scenarios.id", ondelete="CASCADE"), index=True
    )
    new_scenario_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scenarios.id", ondelete="SET NULL")
    )
    question: Mapped[str] = mapped_column(Text)
    status: Mapped[WhatIfStatus] = mapped_column(enum_column(WhatIfStatus))
    delta: Mapped[dict[str, Any]] = mapped_column(JSONB)
    understood: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str | None] = mapped_column(Text)
    explanation_verified: Mapped[bool | None] = mapped_column()
    prompt_version: Mapped[str] = mapped_column(String(20))
    model: Mapped[str] = mapped_column(String(80))
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
