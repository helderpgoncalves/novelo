"""Avaliação da triagem por foto contra uma verdade-terreno: exatidão por campo, matriz de confusão, custo e latência.

A lógica vive aqui (testável sem rede, com um modelo falso); `scripts/eval_triage.py` é só a linha de comandos.
Nunca corre no pedido de um utilizador: é uma ferramenta da equipa (`just eval-triage`).
"""

import csv
import statistics
import time
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any, Protocol

from pydantic import BaseModel, Field

from novelo.adapters.openrouter import CallUsage
from novelo.domain.taxonomy import PROMISED_AXES, Colour, FineState, Gender, Season, SizeBand, destination_for
from novelo.features.lots.schemas import TriageResult
from novelo.features.lots.triage import analyse

COMPOSITION_TOLERANCE_PP = 10.0
TRUTH_COLUMNS = (
    "file",
    "label_file",
    "garment_type",
    "fine_state",
    "condition",
    "season",
    "colour",
    "gender",
    "size_band",
    "brand",
    "composition",
)
# Um eixo deixa de ser «prometido» quando a exatidão aguenta E a amostra prova o número.
GENDER_SIZE_PROMISE_THRESHOLD = 0.9
PROMISE_MIN_SAMPLES = 30

# Eixo → valores fechados da taxonomia (a verdade-terreno também é validada contra o vocabulário).
_AXIS_ENUMS: dict[str, type] = {
    "fine_state": FineState,
    "season": Season,
    "colour": Colour,
    "gender": Gender,
    "size_band": SizeBand,
}


class EvalClient(Protocol):
    usage: list[CallUsage]

    def model_for(self, task: str) -> str: ...

    async def structured(self, **kwargs: Any) -> Any: ...


class TruthRow(BaseModel):
    file: str
    label_file: str | None = None
    garment_type: str
    fine_state: str | None = None
    condition: str | None = None  # legado: só o destino (reuse/recycle/reject)
    season: str | None = None
    colour: str | None = None
    gender: str | None = None
    size_band: str | None = None
    brand: str | None = None
    composition: dict[str, float] = Field(default_factory=dict)


class TriageEvalModel(BaseModel):
    model: str
    pieces: int
    failures: int
    accuracy: dict[str, float] = Field(
        description="Por campo, de 0 a 1: eixos da taxonomia (fine_state, garment_type, season, colour, gender, "
        "size_band), destination, brand, dominant_fibre, composition_within_10pp"
    )
    samples: dict[str, int] = Field(
        default_factory=dict, description="Por eixo da taxonomia, com quantas peças de verdade-terreno se mediu"
    )
    promised_axes: list[str] = Field(
        default_factory=list,
        description="Eixos «prometidos»: género e tamanho enquanto a exatidão e a amostra não aguentarem",
    )
    avg_latency_s: float
    p95_latency_s: float
    avg_cost_usd: float | None = Field(description="Por peça, custo real devolvido pelo OpenRouter")
    total_cost_usd: float | None
    confusion_garment_type: dict[str, dict[str, int]]
    confusion_fine_state: dict[str, dict[str, int]]
    errors: list[str]


class TriageEvalReport(BaseModel):
    generated_at: datetime
    prompt_version: str
    images: int
    models: list[TriageEvalModel]


# --- Verdade-terreno -------------------------------------------------------------------------------


def parse_composition(raw: str) -> dict[str, float]:
    """`cotton:60;polyester:40` -> {"cotton": 60.0, "polyester": 40.0}."""
    parts: dict[str, float] = {}
    for chunk in filter(None, (c.strip() for c in raw.replace(",", ";").split(";"))):
        fibre, _, pct = chunk.partition(":")
        parts[fibre.strip().lower()] = parts.get(fibre.strip().lower(), 0.0) + float(pct)
    return parts


def load_truth(csv_path: Path) -> list[TruthRow]:
    with csv_path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        missing = {"file", "garment_type"} - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"{csv_path.name}: missing columns {sorted(missing)}; expected {list(TRUTH_COLUMNS)}")
        rows: list[TruthRow] = []
        for row in reader:
            if not (row.get("file") or "").strip():
                continue
            axis_values = {axis: (row.get(axis) or "").strip().lower() or None for axis in _AXIS_ENUMS}
            for axis, value in axis_values.items():
                enum_cls = _AXIS_ENUMS[axis]
                if value is not None:
                    try:
                        enum_cls(value)
                    except ValueError as exc:
                        allowed = ", ".join(member.value for member in enum_cls)  # type: ignore[attr-defined]
                        raise ValueError(
                            f"{csv_path.name}: {axis}={value!r} não está no vocabulário fechado; valores: {allowed}"
                        ) from exc
            rows.append(
                TruthRow(
                    file=row["file"].strip(),
                    label_file=(row.get("label_file") or "").strip() or None,
                    garment_type=row["garment_type"].strip().lower(),
                    condition=(row.get("condition") or "").strip().lower() or None,
                    brand=(row.get("brand") or "").strip() or None,
                    composition=parse_composition(row.get("composition") or ""),
                    **axis_values,
                )
            )
        return rows


# --- Métricas --------------------------------------------------------------------------------------


def _norm_brand(value: str | None) -> str:
    if not value:
        return ""
    plain = "".join(c for c in unicodedata.normalize("NFD", value.lower()) if not unicodedata.combining(c))
    return "".join(ch for ch in plain if ch.isalnum())


def _predicted_composition(result: TriageResult) -> dict[str, float]:
    parts: dict[str, float] = {}
    for p in result.analysis.composition:
        parts[p.fibre.value] = parts.get(p.fibre.value, 0.0) + p.pct
    return parts


def _within(truth: dict[str, float], pred: dict[str, float]) -> bool:
    return all(abs(truth.get(f, 0.0) - pred.get(f, 0.0)) <= COMPOSITION_TOLERANCE_PP for f in set(truth) | set(pred))


def _top(parts: dict[str, float]) -> str:
    return max(parts, key=lambda k: parts[k]) if parts else "unknown"


def _p95(values: list[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, round(0.95 * (len(ordered) - 1)))]


def _confusion(pairs: list[tuple[str, str]]) -> dict[str, dict[str, int]]:
    matrix: dict[str, dict[str, int]] = {}
    for truth, pred in pairs:
        row = matrix.setdefault(truth, {})
        row[pred] = row.get(pred, 0) + 1
    return matrix


def promised_axes(accuracy: dict[str, float], samples: dict[str, int]) -> list[str]:
    """Género e tamanho ficam «prometidos» enquanto a exatidão não aguentar com amostra que prove o número."""
    return sorted(
        axis.value
        for axis in PROMISED_AXES
        if accuracy.get(axis.value, 0.0) < GENDER_SIZE_PROMISE_THRESHOLD
        or samples.get(axis.value, 0) < PROMISE_MIN_SAMPLES
    )


def score(
    model: str, rows: list[TruthRow], outcomes: list[tuple[TriageResult | None, float, float | None, str | None]]
) -> TriageEvalModel:
    """`outcomes` alinhado com `rows`: (resultado ou None se falhou, latência em s, custo em USD, erro)."""
    axes = ("fine_state", "garment_type", "season", "colour", "gender", "size_band")
    hits = dict.fromkeys((*axes, "destination", "brand", "dominant_fibre", "composition_within_10pp"), 0)
    axis_total = dict.fromkeys(axes, 0)  # só se mede o eixo onde há verdade-terreno
    garment: list[tuple[str, str]] = []
    fine: list[tuple[str, str]] = []
    latencies: list[float] = []
    costs: list[float] = []
    errors: list[str] = []
    ok = 0
    for row, (result, latency, cost, error) in zip(rows, outcomes, strict=True):
        latencies.append(latency)
        if cost is not None:
            costs.append(cost)
        if result is None:
            errors.append(f"{row.file}: {error}")
            continue
        ok += 1
        a = result.analysis
        garment.append((row.garment_type, a.garment_type.value))
        pred_destination = destination_for(a.fine_state).value
        if row.condition is not None:  # verdade legada: só o destino derivado
            hits["destination"] += pred_destination == row.condition
        if row.fine_state is not None:
            fine.append((row.fine_state, a.fine_state.value))
            axis_total["fine_state"] += 1
            hits["fine_state"] += a.fine_state.value == row.fine_state
        pred_axes = {
            "garment_type": a.garment_type.value,
            "season": a.season.value,
            "colour": a.colour.value,
            "gender": a.gender.value,
            "size_band": a.size_band.value,
        }
        for axis, value in pred_axes.items():
            truth = getattr(row, axis, None)
            if truth is None:
                continue
            axis_total[axis] += 1
            hits[axis] += value == truth
        pred = _predicted_composition(result)
        hits["brand"] += _norm_brand(a.brand) == _norm_brand(row.brand)
        if row.composition:
            hits["dominant_fibre"] += _top(pred) == _top(row.composition)
            hits["composition_within_10pp"] += _within(row.composition, pred)
    with_comp = sum(1 for r, o in zip(rows, outcomes, strict=True) if o[0] is not None and r.composition)
    denominators = {"dominant_fibre": with_comp, "composition_within_10pp": with_comp} | axis_total
    accuracy = {
        k: round(v / (denominators.get(k, ok) or 1), 4) if (denominators.get(k, ok)) else 0.0 for k, v in hits.items()
    }
    samples = {k: axis_total[k] for k in axes}
    return TriageEvalModel(
        model=model,
        pieces=len(rows),
        failures=len(rows) - ok,
        accuracy=accuracy,
        samples=samples,
        promised_axes=promised_axes(accuracy, samples),
        avg_latency_s=round(statistics.fmean(latencies), 3) if latencies else 0.0,
        p95_latency_s=round(_p95(latencies), 3),
        avg_cost_usd=round(statistics.fmean(costs), 6) if costs else None,
        total_cost_usd=round(sum(costs), 6) if costs else None,
        confusion_garment_type=_confusion(garment),
        confusion_fine_state=_confusion(fine),
        errors=errors,
    )


async def evaluate_model(
    client: EvalClient, rows: list[TruthRow], images_dir: Path, model: str | None = None
) -> TriageEvalModel:
    outcomes: list[tuple[TriageResult | None, float, float | None, str | None]] = []
    for row in rows:
        item = (images_dir / row.file).read_bytes()
        label = (images_dir / row.label_file).read_bytes() if row.label_file else None
        before = len(client.usage)
        started = time.perf_counter()
        try:
            result = await analyse(client, item, label, model=model)  # type: ignore[arg-type]
            error = None
        except Exception as exc:  # uma peça falhada não pára a avaliação
            result, error = None, f"{type(exc).__name__}: {getattr(exc, 'message', exc)}"
        elapsed = time.perf_counter() - started
        new = client.usage[before:]
        priced = [u.cost_usd for u in new if u.cost_usd is not None]
        outcomes.append((result, elapsed, sum(priced) if priced else None, error))
    return score(model or client.model_for("triage"), rows, outcomes)


# --- Relatórios ------------------------------------------------------------------------------------


def save_report(path: Path, report: TriageEvalReport) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(report.model_dump_json(indent=2), encoding="utf-8")


def load_report(path: Path) -> TriageEvalReport | None:
    if not path.is_file():
        return None
    return TriageEvalReport.model_validate_json(path.read_text(encoding="utf-8"))


def _pct(value: float) -> str:
    return f"{value * 100:.1f}%".replace(".", ",")


def _usd(value: float | None, digits: int = 4) -> str:
    return "n/d" if value is None else f"{value:.{digits}f} US$".replace(".", ",")


def _matrix_md(title: str, matrix: dict[str, dict[str, int]]) -> list[str]:
    if not matrix:
        return [f"**{title}**: sem dados.", ""]
    labels = sorted({*matrix, *(p for row in matrix.values() for p in row)})
    lines = [
        f"**{title}** (linhas = verdade, colunas = previsão)",
        "",
        "| verdade \\ previsão | " + " | ".join(labels) + " |",
    ]
    lines.append("| --- | " + " | ".join("---:" for _ in labels) + " |")
    for truth in labels:
        row = matrix.get(truth, {})
        lines.append(f"| {truth} | " + " | ".join(str(row.get(p, 0)) for p in labels) + " |")
    return [*lines, ""]


def render_markdown(report: TriageEvalReport) -> str:
    when = report.generated_at.strftime("%d/%m/%Y %H:%M UTC")
    lines = [
        "# Avaliação da triagem por foto",
        "",
        f"Gerado por `just eval-triage` a {when}. Prompt `triage_{report.prompt_version}`, "
        f"{report.images} peças com verdade-terreno. Valores de custo reais do OpenRouter (`usage.cost`).",
        "",
        "## Comparação entre modelos (por eixo da taxonomia)",
        "",
        "| Modelo | Estado | Tipologia | Estação | Cor | Género | Tamanho | Destino | Marca | Fibra | Composição ±10 pp "
        "| Latência média | P95 | Custo/peça | Falhas |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]

    def _axis(a: dict[str, float], key: str, model_promised: list[str]) -> str:
        mark = " ‹prometido›" if key in model_promised else ""
        return _pct(a.get(key, 0.0)) + mark

    for m in report.models:
        a = m.accuracy
        lines.append(
            f"| `{m.model}` | {_axis(a, 'fine_state', m.promised_axes)} | {_axis(a, 'garment_type', m.promised_axes)} "
            f"| {_axis(a, 'season', m.promised_axes)} | {_axis(a, 'colour', m.promised_axes)} "
            f"| {_axis(a, 'gender', m.promised_axes)} | {_axis(a, 'size_band', m.promised_axes)} "
            f"| {_pct(a.get('destination', 0.0))} | {_pct(a.get('brand', 0.0))} | {_pct(a.get('dominant_fibre', 0.0))} "
            f"| {_pct(a.get('composition_within_10pp', 0.0))} | "
            f"{str(m.avg_latency_s).replace('.', ',')} s | {str(m.p95_latency_s).replace('.', ',')} s | "
            f"{_usd(m.avg_cost_usd, 5)} | {m.failures}/{m.pieces} |"
        )
    if any("prometido" in line for line in lines):
        lines += [
            "",
            "«prometido» = género/tamanho ainda não têm exatidão e amostra para se dar por garantidos "
            f"(linha: ≥ {GENDER_SIZE_PROMISE_THRESHOLD:.0%} de acerto e ≥ {PROMISE_MIN_SAMPLES} peças por eixo).",
        ]
    samples_note = ", ".join(f"{k}: {v}" for k, v in sorted(report.models[0].samples.items())) if report.models else ""
    if samples_note:
        lines += ["", f"Amostra por eixo (primeiro modelo): {samples_note}."]
    for m in report.models:
        lines += ["", f"## `{m.model}`", ""]
        lines += _matrix_md("Matriz de confusão: tipo de peça", m.confusion_garment_type)
        lines += _matrix_md("Matriz de confusão: estado fino", m.confusion_fine_state)
        lines.append(f"Custo total: {_usd(m.total_cost_usd)} · peças: {m.pieces}")
        if m.errors:
            lines += ["", "Falhas:", "", *[f"- {e}" for e in m.errors]]
    return "\n".join(lines) + "\n"


def render_empty_template() -> str:
    return """# Avaliação da triagem por foto

Ainda não foi corrida nenhuma avaliação: não há imagens de teste com verdade-terreno.

## Como preparar

1. Cria a pasta `data/eval/triage/` e põe lá as fotografias (JPEG, PNG ou WebP) de peças reais, já classificadas por uma pessoa.
2. Na mesma pasta, cria `truth.csv` (UTF-8) com uma linha por peça:

   | Coluna | Obrigatória | Valores |
   | --- | --- | --- |
   | `file` | sim | nome da foto da peça |
   | `label_file` | não | nome da foto da etiqueta |
   | `garment_type` | sim | `tshirt`, `shirt`, `trousers`, `jumper`, `jacket`, `dress`, `skirt`, `bedding`, `towel`, `footwear`, `accessory`, `other` |
   | `fine_state` | não | `grade_a`, `grade_b`, `grade_c`, `grade_d`, `recycle`, `reject` (estado fino da taxonomia) |
   | `condition` | não | `reuse`, `recycle`, `reject` (legado: mede só o destino derivado) |
   | `season` | não | `all_season`, `warm`, `cold` |
   | `colour` | não | `black`, `white`, `grey`, `beige`, `brown`, `red`, `orange`, `yellow`, `green`, `blue`, `pink`, `multicolour`, `unknown` |
   | `gender` | não | `men`, `women`, `kids`, `babies` |
   | `size_band` | não | `xs`, `s`, `m`, `l`, `xl`, `xxl`, `unknown` |
   | `brand` | não | marca como está escrita; vazio se não houver |
   | `composition` | não | `cotton:60;polyester:40` (fibras: as do esquema `Fibre`, ex.: `cotton`, `wool`, `polyester`) |

3. Garante `OPENROUTER_API_KEY` no `.env`.
4. Corre `just eval-triage` (um modelo, o configurado para a triagem) ou
   `just eval-triage --models openai/gpt-6-luna,typesafe/jev-router` para comparar vários modelos.

Este ficheiro é reescrito em cada execução. O resultado também fica em `data/eval/triage-last.json`, que o painel
de IA (`/admin/ai`) mostra. Usa pelo menos 30 peças variadas: com menos, as percentagens não dizem nada.

## O que se mede

- **Exatidão por eixo**: estado fino, tipologia, estação, cor, género e tamanho (só se mede o eixo com verdade-terreno);
  destino derivado (verdade legada `condition`), marca (igualdade ignorando acentos e maiúsculas), fibra dominante e
  composição (todas as fibras a ±10 pontos percentuais).
- **«prometido»**: género e tamanho ficam marcados enquanto não houver ≥ 90% de acerto com ≥ 30 peças por eixo.
- **Matriz de confusão** do tipo de peça e do estado fino, por modelo.
- **Custo e latência por peça**: custo real devolvido pelo OpenRouter; latência média e P95.
"""
