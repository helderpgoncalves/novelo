"""Emails transacionais: HTML bem formado, imagens com alt, links https, sem placeholders, escape, assunto curto."""

import re
from html.parser import HTMLParser

import pytest

from novelo.features.auth import emails
from novelo.features.auth.email_layout import Brand

BASE = "https://novelo.helder.si"
VOID = {"meta", "img", "br", "hr", "input", "link"}
EVIL = '<script>alert("x")</script> & "Ana"'


class _Collector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.stack: list[str] = []
        self.errors: list[str] = []
        self.imgs: list[dict[str, str | None]] = []
        self.links: list[str] = []
        self.tags: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.tags.append(tag)
        a = dict(attrs)
        if tag == "img":
            self.imgs.append(a)
        if tag == "a" and a.get("href"):
            self.links.append(a["href"] or "")
        if tag not in VOID:
            self.stack.append(tag)

    def handle_endtag(self, tag: str) -> None:
        if tag in VOID:
            return
        if not self.stack or self.stack[-1] != tag:
            self.errors.append(f"</{tag}> inesperado, aberto: {self.stack[-1:]}")
            return
        self.stack.pop()


@pytest.fixture(autouse=True)
def _brand(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(emails, "_brand", lambda: Brand(app_url=BASE, support_email="novelo@heldergoncalves.io"))


NAMES = ["verify-email", "password-reset", "magic-link", "guest-welcome"]


@pytest.mark.parametrize("name", NAMES)
@pytest.mark.parametrize("locale", ["pt-PT", "en"])
def test_email_quality(locale: str, name: str) -> None:
    subject, html, text = emails.sample_emails(locale)[name]
    parsed = _Collector()
    parsed.feed(re.sub(r"<!--.*?-->", "", html, flags=re.S))
    assert parsed.errors == [] and parsed.stack == []
    assert html.startswith("<!DOCTYPE html>") and f'lang="{locale}"' in html
    assert 'name="color-scheme"' in html and "prefers-color-scheme" in html
    assert parsed.imgs and all(i.get("alt") for i in parsed.imgs)
    assert all(str(i["src"]).startswith("https://") for i in parsed.imgs)
    https = [u for u in parsed.links if not u.startswith("mailto:")]
    assert https and all(u.startswith("https://") for u in https)
    for content in (html, text, subject):
        assert "{{" not in content and "}}" not in content
        assert not re.search(r"\{[a-z_]+\}", content)
    assert text.strip() and "<" not in text
    assert 0 < len(subject) <= 70


def test_name_is_escaped() -> None:
    for subject, html, _text in (
        emails.verify_email("pt-PT", f"{BASE}/x", EVIL, 48),
        emails.guest_welcome("en", EVIL, f"{BASE}/x"),
    ):
        assert "<script>" not in html and "&lt;script&gt;" in html
        assert "<script>" not in subject


def test_context_only_when_present() -> None:
    _, with_ctx, _ = emails.magic_link("pt-PT", f"{BASE}/x", 15, ip="1.2.3.4", device="Firefox")
    _, without, _ = emails.magic_link("pt-PT", f"{BASE}/x", 15)
    assert "1.2.3.4" in with_ctx and "Firefox" in with_ctx
    assert "1.2.3.4" not in without and "Endereço IP" not in without


def test_validity_and_singular() -> None:
    _, _, text = emails.password_reset("pt-PT", f"{BASE}/x", 1)
    assert "1 minuto" in text and "Uma só vez" in text
    _, _, text_en = emails.verify_email("en", f"{BASE}/x", None, 48)
    assert "48 hours" in text_en
