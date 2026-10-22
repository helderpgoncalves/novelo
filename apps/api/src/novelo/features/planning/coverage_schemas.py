"""Matriz de cobertura de um cenário (art. 22.º-C, n.º 9, alínea b) da Diretiva (UE) 2025/1892)."""

import uuid
from typing import Literal

from pydantic import BaseModel, Field

from novelo.domain.vocab import CollectionMode, Tipau
from novelo.features.planning.schemas import Siting

# Como o têxtil chega ao circuito numa freguesia: no circuito porta a porta (0 km novos), a pedido com desvio, a pedido
# sem plano de recolha (cenários anteriores a 21 out 2026), local existente ou contentor de rua (só referência).
CoverageChannel = Literal["door_to_door", "detour", "on_demand", "existing", "street"]


class CoverageParish(BaseModel):
    """Uma freguesia na matriz de cobertura: território, procura, proximidade e o que o cenário lá faz."""

    parish_code: str
    parish_name: str
    tipau: Tipau | None = Field(description="Tipologia de áreas urbanas do INE (APU, AMU, APR)")
    population: int = Field(description="Habitantes (INE, Censos 2021)")
    area_km2: float | None = Field(description="Área da freguesia na CAOP 2019 (km²); nulo sem o pacote municipal")
    density_hab_km2: float | None = Field(description="Habitantes por km² (população ÷ área CAOP)")
    demand_t: float = Field(
        description="Volume previsto: têxtil por desviar do lixo, t/ano (procura do modelo, estimativa)"
    )
    area_within_300m_pct: float | None = Field(
        description=(
            "Proximidade: % da ÁREA da freguesia a ≤ 300 m de um local de contentores municipais (pacote QGIS da "
            "Vitrus, CAOP 2019), onde a viatura já para. É área, não população (não há população por quarteirão)"
        )
    )
    door_to_door_days_week: int = Field(
        description="Acessibilidade: dias/semana com passagem de circuito porta a porta de indiferenciado com viatura"
    )
    service_days: int = Field(
        description="Dias/semana com passagem de um circuito de indiferenciado (porta a porta ou moloks) com viatura"
    )
    modes: list[CollectionMode] = Field(description="Modos do cenário na freguesia (vazio = sem recolha)")
    channels: list[CoverageChannel] = Field(description="Canais do cenário na freguesia")
    tonnes: float = Field(description="Têxtil captado por ano no cenário (estimativa)")
    covered_population: float = Field(description="População servida no cenário (estimativa)")
    covered_share: float = Field(description="População servida ÷ população (0 a 1)")
    annual_cost_eur: float = Field(description="Custo anual do cenário na freguesia")


class CoverageGroup(BaseModel):
    """Soma de um grupo de freguesias (uma TIPAU, ou o concelho no total)."""

    tipau: Tipau | None = Field(description="Nulo no total do concelho e nas freguesias sem TIPAU")
    parishes: int
    population: int
    covered_population: float
    covered_pct: float | None = Field(description="População servida ÷ população, em % (nulo sem população)")
    tonnes: float
    annual_cost_eur: float
    eur_per_tonne: float | None = Field(description="Custo anual ÷ toneladas (nulo com 0 t)")


class CoverageEquity(BaseModel):
    """Não limitado às zonas rendíveis: cobertura fora das freguesias predominantemente urbanas vs dentro."""

    urban_population: int = Field(description="Habitantes nas freguesias predominantemente urbanas (APU)")
    urban_covered_pct: float | None = Field(description="% da população servida nas APU")
    non_urban_population: int = Field(description="Habitantes nas freguesias AMU e APR")
    non_urban_covered_pct: float | None = Field(description="% da população servida nas AMU e APR")
    non_urban_vs_urban: float | None = Field(
        description="% servida nas AMU e APR ÷ % servida nas APU (1 = a mesma cobertura; nulo se não se puder dividir)"
    )


class ScenarioCoverage(BaseModel):
    """Matriz de cobertura do cenário por freguesia e por TIPAU (art. 22.º-C, n.º 9, b) da Diretiva 2025/1892:
    dimensão e densidade da população, volume previsto, acessibilidade e proximidade, sem se limitar às zonas
    rendíveis). Os números vêm do cenário e da base de dados; a rede atual (circuitos, contentores) é a de hoje."""

    scenario_id: uuid.UUID
    label: str
    siting: Siting
    parishes: list[CoverageParish] = Field(description="Por freguesia, por TIPAU (APU, AMU, APR) e população")
    by_tipau: list[CoverageGroup]
    total: CoverageGroup
    equity: CoverageEquity
