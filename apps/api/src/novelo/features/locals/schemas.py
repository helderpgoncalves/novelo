import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from novelo.domain.vocab import LocalKind, NoticeState


class LocalAccountOut(BaseModel):
    """A conta de local vista por quem nela entra: o sítio, a natureza e o certificado."""

    id: uuid.UUID
    locality_id: uuid.UUID | None
    locality_name: str | None
    parish_name: str | None = Field(default=None, description="Freguesia do local, para o cabeçalho")
    kind: LocalKind = Field(description="Natureza do sítio: `assistido` (escola no MVP) ou `b2b`")
    certificate_opt_in: bool = Field(description="Certificado público ligado (opt-in do próprio local)")
    created_at: datetime


class StopNoticeOut(BaseModel):
    """Um aviso «sacos prontos»: garante paragem no dia (política de paragem)."""

    id: uuid.UUID
    locality_id: uuid.UUID | None
    state: NoticeState = Field(description="`active` garante paragem; `cancelled` é histórico")
    bag_count: int | None = Field(default=None, description="Sacos que o local declara prontos (sinal, não contagem)")
    note: str | None
    created_at: datetime = Field(description="Quando o aviso foi dado")
    cancelled_at: datetime | None


class StopNoticeCreate(BaseModel):
    """O que o local diz ao avisar: quantos sacos (opcional) e um recado para a equipa (opcional)."""

    bag_count: int | None = Field(
        default=None, ge=1, le=50, description="Quantos sacos estão prontos (o protótipo pede «diz quantos»)"
    )
    note: str | None = Field(default=None, max_length=240, description="Recado para a equipa, ex.: «sala 12»")


class StopNoticeCurrent(BaseModel):
    """O aviso ativo do local, ou `null` quando não há nenhum (a porta do herói mostra o estado certo)."""

    notice: StopNoticeOut | None


class CertificateOptIn(BaseModel):
    """Opt-in do certificado público: só o próprio local decide partilhar os kg agregados."""

    opt_in: bool


class LocalReportOut(BaseModel):
    """Relatório do local em kg por destino — medido na pesagem, destinos pela triagem. Sem CO₂ nem doadores.

    O peso total soma o medido na paragem de cada lote (estimado nos lotes anteriores à balança);
    os destinos vêm da mesa de triagem, logo só cobrem os lotes triados (`lots_in_triage` fica de fora).
    """

    locality_id: uuid.UUID | None
    locality_name: str | None
    lots: int = Field(description="Paragens com lote (um lote por paragem)")
    measured_lots: int = Field(description="Lotes com peso medido na balança da viatura")
    sorted_lots: int = Field(description="Lotes já triados (com destinos)")
    lots_in_triage: int = Field(description="Lotes ainda na mesa de triagem, sem destinos")
    weight_kg: float = Field(description="Peso total (medido quando há balança; estimado nos lotes antigos)")
    reuse_kg: float
    recycle_kg: float
    reject_kg: float
    first_stop_at: datetime | None
    last_stop_at: datetime | None


class LocalCertificateOut(BaseModel):
    """Página pública do certificado (opt-in): totais agregados do local. Nunca doadores, nunca CO₂."""

    locality_name: str | None
    parish_name: str | None
    stops: int = Field(description="Paragens com lote pesado")
    weight_kg: float
    reuse_kg: float
    recycle_kg: float
    reject_kg: float
    reuse_pct: float
    recycle_pct: float
    reject_pct: float
    first_stop_at: datetime | None
    updated_at: datetime = Field(description="Momento do cálculo (os totais são sempre os de agora)")


class LocalAccountAdminOut(BaseModel):
    """A conta de local vista pela equipa (gestão): quem entra, o sítio, o certificado e o aviso ativo."""

    id: uuid.UUID
    user_id: uuid.UUID
    user_email: str
    user_name: str | None
    locality_id: uuid.UUID | None
    locality_name: str | None
    kind: LocalKind
    certificate_opt_in: bool
    notice: StopNoticeOut | None = Field(default=None, description="Aviso ativo do local, se houver")
    created_at: datetime
