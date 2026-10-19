from typing import Literal

from pydantic import BaseModel, Field

from novelo.domain.vocab import CollectionMode, Tipau


class PilotRequest(BaseModel):
    k: int = Field(default=2, ge=2, le=4, description="Número de freguesias do piloto")
    months: int = Field(default=3, ge=1, le=12, description="Duração do piloto em meses")
    modes: list[CollectionMode] = Field(
        default_factory=lambda: [CollectionMode.STREET, CollectionMode.ON_DEMAND],
        min_length=1,
        description="Modos de recolha a testar no piloto",
    )
    min_tonnes_pilot: float | None = Field(
        default=None,
        ge=0,
        description="Piso de sinal em toneladas no piloto; omitido = calculado para medir a taxa de rejeito (3 p.p.)",
    )
    n_samples: int = Field(default=500, ge=50, le=5000)
    seed: int = 7
    swing: float = Field(default=0.3, ge=0.05, le=0.9, description="Incerteza ± dos pressupostos nos intervalos")


class PilotFact(BaseModel):
    """Um número que justifica a escolha, com a sua origem."""

    key: str
    value: float
    unit: str
    source: str


class PilotZoneOut(BaseModel):
    parish_code: str
    parish_name: str
    tipau: Tipau | None
    facts: list[PilotFact]


class PilotScoreOut(BaseModel):
    score: float = Field(description="Valor de aprendizagem do conjunto, de 0 a 1")
    tipau_diversity: float
    density_contrast: float
    coverage: float
    cost: float
    weight_tipau: float
    weight_density: float
    weight_coverage: float
    weight_cost: float


class PilotKpiOut(BaseModel):
    key: Literal["tonnes", "eur_per_tonne", "reject_rate_pct"]
    unit: str
    value: float = Field(description="Valor previsto (estimativa)")
    p10: float
    p90: float
    basis: str = Field(description="De onde vem a previsão")


class SignalFloorOut(BaseModel):
    """Piso de sinal: toneladas mínimas do piloto e o que ficou de fora por não o atingir."""

    min_tonnes_pilot: float = Field(description="t mínimas no piloto (estimativa)")
    computed: bool = Field(description="Falso: valor imposto no pedido")
    tonnes_pilot: float = Field(description="t previstas no piloto escolhido")
    floor_met: bool = Field(description="Falso: nenhuma combinação atinge o piso; devolvida a de mais toneladas")
    combos_total: int
    combos_below_floor: int = Field(description="Combinações descartadas por ficarem abaixo do piso")
    calculation: list[PilotFact] = Field(description="A conta do piso, passo a passo")
    explanation: str


class PilotOut(BaseModel):
    k: int
    months: int
    modes: list[CollectionMode]
    zones: list[PilotZoneOut]
    score: PilotScoreOut
    kpis: list[PilotKpiOut]
    signal_floor: SignalFloorOut
    startup_cost_eur: float = Field(description="Investimento e operação do piloto (estimativa)")
    rationale: list[str] = Field(description="Justificação em frases; todos os números vêm de `zones[].facts`")
    estimate: bool = Field(default=True, description="Os valores previstos são estimativas")
