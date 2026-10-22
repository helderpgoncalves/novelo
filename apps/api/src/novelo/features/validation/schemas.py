"""Contrato da validação do modelo. O que é estimativa vem marcado; nada aqui é inventado."""

from typing import Literal

from pydantic import BaseModel, Field

ReadingKey = Literal["vitrus_apa_share_of_rsu", "plan_share_of_residual", "pt_composition", "plan_per_capita"]
ReadingBasis = Literal["generated", "residual"]
CountKind = Literal["all", "underground", "surface"]


class ValidationBaseline(BaseModel):
    year: int
    collected_t: float
    population: int
    observed_kg_per_inhab_year: float


class PotentialReadingOut(BaseModel):
    key: ReadingKey
    kg_per_inhab_year: float
    basis: ReadingBasis = Field(
        description="`generated`: têxtil gerado no total; `residual`: têxtil que ainda vai para o lixo (o recolhido "
        "à parte soma-se para obter o gerado)"
    )
    implied_capture_pct: float = Field(description="Captura de 2025 se esta leitura do potencial fosse a verdadeira")
    implied_potential_t: float = Field(description="Têxtil gerado (t/ano) que esta leitura implica")
    is_model_base: bool = Field(
        description="A leitura que o modelo usa (Vitrus + APA: ≈ 51 250,6 t de indiferenciado do concelho × 5,86%)"
    )
    is_alternative: bool = Field(
        default=False, description="Leitura publicada mas não usada pela Vitrus; só para triangulação"
    )
    source: str


class FranceReference(BaseModel):
    kg_per_inhab_year: float
    capture_of_model_base_pct: float = Field(description="Parte do potencial-base que a França já recolhe")
    source: str


class ZoneCheckOut(BaseModel):
    zone: str
    population: int
    observed: int
    predicted: float
    pct_error: float | None


class SpatialCheckOut(BaseModel):
    kind: CountKind
    n: int
    pearson_r: float
    spearman_rho: float
    r2: float
    median_abs_pct_error: float
    within_25_pct: int
    within_50_pct: int
    worst: list[ZoneCheckOut] = Field(description="As freguesias onde a regra mais falha, pelo erro absoluto")


class ModelValidationOut(BaseModel):
    baseline: ValidationBaseline
    readings: list[PotentialReadingOut]
    france: FranceReference
    spatial: list[SpatialCheckOut]
    estimates: list[str] = Field(description="Campos que são estimativa e não medida")
    cannot_test: list[str] = Field(description="O que os dados de hoje não permitem testar, e porquê")
