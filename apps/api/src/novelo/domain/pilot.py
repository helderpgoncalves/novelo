"""Recomendador de piloto: que freguesias ensinam mais num piloto curto. Funções puras, sem I/O.

Valor de aprendizagem de um conjunto de k freguesias = soma ponderada de quatro componentes em [0, 1]:

  tipau      amplitude urbano-rural: (TIPAU mais rural − mais urbano) / 2, com APU = 0, AMU = 1, APR = 2
  density    contraste de densidade populacional: (ln d_max − ln d_min) do conjunto / o mesmo de todos os candidatos
  coverage   média de min(dias/semana de circuito, mínimo p/ aproveitar a rota) / mínimo: recolha sem km novos
  cost       média de 1 − (arranque − mín) / (máx − mín): arranque barato

Arranque de uma freguesia = Σ modos (investimento + operação de `months` meses), do modelo de custos.
Os pesos são um pressuposto da equipa (ver `PilotWeights`): a escolha é explicável, não ótima em sentido forte.
A pesquisa é exaustiva (k ≤ 4 sobre ~48 freguesias): sem heurísticas, sem aleatoriedade, mesmo resultado sempre.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass, replace
from itertools import combinations

from novelo.domain.network import Params, Zone, build_option, mode_cost
from novelo.domain.sensitivity import (
    DEFAULT_SAMPLES,
    DEFAULT_SEED,
    DEFAULT_SWING,
    PlanItem,
    monte_carlo,
    percentile,
    sample_factors,
)
from novelo.domain.vocab import CollectionMode as Mode
from novelo.domain.vocab import Tipau

MAX_K = 4
DEFAULT_MODES = (Mode.STREET, Mode.ON_DEMAND)


@dataclass(frozen=True)
class PilotWeights:
    tipau: float = 0.25
    density: float = 0.15
    coverage: float = 0.30
    cost: float = 0.30

    def __post_init__(self) -> None:
        if abs(self.tipau + self.density + self.coverage + self.cost - 1) > 1e-9:
            raise ValueError("os pesos têm de somar 1")


@dataclass(frozen=True)
class PilotCandidate:
    zone: Zone
    tipau: Tipau | None
    area_km2: float | None

    @property
    def density(self) -> float | None:
        """Habitantes por km², ou None sem área."""
        return self.zone.population / self.area_km2 if self.area_km2 and self.area_km2 > 0 else None


@dataclass(frozen=True)
class CandidateScore:
    candidate: PilotCandidate
    coverage: float  # 0 a 1
    startup_cost_eur: float
    cost_score: float  # 0 a 1, 1 = mais barato de arrancar
    pilot_tonnes: float = 0.0  # t captadas nos `months` do piloto, nos modos escolhidos (estimativa)


@dataclass(frozen=True)
class PilotSelection:
    chosen: tuple[CandidateScore, ...]
    score: float
    tipau_diversity: float
    density_contrast: float
    coverage: float
    cost: float
    weights: PilotWeights
    tonnes: float = 0.0  # t do piloto no conjunto
    combos_total: int = 0
    combos_below_floor: int = 0  # combinações descartadas por ficarem abaixo do piso de sinal
    min_tonnes: float = 0.0
    floor_met: bool = True  # falso: nenhuma combinação atinge o piso; devolve-se a de mais toneladas


@dataclass(frozen=True)
class RejectFloor:
    """Piso de sinal: toneladas mínimas para medir a taxa de rejeito com um intervalo útil, por freguesia e modo."""

    reject_share: float
    half_width: float
    z: float
    design_effect: float
    piece_kg: float
    pieces_per_cell: int
    tonnes_per_cell: float
    cells: int
    tonnes: float


def reject_rate_floor(
    reject_share: float,
    cells: int,
    *,
    half_width: float = 0.03,
    z: float = 1.96,
    design_effect: float = 2.0,
    piece_kg: float = 0.415,
) -> RejectFloor:
    """n = z² · p(1 − p) / h² · deff peças por célula (freguesia × modo); toneladas = n · peso médio da peça.

    p = taxa de rejeito observada (14,1%); h = meia-largura do IC a 95% (3 pontos percentuais); deff = efeito de
    desenho do ensaio por conglomerados (sacos de uma mesma entrega não são independentes; convenção 2, a validar);
    peso médio da peça = média dos pesos por tipo de peça do Novelo (415 g, pressuposto).
    """
    if not 0 < reject_share < 1 or cells < 1 or half_width <= 0 or piece_kg <= 0:
        raise ValueError("parâmetros inválidos para o piso de sinal")
    pieces = math.ceil(z**2 * reject_share * (1 - reject_share) / half_width**2 * design_effect)
    per_cell = pieces * piece_kg / 1000
    return RejectFloor(reject_share, half_width, z, design_effect, piece_kg, pieces, per_cell, cells, per_cell * cells)


def startup_cost_eur(zone: Zone, params: Params, months: int, modes: Sequence[Mode]) -> float:
    """Investimento inicial + operação durante o piloto, nos modos escolhidos."""
    total = 0.0
    for m in modes:
        c = mode_cost(zone, m, params)
        total += c.capex_eur + c.opex_eur_year * months / 12
    return total


def score_candidates(
    candidates: Sequence[PilotCandidate], params: Params, months: int, modes: Sequence[Mode]
) -> list[CandidateScore]:
    startups = [startup_cost_eur(c.zone, params, months, modes) for c in candidates]
    lo, hi = min(startups), max(startups)
    return [
        CandidateScore(
            candidate=c,
            coverage=min(c.zone.service_days / params.piggyback_min_days, 1.0),
            startup_cost_eur=s,
            cost_score=1.0 if hi == lo else 1 - (s - lo) / (hi - lo),
            pilot_tonnes=build_option(c.zone, tuple(modes), params).tonnes * months / 12,
        )
        for c, s in zip(candidates, startups, strict=True)
    ]


TIPAU_ORDER = {Tipau.APU: 0, Tipau.AMU: 1, Tipau.APR: 2}  # do mais urbano ao mais rural


def tipau_diversity(chosen: Sequence[CandidateScore]) -> float:
    """Amplitude urbano-rural do conjunto: (mais rural − mais urbano) / 2; APU + APR = 1, AMU + APR = 0,5."""
    ranks = [TIPAU_ORDER[t] for s in chosen if (t := s.candidate.tipau) is not None]
    return (max(ranks) - min(ranks)) / 2 if ranks else 0.0


def _log_density_range(values: Sequence[float]) -> float:
    return math.log(max(values)) - math.log(min(values)) if len(values) >= 2 else 0.0


def recommend_pilot(
    candidates: Sequence[PilotCandidate],
    params: Params,
    *,
    k: int = 2,
    months: int = 3,
    modes: Sequence[Mode] = DEFAULT_MODES,
    weights: PilotWeights | None = None,
    min_tonnes: float = 0.0,
) -> PilotSelection:
    """O conjunto de `k` freguesias com mais valor de aprendizagem (empates: ordem por código INE).

    Combinações com menos de `min_tonnes` no piloto são descartadas (piso de sinal). Se nenhuma o atinge, devolve a
    de mais toneladas com `floor_met=False`, para o ecrã dizer que o piloto não consegue medir o que se pretende.
    """
    w = weights or PilotWeights()
    if not 2 <= k <= MAX_K:
        raise ValueError(f"k tem de estar entre 2 e {MAX_K}")
    pool = sorted((c for c in candidates if c.zone.population > 0), key=lambda c: c.zone.id)
    if len(pool) < k:
        raise ValueError("há menos candidatos do que freguesias pedidas")
    scored = score_candidates(pool, params, months, modes)
    full_range = _log_density_range([d for s in scored if (d := s.candidate.density)])

    best: PilotSelection | None = None
    richest: PilotSelection | None = None
    total = below = 0
    for combo in combinations(scored, k):
        total += 1
        densities = [d for s in combo if (d := s.candidate.density)]
        contrast = _log_density_range(densities) / full_range if full_range > 0 and len(densities) >= 2 else 0.0
        tipau = tipau_diversity(combo)
        coverage = sum(s.coverage for s in combo) / k
        cost = sum(s.cost_score for s in combo) / k
        score = w.tipau * tipau + w.density * min(contrast, 1.0) + w.coverage * coverage + w.cost * cost
        tonnes = sum(s.pilot_tonnes for s in combo)
        sel = PilotSelection(combo, score, tipau, min(contrast, 1.0), coverage, cost, w, tonnes, 0, 0, min_tonnes)
        if richest is None or tonnes > richest.tonnes + 1e-12:
            richest = sel
        if tonnes < min_tonnes:
            below += 1
            continue
        if best is None or score > best.score + 1e-12:
            best = sel
    assert richest is not None
    chosen = best or replace(richest, floor_met=False)
    return replace(chosen, combos_total=total, combos_below_floor=below)


# --- Previsão dos KPIs do piloto -------------------------------------------------------------------------------


@dataclass(frozen=True)
class KpiForecast:
    key: str  # tonnes | eur_per_tonne | reject_rate_pct
    value: float
    p10: float
    p90: float


@dataclass(frozen=True)
class PilotForecast:
    months: int
    kpis: tuple[KpiForecast, ...]
    startup_cost_eur: float  # investimento + operação dos `months` meses, nas freguesias do piloto


def forecast_pilot(
    selection: PilotSelection,
    params: Params,
    *,
    months: int,
    modes: Sequence[Mode],
    reject_share: float,
    n: int = DEFAULT_SAMPLES,
    seed: int = DEFAULT_SEED,
    swing: float = DEFAULT_SWING,
) -> PilotForecast:
    """Valor previsto e intervalo P10-P90 de toneladas e €/t (Monte Carlo sobre o modelo) e da taxa de rejeito.

    A taxa de rejeito parte da observada em 2025 (14,1%) e leva a mesma incerteza triangular ±`swing`.
    As toneladas são as de `months` meses; o €/t é o do regime (custo anual / toneladas anuais).
    """
    if not 0 <= reject_share <= 1:
        raise ValueError("a taxa de rejeito tem de estar entre 0 e 1")
    items = [PlanItem(s.candidate.zone, tuple(modes), (1.0,) * len(modes)) for s in selection.chosen]
    mc = monte_carlo(items, params, n=n, seed=seed, swing=swing)
    scale = months / 12
    rejects = [min(1.0, reject_share * f["reject_rate"]) for f in sample_factors(["reject_rate"], n, seed, swing)]
    kpis = (
        KpiForecast("tonnes", mc.base.tonnes * scale, mc.tonnes.p10 * scale, mc.tonnes.p90 * scale),
        KpiForecast("eur_per_tonne", mc.base.eur_per_tonne or 0.0, mc.eur_per_tonne.p10, mc.eur_per_tonne.p90),
        KpiForecast(
            "reject_rate_pct", reject_share * 100, percentile(rejects, 10) * 100, percentile(rejects, 90) * 100
        ),
    )
    return PilotForecast(months, kpis, sum(s.startup_cost_eur for s in selection.chosen))
