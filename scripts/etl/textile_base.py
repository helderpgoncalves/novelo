"""Base do têxtil gerado em Guimarães: o único sítio do ETL com estes números (a API tem o seu, em
`apps/api/src/novelo/features/textile/references.py`, com os mesmos valores).

Fonte (Vitrus, email do mentor de 21 out 2026): em 2025 a Vitrus recolheu 43 051 t de RSU; pela estatística da APA,
5,4% do RSU é têxtil. Esse têxtil é o que ainda vai para o lixo (o recolhido à parte, 301,27 t em 2025, fica fora do
RSU). Substitui os 0,7 kg/hab/mês do "Plano de Ação Integrado", que a Vitrus não conhece nem usa.
"""

from __future__ import annotations

VITRUS_RSU_2025_T = 43_051  # RSU recolhido pela Vitrus em 2025 (mentor, 21 out 2026)
APA_TEXTILE_SHARE_OF_RSU = 0.054  # têxtil no RSU, estatística da APA indicada pela Vitrus
POPULATION = 156_830  # Censos 2021 (INE), soma das 48 freguesias; a mesma população que a API usa
MONTHS = 12

# Têxtil que ainda vai para o lixo (por desviar): 43 051 × 0,054 = 2 324,754 t/ano. Estimativa.
TEXTILE_IN_RSU_T = VITRUS_RSU_2025_T * APA_TEXTILE_SHARE_OF_RSU
# Por habitante: 2 324 754 kg / 156 830 hab / 12 = 1,2353 kg/hab/mês (14,82 kg/hab/ano). Estimativa.
KG_PER_INHAB_MONTH = TEXTILE_IN_RSU_T * 1000 / POPULATION / MONTHS

SOURCE_LABEL = "Vitrus (43 051 t de RSU recolhidas em 2025) e APA (5,4% de têxtil no RSU)"


def generated_t(collected_t: float) -> float:
    """Têxtil gerado no total: o que vai para o lixo mais o recolhido à parte (2 626,02 t com 301,266 t)."""
    return TEXTILE_IN_RSU_T + collected_t


def capture(collected_t: float) -> float:
    """Captura atual: recolhido à parte / gerado (301,266 / 2 626,02 = 11,47%)."""
    return collected_t / generated_t(collected_t)
