import uuid
from typing import Literal

from pydantic import BaseModel, Field

from novelo.features.planning.schemas import ParamSource


class SensitivityRequest(BaseModel):
    swing: float = Field(default=0.3, ge=0.05, le=0.9, description="Variação ± de cada parâmetro (0,3 = ±30%)")
    n_samples: int = Field(default=500, ge=50, le=5000, description="Amostras do Monte Carlo")
    seed: int = Field(default=7, description="Semente fixa: mesma entrada, mesmo resultado")
    threshold_eur_per_tonne: float | None = Field(
        default=None, gt=0, description="Limiar de €/t para calcular a probabilidade de ficar abaixo"
    )


class MetricsOut(BaseModel):
    tonnes: float = Field(description="t/ano")
    annual_cost_eur: float
    eur_per_tonne: float | None


class QuantilesOut(BaseModel):
    p10: float
    p50: float
    p90: float


class TornadoBarOut(BaseModel):
    key: str = Field(description="Caminho do parâmetro, igual ao de `ParamMeta.key`")
    unit: str
    source: ParamSource = Field(description="Origem do pressuposto: dado, plano ou pressuposto da equipa")
    base_value: float
    low_value: float = Field(description="Valor do parâmetro com -swing")
    high_value: float = Field(description="Valor do parâmetro com +swing")
    low: MetricsOut
    high: MetricsOut
    swing_eur_per_tonne: float = Field(description="Impacto em €/t (|alto − baixo|); critério de ordenação")
    swing_tonnes: float
    swing_cost_eur: float


class SensitivityOut(BaseModel):
    scenario_id: uuid.UUID
    swing: float
    n_samples: int
    seed: int
    method: str = Field(description="Como foi calculado (o plano otimizado é reavaliado, o solver não corre de novo)")
    base: MetricsOut = Field(description="Plano com os pressupostos centrais (reproduz os KPIs do cenário)")
    tornado: list[TornadoBarOut]
    eur_per_tonne: QuantilesOut
    annual_cost_eur: QuantilesOut
    tonnes: QuantilesOut
    threshold_eur_per_tonne: float | None
    prob_below_threshold: float | None = Field(description="P(€/t < limiar), de 0 a 1")
    assumption_share_of_top_drivers: float = Field(
        description="Fração dos 5 maiores fatores de incerteza que são pressupostos sem dado (estimativa)"
    )


class RobustnessOut(BaseModel):
    recommended_id: uuid.UUID
    alternative_id: uuid.UUID
    criterion: Literal["eur_per_tonne", "annual_cost_eur", "tonnes"]
    n_samples: int
    seed: int
    swing: float
    share_recommended_better: float = Field(description="Fração das amostras em que o recomendado é melhor (0 a 1)")
    min_share: float
    holds: bool = Field(description="O recomendado é melhor em pelo menos `min_share` das amostras")
    median_advantage: float = Field(description="Mediana de (alternativo − recomendado) no critério; positivo = ganho")
    base_recommended: MetricsOut
    base_alternative: MetricsOut
