"""Calibração pela API: a retroalimentação da procura observada (spec #62, ADR captura anual é derivada).

A tabela de agregados (métrica × unidade × janela de 12 semanas) é a ÚNICA ponte entre os eventos e o
planeamento: recomputa-se ao recalcular um cenário (nunca agendada), o painel «Calibração» lê-a, e o
cenário fotografia a calibração que usou. Aqui testam-se os comportamentos observáveis: só lotes
medidos e partidos contam, a janela corta o que é velho (mas não o intervalo), o `q` nunca muda, os
pedidos nunca multiplicam kg, e apagar os eventos não muda o planeamento (só os agregados falam).

Números de referência da freguesia de teste (1 000 hab, 2 locais):
  D_z = 1 000 × 1,59583 × 12 = 19 149,96 kg/ano
  prior da taxa por local = 19 149,96 ÷ 2 ÷ 365 = 26,23227 kg/dia
  prior da captura = 0,25 × 0,6 = 0,15;  prior do kg por saco = 25 kg
  prior dos sacos por ronda = 19 149,96 × 0,15 ÷ 25 ÷ 26 = 4,41921
"""

import uuid
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.collection_requests.models import CollectionRequest
from novelo.features.lots.models import Lot, LotUnit
from novelo.features.network.models import Locality, Parish
from tests.api.test_collection_requests import citizen_body

P = "/api/v1"
CAL = f"{P}/calibration"


async def make_setup(session: AsyncSession) -> tuple[Parish, Locality, Locality]:
    """Freguesia de teste com 1 000 habitantes e dois locais (dados feitos à mão, isolados do seed)."""
    tag = uuid.uuid4().hex[:6]
    parish = Parish(dicofre=f"99{tag[:4]}", name=f"Calibração {tag}", population=1000)
    session.add(parish)
    await session.flush()
    l1 = Locality(name=f"Escola A {tag}", parish_id=parish.id)
    l2 = Locality(name=f"Escola B {tag}", parish_id=parish.id)
    session.add_all([l1, l2])
    await session.flush()
    return parish, l1, l2


async def measured_departure(
    c: httpx.AsyncClient, session: AsyncSession, locality_id: uuid.UUID, unit_g: list[int], *, days_ago: int
) -> str:
    """Um lote de paragem medido e fechado «há days_ago dias»: unidades pesadas + Partir + recuo no tempo."""
    code = (await c.post(f"{P}/lots/stops", json={"locality_id": str(locality_id)})).json()["code"]
    for i, grams in enumerate(unit_g):
        unit = (await c.post(f"{P}/lots/{code}/units", json={"bag_code": f"SACO-{days_ago}-{i}"})).json()
        await c.put(f"{P}/lots/{code}/units/{unit['id']}", json={"weight_g": grams})
    depart = await c.post(f"{P}/lots/{code}/departure")
    assert depart.status_code == 200, depart.text
    moment = datetime.now(UTC) - timedelta(days=days_ago)
    await session.execute(update(Lot).where(Lot.code == code).values(departed_at=moment, created_at=moment))
    await session.commit()
    return code


async def backdate_request(session: AsyncSession, request_id: str, moment: datetime) -> None:
    await session.execute(
        update(CollectionRequest).where(CollectionRequest.id == uuid.UUID(request_id)).values(created_at=moment)
    )
    await session.commit()


def row_of(rows: list[dict], metric: str, unit_code: str) -> dict:
    return next(r for r in rows if r["metric"] == metric and r["unit_code"] == unit_code)


async def new_scenario(c: httpx.AsyncClient, label: str) -> dict:
    resp = await c.post(
        f"{P}/planning/scenarios", json={"label": label, "objective": "max_tonnes", "budget_eur_year": 60000}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_scenario_creation_recomputes_the_aggregates(logged_in: httpx.AsyncClient, session: AsyncSession) -> None:
    parish, school_a, _ = await make_setup(session)
    # Três visitas à Escola A: 3,5 / 8 (4,2+3,8) / 2,8 kg com intervalos de 7 e 7 dias.
    # A 1.ª visita não tem anterior → sem amostra; as taxas são 8/7 = 1,142857 e 2,8/7 = 0,4 kg/dia;
    # mediana de duas amostras = média = 0,771429 kg/dia.
    await measured_departure(logged_in, session, school_a.id, [3500], days_ago=14)
    await measured_departure(logged_in, session, school_a.id, [4200, 3800], days_ago=7)
    await measured_departure(logged_in, session, school_a.id, [2800], days_ago=0)

    scenario = await new_scenario(logged_in, "C")
    body = (await logged_in.get(CAL)).json()
    assert body["window_weeks"] == 12
    assert body["computed_at"] is not None

    # Taxa de geração (kg/dia por local): n=2 intervalos, mediana 0,771429.
    prior = 1000 * 1.59583 * 12 / 2 / 365
    taxa = row_of(body["rows"], "generation_rate", str(school_a.id))
    assert taxa["scope"] == "local"
    assert taxa["n"] == 2
    assert taxa["observed"] == pytest.approx((8.0 / 7.0 + 2.8 / 7.0) / 2)
    assert taxa["prior"] == pytest.approx(prior, rel=1e-6)
    assert taxa["blended"] == pytest.approx((3 * prior + 2 * taxa["observed"]) / 5)  # k=4 (o prior pesa k−1)
    assert taxa["weight"] == pytest.approx(2 / 5)
    assert taxa["label"] == "estimativa·2"
    assert taxa["parish_code"] == parish.dicofre

    # Kg por saco: 4 unidades (2,8 / 3,5 / 3,8 / 4,2 kg) → mediana (3,5+3,8)/2 = 3,65; o agrupado do
    # concelho mistura com o prior 25: (4·25 + 4·3,65) ÷ 8 = 14,325; à 4.ª unidade empata (k=4).
    bags = row_of(body["rows"], "kg_per_bag", str(school_a.id))
    assert bags["n"] == 4 and bags["observed"] == pytest.approx(3.65)
    assert bags["label"] == "observado·4"
    pooled = row_of(body["rows"], "kg_per_bag", "concelho")
    assert pooled["n"] == 4
    assert pooled["blended"] == pytest.approx((3 * 25.0 + 4 * 3.65) / 7)  # 89,6 ÷ 7 = 12,8
    assert pooled["label"] == "observado·4"

    # Sacos por ronda na freguesia: 3 visitas em 3 semanas com 1, 2 e 1 sacos → mediana 1,0; n=3 semanas.
    per_round = row_of(body["rows"], "bags_per_round", parish.dicofre)
    assert per_round["n"] == 3 and per_round["observed"] == pytest.approx(1.0)
    assert per_round["prior"] == pytest.approx(1000 * 1.59583 * 12 * 0.15 / 25 / 26, rel=1e-6)  # 4,41921

    # Captura derivada: evidência 0,771429 kg/dia × 365 = 281,57 kg; c_obs = 281,57 ÷ 19 149,96 = 0,014703;
    # blend de freguesia k=8, n=2: (8·0,15 + 2·0,014703) ÷ 10 = 0,122941.
    capture = row_of(body["rows"], "on_demand_capture", parish.dicofre)
    assert capture["observed"] == pytest.approx(taxa["observed"] * 365 / (1000 * 1.59583 * 12))
    assert capture["blended"] == pytest.approx((7 * 0.15 + 2 * capture["observed"]) / 9)
    assert capture["label"] == "estimativa·2"

    # A fotografia do cenário é esta mesma calibração.
    photo = scenario["result"]["calibration"]
    assert photo is not None and photo["window_weeks"] == 12
    assert len(photo["readings"]) == len(body["rows"])
    assert {r["metric"] for r in photo["readings"]} == {
        "generation_rate",
        "kg_per_bag",
        "bags_per_round",
        "on_demand_capture",
    }


async def test_only_measured_departed_lots_are_samples(logged_in: httpx.AsyncClient, session: AsyncSession) -> None:
    parish, school_a, school_b = await make_setup(session)
    # Escola B: um lote com unidade POR PESAR (não parte) e um lote antigo estimado — nenhum conta.
    pending = (await logged_in.post(f"{P}/lots/stops", json={"locality_id": str(school_b.id)})).json()["code"]
    await logged_in.post(f"{P}/lots/{pending}/units", json={"bag_code": "PENDENTE"})
    await logged_in.post(f"{P}/lots", json={"parish_code": parish.dicofre})
    # Escola A: duas visitas medidas e partidas. Escola B não tem amostras próprias: entra como
    # prior melhorado (n=0), nunca com valor observado.
    await measured_departure(logged_in, session, school_a.id, [3500], days_ago=14)
    await measured_departure(logged_in, session, school_a.id, [6000], days_ago=7)
    await new_scenario(logged_in, "C")
    body = (await logged_in.get(CAL)).json()
    observed_b = row_of(body["rows"], "generation_rate", str(school_b.id))
    assert observed_b["n"] == 0 and observed_b["observed"] is None  # prior melhorado, não amostra
    assert all(not (r["metric"] == "kg_per_bag" and r["unit_code"] == str(school_b.id)) for r in body["rows"])


async def test_window_cuts_old_weights_but_not_the_interval(
    logged_in: httpx.AsyncClient, session: AsyncSession
) -> None:
    _, school_a, _ = await make_setup(session)
    # Visita há 91 dias (fora da janela de 84) e visita há 14 dias: a amostra usa o intervalo longo
    # (91 − 14 = 77 dias) e o peso da visita dentro da janela: 7 kg ÷ 77 = 0,090909… kg/dia.
    await measured_departure(logged_in, session, school_a.id, [5000], days_ago=91)
    await measured_departure(logged_in, session, school_a.id, [7000], days_ago=14)
    await new_scenario(logged_in, "C")
    taxa = row_of((await logged_in.get(CAL)).json()["rows"], "generation_rate", str(school_a.id))
    assert taxa["n"] == 1
    assert taxa["observed"] == pytest.approx(7.0 / 77.0)
    assert taxa["label"] == "estimativa·1"


async def test_the_bridge_is_the_only_path_from_events_to_planning(
    logged_in: httpx.AsyncClient, session: AsyncSession
) -> None:
    """A ponte é única: sem eventos, o recálculo seguinte reconstrói agregados vazios e o cenário volta ao prior.

    Isto prova que não há fuga lateral dos eventos para o planeamento: os agregados derivam SEMPRE dos
    eventos no recálculo (idempotentes), e o otimizador consome apenas essa fotografia (ver também o
    teste puro do `compute` em `tests/unit/test_calibration.py`).
    """
    _, school_a, _ = await make_setup(session)
    await measured_departure(logged_in, session, school_a.id, [3500], days_ago=14)
    await measured_departure(logged_in, session, school_a.id, [6000], days_ago=7)
    first = await new_scenario(logged_in, "C1")
    assert first["result"]["calibration"] is not None

    # Apagar TODOS os eventos da base: unidades, lotes e pedidos.
    await session.execute(delete(LotUnit))
    await session.execute(delete(Lot))
    await session.execute(delete(CollectionRequest))
    await session.commit()

    second = await new_scenario(logged_in, "C2")
    body = (await logged_in.get(CAL)).json()
    assert body["rows"] == []  # reconstrução a partir de nenhum evento: agregados vazios
    assert second["result"]["calibration"] is None  # e o cenário corre só com priores


async def test_q_is_never_substituted_by_the_observed(logged_in: httpx.AsyncClient, session: AsyncSession) -> None:
    parish, school_a, _ = await make_setup(session)
    # Observação saturada: duas visitas com 25 sacos de 15 kg (375 kg) a 7 dias → 53,571 kg/dia;
    # evidência anual 53,571 × 365 = 19 553,6 kg > D_z = 19 149,96 → captura observada limitada a 1.
    await measured_departure(logged_in, session, school_a.id, [15000] * 25, days_ago=14)
    await measured_departure(logged_in, session, school_a.id, [15000] * 25, days_ago=7)
    scenario = await new_scenario(logged_in, "C")
    # COM calibração ativa, o q da APA mantém a fonte e o potencial: nunca é substituído.
    meta = (await logged_in.get(f"{P}/planning/parameters")).json()["meta"]
    sources = {m["key"]: (m["source"], m.get("n")) for m in meta}
    assert sources["kg_per_inhab_month"] == ("vitrus_data", None)
    assert scenario["result"]["kpis"]["potential_t"] == pytest.approx(3003.3, abs=0.1)  # procura da APA intacta
    capture = row_of((await logged_in.get(CAL)).json()["rows"], "on_demand_capture", parish.dicofre)
    assert capture["observed"] == 1.0  # limitada por D_z
    assert capture["blended"] < 1.0  # o blend com o prior mantém a fotografia honesta


async def test_parameter_source_labels_become_observed_n(logged_in: httpx.AsyncClient, session: AsyncSession) -> None:
    _, school_a, _ = await make_setup(session)
    # 9 visitas com 2 sacos cada: 8 intervalos (n=8 ≥ k=8 na captura) e 18 unidades (n=18 ≥ k=4 nos sacos).
    for i in range(9):
        await measured_departure(logged_in, session, school_a.id, [4000, 4000], days_ago=i * 7)
    await new_scenario(logged_in, "C")  # o recálculo do cenário é o gatilho da recomputação
    meta = (await logged_in.get(f"{P}/planning/parameters")).json()["meta"]
    sources = {m["key"]: (m["source"], m.get("n")) for m in meta}
    assert sources["modes.on_demand.capture_rate"] == ("observed", 8)
    assert sources["on_demand_kg_per_pickup"] == ("observed", 18)
    # Sem calibração, tudo fica como estava.
    assert sources["modes.existing.capture_rate"] == ("assumption", None)
    assert sources["modes.street.capture_rate"] == ("assumption", None)
    assert sources["on_demand_every_weeks"] == ("assumption", None)


async def test_requests_are_a_signal_that_never_multiplies_kg(
    logged_in: httpx.AsyncClient, make_user, session: AsyncSession
) -> None:

    parish, school_a, _ = await make_setup(session)
    await measured_departure(logged_in, session, school_a.id, [3500], days_ago=14)
    await measured_departure(logged_in, session, school_a.id, [6000], days_ago=7)
    u1, u2 = await make_user("cidadao-cal-1@test.pt"), await make_user("cidadao-cal-2@test.pt")
    # Moradas diferentes: «1 ativo por morada» bloqueia a mesma morada para contas diferentes.
    r1 = await u1.post("/api/v1/collection-requests", json=citizen_body(parish, address="Rua A, 1"))
    r2 = await u2.post("/api/v1/collection-requests", json=citizen_body(parish, address="Rua B, 2"))
    assert r1.status_code == r2.status_code == 201
    await backdate_request(session, r2.json()["id"], datetime.now(UTC) - timedelta(days=8))

    # O recálculo é o gatilho: sem ele o painel mostra a fotografia anterior (sem os pedidos).
    with_requests = await new_scenario(logged_in, "Com")
    body = (await logged_in.get(CAL)).json()
    requests = row_of(body["rows"], "requests_per_week", parish.dicofre)
    assert requests["n"] == 2  # 8 dias → 2 semanas observadas
    assert requests["observed"] == pytest.approx(1.0)  # 2 pedidos ÷ 2 semanas
    assert requests["prior"] == 0.0  # sem prior de pedidos (sinal de arranque)
    assert requests["blended"] == pytest.approx((7 * 0.0 + 2 * 1.0) / 9)
    assert requests["label"] == "estimativa·2"

    # Os mesmos pesos SEM os pedidos dão as mesmas toneladas: pedidos nunca multiplicam kg.
    await session.execute(delete(CollectionRequest))
    await session.commit()
    without = await new_scenario(logged_in, "Sem")
    assert without["tonnes_year"] == with_requests["tonnes_year"]
    after = (await logged_in.get(CAL)).json()
    assert all(r["metric"] != "requests_per_week" for r in after["rows"])  # recomputou sem pedidos


async def test_unvisited_local_gets_the_calibrated_prior(logged_in: httpx.AsyncClient, session: AsyncSession) -> None:
    _, school_a, school_b = await make_setup(session)
    # Escola A observada com 25 sacos de 15 kg a 7 dias: taxa 375/7 = 53,571 kg/dia, acima do prior
    # 26,232 → conversão 53,571 ÷ 26,232 = 2,0421; melhorada com n=1 visita (k=4):
    # 26,232 × (4·1 + 1·2,0421) ÷ 5 = 26,232 × 1,20842 = 31,698 kg/dia — melhorado, nunca substituído.
    await measured_departure(logged_in, session, school_a.id, [15000] * 25, days_ago=14)
    await measured_departure(logged_in, session, school_a.id, [15000] * 25, days_ago=7)
    await new_scenario(logged_in, "C")
    body = (await logged_in.get(CAL)).json()
    unvisited = row_of(body["rows"], "generation_rate", str(school_b.id))
    prior_base = 1000 * 1.59583 * 12 / 2 / 365
    assert unvisited["n"] == 0
    assert unvisited["observed"] is None
    assert unvisited["prior"] == pytest.approx(prior_base * (3 + (375 / 7) / prior_base) / 4)
    assert unvisited["blended"] == unvisited["prior"]  # sem amostras, o blend não mexe no valor
    assert unvisited["label"] == "pressuposto"


async def test_panel_is_empty_before_any_recompute(logged_in: httpx.AsyncClient) -> None:
    body = (await logged_in.get(CAL)).json()
    assert body == {"window_weeks": 12, "computed_at": None, "rows": []}


async def test_panel_requires_login(client: httpx.AsyncClient) -> None:
    assert (await client.get(CAL)).status_code == 401
