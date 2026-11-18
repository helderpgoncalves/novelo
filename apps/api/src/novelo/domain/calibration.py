"""Calibração: a retroalimentação da procura observada. Funções puras, sem I/O.

ADR «Captura anual é derivada, nunca auto-calibrada pelo piloto» (#53) e
docs/engenharia/dados-e-modelo.md §Calibração. O que a rede observa (pesos medidos por paragem,
pedidos) calibra QUATRO métricas operacionais; a captura anual é DERIVADA das taxas (taxa × degrau,
limitada pela procura da APA) e nunca medida diretamente.

Mecânica:
  janela móvel       12 semanas (84 dias), por métrica e unidade
  mediana            estatística da janela das métricas de peso (robusta a outliers; peso 0 = falha, não amostra)
  pseudo-contagem    m̂ = ((k−1)·prior + n·observado) ÷ (n + k − 1), com k = 4 visitas (por local)
                     ou 8 semanas (por freguesia)
  rótulos            «pressuposto» (n=0), «estimativa·n» (n < k) e «observado·n» (n ≥ k: o observado domina —
                     à 4.ª visita pesa 4/7, nunca empata)
  captura derivada   c = min(1, taxa × 365 ÷ D_z) misturada com o prior na pseudo-contagem da freguesia
  priores            os locais não visitados melhoram concelho afora pela conversão litros→kg calibrada
                     pelos visitados — e NUNCA para além do blend documentado

O `q` da APA (1,596 kg/hab/mês) nunca entra neste módulo: a procura chega como argumento
(`demand_kg_year`) e nunca é recalculada aqui. Os pedidos nunca multiplicam kg — são sinal de
arranque, calibração do n e KPI por freguesia.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from math import ceil

from novelo.domain.vocab import CalibrationMetric, CalibrationScope

WINDOW_WEEKS = 12
WINDOW_DAYS = WINDOW_WEEKS * 7
DAYS_PER_YEAR = 365
# Pseudo-contagem: k = 4 VISITAS nas métricas por local (taxa de geração, kg por saco); k = 8 SEMANAS
# nas métricas por freguesia (sacos por ronda, pedidos por semana). O observado pesa n ÷ (n + k − 1):
# DOMINA a partir da n=k (à 4.ª visita pesa 4/7), nunca empata — critério de aceitação da spec.
PSEUDO_K_LOCAL = 4
PSEUDO_K_PARISH = 8

PRESSUPOSTO_LABEL = "pressuposto"


def median(values: Sequence[float]) -> float:
    """Mediana de uma lista não vazia (robusta a outliers — o motivo da escolha da janela)."""
    if not values:
        raise ValueError("mediana de lista vazia")
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) / 2


def observed_weight(n: int, k: int) -> float:
    """Peso do observado no blend: n ÷ (n + k − 1). À n=k o observado já DOMINA (k=4 → 4/7 > 1/2)."""
    if n < 0 or k < 1 or n + k - 1 <= 0:
        raise ValueError("n não negativo e k positivo, com n + k − 1 > 0")
    return n / (n + k - 1)


def blend(prior: float, observed: float, n: int, k: int) -> float:
    """Pseudo-contagem: m̂ = ((k−1)·prior + n·observado) ÷ (n + k − 1) — sem penhascos entre prior e
    observado, e o observado passa a dominar exatamente à n=k (nunca empata)."""
    if prior < 0 or observed < 0:
        raise ValueError("prior e observado não negativos")
    weight = observed_weight(n, k)
    return (1 - weight) * prior + weight * observed


def sample_label(n: int, k: int) -> str:
    """Rótulo da fonte: «pressuposto» sem amostras, «estimativa·n» abaixo da dominância, «observado·n» a partir dela."""
    if n <= 0:
        return PRESSUPOSTO_LABEL
    return f"{'observado' if n >= k else 'estimativa'}·{n}"


def generation_rate_kg_day(weight_kg: float, days: float) -> float:
    """Taxa de geração de uma visita: peso medido ÷ dias desde a visita anterior do mesmo local.

    Peso 0 é falha de pesagem, não amostra (ADR): levanta erro — o chamador filtra antes.
    """
    if weight_kg <= 0:
        raise ValueError("peso medido tem de ser positivo (peso 0 é falha, não amostra)")
    if days <= 0:
        raise ValueError("intervalo em dias tem de ser positivo")
    return weight_kg / days


def visit_rates(visits: Sequence[tuple[float | None, float]]) -> list[float]:
    """Taxas kg/dia de visitas consecutivas de um local: `(intervalo_em_dias, kg_medido)`.

    A primeira visita não tem intervalo (nada a dividir) e o peso 0 é falha de pesagem — ambos ficam de
    fora. O intervalo da primeira visita dentro da janela pode estender-se a uma visita antes da janela:
    o que a janela corta são os PESOS, não o tempo entre visitas.
    """
    rates = []
    for interval_days, kg in visits:
        if interval_days is None or kg <= 0:
            continue
        rates.append(generation_rate_kg_day(kg, interval_days))
    return rates


def weekly_means(by_week: Mapping[int, Sequence[float]]) -> dict[int, float]:
    """Média por semana (ex.: sacos por ronda na semana). Semana sem ronda não é amostra — não é 0."""
    return {week: sum(samples) / len(samples) for week, samples in by_week.items() if samples}


def weekly_request_rate(counts: Sequence[int], weeks_observed: int) -> float:
    """Pedidos por semana: total ÷ semanas observadas (a semana sem pedido é 0 — ausência medida)."""
    if weeks_observed <= 0:
        raise ValueError("semanas observadas têm de ser positivas")
    return sum(counts) / weeks_observed


def observed_weeks(first: datetime, end: datetime) -> int:
    """Semanas observadas desde o primeiro pedido até ao fim da janela, entre 1 e 12 (0 se ainda não há nada).

    Um pedido hoje observa 1 semana; 8 dias observam 2; o teto é a própria janela (12).
    """
    if first > end:
        return 0
    days = (end - first).total_seconds() / 86400
    return max(1, min(WINDOW_WEEKS, ceil(days / 7)))


def annual_capture(observed_kg_year: float, demand_kg_year: float) -> float:
    """Captura anual observada: kg recolhidos por ano ÷ procura da freguesia (D_z), limitada a 1.

    A procura da APA é o TETO (ADR): o observado pode dizer que a rede capta mais do que o prior diz,
    nunca que existe mais têxtil do que a procura calculada com o `q`.
    """
    if observed_kg_year < 0:
        raise ValueError("kg observados não negativos")
    if demand_kg_year <= 0:
        raise ValueError("procura positiva")
    return min(1.0, observed_kg_year / demand_kg_year)


def conversion_ratio(observed: float, prior: float) -> float:
    """Conversão observada ÷ prior (ex.: litros→kg calibrada pelos locais visitados)."""
    if observed < 0 or prior <= 0:
        raise ValueError("observado não negativo e prior positivo")
    return observed / prior


def improved_prior(prior: float, ratio: float, n: int, k: int) -> float:
    """Prior de um local não visitado melhorado pela conversão dos visitados — SEMPRE dentro do blend.

    `ratio` mistura-se com 1,0 (o prior não muda) pela pseudo-contagem: com poucas visitas a conversão
    quase não mexe; o prior nunca é substituído para além disto (ADR).
    """
    return prior * blend(1.0, ratio, n, k)


@dataclass(frozen=True)
class Reading:
    """Uma linha da calibração: métrica × unidade × janela (a fotografia que o cenário guarda).

    `prior` é o valor dos pressupostos com que foi recalculado; `observed` é a estatística da janela
    (mediana das taxas/sacos, pedidos ÷ semanas); `blended` é o valor calibrado que o planeamento
    consome. Só estas linhas passam da retroalimentação ao planeamento — nunca eventos individuais.
    """

    metric: CalibrationMetric
    scope: CalibrationScope
    unit_code: str  # dicofre da freguesia, código do local ou "concelho"
    unit_name: str
    parish_code: str  # freguesia da unidade ("" no concelho); liga a taxa do local à captura da freguesia
    n: int
    pseudo_k: int
    observed: float | None  # None sem amostras
    prior: float
    blended: float
    weight: float  # n ÷ (n + k − 1)
    label: str  # pressuposto | estimativa·n | observado·n


@dataclass(frozen=True)
class Calibration:
    """A calibração inteira de um recálculo: as linhas da tabela de agregados, prontas a fotografar."""

    window_weeks: int
    readings: list[Reading]

    def reading(self, metric: CalibrationMetric, unit_code: str) -> Reading | None:
        """A linha de uma métrica numa unidade (None sem observação — o prior fica)."""
        for row in self.readings:
            if row.metric == metric and row.unit_code == unit_code:
                return row
        return None

    def kg_per_pickup(self) -> float | None:
        """Kg por saco agrupado do concelho (o que calibra `on_demand_kg_per_pickup`); None sem amostras."""
        row = self.reading(CalibrationMetric.KG_PER_BAG, "concelho")
        return row.blended if row else None

    def capture_by_parish(self) -> dict[str, Reading]:
        """Captura derivada do saco à porta por freguesia (linhas `on_demand_capture` da fotografia)."""
        return {r.unit_code: r for r in self.readings if r.metric == CalibrationMetric.ON_DEMAND_CAPTURE}


def pooled_kg_per_bag(readings: Sequence[Reading]) -> float | None:
    """Kg por saco do concelho: média das medianas observadas por local, ponderada por n.

    Reproduzível da fotografia (só observados e n's). Mediana exata do conjunto exigiria as unidades
    individuais, que a tabela de agregados não guarda (regra arquitetónica: o planeamento só vê
    agregados) — a média ponderada por n é o resumo honesto.
    """
    usable = [r for r in readings if r.observed is not None]
    total_n = sum(r.n for r in usable)
    if total_n == 0:
        return None
    return sum((r.observed or 0.0) * r.n for r in usable) / total_n


def on_demand_capture_readings(
    taxa_readings: Sequence[Reading],
    *,
    demand_kg_year: Mapping[str, float],
    prior_capture: Mapping[str, float],
    k: int = PSEUDO_K_PARISH,
) -> dict[str, Reading]:
    """Captura anual derivada do saco à porta, por freguesia com observação (ADR: taxa × degrau, teto D_z).

    Por freguesia com taxas observadas:
      evidência anual   E = Σ (taxa observada dos locais) × 365 kg
      captura observada c_obs = min(1, E ÷ D_z)          — a procura da APA limita sempre
      captura calibrada c = (k·c_prior + n·c_obs) ÷ (k + n), com n = visitas observadas na freguesia
    Freguesias sem observação não entram: o prior delas nunca é substituído. O `q` não entra — a procura
    chega pronta em `demand_kg_year`.
    """
    by_parish: dict[str, list[Reading]] = {}
    for row in taxa_readings:
        if row.metric == CalibrationMetric.GENERATION_RATE and row.observed is not None and row.parish_code:
            by_parish.setdefault(row.parish_code, []).append(row)
    out: dict[str, Reading] = {}
    for code, rows in by_parish.items():
        demand = demand_kg_year.get(code)
        prior = prior_capture.get(code)
        if demand is None or prior is None:
            continue
        evidence_kg = sum(r.observed for r in rows if r.observed is not None) * DAYS_PER_YEAR
        observed = annual_capture(evidence_kg, demand)
        n = sum(r.n for r in rows)
        out[code] = Reading(
            metric=CalibrationMetric.ON_DEMAND_CAPTURE,
            scope=CalibrationScope.PARISH,
            unit_code=code,
            unit_name=code,
            parish_code=code,
            n=n,
            pseudo_k=k,
            observed=observed,
            prior=prior,
            blended=blend(prior, observed, n, k),
            weight=observed_weight(n, k),
            label=sample_label(n, k),
        )
    return out


def window_start(now: datetime) -> datetime:
    """Início da janela de observação: 12 semanas antes do recálculo."""
    return now - timedelta(days=WINDOW_DAYS)
