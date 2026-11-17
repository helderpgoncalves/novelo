"""Contrato da calibração: o painel «Calibração» e a fotografia que cada cenário guarda no resultado."""

from datetime import datetime

from pydantic import BaseModel, Field

from novelo.domain.vocab import CalibrationMetric, CalibrationScope


class CalibrationReadingOut(BaseModel):
    """Uma linha da calibração: métrica × unidade na janela atual (a tabela de agregados)."""

    metric: CalibrationMetric
    scope: CalibrationScope
    unit_code: str = Field(description="Código da unidade: UUID do local, DICOFRE da freguesia ou «concelho»")
    unit_name: str
    parish_code: str = Field(description="Freguesia da unidade («» no concelho); liga a taxa do local à captura")
    n: int = Field(description="Amostras: visitas nas métricas por local, semanas nas por freguesia")
    pseudo_k: int = Field(description="Peso do prior na pseudo-contagem (4 visitas por local; 8 semanas por freguesia)")
    observed: float | None = Field(
        description="Estatística da janela (mediana dos pesos; pedidos ÷ semanas); nulo sem amostras"
    )
    prior: float = Field(description="Valor dos pressupostos com que foi recalculado")
    blended: float = Field(
        description="Valor calibrado: (k·prior + n·observado) ÷ (k + n) — o que o planeamento consome"
    )
    weight: float = Field(description="Peso do observado: n ÷ (n + k)")
    label: str = Field(description="Fonte para o ecrã: «pressuposto», «estimativa·n» ou «observado·n»")


class CalibrationPhoto(BaseModel):
    """A fotografia da calibração que um cenário copia para o seu resultado (reprodutível e comparável)."""

    window_weeks: int
    computed_at: datetime | None = None
    readings: list[CalibrationReadingOut]


class CalibrationOut(BaseModel):
    """O painel «Calibração» (gestão): a tabela de agregados atual, por métrica e unidade."""

    window_weeks: int = Field(description="Janela de observação em semanas (12, móvel)")
    computed_at: datetime | None = Field(
        description="Altura do último recálculo (ao recalcular um cenário; nunca agendada)"
    )
    rows: list[CalibrationReadingOut]
