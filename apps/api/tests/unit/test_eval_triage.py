import base64
from pathlib import Path

from novelo.adapters.openrouter import CallUsage
from novelo.ai.eval_triage import (
    TriageEvalReport,
    evaluate_model,
    load_report,
    load_truth,
    parse_composition,
    promised_axes,
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


def _analysis(
    garment: str,
    fine_state: str,
    season: str = "all_season",
    colour: str = "black",
    gender: str = "women",
    size_band: str = "unknown",
    brand: str | None = None,
    fibre: str = "cotton",
    pct: float = 100,
) -> TriageAnalysis:
    return TriageAnalysis(
        garment_type=garment,  # type: ignore[arg-type]
        fine_state=fine_state,  # type: ignore[arg-type]
        season=season,  # type: ignore[arg-type]
        colour=colour,  # type: ignore[arg-type]
        gender=gender,  # type: ignore[arg-type]
        size_band=size_band,  # type: ignore[arg-type]
        composition=[CompositionPart(fibre=fibre, pct=pct)],  # type: ignore[arg-type]
        brand=brand,
        confidence=0.9,
        notes="ok",
    )


def test_parse_composition_and_truth_csv(tmp_path: Path) -> None:
    assert parse_composition("cotton:60;polyester:40") == {"cotton": 60.0, "polyester": 40.0}
    csv = tmp_path / "truth.csv"
    csv.write_text(
        "file,label_file,garment_type,fine_state,condition,brand,composition\n"
        "a.png,,shirt,grade_b,,Zara,cotton:100\nb.png,b_l.png,jumper,recycle,,,wool:80;acrylic:20\n",
        encoding="utf-8",
    )
    rows = load_truth(csv)
    assert [r.file for r in rows] == ["a.png", "b.png"] and rows[1].label_file == "b_l.png" and rows[1].brand is None
    assert rows[0].fine_state == "grade_b" and rows[1].fine_state == "recycle"


def test_truth_csv_validates_axis_values_against_the_closed_vocabulary(tmp_path: Path) -> None:
    csv = tmp_path / "truth.csv"
    csv.write_text(
        "file,garment_type,fine_state,season,colour,gender,size_band\na.png,shirt,muito_boa,cold,black,women,m\n",
        encoding="utf-8",
    )
    try:
        load_truth(csv)
    except ValueError as exc:
        assert "muito_boa" in str(exc)  # o valor fora do vocabulário aparece na mensagem
    else:
        raise AssertionError("devia recusar um valor fora do vocabulário fechado")


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
            _analysis("shirt", "grade_b", brand="zara"),  # tudo certo (marca sem distinção de maiúsculas)
            _analysis("jacket", "recycle", brand=None, fibre="wool"),  # tipo errado; composição fora de ±10 pp
            UpstreamError("down"),  # falha não pára a avaliação
        ]
    )
    result = await evaluate_model(client, load_truth(csv), tmp_path, model="fake/vision")  # type: ignore[arg-type]
    assert result.pieces == 3 and result.failures == 1 and "c.png" in result.errors[0]
    # Verdade legada (só `condition`): mede o destino derivado do estado fino previsto.
    assert result.accuracy["garment_type"] == 0.5 and result.accuracy["destination"] == 1.0
    assert result.accuracy["brand"] == 1.0 and result.accuracy["dominant_fibre"] == 1.0
    assert result.accuracy["composition_within_10pp"] == 0.5
    assert result.accuracy["fine_state"] == 0.0  # sem verdade-terreno do estado fino, não se mede
    assert result.confusion_garment_type == {"shirt": {"shirt": 1}, "jumper": {"jacket": 1}}
    assert result.confusion_fine_state == {}  # o CSV legado não tem estado fino
    assert result.avg_cost_usd == 0.002 and result.total_cost_usd == 0.004

    report = TriageEvalReport(generated_at="2026-10-19T12:00:00Z", prompt_version="v4", images=3, models=[result])  # type: ignore[arg-type]
    md = render_markdown(report)
    assert "fake/vision" in md and "Matriz de confusão" in md and "50,0%" in md
    save_report(tmp_path / "last.json", report)
    assert load_report(tmp_path / "last.json") == report and load_report(tmp_path / "nope.json") is None


async def test_scores_each_taxonomy_axis_and_fine_state_confusion(tmp_path: Path) -> None:
    """O eval mede eixo a eixo (bilhete #56): valores calculados à mão."""
    for name in ("a.png", "b.png"):
        (tmp_path / name).write_bytes(PNG)
    csv = tmp_path / "truth.csv"
    csv.write_text(
        "file,garment_type,fine_state,season,colour,gender,size_band,brand,composition\n"
        "a.png,shirt,grade_b,warm,blue,women,m,Zara,cotton:100\n"
        "b.png,jumper,grade_a,cold,black,men,xl,,wool:70;acrylic:30\n",
        encoding="utf-8",
    )
    client = ScriptedVision(
        [
            # a.png: acerta tudo
            _analysis("shirt", "grade_b", season="warm", colour="blue", gender="women", size_band="m", brand="Zara"),
            # b.png: acerta a tipologia; erra o estado, a estação, a cor, o género e o tamanho;
            # composição wool:100 contra wool:70;acrylic:30 (fora de ±10 pp), fibra dominante certa
            _analysis("jumper", "grade_c", season="warm", colour="blue", gender="women", size_band="m", fibre="wool"),
        ]
    )
    result = await evaluate_model(client, load_truth(csv), tmp_path, model="fake/vision")  # type: ignore[arg-type]
    a = result.accuracy
    assert a["garment_type"] == 1.0  # 2/2
    assert a["fine_state"] == 0.5  # 1/2 (grade_b ✓, grade_a→grade_c ✗)
    assert a["season"] == 0.5  # 1/2
    assert a["colour"] == 0.5  # 1/2
    assert a["gender"] == 0.5  # 1/2
    assert a["size_band"] == 0.5  # 1/2
    assert a["destination"] == 0.0  # sem coluna `condition` na verdade-terreno, não se mede (teste legado cobre isso)
    assert a["dominant_fibre"] == 1.0 and a["composition_within_10pp"] == 0.5 and a["brand"] == 1.0
    assert result.samples == {
        "fine_state": 2,
        "garment_type": 2,
        "season": 2,
        "colour": 2,
        "gender": 2,
        "size_band": 2,
    }
    assert result.confusion_fine_state == {"grade_a": {"grade_c": 1}, "grade_b": {"grade_b": 1}}

    report = TriageEvalReport(generated_at="2026-10-19T12:00:00Z", prompt_version="v4", images=2, models=[result])  # type: ignore[arg-type]
    md = render_markdown(report)
    # Género e tamanho levam a marca «prometido» enquanto a exatidão não aguenta.
    assert md.count("prometido") >= 2 and "estação" in md.lower()


def test_promised_axes_need_accuracy_and_sample_size() -> None:
    # Exatidão baixa → prometido mesmo com muita amostra.
    assert promised_axes({"gender": 0.5, "size_band": 0.5}, {"gender": 100, "size_band": 100}) == [
        "gender",
        "size_band",
    ]
    # Exatidão que aguenta mas amostra curta: continua prometido (menos de 30 exemplos não prova nada).
    assert promised_axes({"gender": 0.95, "size_band": 0.95}, {"gender": 40, "size_band": 10}) == ["size_band"]
    # Nos dois critérios acima da linha: deixou de ser prometido.
    assert promised_axes({"gender": 0.95, "size_band": 0.95}, {"gender": 40, "size_band": 40}) == []


def test_empty_template_has_instructions() -> None:
    text = render_empty_template()
    assert "truth.csv" in text and "just eval-triage" in text and "--models" in text
    assert "fine_state" in text  # documenta as colunas novas por eixo
