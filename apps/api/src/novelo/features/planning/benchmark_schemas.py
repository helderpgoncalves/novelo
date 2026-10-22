from typing import Self

from pydantic import BaseModel, Field, model_validator

from novelo.domain.vocab import CollectionMode, ScenarioObjective


class BenchmarkOut(BaseModel):
    key: str = Field(description="Identificador estável do preset, ex.: `french_performance`")
    label: str
    kg_per_inhab_year: float = Field(description="Meta de recolha de têxtil (kg/hab/ano)")
    people_per_point: int = Field(description="Densidade: 1 ponto por cada N habitantes")
    density_mode: CollectionMode = Field(
        description="Modo a que a densidade se aplica (`street` no preset francês: só como referência)"
    )
    source: str
    verified: bool = Field(description="Falso: referência externa por confirmar na fonte original")
    # Consequências com os dados e pressupostos atuais (cada número vem do INE, da Vitrus ou do modelo):
    population: int = Field(description="Habitantes (INE, Censos 2021) das freguesias com dados")
    target_tonnes: float = Field(description="Meta em t/ano: kg/hab/ano × população")
    implied_capture_pct: float = Field(
        description="Fração do têxtil que ainda vai para o lixo (≈ 51 250,6 t de indiferenciado do concelho × 5,86%, "
        "Vitrus + APA) que a meta exige"
    )
    observed_capture_pct: float = Field(description="Captura atual: recolhido em 2025 ÷ têxtil gerado (estimativa)")
    observed_kg_per_inhab_year: float = Field(description="Recolhido em 2025 / habitantes (dados da Vitrus)")
    current_people_per_point: int = Field(description="Densidade atual do pressuposto para o mesmo modo")
    max_capturable_t: float = Field(description="Teto do modelo com todos os modos ligados e a densidade do preset")
    reachable: bool = Field(description="A meta cabe dentro do teto do modelo")


class BenchmarkScenarioRequest(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=80, description="Omitido = nome do preset")
    objective: ScenarioObjective = Field(
        default=ScenarioObjective.MIN_COST, description="min_cost: custo mínimo para a meta; max_tonnes: com orçamento"
    )
    budget_eur_year: float | None = Field(default=None, ge=0, description="Obrigatório em max_tonnes")

    @model_validator(mode="after")
    def _budget_for_max_tonnes(self) -> Self:
        if self.objective == ScenarioObjective.MAX_TONNES and self.budget_eur_year is None:
            raise ValueError("budget_eur_year is required for max_tonnes")
        return self
