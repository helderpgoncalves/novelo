#!/usr/bin/env python3
"""Seed de demonstração: cenários, triagens com fotografias reais, lotes com miniaturas, reservas e histórico.

Cria, pela API real (todas as validações valem), 6 lotes com 24 peças a partir de fotografias reais da Wikimedia
Commons (só CC0, domínio público, CC BY e CC BY-SA; autor e licença seguem como crédito de cada miniatura) e os
cenários de demonstração (rótulo `Demo · `). A triagem usa o modelo de visão a sério (uns cêntimos): a composição
vem da etiqueta quando a foto a mostra e, nas restantes peças, é a que o operador confirma (pressuposto de
demonstração, documentado em docs/engenharia/rotas-reais.md e privacidade-fotografias.md). Depois espalha as datas do
histórico por vários dias (SQL), para o passaporte parecer o de um lote real.

Corre DENTRO do contentor da API (usa o código da aplicação para criar o token de um administrador; nada de segredos
sai do contentor). Dry-run por omissão:

  docker exec -i <api> python - --yes < scripts/seed/demo_seed.py
  docker exec -i <api> python - --cleanup MANIFEST.json --yes < scripts/seed/demo_seed.py

Opções: --yes (escreve), --skip-scenarios, --skip-lots, --offline-triage (SÓ desenvolvimento, sem chave de IA: análise
neutra em vez de chamar o modelo), --cleanup FICHEIRO (apaga o que um manifesto anterior criou).
Escreve o manifesto de cada execução em /tmp/demo_seed_manifest.json e imprime-o no fim.
"""

import asyncio
import json
import os
import sys
import time
import urllib.parse
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
from sqlalchemy import text

from novelo.core.database import engine
from novelo.core.security import create_access_token
from novelo.features.auth.cookies import ACCESS_COOKIE, cookie_name

BASE = os.environ.get("NOVELO_API_BASE", "http://127.0.0.1:8000/api/v1")
UA = {"User-Agent": "novelo-demo-seed/1.0 (https://novelo.helder.si; contacto-removido)"}
CACHE = Path("/tmp/demo_photos")
YES = "--yes" in sys.argv
ARGS = sys.argv[1:]

# (ficheiro no Commons, autor, licença). Autor e licença verificados na API do Commons a 23 out 2026.
PHOTOS: dict[str, tuple[str, str, str]] = {
    "b072": ("Vintage 90's Lacoste Polo Shirt.jpg", "Quercus acuta", "CC BY-SA 4.0"),
    "b064": ("Fumarel piqué polo shirt.jpg", "Fumarel1987", "CC0"),
    "b030": ("ANSOL.org t-shirt.jpg", "Mind Booster Noori", "CC0"),
    "b312": ("Womens orvis shirt white.jpg", "Punker1999", "CC0"),
    "b302": ("Clean-blank-shirt-hanger.jpg", "Pajju12", "CC BY-SA 4.0"),
    "b085": ("Green Aran Sweater.JPG", "Smee", "Domínio público"),
    "b083": ("Aran cardigan.jpg", "Lisa Dusseault", "CC BY 2.0"),
    "b076": ("Navy Wooly-Pully.JPG", "Peter Ellis", "CC BY-SA 2.5"),
    "b332": ("Ralph Lauren wool scarf.jpg", "Amin", "CC BY-SA 4.0"),
    "b291": ("Pure new wool label on secondhand coat.jpg", "MAKY.OREL", "CC0"),
    "a030": ("Jean jacket.jpg", "NikosLikomitros", "CC0"),
    "a017": ("Jeans MET 1978.175.3 B.jpg", "Levi Strauss & Co.", "CC0"),
    "a076": ("Men's trousers inside out.jpg", "Kotivalo", "CC0"),
    "b234": (
        "Clothing tag on Navy Issued Jacket, Cold Weather, Permeable built by the Vanderbilt Shirt Company.jpg",
        "ArmyParatrooper436",
        "CC BY-SA 4.0",
    ),
    "b184": ("Bed sheet.JPG", "Mattes", "Domínio público"),
    "b187": ("Fitted sheet.jpg", "The Sleep Judge", "CC BY 2.0"),
    "b205": ("One big towel beside a smaller towel.jpg", "Toad40", "CC BY-SA 4.0"),
    "b212": ("Zusammengelegte Handtücher.jpg", "Mattes", "Domínio público"),
    "b146": ("Hoodie m7agar.jpg", "YoussefTahoun", "CC0"),
    "b150": ("Sudadera urban.jpg", "Davidcanogomez", "CC BY-SA 3.0"),
    "b077": ("Seaman jumper.JPG", "Peter Ellis", "CC BY-SA 2.5"),
    "b328": ("Alpaca wool scarf.JPG", "Deryck Chan", "CC BY-SA 3.0"),
    "b037": ("Seamless black T-shirt bra, label.jpg", "DimiTalen", "CC0"),
    "b239": ("Tag of a Muji clothing product in the UK 01.jpg", "Tbatb", "CC BY-SA 4.0"),
}

# Item: foto, tipo de peça, estado, composição CONFIRMADA pelo operador (None = a que a etiqueta deu ao modelo),
# marca (None = a que o modelo leu). `label` = a foto é só da etiqueta (composição lida pelo modelo).
Item = dict[str, object]
LOTS: list[dict[str, object]] = [
    {
        "name": "Camisas e polos de algodão",
        "parish": "030813",  # Creixomil
        "opened_days_ago": 14,
        "final": "delivered",
        "items": [
            {"p": "b072", "g": "shirt", "c": [("cotton", 100)], "brand": "Lacoste"},
            {"p": "b064", "g": "shirt", "c": [("cotton", 100)], "brand": "FUMAREL"},
            {"p": "b030", "g": "tshirt", "c": [("cotton", 100)]},
            {"p": "b312", "g": "shirt", "c": [("polyester", 100)]},
            {"p": "b302", "g": "tshirt", "c": [("cotton", 95), ("elastane", 5)]},
        ],
        "reservation": ("Fiação do Ave (demonstração)", "demo@example.org", "Entrega de teste do Vale do Ave."),
    },
    {
        "name": "Lã e malhas",
        "parish": "030804",  # Azurém
        "opened_days_ago": 10,
        "final": "reserved",
        "items": [
            {"p": "b085", "g": "jumper", "c": [("wool", 100)], "brand": "Carraig Donn"},
            {"p": "b083", "g": "jumper", "c": [("wool", 100)]},
            {"p": "b076", "g": "jumper", "c": [("wool", 100)]},
            {"p": "b332", "g": "other", "c": None},  # a etiqueta da peça foi lida pelo modelo (100% lã)
            {"p": "b291", "g": "jacket", "c": [("wool", 100)], "brand": "Edinburgh"},
        ],
        "reservation": (
            "Reciclagem de Lã do Ave (demonstração)",
            "demo@example.org",
            "Interesse em lã para fio reciclado.",
        ),
    },
    {
        "name": "Denim e calças",
        "parish": "030838",  # Ponte
        "opened_days_ago": 7,
        "final": "sorted",
        "items": [
            {"p": "a030", "g": "jacket", "c": [("cotton", 100)]},
            {"p": "a017", "g": "trousers", "c": [("cotton", 100)]},
            {"p": "a076", "g": "trousers", "c": [("polyester", 65), ("cotton", 35)], "cond": "recycle"},
            {"p": "b234", "g": "jacket", "c": None},
        ],
    },
    {
        "name": "Roupa de casa",
        "parish": "030837",  # Polvoreira
        "opened_days_ago": 16,
        "final": "delivered",
        "items": [
            {"p": "b184", "g": "bedding", "c": [("cotton", 100)]},
            {"p": "b187", "g": "bedding", "c": [("cotton", 100)]},
            {"p": "b205", "g": "towel", "c": [("cotton", 100)], "cond": "recycle"},
            {"p": "b212", "g": "towel", "c": [("cotton", 100)]},
        ],
        "reservation": ("Têxteis Circulares do Vale (demonstração)", "demo@example.org", "Lote de roupa de casa."),
    },
    {
        "name": "Hoodies, lã e cachecóis",
        "parish": "030865",  # São Torcato
        "opened_days_ago": 5,
        "final": "reserved",
        "items": [
            {"p": "b146", "g": "jumper", "c": [("cotton", 80), ("polyester", 20)]},
            {"p": "b150", "g": "jumper", "c": [("cotton", 80), ("polyester", 20)]},
            {"p": "b077", "g": "jumper", "c": [("wool", 100)]},
            {"p": "b328", "g": "other", "c": [("wool", 100)]},
        ],
        "reservation": ("Fibras do Minho (demonstração)", "demo@example.org", "Mistura de algodão e lã."),
    },
    {
        "name": "Lote em curso (etiquetas lidas pelo modelo)",
        "parish": "030840",  # Ronfe
        "opened_days_ago": 1,
        "final": "collected",
        "items": [
            {"p": "b037", "g": "other", "c": None, "label": True},
            {"p": "b239", "g": "other", "c": None, "label": True},
        ],
    },
]

SCENARIOS: list[tuple[str, dict[str, object], str | None]] = [
    ("p40", dict(label="Demo · Por freguesia · 40 000 €/ano", objective="max_tonnes", budget_eur_year=40000, siting="parish"), None),
    ("p90", dict(label="Demo · Por freguesia · 90 000 €/ano", objective="max_tonnes", budget_eur_year=90000, siting="parish"), "p40"),
    ("pmin", dict(label="Demo · Por freguesia · custo mínimo · meta 350 t", objective="min_cost", target_tonnes=350, siting="parish"), None),
    ("s50", dict(label="Demo · Locais reais · 50 000 €/ano", objective="max_tonnes", budget_eur_year=50000, siting="sites", site_radius_m=300), None),
    ("s50r", dict(label="Demo · Locais reais · raio 500 m · 50 000 €/ano", objective="max_tonnes", budget_eur_year=50000, siting="sites", site_radius_m=500), "s50"),
    ("sesc", dict(label="Demo · Pontos assistidos (escolas) · 30 000 €/ano", objective="max_tonnes", budget_eur_year=30000, siting="sites", site_candidates="staffed"), None),
    ("smin", dict(label="Demo · Locais reais · custo mínimo · meta 250 t", objective="min_cost", target_tonnes=250, siting="sites", site_radius_m=300), None),
]  # fmt: skip


def credit_of(key: str) -> str:
    _, author, licence = PHOTOS[key]
    return f"{author}, {licence}, Wikimedia Commons"


async def client() -> httpx.AsyncClient:
    async with engine.connect() as c:
        row = (
            await c.execute(
                text("select id, role from users where role='admin' and is_active order by created_at limit 1")
            )
        ).one()
    token = create_access_token(row[0], row[1])
    return httpx.AsyncClient(base_url=BASE, headers={"Cookie": f"{cookie_name(ACCESS_COOKIE)}={token}"}, timeout=240)


def download(key: str) -> bytes:
    CACHE.mkdir(exist_ok=True)
    path = CACHE / f"{key}.jpg"
    if path.exists() and path.stat().st_size > 5_000:
        return path.read_bytes()
    title = PHOTOS[key][0]
    url = "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(title) + "?width=1024"
    for attempt in range(5):
        r = httpx.get(url, headers=UA, follow_redirects=True, timeout=60)
        if r.status_code == 200 and r.content[:3] == b"\xff\xd8\xff":
            path.write_bytes(r.content)
            return r.content
        time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"Não consegui descarregar {title}: {r.status_code}")


async def seed_lots(c: httpx.AsyncClient, manifest: dict[str, object]) -> None:
    lots_out: list[dict[str, object]] = []
    manifest["lots"] = lots_out
    for spec in LOTS:
        r = await c.post("/lots", json={"parish_code": spec["parish"]})
        r.raise_for_status()
        code = r.json()["code"]
        out: dict[str, object] = {"code": code, "name": spec["name"], "final": spec["final"], "items": []}
        lots_out.append(out)
        print(f"\nLote {code} · {spec['name']} ({spec['parish']})", flush=True)
        for it in spec["items"]:  # type: ignore[attr-defined]
            key = str(it["p"])
            data = download(key)
            if "--offline-triage" in ARGS:  # desenvolvimento: sem modelo, a composição vem toda do operador
                t = {
                    "analysis": {"condition": "reuse", "composition": [{"fibre": "unknown", "pct": 100}], "brand": None, "confidence": 0.5},
                    "estimated_weight_g": {"shirt": 200, "tshirt": 150, "trousers": 450, "jumper": 400, "jacket": 700, "bedding": 900, "towel": 500}.get(str(it["g"]), 300),
                    "prompt_version": "offline", "model": "offline",
                }  # fmt: skip
            else:
                tri = await c.post(
                    "/triage", files={"item_photo": (f"{key}.jpg", data, "image/jpeg")}, data={"locale": "pt-PT"}
                )
                tri.raise_for_status()
                t = tri.json()
            a = t["analysis"]
            composition = (
                [{"fibre": f, "pct": p} for f, p in it["c"]] if it.get("c") else a["composition"]  # type: ignore[union-attr]
            )
            body = {
                "garment_type": it["g"],
                "condition": it.get("cond") or a["condition"],
                "composition": composition,
                "brand": it.get("brand") or a.get("brand"),
                "estimated_weight_g": t["estimated_weight_g"],
                "confidence": a["confidence"],
                "prompt_version": t["prompt_version"],
            }
            added = await c.post(f"/lots/{code}/items", json=body)
            added.raise_for_status()
            item_id = added.json()["id"]
            up = await c.put(
                f"/lots/{code}/items/{item_id}/photo",
                files={"photo": (f"{key}.jpg", data, "image/jpeg")},
                data={"confirm_no_people": "true", "credit": credit_of(key)},
            )
            up.raise_for_status()
            print(
                f"  {key}: {body['garment_type']:8} {body['condition']:8} {composition} {body['brand']} (modelo: {a['confidence']})",
                flush=True,
            )
            out["items"].append({"photo": key, "id": item_id, "triage_model": t["model"]})  # type: ignore[attr-defined]
            await asyncio.sleep(1.5)
        final = str(spec["final"])
        if final in ("sorted", "reserved", "delivered"):
            (await c.post(f"/lots/{code}/state", json={"state": "sorted"})).raise_for_status()
        if final in ("reserved", "delivered") and spec.get("reservation"):
            name, contact, note = spec["reservation"]  # type: ignore[misc]
            (
                await c.post(f"/market/{code}/reserve", json={"recycler_name": name, "contact": contact, "note": note})
            ).raise_for_status()
        if final == "delivered":
            (await c.post(f"/lots/{code}/state", json={"state": "delivered"})).raise_for_status()
    await backdate(lots_out)


async def backdate(lots_out: list[dict[str, object]]) -> None:
    """Espalha o histórico pelos dias: aberto de manhã, peças a seguir, triado no dia seguinte, reserva, entrega."""
    now = datetime.now(UTC)
    async with engine.begin() as c:
        retention = (
            await c.execute(
                text("select coalesce(max(expires_at - created_at), interval '90 days') from lot_item_photos")
            )
        ).scalar_one()
        for out, spec in zip(lots_out, LOTS, strict=True):
            t0 = (now - timedelta(days=int(spec["opened_days_ago"]))).replace(
                hour=9, minute=14, second=0, microsecond=0
            )  # type: ignore[call-overload]
            code = out["code"]
            lot_id = (await c.execute(text("select id from lots where code=:c"), {"c": code})).scalar_one()
            await c.execute(text("update lots set created_at=:t, updated_at=:t where id=:i"), {"t": t0, "i": lot_id})
            items = (
                (
                    await c.execute(
                        text("select id from lot_items where lot_id=:i order by created_at, id"), {"i": lot_id}
                    )
                )
                .scalars()
                .all()
            )
            for n, item_id in enumerate(items):
                ts = t0 + timedelta(minutes=6 * (n + 1) + 2 * n)
                await c.execute(
                    text("update lot_items set created_at=:t, updated_at=:t where id=:i"), {"t": ts, "i": item_id}
                )
                await c.execute(
                    text("update lot_item_photos set created_at=:t, consent_at=:t, expires_at=:e where item_id=:i"),
                    {"t": ts, "e": ts + retention, "i": item_id},
                )
            events = (
                await c.execute(
                    text("select id, kind from lot_events where lot_id=:i order by occurred_at, id"), {"i": lot_id}
                )
            ).all()
            added = 0
            for ev_id, kind in events:
                if kind == "opened":
                    ts = t0
                elif kind == "item_added":
                    ts = t0 + timedelta(minutes=6 * (added + 1) + 2 * added)
                    added += 1
                elif kind == "sorted":
                    ts = t0 + timedelta(hours=26, minutes=41)
                elif kind == "reserved":
                    ts = t0 + timedelta(days=2, hours=3, minutes=12)
                else:  # delivered
                    ts = t0 + timedelta(days=4, hours=1, minutes=5)
                await c.execute(
                    text("update lot_events set occurred_at=:t where id=:i"),
                    {"t": min(ts, now - timedelta(minutes=5)), "i": ev_id},
                )
            await c.execute(
                text("update lot_reservations set created_at=:t where lot_id=:i"),
                {"t": t0 + timedelta(days=2, hours=3, minutes=12), "i": lot_id},
            )


async def seed_scenarios(c: httpx.AsyncClient, manifest: dict[str, object]) -> None:
    ids: dict[str, str] = {}
    created: list[dict[str, object]] = []
    manifest["scenarios"] = created
    for key, body, parent in SCENARIOS:
        payload = dict(body)
        if parent:
            payload["parent_id"] = ids[parent]
        r = await c.post("/planning/scenarios", json=payload)
        if r.status_code >= 300:
            print("ERRO", key, r.status_code, r.text[:300], flush=True)
            continue
        j = r.json()
        ids[key] = j["id"]
        res = j["result"]
        print(
            f"{key}: {j['id']} {j['status']} routing={res.get('routing')} {res['kpis']['tonnes_year']} t {res['kpis']['annual_cost_eur']} €",
            flush=True,
        )
        created.append({"key": key, "id": j["id"], "label": payload["label"]})
        await asyncio.sleep(10)  # o limite de execuções do otimizador é por minuto


async def cleanup(path: str) -> None:
    manifest = json.loads(Path(path).read_text())
    codes = [lot["code"] for lot in manifest.get("lots", [])]
    ids = [s["id"] for s in reversed(manifest.get("scenarios", []))]  # filhos antes dos pais
    async with engine.begin() as c:
        n_lots = (await c.execute(text("select count(*) from lots where code = any(:c)"), {"c": codes})).scalar_one()
        n_sc = (
            await c.execute(
                text("select count(*) from scenarios where id::text = any(:i) and label like 'Demo · %'"), {"i": ids}
            )
        ).scalar_one()
        print(f"lotes: {n_lots}/{len(codes)}; cenários 'Demo · ': {n_sc}/{len(ids)}")
        if not YES:
            print("dry-run: nada apagado (usa --yes)")
            return
        await c.execute(text("delete from lots where code = any(:c)"), {"c": codes})
        for sid in ids:
            await c.execute(text("delete from scenarios where id::text = :i and label like 'Demo · %'"), {"i": sid})
    print("apagado")


async def main() -> None:
    if "--cleanup" in ARGS:
        await cleanup(ARGS[ARGS.index("--cleanup") + 1])
        return
    total = sum(len(lot["items"]) for lot in LOTS)  # type: ignore[arg-type]
    print(f"Plano: {len(LOTS)} lotes, {total} peças com fotografia real, {len(SCENARIOS)} cenários.")
    if not YES:
        print("dry-run: nada criado (usa --yes). Fotografias:")
        for key, (title, author, licence) in PHOTOS.items():
            print(f"  {key}: {title[:60]} | {author} | {licence}")
        return
    manifest: dict[str, object] = {"created_at": datetime.now(UTC).isoformat()}
    async with await client() as c:
        health = await c.get("/health")
        health.raise_for_status()
        if "--skip-lots" not in ARGS:
            await seed_lots(c, manifest)
        if "--skip-scenarios" not in ARGS:
            await seed_scenarios(c, manifest)
    Path("/tmp/demo_seed_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    print("\nMANIFESTO", json.dumps(manifest, ensure_ascii=False))


asyncio.run(main())
