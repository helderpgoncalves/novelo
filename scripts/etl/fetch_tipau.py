# /// script
# requires-python = ">=3.12"
# dependencies = ["httpx>=0.28"]
# ///
"""Tipologia de Áreas Urbanas (TIPAU, INE) de cada freguesia de Guimarães, lida da Wikipédia.

A tabela "Freguesias e organização administrativa de Guimarães" traz a classificação do INE (APU, AMU ou APR) ao lado
de cada freguesia (e, nas uniões, a da união). Guarda-se em data/raw/public/tipau.json, versionado, para o ETL ser
reproduzível. Uso: `uv run scripts/etl/fetch_tipau.py`.
"""

import json
import re
import unicodedata
from pathlib import Path

import httpx

OUT = Path(__file__).resolve().parents[2] / "data" / "raw" / "public" / "tipau.json"
UA = "novelo-hackathon/1.0 (https://novelo.helder.si; helderpimentaxc@gmail.com)"
PAGE = 862035  # "Freguesias e organização administrativa de Guimarães"


def norm(text: str) -> str:
    plain = "".join(c for c in unicodedata.normalize("NFD", text.lower()) if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", plain).strip()


def main() -> None:
    resp = httpx.get(
        "https://pt.wikipedia.org/w/api.php",
        params={"action": "parse", "pageid": PAGE, "prop": "wikitext", "format": "json"},
        headers={"User-Agent": UA},
        timeout=40,
    )
    wikitext = resp.json()["parse"]["wikitext"]["*"]
    result: dict[str, str] = {}
    for row in wikitext.split("\n|-"):
        classes = re.findall(r"\b(APU|AMU|APR)\b", row)
        links = re.findall(r"\[\[(?:Imagem:[^\]]*\]\]\s*)?\[?\[?([^\]|\[]+?)(?:\|[^\]]*)?\]\]", row)
        if not classes or not links:
            continue
        union = next((x for x in links if x.lower().startswith("união das freguesias")), None)
        if union:
            result[norm(union.replace("União das Freguesias de", "União das freguesias de"))] = classes[-1].lower()
            continue
        name = re.sub(r"\s*\(Guimarães\)", "", links[0])
        result.setdefault(norm(name), classes[0].lower())
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1))
    print(f"TIPAU: {len(result)} freguesias e uniões")


if __name__ == "__main__":
    main()
