# ruff: noqa: PLR0911, PLR0912
"""Menções `@`: pesquisa tipada para o auto-completar e resolução no servidor para blocos de contexto verificados."""

import difflib
import json
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.core.errors import AppError, ForbiddenError, NotFoundError
from novelo.domain.vocab import Fibre
from novelo.features.copilot import pages
from novelo.features.copilot.schemas import (
    MentionGroup,
    MentionItem,
    MentionRef,
    MentionsOut,
    MentionType,
    ScenarioCard,
)
from novelo.features.copilot.tables import fold
from novelo.features.datasets.models import DataAlert, DataSource
from novelo.features.lots import service as lots
from novelo.features.lots.models import Lot
from novelo.features.municipal import service as municipal
from novelo.features.municipal.filters import SiteFilters
from novelo.features.network import service as network
from novelo.features.network.models import Circuit, Locality, Parish, Vehicle
from novelo.features.planning import service as planning
from novelo.features.reports.models import Report
from novelo.features.users.models import User

CANDIDATES = 300  # linhas por tipo carregadas para pontuar (as tabelas são pequenas)
FIBRE_LABELS = {
    "pt-PT": {"cotton": "Algodão", "wool": "Lã", "polyester": "Poliéster", "nylon": "Nylon", "viscose": "Viscose",
              "linen": "Linho", "acrylic": "Acrílico", "elastane": "Elastano", "silk": "Seda", "other": "Outra",
              "unknown": "Desconhecida"},
    "en": {"cotton": "Cotton", "wool": "Wool", "polyester": "Polyester", "nylon": "Nylon", "viscose": "Viscose",
           "linen": "Linen", "acrylic": "Acrylic", "elastane": "Elastane", "silk": "Silk", "other": "Other",
           "unknown": "Unknown"},
}  # fmt: skip


class MentionError(AppError):
    """Menção que o servidor não consegue resolver (a mensagem diz qual)."""

    status_code = 404
    code = "not_found"


@dataclass
class ResolvedMention:
    ref: MentionRef
    label: str
    facts: dict[str, Any]
    card: ScenarioCard | None = None
    detail: str = ""

    def block(self) -> str:
        return f"[{self.ref.type.value} «{self.label}»] " + json.dumps(self.facts, ensure_ascii=False, default=str)


@dataclass
class _Candidate:
    item: MentionItem
    haystack: list[str] = field(default_factory=list)


def score(query: str, text: str) -> float:
    """4 igual, 3 prefixo, 2 prefixo de palavra, 1 contém, <1 aproximado (sem acentos nem maiúsculas)."""
    q, t = fold(query), fold(text)
    if not q:
        return 0.0
    if t == q:
        return 4.0
    if t.startswith(q):
        return 3.0
    words = t.replace("-", " ").split()
    if any(w.startswith(q) for w in words):
        return 2.0
    if q in t:
        return 1.0
    best = max((difflib.SequenceMatcher(None, q, w).ratio() for w in words), default=0.0)
    return best * 0.9 if best >= 0.75 else 0.0


def _num(value: float | None, digits: int, pt: bool) -> str:
    if value is None:
        return "n/d"
    text = f"{value:,.{digits}f}"
    return text.replace(",", " ").replace(".", ",") if pt else text


async def _candidates(db: AsyncSession, user: User, kind: MentionType, locale: str, q: str = "") -> list[_Candidate]:
    pt = locale != "en"
    out: list[_Candidate] = []

    def add(id_: str, label: str, sub: str | None, icon: str, route: str | None, *extra: str) -> None:
        item = MentionItem(id=id_, type=kind, label=label, sublabel=sub, icon=icon, route=route)
        out.append(_Candidate(item, [label, *extra]))

    if kind == MentionType.SCENARIO:
        for sc in await planning.list_scenarios(db, CANDIDATES):
            sub = f"{_num(sc.eur_per_tonne, 1, pt)} €/t · {_num(sc.tonnes_year, 1, pt)} t/{'ano' if pt else 'yr'}"
            add(str(sc.id), sc.label, sub, "layers", f"/scenarios/{sc.id}")
    elif kind == MentionType.PARISH:
        for pa in (await db.execute(select(Parish).order_by(Parish.name))).scalars():
            psub = f"{_num(float(pa.population), 0, pt)} {'hab.' if pt else 'inhab.'}" if pa.population else None
            add(pa.dicofre, pa.name, psub, "map-pin", None, pa.dicofre)
    elif kind == MentionType.CIRCUIT:
        for ci in (await db.execute(select(Circuit).order_by(Circuit.code))).scalars():
            add(ci.code, ci.code, f"{ci.typology.value} · {ci.collection_type.value}", "route", "/circuits")
    elif kind == MentionType.LOCALITY:
        for lo in (await db.execute(select(Locality).order_by(Locality.name))).scalars():
            add(lo.name, lo.name, None, "map-pin", "/localities")
    elif kind == MentionType.VEHICLE:
        for ve in (await db.execute(select(Vehicle).order_by(Vehicle.plate))).scalars():
            add(ve.plate, ve.plate, ve.note, "truck", "/fleet")
    elif kind == MentionType.LOT:
        for lt in (await db.execute(select(Lot).order_by(Lot.created_at.desc()).limit(CANDIDATES))).scalars():
            add(lt.code, lt.code, f"{lt.state.value} · {lt.dominant_fibre.value}", "package", f"/lots/{lt.code}")
    elif kind == MentionType.ALERT:
        aq = select(DataAlert).order_by(DataAlert.number).limit(CANDIDATES)
        for al in (await db.execute(aq)).scalars():
            add(
                str(al.id),
                f"#{al.number} {al.kind.value}",
                al.detail[:90],
                "triangle-alert",
                "/data-quality",
                al.detail,
            )
    elif kind == MentionType.REPORT:
        rq = select(Report.id, Report.title, Report.created_at).order_by(Report.created_at.desc()).limit(CANDIDATES)
        for rid, title, created in (await db.execute(rq)).all():
            add(str(rid), title, created.strftime("%d/%m/%Y"), "file-text", "/reports")
    elif kind == MentionType.BRAND:
        for br in (await lots.brands(db)).brands:
            add(br.brand, br.brand, f"{br.items} {'peças' if pt else 'items'}", "tag", "/lots?tab=brands")
    elif kind == MentionType.FIBRE:
        for f in Fibre:
            add(
                f.value,
                FIBRE_LABELS[locale if locale in FIBRE_LABELS else "pt-PT"][f.value],
                f.value,
                "shirt",
                "/lots?tab=market",
                f.value,
            )
    elif kind == MentionType.MUNICIPAL_SITE:
        # 2 026 locais: pesquisa-se na base de dados (id, ruas, freguesia; nunca nomes de produtores)
        page = await municipal.list_sites(db, SiteFilters(q=q or None), limit=CANDIDATES, cursor=None, names=False)
        for site in page.items:
            street = site.streets[0] if site.streets else ("produtor" if pt else "producer")
            where = site.parish_name or ""
            n = f"{site.containers} {'contentores' if pt else 'containers'}"
            add(
                site.site_id,
                f"{street} ({site.site_id})",
                f"{where} · {n}",
                "map-pin",
                None,
                site.site_id,
                *site.streets,
                where,
            )
    elif kind == MentionType.PAGE:
        for pg in pages.PAGES:
            if (pg.admin_only and user.role != "admin") or "$" in pg.route:
                continue
            add(pg.key, pg.label(locale), pg.route, pg.icon, pg.route, pg.pt, pg.en)
    else:
        for ds in (await db.execute(select(DataSource).order_by(DataSource.received_on.desc()))).scalars():
            add(ds.key, ds.title, ds.provider, "database", "/data-quality", ds.key)
    return out


async def search(
    db: AsyncSession, user: User, q: str, types: list[MentionType], limit: int, locale: str = "pt-PT"
) -> MentionsOut:
    wanted = types or list(MentionType)
    per_group = limit if len(wanted) == 1 else max(3, limit // 3)
    groups: list[MentionGroup] = []
    total = 0
    for kind in wanted:
        scored: list[tuple[float, int, MentionItem]] = []
        for pos, cand in enumerate(await _candidates(db, user, kind, locale, q)):
            s = max((score(q, h) for h in cand.haystack), default=0.0) if q.strip() else 1.0
            if s > 0:
                scored.append((s, -pos, cand.item))  # empate: ordem original (recentes primeiro nas listas por data)
        scored.sort(key=lambda t: (t[0], t[1]), reverse=True)
        items = [t[2] for t in scored[:per_group]]
        if items:
            groups.append(MentionGroup(type=kind, items=items))
            total += len(items)
    return MentionsOut(query=q, groups=groups, total=total)


# --- Resolução no servidor ---------------------------------------------------------------------------


def _missing(ref: MentionRef) -> MentionError:
    return MentionError(f"Mention not found: {ref.type.value} '{ref.id[:60]}'")


async def resolve(db: AsyncSession, user: User, ref: MentionRef, locale: str = "pt-PT") -> ResolvedMention:
    """Dados reais da entidade. O texto da menção que o cliente mostra nunca entra no prompt."""
    from novelo.features.copilot.tools import _card, scenario_facts  # noqa: PLC0415  (evita import circular)

    kind = ref.type
    if kind == MentionType.SCENARIO:
        try:
            s = await planning.get_scenario(db, uuid.UUID(ref.id))
        except (ValueError, NotFoundError) as exc:
            raise _missing(ref) from exc
        facts = scenario_facts(s) | {"restricted_parishes": len(s.constraints), "solver_status": s.solver_status}
        return ResolvedMention(ref, s.label, facts, _card(s, created_now=False))
    if kind == MentionType.PARISH:
        p = (await db.execute(select(Parish).where(Parish.dicofre == ref.id))).scalar_one_or_none()
        if p is None:
            raise _missing(ref)
        pfacts: dict[str, Any] = {"code": p.dicofre, "population": p.population, "population_year": p.population_year,
                                 "tipau": p.tipau.value if p.tipau else None, "area_km2": float(p.area_km2) if p.area_km2 else None}  # fmt: skip
        try:  # rede municipal (outras frações): só se já foi importada
            m = await municipal.get_parish(db, p.dicofre)
        except NotFoundError:
            m = None
        if m is not None:
            pfacts["municipal_network"] = {"containers": m.containers, "containers_per_1000_hab": m.containers_per_1000_hab,
                                          "public_sites": m.public_sites, "candidate_sites": m.candidate_sites,
                                          "textile_gap_t_estimate": m.textile_gap_t, "gap_rank_estimate": m.gap_rank}  # fmt: skip
        return ResolvedMention(ref, p.name, pfacts)
    if kind == MentionType.CIRCUIT:
        c = next((x for x in (await network.list_circuits(db)).circuits if x.code == ref.id), None)
        if c is None:
            raise _missing(ref)
        return ResolvedMention(ref, c.code, {"typology": c.typology.value, "collection_type": c.collection_type.value, "status": c.status.value,
                                             "days": c.days_text, "localities": c.localities[:12], "vehicles": c.vehicles})  # fmt: skip
    if kind == MentionType.LOCALITY:
        lo = next((x for x in await network.list_localities(db) if fold(x.name) == fold(ref.id)), None)
        if lo is None:
            raise _missing(ref)
        return ResolvedMention(
            ref, lo.name, {"parish_code": lo.parish_code, "circuits": lo.circuits, "days_per_week": lo.days_per_week}
        )
    if kind == MentionType.VEHICLE:
        v = next((x for x in (await network.get_fleet(db)).vehicles if x.plate == ref.id), None)
        if v is None:
            raise _missing(ref)
        return ResolvedMention(
            ref, v.plate, {"circuits": v.circuits, "assignments": v.assignments, "never_assigned": v.never_assigned}
        )
    if kind == MentionType.LOT:
        try:
            lot = await lots.get_lot(db, ref.id)
        except NotFoundError as exc:
            raise _missing(ref) from exc
        return ResolvedMention(ref, lot.code, {"state": lot.state.value, "dominant_fibre": lot.dominant_fibre.value, "items": lot.items,
                                               "weight_kg": lot.weight_kg, "parish": lot.parish_name})  # fmt: skip
    return await _resolve_other(db, user, ref, locale)


async def _resolve_other(db: AsyncSession, user: User, ref: MentionRef, locale: str) -> ResolvedMention:
    kind = ref.type
    if kind == MentionType.MUNICIPAL_SITE:
        try:
            d = await municipal.get_site(db, ref.id, radius_m=municipal.DEFAULT_NEIGHBOUR_RADIUS_M, names=False)
        except NotFoundError as exc:
            raise _missing(ref) from exc
        s = d.site
        label = s.streets[0] if s.streets else s.site_id
        return ResolvedMention(ref, label, {"network": "municipal (not textile)", "site_id": s.site_id, "parish": s.parish_name, "site_class": s.site_class.value,
                                            "containers": s.containers, "kinds": [k.value for k in s.kinds], "textile_candidate": s.textile_candidate,
                                            "candidate_reason": s.candidate_reason, "coord_precision": s.coord_precision.value, "nn_distance_m": s.nn_distance_m,
                                            "neighbours_within_200m": len(d.neighbours)})  # fmt: skip
    if kind in {MentionType.ALERT, MentionType.REPORT}:
        try:
            key = uuid.UUID(ref.id)
        except ValueError as exc:
            raise _missing(ref) from exc
        if kind == MentionType.ALERT:
            a = await db.get(DataAlert, key)
            if a is None:
                raise _missing(ref)
            return ResolvedMention(ref, f"#{a.number}", {"kind": a.kind.value, "detail": a.detail[:400], "suggestion": a.suggestion[:300], "status": a.status.value})  # fmt: skip
        r = await db.get(Report, key)
        if r is None:
            raise _missing(ref)
        return ResolvedMention(
            ref,
            r.title,
            {"locale": r.locale, "scenarios": len(r.scenario_ids), "created": r.created_at.date().isoformat()},
        )
    if kind == MentionType.BRAND:
        b = next((x for x in (await lots.brands(db)).brands if fold(x.brand) == fold(ref.id)), None)
        if b is None:
            raise _missing(ref)
        return ResolvedMention(
            ref,
            b.brand,
            {"items": b.items, "weight_kg": b.weight_kg, "top_fibre": b.top_fibre.value, "share_pct": b.share_pct},
        )
    if kind == MentionType.FIBRE:
        if ref.id not in {f.value for f in Fibre}:
            raise _missing(ref)
        entry = next((m for m in await lots.market(db, Fibre(ref.id)) if m.fibre.value == ref.id), None)
        return ResolvedMention(
            ref, ref.id, {"lots_on_market": entry.lots if entry else 0, "weight_kg": entry.weight_kg if entry else 0}
        )
    if kind == MentionType.PAGE:
        page = pages.BY_KEY.get(ref.id)
        if page is None:
            raise _missing(ref)
        if page.admin_only and user.role != "admin":
            raise ForbiddenError("This screen is only available to administrators")
        return ResolvedMention(ref, page.label(locale), {"route": page.route})
    src = (await db.execute(select(DataSource).where(DataSource.key == ref.id))).scalar_one_or_none()
    if src is None:
        raise _missing(ref)
    return ResolvedMention(ref, src.title, {"provider": src.provider, "file": src.file_name,
                                            "period": f"{src.period_start} – {src.period_end}" if src.period_start else None})  # fmt: skip
