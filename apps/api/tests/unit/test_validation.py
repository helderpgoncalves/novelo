"""Validação do modelo: valores calculados à mão."""

import pytest

from novelo.domain.validation import (
    implied_capture_pct,
    leave_one_out,
    pearson,
    potential_reading,
    share_reading,
    spearman,
)


def test_implied_capture_matches_the_baseline() -> None:
    # 301,265 t / (156 830 hab × 8,4 kg/hab/ano) = 22,87%
    assert implied_capture_pct(301.265, 156_830, 8.4) == pytest.approx(22.87, abs=0.01)


def test_a_bigger_potential_means_a_smaller_capture() -> None:
    low = potential_reading("a", 8.4, 301.265, 156_830)
    high = potential_reading("b", 23.5, 301.265, 156_830)
    assert high.implied_capture_pct < low.implied_capture_pct
    assert high.implied_capture_pct == pytest.approx(8.17, abs=0.01)


def test_share_reading() -> None:
    # 517 kg/hab/ano × 4,55% = 23,5235
    assert share_reading(517, 4.55) == pytest.approx(23.5235)


def test_invalid_inputs_are_rejected() -> None:
    with pytest.raises(ValueError):
        implied_capture_pct(1, 0, 8.4)
    with pytest.raises(ValueError):
        implied_capture_pct(1, 100, 0)


def test_pearson_and_spearman_on_a_monotone_line() -> None:
    x = [1.0, 2.0, 3.0, 4.0]
    assert pearson(x, [2.0, 4.0, 6.0, 8.0]) == pytest.approx(1.0)
    assert pearson(x, [8.0, 6.0, 4.0, 2.0]) == pytest.approx(-1.0)
    assert spearman(x, [1.0, 4.0, 9.0, 16.0]) == pytest.approx(1.0)


def test_spearman_averages_tied_ranks() -> None:
    # postos de y: 1,5 / 1,5 / 3 / 4
    assert spearman([1.0, 2.0, 3.0, 4.0], [1.0, 1.0, 2.0, 3.0]) == pytest.approx(0.9487, abs=1e-4)


def test_leave_one_out_is_exact_when_proportional() -> None:
    check = leave_one_out(["a", "b", "c", "d"], [100, 200, 300, 400], [10, 20, 30, 40])
    assert check.median_abs_pct_error == pytest.approx(0)
    assert check.r2 == pytest.approx(1.0)
    assert check.within_25_pct == 4


def test_leave_one_out_by_hand() -> None:
    # população 100/200/300/400, contentores 10/20/30/50 (total 110 em 1 000 hab.)
    check = leave_one_out(["a", "b", "c", "d"], [100, 200, 300, 400], [10, 20, 30, 50])
    by_zone = {z.zone: z for z in check.zones}
    assert by_zone["a"].predicted == pytest.approx(100 * 100 / 900)  # 11,11
    assert by_zone["d"].predicted == pytest.approx(40.0)
    assert by_zone["d"].pct_error == pytest.approx(20.0)
    assert by_zone["b"].pct_error == pytest.approx(12.5)
    # erros 11,11 / 12,5 / 14,29 / 20: a mediana é a média dos dois do meio
    assert check.median_abs_pct_error == pytest.approx((12.5 + 14.2857142857) / 2, abs=1e-6)
    assert check.within_25_pct == 4
    assert check.within_50_pct == 4
    # a pior freguesia (maior erro absoluto) vem primeiro
    assert check.zones[0].zone == "d"


def test_leave_one_out_needs_enough_zones() -> None:
    with pytest.raises(ValueError):
        leave_one_out(["a", "b", "c"], [1, 2, 3], [1, 2, 3])
