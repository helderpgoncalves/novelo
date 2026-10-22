"""Base do têxtil gerado em Guimarães: o único sítio do ETL com estes números (a API tem o seu, em
`apps/api/src/novelo/features/textile/references.py`, com os mesmos valores).

Fontes indicadas pela Vitrus (mentor, 22 out 2026): em 2025 a Vitrus recolheu 43 050,5 t de indiferenciado, 84,0% do
indiferenciado do concelho (Relatório e Contas 2025, p. 8); pela APA, 5,86% do indiferenciado nacional de 2025 é
têxtil (RARU 2025, p. 24). Esse têxtil é o que ainda vai para o lixo (o recolhido à parte, 301,27 t em 2025, fica fora
do indiferenciado). Substitui a base de 21 out (43 051 t × 5,4%, só a parte da Vitrus).
"""

from __future__ import annotations

VITRUS_RSU_2025_T = 43_050.5  # indiferenciado recolhido pela Vitrus em 2025 (R&C 2025, p. 8)
VITRUS_SHARE_OF_MUNICIPAL_RSU = 0.840  # parte do indiferenciado do concelho que a Vitrus recolhe (idem)
MUNICIPAL_RSU_2025_T = VITRUS_RSU_2025_T / VITRUS_SHARE_OF_MUNICIPAL_RSU  # ≈ 51 250,6 t, estimativa
APA_TEXTILE_SHARE_OF_RSU = 0.0586  # têxtil no indiferenciado (APA, RARU 2025, p. 24)
POPULATION = 156_830  # Censos 2021 (INE), soma das 48 freguesias; a mesma população que a API usa
MONTHS = 12

# Têxtil que ainda vai para o lixo (por desviar): 51 250,6 × 0,0586 ≈ 3 003,3 t/ano. Estimativa.
TEXTILE_IN_RSU_T = MUNICIPAL_RSU_2025_T * APA_TEXTILE_SHARE_OF_RSU
# Por habitante: 3 003 285 kg / 156 830 hab / 12 ≈ 1,5958 kg/hab/mês (19,15 kg/hab/ano). Estimativa.
KG_PER_INHAB_MONTH = TEXTILE_IN_RSU_T * 1000 / POPULATION / MONTHS

SOURCE_LABEL = (
    "Vitrus (43 050,5 t de indiferenciado em 2025, 84,0% do concelho: R&C 2025) e APA (5,86% de têxtil no "
    "indiferenciado: RARU 2025)"
)


def generated_t(collected_t: float) -> float:
    """Têxtil gerado no total: o que vai para o lixo mais o recolhido à parte (≈ 3 304,6 t com 301,266 t)."""
    return TEXTILE_IN_RSU_T + collected_t


def capture(collected_t: float) -> float:
    """Captura atual: recolhido à parte / gerado (301,266 / 3 304,55 ≈ 9,1%)."""
    return collected_t / generated_t(collected_t)
