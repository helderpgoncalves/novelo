"""Catálogo e resgate (#65): teto de donativos e códigos — calculado à mão (o domínio é puro, sem I/O).

O teto de donativos é indexado ao **custo evitado de aterro** (105,64 €/t = TGR 40 € + tarifa
Resinorte 65,64 €; fonte «docs/engenharia/dados-e-modelo.md», Vitrus 22 out 2026): o valor-euro
doado a IPSS num mês nunca passa de uma fração do que a conta já desviou de aterro — **medido na
balança da viatura**, nunca estimado. Os códigos de resgate usam o MESMO alfabeto dos sacos
(sem 0/O/1/I/L): leem-se bem em QR impresso à mesa do parceiro.
"""

from novelo.domain.bags import ALPHABET, CODE_CHARS, REDEMPTION_CODE_PREFIX, new_redemption_code
from novelo.domain.catalog import AVOIDED_TREATMENT_EUR_CENTS_PER_T, CatalogItemKind, donation_cap_cents

# --- teto de donativos: pct × 105,64 €/t × toneladas medidas ---------------------------------------


def test_avoided_cost_is_the_sourced_value_in_cents() -> None:
    # 105,64 €/t (40 € TGR + 65,64 € Resinorte) em cêntimos por tonelada — a fonte é obrigatória.
    assert AVOIDED_TREATMENT_EUR_CENTS_PER_T == 10_564


def test_cap_is_the_full_avoided_cost_at_100_pct() -> None:
    # 30 kg medidos: 30_000 g × 10_564 cênt./t ÷ 1_000_000 = 316,92 €→cênt. = 316,92 → 316 (3,16 €).
    assert donation_cap_cents(30_000) == 316


def test_cap_scales_with_measured_grams_and_floors() -> None:
    assert donation_cap_cents(2_400) == 25  # 2_400 × 10_564 ÷ 1_000_000 = 25,3536 → 25 (0,25 €)
    assert donation_cap_cents(100_000) == 1056  # 100 kg → 1056,4 → 1056 (10,56 €)
    assert donation_cap_cents(0) == 0  # nada pesado: nada de donativo financiado pelo custo evitado


def test_cap_applies_the_percentage() -> None:
    # 50%: 316,92 ÷ 2 = 158,46 → 158. O pct é pressuposto configurável (POINTS_DONATION_CAP_PCT).
    assert donation_cap_cents(30_000, cap_pct=50) == 158
    assert donation_cap_cents(30_000, cap_pct=0) == 0  # 0 desliga o financiamento de donativos


def test_cap_never_negatives() -> None:
    # Peso negativo não existe (CHECK na base); por defesa, também aqui vale 0.
    assert donation_cap_cents(-5) == 0


# --- códigos de resgate: o alfabeto dos sacos, prefixo próprio -------------------------------------


def test_redemption_code_has_its_own_prefix() -> None:
    # Determinístico com escolhedor injetado (o real usa `secrets.choice`).
    assert new_redemption_code(lambda _chars: "K") == "RDM-KKKKKK"
    assert REDEMPTION_CODE_PREFIX == "RDM-"


def test_redemption_code_length_matches_the_bags() -> None:
    code = new_redemption_code(lambda _chars: "A")
    assert len(code) == len(REDEMPTION_CODE_PREFIX) + CODE_CHARS  # RDM-XXXXXX


def test_redemption_codes_never_contain_confusable_characters() -> None:
    # O alfabeto é literalmente o dos sacos (sem 0/O/1/I/L): percorre-o todo e confirma nos códigos.
    cycle = iter(ALPHABET * 8)
    codes = [new_redemption_code(lambda _chars: next(cycle)) for _ in range(20)]
    joined = "".join(codes)
    for banned in "0O1IL":
        assert banned not in joined
    assert all(code.startswith(REDEMPTION_CODE_PREFIX) for code in codes)


# --- tipos do catálogo: a forma fechada das três prateleiras ---------------------------------------


def test_catalog_kinds_are_the_three_shelves() -> None:
    # Donativo IPSS (única âncora €), prémio de parceiro, acumulado ambiental (não monetário).
    assert {kind.value for kind in CatalogItemKind} == {"ipss_donation", "partner_prize", "environmental"}
