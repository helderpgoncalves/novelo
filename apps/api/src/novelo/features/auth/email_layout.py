# ruff: noqa: E501
"""Esqueleto HTML/texto dos emails transacionais.

Tabelas com `role="presentation"`, CSS inline (com `<style>` só para dark mode e telemóvel), botão com
fallback VML para o Outlook para Windows e logótipo em PNG servido por HTTPS. Os textos vêm de `emails.py`.
"""

import textwrap
from dataclasses import dataclass, field
from html import escape

# Neutros de produto; o verde da marca (docs/marca/guia-de-marca.md) é a única cor de acento e só
# aparece no botão principal e nas ligações. Variantes escuras em `_STYLE_BLOCK`.
PAGE, CARD, INK, MUTED, BORDER, SOFT, ACCENT, ACCENT_DARK = (
    "#F6F7F6",
    "#FFFFFF",
    "#111917",
    "#5B6662",
    "#E3E6E4",
    "#FAFAF9",
    "#2E6B57",
    "#7FB39C",
)
_SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"
LOGO_WIDTH_PX = 120  # os PNG têm 264 px (@2x de 132): o navegador reduz com nitidez
WIDTH_PX = 580


@dataclass(frozen=True)
class Brand:
    app_url: str
    support_email: str

    @property
    def base(self) -> str:
        return self.app_url.rstrip("/")

    @property
    def logo_url(self) -> str:
        """Logótipo para fundo claro (wordmark escuro)."""
        return f"{self.base}/email/novelo-logotipo.png"

    @property
    def logo_dark_url(self) -> str:
        """Logótipo para fundo escuro, trocado por CSS no modo escuro."""
        return f"{self.base}/email/novelo-logotipo-negativo.png"


@dataclass(frozen=True)
class Chrome:
    """Textos fixos de cada idioma (rodapé, ligação alternativa)."""

    lang: str
    logo_alt: str
    fallback: str  # "Se o botão não funcionar, copia esta ligação para o navegador:"
    footer_project: str
    footer_help: str  # "Precisas de ajuda?"


@dataclass(frozen=True)
class Content:
    preheader: str
    eyebrow: str
    title: str
    paragraphs: list[str]
    cta_label: str
    url: str
    facts: list[tuple[str, str]] = field(default_factory=list)
    context_title: str = ""
    context: list[tuple[str, str]] = field(default_factory=list)  # IP, dispositivo (só se existirem)
    notice_title: str = ""
    notice: str = ""
    reason: str = ""
    bullets: list[str] = field(default_factory=list)


_STYLE_BLOCK = f"""
body,table,td,a{{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}}
table,td{{mso-table-lspace:0;mso-table-rspace:0;}}
img{{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;}}
a{{color:{ACCENT};}}
.logo-dark{{display:none;max-height:0;overflow:hidden;mso-hide:all;}}
@media only screen and (max-width:600px){{
  .px{{padding-left:24px !important;padding-right:24px !important;}}
  .btn-cell a{{display:block !important;box-sizing:border-box !important;text-align:center !important;}}
  .outer{{padding:24px 0 32px !important;}}
  .head{{padding-left:24px !important;}}
  .card{{border-radius:0 !important;border-left:0 !important;border-right:0 !important;}}
}}
@media (prefers-color-scheme:dark){{
  .bg-page{{background-color:#101412 !important;}}
  .bg-card{{background-color:#171C1A !important;border-color:#2A3230 !important;}}
  .bg-soft{{background-color:#1C2220 !important;border-color:#2A3230 !important;}}
  .tx{{color:#ECEFED !important;}}
  .tx-muted{{color:#A3ADA9 !important;}}
  .lnk{{color:{ACCENT_DARK} !important;}}
  .btn-a{{background-color:{ACCENT_DARK} !important;color:#0E1512 !important;border-color:{ACCENT_DARK} !important;}}
  .rule{{border-color:#2A3230 !important;}}
  .logo-light{{display:none !important;max-height:0 !important;}}
  .logo-dark{{display:block !important;max-height:none !important;overflow:visible !important;}}
}}
[data-ogsc] .tx{{color:#ECEFED !important;}}
[data-ogsc] .tx-muted{{color:#A3ADA9 !important;}}
[data-ogsc] .lnk{{color:{ACCENT_DARK} !important;}}
[data-ogsc] .btn-a{{color:#0E1512 !important;}}
[data-ogsb] .bg-page{{background-color:#101412 !important;}}
[data-ogsb] .bg-card{{background-color:#171C1A !important;}}
[data-ogsb] .bg-soft{{background-color:#1C2220 !important;}}
[data-ogsb] .btn-a{{background-color:{ACCENT_DARK} !important;}}
"""


def _button(label: str, url: str) -> str:
    label_h, url_h = escape(label), escape(url)
    width = max(200, len(label) * 9 + 56)
    return (
        f'<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" '
        f'href="{url_h}" style="height:46px;v-text-anchor:middle;width:{width}px;" arcsize="13%" strokecolor="{ACCENT}" fillcolor="{ACCENT}">'
        f'<w:anchorlock/><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">{label_h}</center>'
        f"</v:roundrect><![endif]-->"
        f"<!--[if !mso]><!-->"
        f'<a class="btn-a" href="{url_h}" target="_blank" style="display:inline-block;background-color:{ACCENT};color:#FFFFFF;'
        f"font-family:{_SANS};font-size:15px;line-height:20px;font-weight:600;text-decoration:none;padding:13px 28px;"
        f'border:1px solid {ACCENT};border-radius:6px;mso-hide:all;">{label_h}</a>'
        f"<!--<![endif]-->"
    )


def _rows(items: list[tuple[str, str]]) -> str:
    out = []
    for label, value in items:
        out.append(
            f'<tr><td class="tx-muted" style="font-family:{_SANS};font-size:14px;line-height:22px;color:{MUTED};padding:3px 20px 3px 0;white-space:nowrap;vertical-align:top;">{escape(label)}</td>'
            f'<td class="tx" style="font-family:{_SANS};font-size:14px;line-height:22px;color:{INK};padding:3px 0;vertical-align:top;">{escape(value)}</td></tr>'
        )
    return "".join(out)


def _box(items: list[tuple[str, str]], title: str = "") -> str:
    head = (
        f'<tr><td colspan="2" class="tx" style="font-family:{_SANS};font-size:13px;line-height:20px;font-weight:600;'
        f'color:{INK};padding:0 0 4px;">{escape(title)}</td></tr>'
        if title
        else ""
    )
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">'
        f'<tr><td class="bg-soft" style="background-color:{SOFT};border:1px solid {BORDER};border-radius:6px;padding:12px 16px;">'
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0">{head}{_rows(items)}</table></td></tr></table>'
    )


def render_html(c: Content, chrome: Chrome, brand: Brand) -> str:
    p_style = f"font-family:{_SANS};font-size:15px;line-height:24px;color:{INK};margin:0 0 16px;"
    paragraphs = "".join(f'<p class="tx" style="{p_style}">{escape(p)}</p>' for p in c.paragraphs)
    bullets = ""
    if c.bullets:
        items = "".join(
            f'<li class="tx" style="font-family:{_SANS};font-size:15px;line-height:24px;color:{INK};margin:0 0 4px;">{escape(b)}</li>'
            for b in c.bullets
        )
        bullets = f'<ul style="margin:0 0 16px;padding:0 0 0 20px;">{items}</ul>'
    facts = _box(c.facts) if c.facts else ""
    context = _box(c.context, c.context_title) if c.context else ""
    notice = (
        f'<p class="tx-muted" style="font-family:{_SANS};font-size:14px;line-height:22px;color:{MUTED};margin:0;">'
        f'<strong class="tx" style="font-weight:600;color:{INK};">{escape(c.notice_title)}</strong> {escape(c.notice)}</p>'
        if c.notice
        else ""
    )
    small = f"font-family:{_SANS};font-size:13px;line-height:20px;color:{MUTED};margin:0;"
    link = f'<a class="lnk" href="{escape(c.url)}" target="_blank" style="color:{ACCENT};text-decoration:underline;word-break:break-all;">{escape(c.url)}</a>'
    support = f'<a class="lnk" href="mailto:{escape(brand.support_email)}" style="color:{ACCENT};text-decoration:underline;">{escape(brand.support_email)}</a>'
    home = f'<a class="lnk" href="{escape(brand.base)}" target="_blank" style="color:{ACCENT};text-decoration:underline;">{escape(brand.base.split("://", 1)[-1])}</a>'
    eyebrow = (
        f'<p class="tx-muted" style="font-family:{_SANS};font-size:13px;line-height:20px;font-weight:600;color:{MUTED};margin:0 0 8px;">{escape(c.eyebrow)}</p>'
        if c.eyebrow
        else ""
    )
    pad = "&#847;&zwnj;&nbsp;" * 40  # impede que o corpo apareça a seguir ao preheader na lista da caixa de entrada
    logo_style = f"width:{LOGO_WIDTH_PX}px;max-width:100%;height:auto;border:0;font-family:{_SANS};font-size:18px;font-weight:600;color:{INK};"
    return f"""<!DOCTYPE html>
<html lang="{chrome.lang}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>{escape(c.title)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style type="text/css">{_STYLE_BLOCK}</style>
</head>
<body class="bg-page" style="margin:0;padding:0;background-color:{PAGE};word-spacing:normal;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:{PAGE};">{escape(c.preheader)}{pad}</div>
<table role="presentation" class="bg-page" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:{PAGE};">
<tr><td class="outer" align="center" style="padding:40px 12px 48px;">
<table role="presentation" width="{WIDTH_PX}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:{WIDTH_PX}px;">
<tr><td class="head" style="padding:0 0 20px 4px;">
<a href="{escape(brand.base)}" target="_blank" style="text-decoration:none;"><img class="logo-light" src="{escape(brand.logo_url)}" width="{LOGO_WIDTH_PX}" alt="{escape(chrome.logo_alt)}" style="display:block;{logo_style}"><img class="logo-dark" src="{escape(brand.logo_dark_url)}" width="{LOGO_WIDTH_PX}" alt="" style="display:none;{logo_style}"></a>
</td></tr>
<tr><td class="card bg-card" style="background-color:{CARD};border:1px solid {BORDER};border-radius:8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td class="px" style="padding:36px 40px 0;">
{eyebrow}
<h1 class="tx" style="font-family:{_SANS};font-size:24px;line-height:32px;font-weight:600;color:{INK};margin:0 0 16px;">{escape(c.title)}</h1>
{paragraphs}{bullets}
</td></tr>
<tr><td class="px" style="padding:8px 40px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td class="btn-cell" align="left" style="padding:0 0 28px;">{_button(c.cta_label, c.url)}</td></tr></table>
{facts}
</td></tr>
<tr><td class="px" style="padding:0 40px 36px;">
<p class="tx-muted" style="{small}margin-bottom:4px;">{escape(chrome.fallback)}</p>
<p style="{small}margin-bottom:24px;">{link}</p>
{context}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="rule" style="border-top:1px solid {BORDER};padding:20px 0 0;">{notice}</td></tr></table>
</td></tr>
</table>
</td></tr>
<tr><td class="px" style="padding:20px 4px 0;">
<p class="tx-muted" style="{small}margin-bottom:6px;">{escape(c.reason)}</p>
<p class="tx-muted" style="{small}margin-bottom:6px;">{escape(chrome.footer_help)} {support}</p>
<p class="tx-muted" style="{small}">{escape(chrome.footer_project)} {home}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
"""


_ASCII_PUNCT = str.maketrans(
    {
        "“": '"',
        "”": '"',
        "«": '"',
        "»": '"',
        "‘": "'",
        "’": "'",
        "–": "-",
        "—": "-",
        "·": "-",
        "…": "...",
        "\u00a0": " ",
    }
)


def _plain(text: str) -> str:
    """Pontuação tipográfica para ASCII (acentos mantêm-se): o texto simples tem de ler-se em qualquer cliente."""
    return text.translate(_ASCII_PUNCT)


def _wrap(text: str) -> str:
    return textwrap.fill(text, width=72)


def render_text(c: Content, chrome: Chrome, brand: Brand) -> str:
    parts = [c.title]
    parts += [_wrap(p) for p in c.paragraphs]
    if c.bullets:
        parts.append(
            "\n".join(textwrap.fill(b, width=72, initial_indent="- ", subsequent_indent="  ") for b in c.bullets)
        )
    parts.append(f"{c.cta_label}:\n{c.url}")
    if c.facts:
        parts.append("\n".join(f"{k}: {v}" for k, v in c.facts))
    if c.context:
        parts.append(c.context_title + "\n" + "\n".join(f"{k}: {v}" for k, v in c.context))
    if c.notice:
        parts.append(_wrap(f"{c.notice_title} {c.notice}"))
    parts.append(
        f"--\n{_wrap(c.reason)}\n{chrome.footer_project}\n{chrome.footer_help} {brand.support_email} | {brand.base}"
    )
    return _plain("\n\n".join(parts)) + "\n"
