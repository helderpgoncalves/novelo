"""Códigos do cidadão (sacos ativados e QR de conta), calculados à mão.

O gerador é injetável: com um escolhedor fixo, o resultado é determinístico e compara-se a um literal.
"""

from novelo.domain.bags import (
    ACCOUNT_CODE_PREFIX,
    ALPHABET,
    BAG_CODE_PREFIX,
    CODE_CHARS,
    new_account_code,
    new_bag_code,
)


class _FixedChoice:
    """Escolhedor determinístico: devolve os caracteres dados, pela ordem."""

    def __init__(self, chars: str) -> None:
        self.chars = chars
        self.i = 0

    def __call__(self, _alphabet: str) -> str:
        char = self.chars[self.i % len(self.chars)]
        self.i += 1
        return char


def test_bag_code_uses_prefix_and_readable_alphabet() -> None:
    rng = _FixedChoice("A2B3C4")
    assert new_bag_code(rng) == "NVL-A2B3C4"  # prefixo + 6 caracteres do alfabeto legível
    assert new_bag_code().startswith(BAG_CODE_PREFIX)  # geração real (secrets) não rebenta


def test_account_code_uses_its_own_prefix() -> None:
    rng = _FixedChoice("Z9Z9Z9")
    assert new_account_code(rng) == "NVA-Z9Z9Z9"
    assert BAG_CODE_PREFIX != ACCOUNT_CODE_PREFIX  # o scan distingue saco de conta pelo prefixo


def test_codes_have_the_right_shape() -> None:
    for code in (new_bag_code(), new_account_code()):
        body = code[4:]
        assert len(code) == 4 + CODE_CHARS
        assert all(char in ALPHABET for char in body)  # o corpo vem todo do alfabeto legível
        assert not any(char in "0O1IL" for char in body)
