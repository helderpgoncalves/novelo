# ruff: noqa: E501
"""Esqueleto HTML/texto dos emails transacionais.

Tabelas com `role="presentation"`, CSS inline (com `<style>` só para dark mode e telemóvel), botão com
fallback VML para o Outlook para Windows e logótipo em PNG servido por HTTPS. Os textos vêm de `emails.py`.
"""

import textwrap
from dataclasses import dataclass, field
from html import escape

# Paleta da marca (docs/marca/guia-de-marca.md) e variantes escuras.
LINHO, TINTA, FLORESTA, PEDRA, AREIA, LINHA, FLORESTA_CLARA = (
    "#F4F1EA",
    "#14211D",
    "#2E6B57",
    "#5E6B66",
    "#C4A06A",
    "#DCD5C8",
    "#7FB39C",
)
_SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"
_SERIF = "Georgia,'Times New Roman',Times,serif"
LOGO_WIDTH_PX = 132  # o PNG tem 264 px (@2x)


@dataclass(frozen=True)
class Brand:
    app_url: str
    support_email: str

    @property
    def base(self) -> str:
        return self.app_url.rstrip("/")

    @property
    def logo_url(self) -> str:
        return f"{self.base}/email/novelo-logotipo-negativo.png"


@dataclass(frozen=True)
class Chrome:
    """Textos fixos de cada idioma (rodapé, ligação alternativa)."""

    lang: str
    logo_alt: str
    fallback: str  # "Se o botão não funcionar, copia esta ligação para o navegador:"
    footer_project: str
    footer_team: str
    footer_help: str  # "Precisa de ajuda?"


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
a{{color:{FLORESTA};}}
@media only screen and (max-width:600px){{
  .px{{padding-left:24px !important;padding-right:24px !important;}}
  .h1{{font-size:26px !important;line-height:32px !important;}}
  .btn-cell a{{display:block !important;box-sizing:border-box !important;text-align:center !important;}}
  .outer{{padding:0 !important;}}
  .card{{border-radius:0 !important;border-left:0 !important;border-right:0 !important;}}
}}
@media (prefers-color-scheme:dark){{
  .bg-page{{background-color:#0C1512 !important;}}
  .bg-card{{background-color:#16251F !important;border-color:#2A3B35 !important;}}
  .bg-soft{{background-color:#1D2E28 !important;border-color:#2A3B35 !important;}}
  .tx{{color:#F4F1EA !important;}}
  .tx-muted{{color:#B4C0BB !important;}}
  .tx-eyebrow,.lnk{{color:{FLORESTA_CLARA} !important;}}
  .btn-a{{background-color:{FLORESTA_CLARA} !important;color:{TINTA} !important;border-color:{FLORESTA_CLARA} !important;}}
  .rule{{border-color:#2A3B35 !important;}}
}}
[data-ogsc] .tx{{color:#F4F1EA !important;}}
[data-ogsc] .tx-muted{{color:#B4C0BB !important;}}
[data-ogsc] .tx-eyebrow,[data-ogsc] .lnk{{color:{FLORESTA_CLARA} !important;}}
[data-ogsc] .btn-a{{color:{TINTA} !important;}}
[data-ogsb] .bg-page{{background-color:#0C1512 !important;}}
[data-ogsb] .bg-card{{background-color:#16251F !important;}}
[data-ogsb] .bg-soft{{background-color:#1D2E28 !important;}}
[data-ogsb] .btn-a{{background-color:{FLORESTA_CLARA} !important;}}
"""


def _button(label: str, url: str) -> str:
    label_h, url_h = escape(label), escape(url)
    width = max(220, len(label) * 11 + 64)
    return (
        f'<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" '
        f'href="{url_h}" style="height:48px;v-text-anchor:middle;width:{width}px;" arcsize="17%" strokecolor="{FLORESTA}" fillcolor="{FLORESTA}">'
        f'<w:anchorlock/><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">{label_h}</center>'
        f"</v:roundrect><![endif]-->"
        f"<!--[if !mso]><!-->"
        f'<a class="btn-a" href="{url_h}" target="_blank" style="display:inline-block;background-color:{FLORESTA};color:#FFFFFF;'
        f"font-family:{_SANS};font-size:16px;line-height:20px;font-weight:600;text-decoration:none;padding:14px 32px;"
        f'border:1px solid {FLORESTA};border-radius:8px;mso-hide:all;">{label_h}</a>'
        f"<!--<![endif]-->"
    )


def _rows(items: list[tuple[str, str]]) -> str:
    out = []
    for label, value in items:
        out.append(
            f'<tr><td class="tx-muted" style="font-family:{_SANS};font-size:14px;line-height:20px;color:{PEDRA};padding:3px 16px 3px 0;white-space:nowrap;vertical-align:top;">{escape(label)}</td>'
            f'<td class="tx" style="font-family:{_SANS};font-size:14px;line-height:20px;color:{TINTA};font-weight:600;padding:3px 0;vertical-align:top;">{escape(value)}</td></tr>'
        )
    return "".join(out)


def _box(items: list[tuple[str, str]], title: str = "") -> str:
    head = (
        f'<tr><td colspan="2" class="tx-eyebrow" style="font-family:{_SANS};font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.2px;'
        f'text-transform:uppercase;color:{FLORESTA};padding:0 0 6px;">{escape(title)}</td></tr>'
        if title
        else ""
    )
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">'
        f'<tr><td class="bg-soft" style="background-color:{LINHO};border:1px solid {LINHA};border-radius:8px;padding:14px 18px;">'
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0">{head}{_rows(items)}</table></td></tr></table>'
    )


def render_html(c: Content, chrome: Chrome, brand: Brand) -> str:
    p_style = f"font-family:{_SANS};font-size:16px;line-height:26px;color:{TINTA};margin:0 0 16px;"
    paragraphs = "".join(f'<p class="tx" style="{p_style}">{escape(p)}</p>' for p in c.paragraphs)
    bullets = ""
    if c.bullets:
        items = "".join(
            f'<li class="tx" style="font-family:{_SANS};font-size:16px;line-height:26px;color:{TINTA};margin:0 0 6px;">{escape(b)}</li>'
            for b in c.bullets
        )
        bullets = f'<ul style="margin:0 0 20px;padding:0 0 0 20px;">{items}</ul>'
    facts = _box(c.facts) if c.facts else ""
    context = _box(c.context, c.context_title) if c.context else ""
    notice = (
        f'<p class="tx-muted" style="font-family:{_SANS};font-size:14px;line-height:22px;color:{PEDRA};margin:0 0 8px;">'
        f'<strong class="tx" style="color:{TINTA};">{escape(c.notice_title)}</strong> {escape(c.notice)}</p>'
        if c.notice
        else ""
    )
    small = f"font-family:{_SANS};font-size:13px;line-height:20px;color:{PEDRA};margin:0;"
    link = f'<a class="lnk" href="{escape(c.url)}" target="_blank" style="color:{FLORESTA};text-decoration:underline;word-break:break-all;">{escape(c.url)}</a>'
    support = f'<a class="lnk" href="mailto:{escape(brand.support_email)}" style="color:{FLORESTA};text-decoration:underline;">{escape(brand.support_email)}</a>'
    home = f'<a class="lnk" href="{escape(brand.base)}" target="_blank" style="color:{FLORESTA};text-decoration:underline;">{escape(brand.base.split("://", 1)[-1])}</a>'
    pad = "&#847;&zwnj;&nbsp;" * 40  # impede que o corpo apareça a seguir ao preheader na lista da caixa de entrada
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
<body class="bg-page" style="margin:0;padding:0;background-color:{LINHO};word-spacing:normal;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:{LINHO};">{escape(c.preheader)}{pad}</div>
<table role="presentation" class="bg-page" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:{LINHO};">
<tr><td class="outer" align="center" style="padding:32px 12px 40px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
<tr><td class="card bg-card" style="background-color:#FFFFFF;border:1px solid {LINHA};border-radius:12px;overflow:hidden;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td class="px" bgcolor="{TINTA}" style="background-color:{TINTA};padding:26px 40px;border-bottom:3px solid {AREIA};">
<a href="{escape(brand.base)}" target="_blank" style="text-decoration:none;"><img src="{escape(brand.logo_url)}" width="{LOGO_WIDTH_PX}" alt="{escape(chrome.logo_alt)}" style="display:block;width:{LOGO_WIDTH_PX}px;max-width:100%;height:auto;border:0;color:{LINHO};font-family:{_SERIF};font-size:22px;"></a>
</td></tr>
<tr><td class="px" style="padding:40px 40px 8px;">
<p class="tx-eyebrow" style="font-family:{_SANS};font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:{FLORESTA};margin:0 0 12px;">{escape(c.eyebrow)}</p>
<h1 class="h1 tx" style="font-family:{_SERIF};font-size:30px;line-height:36px;font-weight:normal;color:{TINTA};margin:0 0 20px;">{escape(c.title)}</h1>
{paragraphs}{bullets}
</td></tr>
<tr><td class="px" style="padding:8px 40px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td class="btn-cell" align="left" style="padding:0 0 24px;">{_button(c.cta_label, c.url)}</td></tr></table>
{facts}
</td></tr>
<tr><td class="px" style="padding:0 40px 8px;">
<p class="tx-muted" style="{small}margin-bottom:6px;">{escape(chrome.fallback)}</p>
<p style="{small}margin-bottom:28px;">{link}</p>
{context}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="rule" style="border-top:1px solid {LINHA};padding:20px 0 0;">{notice}</td></tr></table>
</td></tr>
<tr><td style="font-size:0;line-height:0;height:32px;">&nbsp;</td></tr>
</table>
</td></tr>
</table>
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
<tr><td class="px" style="padding:24px 40px 0;">
<p class="tx-muted" style="{small}margin-bottom:8px;"><strong class="tx" style="color:{TINTA};">{escape(chrome.footer_project)}</strong><br>{escape(chrome.footer_team)}</p>
<p class="tx-muted" style="{small}margin-bottom:8px;">{escape(c.reason)}</p>
<p class="tx-muted" style="{small}">{escape(chrome.footer_help)} {support} &nbsp;&middot;&nbsp; {home}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
"""


def _wrap(text: str) -> str:
    return textwrap.fill(text, width=72)


def render_text(c: Content, chrome: Chrome, brand: Brand) -> str:
    parts = [f"NOVELO\n{c.eyebrow.upper()}", c.title]
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
        "--\n"
        f"{chrome.footer_project}\n{chrome.footer_team}\n{_wrap(c.reason)}\n"
        f"{chrome.footer_help} {brand.support_email} | {brand.base}"
    )
    return "\n\n".join(parts) + "\n"
