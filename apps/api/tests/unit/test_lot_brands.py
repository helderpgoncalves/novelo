import pytest

from novelo.features.lots.service import _clean_brand


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("  zara ", "Zara"),
        ("ZARA", "Zara"),
        ("WISENT", "Wisent"),
        ("H&M", "H&M"),
        ("c&a", "C&A"),
        ("LEVI'S", "Levi's"),
        ("POLO BY RALPH LAUREN", "Polo by Ralph Lauren"),
        ("AMERICAN POWER SOURCE, INC.", "American Power Source, Inc."),
        # Com maiúsculas e minúsculas fica como foi escrita (o modelo e o operador copiam a etiqueta).
        ("Polo by Ralph Lauren", "Polo by Ralph Lauren"),
        ("McKenzie", "McKenzie"),
        ("   ", None),
        (None, None),
    ],
)
def test_clean_brand_keeps_one_spelling_per_brand(raw: str | None, expected: str | None) -> None:
    assert _clean_brand(raw) == expected
