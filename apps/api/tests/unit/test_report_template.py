"""O modelo do relatório RAP mostra valores, nunca a representação de um objeto Python."""

from novelo.features.reports.builder import _ENV
from novelo.features.reports.texts import TEXTS


def test_brand_rows_show_the_item_count_not_a_dict_method() -> None:
    # `items` numa linha de dicionário resolvia-se para `dict.items` no Jinja: «<built-in method items ...>» no PDF.
    t = TEXTS["pt-PT"]
    html = _ENV.get_template("rap.html").render(
        t=t,
        locale="pt-PT",
        brands=[{"brand": "Zara", "n_items": 6, "kg": "1,65", "share": "100,0%", "fibre": "Lã"}],
        brand_sample=6,
        scenarios=[],
        comparison=[],
        entities=[],
        totals={},
        fibres=[],
        assumptions=[],
        sources=[],
    )
    assert "built-in method" not in html and "object at 0x" not in html
    assert '<td>Zara</td><td class="n">6</td>' in html
