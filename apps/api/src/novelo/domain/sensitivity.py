"""Incerteza do modelo: tornado, Monte Carlo e robustez. Funções puras, sem I/O.

Os custos unitários da Vitrus ainda não existem (são pressupostos), por isso a pergunta útil não é "quanto custa"
mas "quanto custa se estivermos errados, e a decisão aguenta?".

DECISÃO: o Monte Carlo reavalia o modelo de custos sobre o plano JÁ OTIMIZADO (as mesmas freguesias, os mesmos modos)
e não resolve o CP-SAT de novo em cada amostra. Razões:
  1. A pergunta é "o plano que vamos propor falha se os pressupostos estiverem errados?". Reotimizar em cada amostra
     responderia a outra ("quanto custaria o melhor plano se soubéssemos a verdade?") e daria sempre um valor mais
     otimista (viés de seleção), escondendo o risco de quem decide hoje com pressupostos errados.
  2. 500 resoluções de 20 s seriam horas; reavaliar o plano custa milissegundos.
  3. A mesma semente dá a mesma resposta (determinismo exigido pelo projeto).
Os km de cada parte vêm calibrados com as rotas reais do cenário (`PlanItem.km_scale`), de modo que, com os
pressupostos centrais, a avaliação reproduz exatamente os KPIs do cenário guardado.

Distribuições: triangulares em torno do pressuposto, `Tri(1 − s, 1 + s, moda 1)` aplicada como fator multiplicativo
a cada parâmetro, de forma independente. O fator é o que se parte entre cenários (amostras emparelhadas): dois
cenários comparados sofrem a mesma "má sorte" nos pressupostos, o que torna a comparação justa.
"""

from __future__ import annotations

import math
import random
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from typing import Any, Literal

from novelo.domain.network import ModeParams, Params, Zone, build_option
from novelo.domain.vocab import CollectionMode as Mode

DEFAULT_SWING = 0.3
DEFAULT_SAMPLES = 500
DEFAULT_SEED = 7

# Parâmetros globais que entram na avaliação do plano.
GLOBAL_KEYS = (
    "kg_per_inhab_month",
    "cost_per_collection_eur",
    "cost_per_km_eur",
    "detour_factor",
    "on_demand_kg_per_pickup",
    "piggyback_extra_km",
)
# Por modo: o modo a pedido não tem pontos, vida útil nem frequência, só captura e cobertura.
MODE_KEYS = (
    "capture_rate",
    "coverage_factor",
    "capex_per_point_eur",
    "people_per_point",
    "lifetime_years",
    "collections_per_year",
)
ON_DEMAND_KEYS = ("capture_rate", "coverage_factor")

Criterion = Literal["eur_per_tonne", "annual_cost_eur", "tonnes"]


@dataclass(frozen=True)
class PlanItem:
    """Uma freguesia do plano otimizado: os modos escolhidos e o fator de km calibrado com as rotas reais."""

    zone: Zone
    modes: tuple[Mode, ...]
    km_scale: tuple[float, ...]  # um por modo; 1.0 = estimativa radial


@dataclass(frozen=True)
class Metrics:
    tonnes: float
    annual_cost_eur: float

    @property
    def eur_per_tonne(self) -> float | None:
        return self.annual_cost_eur / self.tonnes if self.tonnes > 0 else None


@dataclass(frozen=True)
class TornadoBar:
    key: str
    base_value: float
    low_value: float
    high_value: float
    low: Metrics  # parâmetro × (1 − swing)
    high: Metrics  # parâmetro × (1 + swing)
    swing_eur_per_tonne: float  # |€/t(high) − €/t(low)|: critério de ordenação
    swing_tonnes: float
    swing_cost_eur: float


@dataclass(frozen=True)
class Quantiles:
    p10: float
    p50: float
    p90: float


@dataclass(frozen=True)
class MonteCarlo:
    n: int
    seed: int
    swing: float
    base: Metrics
    eur_per_tonne: Quantiles
    annual_cost_eur: Quantiles
    tonnes: Quantiles
    threshold_eur_per_tonne: float | None
    prob_below_threshold: float | None  # P(€/t < limiar)


@dataclass(frozen=True)
class Robustness:
    n: int
    seed: int
    swing: float
    criterion: Criterion
    share_recommended_better: float  # fração das amostras em que o recomendado é estritamente melhor
    min_share: float
    holds: bool  # share >= min_share
    median_advantage: float  # mediana de (alternativo − recomendado), no critério (positivo = recomendado melhor)
    base_recommended: Metrics
    base_alternative: Metrics


# --- Percentis ---------------------------------------------------------------------------------------------------


def percentile(values: Sequence[float], q: float) -> float:
    """Percentil `q` (0 a 100) por interpolação linear entre ordens (o mesmo método do numpy por omissão)."""
    if not values:
        raise ValueError("sem valores")
    if not 0 <= q <= 100:
        raise ValueError("o percentil tem de estar entre 0 e 100")
    ordered = sorted(values)
    pos = (len(ordered) - 1) * q / 100
    lo = math.floor(pos)
    hi = math.ceil(pos)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (pos - lo)


def quantiles(values: Sequence[float]) -> Quantiles:
    return Quantiles(percentile(values, 10), percentile(values, 50), percentile(values, 90))


# --- Parâmetros --------------------------------------------------------------------------------------------------


def get_value(params: Params, key: str) -> float:
    if key.startswith("modes."):
        _, mode, field_name = key.split(".")
        return float(getattr(params.modes[Mode(mode)], field_name))
    return float(getattr(params, key))


def _clamp(key: str, value: float) -> float:
    """Mantém o valor no domínio válido do parâmetro (as mesmas fronteiras do schema de pressupostos)."""
    name = key.rsplit(".", 1)[-1]
    if name in {"capture_rate", "coverage_factor"}:
        return min(max(value, 0.0), 1.0)
    if name == "detour_factor":
        return min(max(value, 1.0), 3.0)
    if name == "kg_per_inhab_month":
        return min(value, 5.0)
    if name == "people_per_point":
        return float(max(1, round(value)))
    return value


def with_value(params: Params, key: str, value: float) -> Params:
    value = _clamp(key, value)
    if key.startswith("modes."):
        _, mode_name, field_name = key.split(".")
        mode = Mode(mode_name)
        current = params.modes[mode]
        new_value: Any = int(value) if field_name == "people_per_point" else value
        changes: dict[str, Any] = {field_name: new_value}
        modes: dict[Mode, ModeParams] = {**params.modes, mode: replace(current, **changes)}
        return replace(params, modes=modes)
    global_change: dict[str, Any] = {key: value}
    return replace(params, **global_change)


def apply_factors(params: Params, factors: Mapping[str, float]) -> Params:
    """Multiplica cada parâmetro pelo seu fator (cortado ao domínio válido)."""
    out = params
    for key, factor in factors.items():
        out = with_value(out, key, get_value(params, key) * factor)
    return out


def sensitive_keys(items: Sequence[PlanItem], params: Params) -> list[str]:
    """Parâmetros que podem mexer no resultado deste plano: só os dos modos usados e com valor não nulo."""
    used = {m for it in items for m in it.modes}
    keys = list(GLOBAL_KEYS)
    for mode in Mode:  # ordem fixa do enum: determinismo
        if mode not in used:
            continue
        names = ON_DEMAND_KEYS if mode == Mode.ON_DEMAND else MODE_KEYS
        keys += [f"modes.{mode.value}.{n}" for n in names]
    return [k for k in keys if get_value(params, k) != 0]


# --- Avaliação do plano (sem solver) -----------------------------------------------------------------------------


def evaluate_plan(items: Sequence[PlanItem], params: Params) -> Metrics:
    """Toneladas e custo anual de um plano fixo. Mesmas fórmulas do otimizador (`network.build_option`)."""
    tonnes = 0.0
    cost = 0.0
    for it in items:
        option = build_option(it.zone, it.modes, params)
        tonnes += option.tonnes
        for part, scale in zip(option.parts, it.km_scale, strict=True):
            extra_km_cost = part.km_year * (scale - 1) * params.cost_per_km_eur
            cost += part.capex_eur / params.modes[part.mode].lifetime_years + part.opex_eur_year + extra_km_cost
    return Metrics(tonnes, cost)


def calibrate_km_scale(
    zone: Zone, modes: tuple[Mode, ...], params: Params, stored_km: Sequence[float]
) -> tuple[float, ...]:
    """Razão entre os km das rotas reais (guardados no cenário) e a estimativa radial do modelo."""
    parts = build_option(zone, modes, params).parts
    return tuple(s / p.km_year if p.km_year > 0 else 1.0 for p, s in zip(parts, stored_km, strict=True))


# --- Tornado -----------------------------------------------------------------------------------------------------


def tornado(
    items: Sequence[PlanItem], params: Params, swing: float = DEFAULT_SWING, keys: Sequence[str] | None = None
) -> list[TornadoBar]:
    """Varia cada parâmetro ±`swing` (um de cada vez) e ordena por impacto em €/t (maior primeiro)."""
    if not 0 < swing < 1:
        raise ValueError("a variação tem de estar entre 0 e 1 (exclusive)")
    chosen = list(keys) if keys is not None else sensitive_keys(items, params)
    bars = []
    for key in chosen:
        base = get_value(params, key)
        low_p = with_value(params, key, base * (1 - swing))
        high_p = with_value(params, key, base * (1 + swing))
        low, high = evaluate_plan(items, low_p), evaluate_plan(items, high_p)
        low_e, high_e = low.eur_per_tonne, high.eur_per_tonne
        bars.append(
            TornadoBar(
                key=key,
                base_value=base,
                low_value=get_value(low_p, key),
                high_value=get_value(high_p, key),
                low=low,
                high=high,
                swing_eur_per_tonne=abs(high_e - low_e) if low_e is not None and high_e is not None else 0.0,
                swing_tonnes=abs(high.tonnes - low.tonnes),
                swing_cost_eur=abs(high.annual_cost_eur - low.annual_cost_eur),
            )
        )
    return sorted(bars, key=lambda b: (-b.swing_eur_per_tonne, -b.swing_cost_eur, b.key))


# --- Monte Carlo -------------------------------------------------------------------------------------------------


def sample_factors(keys: Sequence[str], n: int, seed: int, swing: float = DEFAULT_SWING) -> list[dict[str, float]]:
    """`n` conjuntos de fatores `Tri(1 − swing, 1 + swing, moda 1)`, independentes por parâmetro, semente fixa."""
    if n < 1:
        raise ValueError("n tem de ser positivo")
    if not 0 <= swing < 1:
        raise ValueError("a variação tem de estar entre 0 (inclusive) e 1 (exclusive)")
    rng = random.Random(seed)
    ordered = sorted(keys)
    return [{k: rng.triangular(1 - swing, 1 + swing, 1.0) for k in ordered} for _ in range(n)]


def monte_carlo(
    items: Sequence[PlanItem],
    params: Params,
    *,
    n: int = DEFAULT_SAMPLES,
    seed: int = DEFAULT_SEED,
    swing: float = DEFAULT_SWING,
    threshold_eur_per_tonne: float | None = None,
) -> MonteCarlo:
    keys = sensitive_keys(items, params)
    results = [evaluate_plan(items, apply_factors(params, f)) for f in sample_factors(keys, n, seed, swing)]
    per_tonne = [e for r in results if (e := r.eur_per_tonne) is not None]
    if not per_tonne:
        raise ValueError("nenhuma amostra tem toneladas: o plano está vazio")
    prob = None
    if threshold_eur_per_tonne is not None:
        prob = sum(1 for e in per_tonne if e < threshold_eur_per_tonne) / len(per_tonne)
    return MonteCarlo(
        n=n,
        seed=seed,
        swing=swing,
        base=evaluate_plan(items, params),
        eur_per_tonne=quantiles(per_tonne),
        annual_cost_eur=quantiles([r.annual_cost_eur for r in results]),
        tonnes=quantiles([r.tonnes for r in results]),
        threshold_eur_per_tonne=threshold_eur_per_tonne,
        prob_below_threshold=prob,
    )


def _criterion_value(m: Metrics, criterion: Criterion) -> float | None:
    """Valor a MINIMIZAR no critério (as toneladas entram com sinal trocado)."""
    if criterion == "eur_per_tonne":
        return m.eur_per_tonne
    if criterion == "annual_cost_eur":
        return m.annual_cost_eur
    return -m.tonnes


def robustness(
    recommended: Sequence[PlanItem],
    recommended_params: Params,
    alternative: Sequence[PlanItem],
    alternative_params: Params,
    *,
    n: int = DEFAULT_SAMPLES,
    seed: int = DEFAULT_SEED,
    swing: float = DEFAULT_SWING,
    criterion: Criterion = "eur_per_tonne",
    min_share: float = 0.8,
) -> Robustness:
    """Em que fração das amostras o recomendado é estritamente melhor que o alternativo?

    Amostras emparelhadas: os mesmos fatores perturbam os pressupostos de ambos (cada um sobre os seus valores).
    """
    keys = sorted(
        set(sensitive_keys(recommended, recommended_params)) | set(sensitive_keys(alternative, alternative_params))
    )
    wins = 0
    valid = 0
    advantages: list[float] = []
    for f in sample_factors(keys, n, seed, swing):
        a = _criterion_value(
            evaluate_plan(recommended, apply_factors(recommended_params, _present(f, recommended_params))), criterion
        )
        b = _criterion_value(
            evaluate_plan(alternative, apply_factors(alternative_params, _present(f, alternative_params))), criterion
        )
        if a is None or b is None:
            continue
        valid += 1
        wins += a < b
        advantages.append(b - a)
    if valid == 0:
        raise ValueError("nenhuma amostra comparável: algum plano está vazio")
    share = wins / valid
    return Robustness(
        n=valid,
        seed=seed,
        swing=swing,
        criterion=criterion,
        share_recommended_better=share,
        min_share=min_share,
        holds=share >= min_share,
        median_advantage=percentile(advantages, 50),
        base_recommended=evaluate_plan(recommended, recommended_params),
        base_alternative=evaluate_plan(alternative, alternative_params),
    )


def _present(factors: Mapping[str, float], params: Params) -> dict[str, float]:
    """Só os fatores cujo parâmetro existe e é não nulo nestes pressupostos (o outro cenário pode usar outros modos)."""
    return {k: v for k, v in factors.items() if get_value(params, k) != 0}
