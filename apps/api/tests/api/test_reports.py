import io

import httpx
import pytest
from pypdf import PdfReader


def _pdf_available() -> bool:
    try:
        from weasyprint import HTML  # noqa: PLC0415

        HTML(string="<p>x</p>").write_pdf()
    except Exception:
        return False
    return True


pytestmark = pytest.mark.skipif(not _pdf_available(), reason="WeasyPrint precisa das bibliotecas Pango do sistema")

P = "/api/v1"


async def scenario(c: httpx.AsyncClient, label: str, budget: float) -> str:
    resp = await c.post(
        f"{P}/planning/scenarios", json={"label": label, "objective": "max_tonnes", "budget_eur_year": budget}
    )
    return str(resp.json()["id"])


def text_of(pdf: bytes) -> str:
    text = "\n".join(page.extract_text() for page in PdfReader(io.BytesIO(pdf)).pages)
    return " ".join(text.split())  # a quebra de linha nas células da tabela não conta


async def test_rap_report_has_real_numbers_and_all_sections(logged_in: httpx.AsyncClient) -> None:
    a, b = await scenario(logged_in, "Contido", 25000), await scenario(logged_in, "Ambicioso", 80000)
    created = await logged_in.post(f"{P}/reports/rap", json={"scenario_ids": [a, b], "locale": "pt-PT"})
    assert created.status_code == 201, created.text
    report = created.json()
    assert report["size_bytes"] > 20_000

    pdf = await logged_in.get(f"{P}/reports/{report['id']}/pdf")
    assert pdf.headers["content-type"] == "application/pdf" and pdf.content[:4] == b"%PDF"
    text = text_of(pdf.content)
    for expected in [
        "Relatório RAP",
        "Custo por tipo de território",
        "Predominantemente urbana",
        "Mediamente urbana",
        "Predominantemente rural",
        "Ultriplo",  # entidades reais da Vitrus
        "301,3",  # recolhido em 2025
        "Contido",
        "Ambicioso",
        "Método, pressupostos e fontes",
        "Censos 2021",
    ]:
        assert expected in text, expected
    assert any(r["id"] == report["id"] for r in (await logged_in.get(f"{P}/reports")).json())


async def test_rap_report_in_english_and_validation(logged_in: httpx.AsyncClient) -> None:
    a = await scenario(logged_in, "Base", 40000)
    created = (await logged_in.post(f"{P}/reports/rap", json={"scenario_ids": [a], "locale": "en"})).json()
    pdf = await logged_in.get(f"{P}/reports/{created['id']}/pdf")
    assert "EPR report" in text_of(pdf.content) and "Cost by type of territory" in text_of(pdf.content)
    assert (await logged_in.post(f"{P}/reports/rap", json={"scenario_ids": []})).status_code == 422
    unknown = await logged_in.post(f"{P}/reports/rap", json={"scenario_ids": ["00000000-0000-0000-0000-000000000000"]})
    assert unknown.json()["code"] == "not_found"
