import base64
from pathlib import Path

from novelo.adapters.openrouter import CallUsage
from novelo.ai.eval_triage import (
    TriageEvalReport,
    evaluate_model,
    load_report,
    load_truth,
    parse_composition,
    render_empty_template,
    render_markdown,
    save_report,
)
from novelo.core.errors import UpstreamError
from novelo.features.lots.schemas import CompositionPart, TriageAnalysis

PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


class ScriptedVision:
    """Modelo de visão falso: devolve respostas preparadas e regista uso como o cliente real."""

    def __init__(self, answers: list[TriageAnalysis | Exception]) -> None:
        self.answers, self.usage = answers, []

    def model_for(self, task: str) -> str:
        return "fake/vision"

    async def structured(self, **_: object) -> TriageAnalysis:
        item = self.answers.pop(0)
        if isinstance(item, Exception):
            raise item
        self.usage.append(CallUsage("fake/vision", 0.5, 1000, 100, 0.002))
        return item


def _analysis(garment: str, condition: str, brand: str | None, fibre: str, pct: float = 100) -> TriageAnalysis:
    return TriageAnalysis(
        garment_type=garment,  # type: ignore[arg-type]
        condition=condition,  # type: ignore[arg-type]
        composition=[CompositionPart(fibre=fibre, pct=pct)],  # type: ignore[arg-type]
        brand=brand,
        confidence=0.9,
        notes="ok",
    )


def test_parse_composition_and_truth_csv(tmp_path: Path) -> None:
    assert parse_composition("cotton:60;polyester:40") == {"cotton": 60.0, "polyester": 40.0}
    csv = tmp_path / "truth.csv"
    csv.write_text(
        "file,label_file,garment_type,condition,brand,composition\n"
        "a.png,,shirt,reuse,Zara,cotton:100\nb.png,b_l.png,jumper,recycle,,wool:80;acrylic:20\n",
        encoding="utf-8",
    )
    rows = load_truth(csv)
    assert [r.file for r in rows] == ["a.png", "b.png"] and rows[1].label_file == "b_l.png" and rows[1].brand is None


async def test_scores_confusion_cost_and_failures(tmp_path: Path) -> None:
    for name in ("a.png", "b.png", "c.png"):
        (tmp_path / name).write_bytes(PNG)
    csv = tmp_path / "truth.csv"
    csv.write_text(
        "file,garment_type,condition,brand,composition\n"
        "a.png,shirt,reuse,Zara,cotton:100\n"
        "b.png,jumper,recycle,,wool:70;acrylic:30\n"
        "c.png,dress,reject,Mango,polyester:100\n",
        encoding="utf-8",
    )
    client = ScriptedVision(
        [
            _analysis("shirt", "reuse", "zara", "cotton"),  # tudo certo (marca sem distinção de maiúsculas)
            _analysis("jacket", "recycle", None, "wool", 100),  # tipo errado; composição fora de ±10 pp
            UpstreamError("down"),  # falha não pára a avaliação
        ]
    )
    result = await evaluate_model(client, load_truth(csv), tmp_path, model="fake/vision")  # type: ignore[arg-type]
    assert result.pieces == 3 and result.failures == 1 and "c.png" in result.errors[0]
    assert result.accuracy["garment_type"] == 0.5 and result.accuracy["condition"] == 1.0
    assert result.accuracy["brand"] == 1.0 and result.accuracy["dominant_fibre"] == 1.0
    assert result.accuracy["composition_within_10pp"] == 0.5
    assert result.confusion_garment_type == {"shirt": {"shirt": 1}, "jumper": {"jacket": 1}}
    assert result.avg_cost_usd == 0.002 and result.total_cost_usd == 0.004

    report = TriageEvalReport(generated_at="2026-10-19T12:00:00Z", prompt_version="v1", images=3, models=[result])  # type: ignore[arg-type]
    md = render_markdown(report)
    assert "fake/vision" in md and "Matriz de confusão" in md and "50,0%" in md
    save_report(tmp_path / "last.json", report)
    assert load_report(tmp_path / "last.json") == report and load_report(tmp_path / "nope.json") is None


def test_empty_template_has_instructions() -> None:
    text = render_empty_template()
    assert "truth.csv" in text and "just eval-triage" in text and "--models" in text
