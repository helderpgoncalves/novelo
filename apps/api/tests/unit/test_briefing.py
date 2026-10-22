from typing import Any

from novelo.features.reports.briefing import _Briefing, executive_briefing, fallback_text

FACTS: dict[str, Any] = {
    "language": "pt-PT",
    "baseline_2025": {
        "year": 2025,
        "collected_t": "301,3",
        "capture_of_generated_pct": "11,5",
        "estimated_generated_t_per_year": "2 626",
        "still_to_divert_t_per_year": "2 325",
        "reuse_t": "179,0",
        "recycle_t": "79,9",
        "reject_t": "42,3",
    },
    "scenarios": [
        {
            "name": "Contido",
            "tonnes_per_year": "310,5",
            "eur_per_tonne": "412",
            "annual_cost_eur": "128 000",
            "investment_eur": "20 000",
            "coverage_pct": "55,0",
        }
    ],
}


class Fake:
    def __init__(self, *texts: str) -> None:
        self.texts = list(texts)
        self.calls = 0

    async def structured(self, **_: Any) -> _Briefing:
        self.calls += 1
        return _Briefing(text=self.texts.pop(0))


async def test_verified_briefing_is_used() -> None:
    good = "Em 2025 recolheram-se 301,3 t; o cenário Contido capta 310,5 t por ano a 412 €/t (estimativa)."
    out = await executive_briefing(Fake(good), FACTS)  # type: ignore[arg-type]
    assert out.source == "ai" and out.text == good and out.prompt_version == "v1"


async def test_invented_numbers_retry_once_then_deterministic_fallback() -> None:
    bad = "O cenário Contido capta 999 t por ano, uma enorme melhoria face ao passado recente."
    fake = Fake(bad, bad)
    out = await executive_briefing(fake, FACTS)  # type: ignore[arg-type]
    assert fake.calls == 2 and out.source == "fallback" and "999" not in out.text
    assert out.text == fallback_text(FACTS) and "301,3" in out.text


async def test_without_ai_the_fallback_is_used_and_english_works() -> None:
    assert (await executive_briefing(None, FACTS)).source == "fallback"
    en = fallback_text({**FACTS, "language": "en"})
    assert en.startswith("In 2025, 301,3 t") and "estimates" in en
