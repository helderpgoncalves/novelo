"""Conta de local (papel `local`) e aviso «sacos prontos»: a conta pertence ao local, criada pela equipa.

Costura principal (comportamento observável pela API): convite com papel `local` + local → conta ligada;
leitura só do próprio local (lotes, relatório); aviso com um só ativo por local; certificado público opt-in.
Sem CO₂ e sem doadores em tudo o que é público. #59.
"""

import re
from collections.abc import Callable
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.locals.models import StopNotice
from novelo.features.network.models import Locality
from tests.conftest import PASSWORD, OutboxSender

U = "/api/v1/users"
AUTH = "/api/v1/auth"
LOCAL = "/api/v1/local"
Maker = Callable[..., Any]


def token_of(outbox: OutboxSender, index: int = -1) -> str:
    match = re.search(r"accept-invite\?token=([\w-]+)", outbox.sent[index]["text"])
    assert match
    return match.group(1)


async def _locality(session: AsyncSession, name: str = "Abação") -> Locality:
    return (await session.execute(select(Locality).where(Locality.name == name))).scalar_one()


async def test_local_invitation_binds_the_account_to_the_locality(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    locality = await _locality(session)
    resp = await admin.post(
        f"{U}/invitations",
        json={
            "email": "direcao@ae-selho.pt",
            "role": "local",
            "locality_id": str(locality.id),
            "local_kind": "assistido",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["role"] == "local"
    assert body["locality_id"] == str(locality.id)
    assert body["locality_name"] == locality.name
    assert body["local_kind"] == "assistido"

    # A pré-visualização (página de aceitar) mostra o local: quem aceita sabe a que escola entra.
    token = token_of(outbox)
    preview = await client.post(f"{AUTH}/invitations/preview", json={"token": token})
    assert preview.status_code == 200, preview.text
    assert preview.json()["locality_id"] == str(locality.id)
    assert preview.json()["locality_name"] == locality.name
    assert preview.json()["local_kind"] == "assistido"

    accepted = await client.post(
        f"{AUTH}/invitations/accept", json={"token": token, "name": "Direção", "password": PASSWORD}
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["user"]["role"] == "local"

    # A conta do local: o próprio local, a natureza do sítio e o certificado desligado por omissão.
    account = await client.get(f"{LOCAL}/account")
    assert account.status_code == 200, account.text
    acc = account.json()
    assert acc["locality_id"] == str(locality.id)
    assert acc["locality_name"] == locality.name
    assert acc["kind"] == "assistido"
    assert acc["certificate_opt_in"] is False


async def test_local_invitation_without_locality_is_rejected(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender
) -> None:
    admin = await make_user("boss@x.pt", "admin")
    missing_locality = await admin.post(f"{U}/invitations", json={"email": "a@x.pt", "role": "local"})
    assert missing_locality.status_code == 422
    assert "locality_id" in str(missing_locality.json())
    missing_kind = await admin.post(
        f"{U}/invitations",
        json={
            "email": "b@x.pt",
            "role": "local",
            "locality_id": "00000000-0000-0000-0000-000000000000",
        },
    )
    assert missing_kind.status_code == 422
    assert "local_kind" in str(missing_kind.json())
    # Local só se usa no papel local: noutro papel, o pedido é inválido.
    stray = await admin.post(f"{U}/invitations", json={"email": "c@x.pt", "role": "operator", "local_kind": "b2b"})
    assert stray.status_code == 422
    assert (await admin.get(f"{U}/invitations")).json()["total"] == 0


async def test_local_invitation_to_unknown_locality_is_404(client: httpx.AsyncClient, make_user: Maker) -> None:
    admin = await make_user("boss@x.pt", "admin")
    resp = await admin.post(
        f"{U}/invitations",
        json={
            "email": "d@x.pt",
            "role": "local",
            "locality_id": "00000000-0000-0000-0000-000000000000",
            "local_kind": "assistido",
        },
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "not_found"


async def test_local_area_is_role_gated(client: httpx.AsyncClient, make_user: Maker) -> None:
    """Só o papel `local` entra em `/local/*`: nem equipa, nem convidado de evento (o admin impersona para apoiar)."""
    for role in ("admin", "operator", "guest"):
        other = await make_user(f"{role}@x.pt", role)
        resp = await other.get(f"{LOCAL}/account")
        assert resp.status_code == 403, (role, resp.text)
        assert resp.json()["code"] == "forbidden"


async def test_team_lists_local_accounts_with_their_notice(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    """A equipa (admin e operador) vê as contas de local: quem entra, o sítio e o aviso ativo."""
    admin = await make_user("boss@x.pt", "admin")
    locality = await _locality(session)
    invited = await admin.post(
        f"{U}/invitations",
        json={
            "email": "direcao@ae-selho.pt",
            "name": "Direção",
            "role": "local",
            "locality_id": str(locality.id),
            "local_kind": "assistido",
        },
    )
    assert invited.status_code == 201, invited.text
    token = token_of(outbox)
    accepted = await client.post(
        f"{AUTH}/invitations/accept", json={"token": token, "name": "Maria João", "password": PASSWORD}
    )
    assert accepted.status_code == 200, accepted.text

    listed = await admin.get("/api/v1/locals")
    assert listed.status_code == 200, listed.text
    rows = listed.json()
    assert len(rows) == 1
    row = rows[0]
    assert row["user_email"] == "direcao@ae-selho.pt"
    assert row["user_name"] == "Maria João"
    assert row["locality_id"] == str(locality.id) and row["locality_name"] == locality.name
    assert row["kind"] == "assistido"
    assert row["certificate_opt_in"] is False
    assert row["notice"] is None  # ainda sem aviso

    # O operador da equipa também vê (é quem despacha rondas); o resto da app não.
    operator = await make_user("op@x.pt", "operator")
    assert (await operator.get("/api/v1/locals")).status_code == 200
    guest = await make_user("g@x.pt", "guest")
    assert (await guest.get("/api/v1/locals")).status_code == 403


async def test_notice_lifecycle_one_active_per_locality(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    """Dá o aviso, vê-o ativo, anula-o e volta a avisar: um só ativo por local, o histórico fica."""
    admin = await make_user("boss@x.pt", "admin")
    locality = await _locality(session)
    await admin.post(
        f"{U}/invitations",
        json={"email": "escola@ae.pt", "role": "local", "locality_id": str(locality.id), "local_kind": "assistido"},
    )
    token = token_of(outbox)
    escola = httpx.AsyncClient(transport=client._transport, base_url="http://test")
    try:
        accepted = await escola.post(
            f"{AUTH}/invitations/accept", json={"token": token, "name": "Escola", "password": PASSWORD}
        )
        assert accepted.status_code == 200, accepted.text

        # Sem aviso: a porta do herói mostra «nada ativo».
        empty = await escola.get(f"{LOCAL}/notices/active")
        assert empty.status_code == 200 and empty.json()["notice"] is None

        # O único gesto de escrita do local: avisar «sacos prontos».
        created = await escola.post(f"{LOCAL}/notices", json={"bag_count": 4, "note": "sala 12, porta dos fundos"})
        assert created.status_code == 201, created.text
        notice = created.json()
        assert notice["state"] == "active"
        assert notice["bag_count"] == 4 and notice["note"] == "sala 12, porta dos fundos"
        assert notice["locality_id"] == str(locality.id)
        assert notice["cancelled_at"] is None

        # Já há um ativo: avisar outra vez é conflito (anular primeiro).
        dup = await escola.post(f"{LOCAL}/notices", json={"bag_count": 2})
        assert dup.status_code == 409 and dup.json()["code"] == "notice_already_active"

        # O ativo aparece no GET (o estado do herói)...
        current = await escola.get(f"{LOCAL}/notices/active")
        assert current.json()["notice"]["id"] == notice["id"]

        # ...e na mesa da equipa.
        team = await admin.get("/api/v1/locals")
        assert team.json()[0]["notice"]["id"] == notice["id"]

        # Anular: 204, o ativo desaparece e o histórico fica (linha nova ao voltar a avisar).
        cancelled = await escola.delete(f"{LOCAL}/notices/active")
        assert cancelled.status_code == 204
        assert (await escola.get(f"{LOCAL}/notices/active")).json()["notice"] is None
        team = await admin.get("/api/v1/locals")
        assert team.json()[0]["notice"] is None
        # Sem ativo, anular é 404. Avisar outra vez cria uma linha nova (o antigo fica cancelado).
        assert (await escola.delete(f"{LOCAL}/notices/active")).status_code == 404
        again = await escola.post(f"{LOCAL}/notices", json={})
        assert again.status_code == 201 and again.json()["id"] != notice["id"]
        rows = (await session.execute(select(StopNotice))).scalars().all()
        assert len(rows) == 2
        assert {r.state for r in rows} == {"active", "cancelled"}
        cancelled_row = next(r for r in rows if r.state == "cancelled")
        assert cancelled_row.cancelled_at is not None and cancelled_row.cancelled_by_id is not None
    finally:
        await escola.aclose()


async def test_notice_needs_the_local_role(make_user: Maker) -> None:
    """A única escrita do local é do local: equipa e convidado não avisam em nome de ninguém."""
    for role in ("admin", "operator", "guest"):
        other = await make_user(f"{role}@x.pt", role)
        resp = await other.post(f"{LOCAL}/notices", json={"bag_count": 1})
        assert resp.status_code == 403, (role, resp.text)
        assert (await other.delete(f"{LOCAL}/notices/active")).status_code == 403


async def test_notice_validates_bag_count(make_user: Maker, outbox: OutboxSender, session: AsyncSession) -> None:
    """O número de sacos é opcional (o recado conta); se vier, tem de fazer sentido."""
    admin = await make_user("boss@x.pt", "admin")
    locality = await _locality(session)
    await admin.post(
        f"{U}/invitations",
        json={"email": "b2b@lar.pt", "role": "local", "locality_id": str(locality.id), "local_kind": "b2b"},
    )
    token = token_of(outbox)
    produtor = httpx.AsyncClient(transport=admin._transport, base_url="http://test")
    try:
        accepted = await produtor.post(
            f"{AUTH}/invitations/accept", json={"token": token, "name": "Lar", "password": PASSWORD}
        )
        assert accepted.status_code == 200, accepted.text
        assert (await produtor.get(f"{LOCAL}/account")).json()["kind"] == "b2b"
        for bad in (0, -3, 999):
            assert (await produtor.post(f"{LOCAL}/notices", json={"bag_count": bad})).status_code == 422
        note_too_long = await produtor.post(f"{LOCAL}/notices", json={"note": "x" * 241})
        assert note_too_long.status_code == 422
        ok = await produtor.post(f"{LOCAL}/notices", json={"note": "contentores cheios"})
        assert ok.status_code == 201 and ok.json()["bag_count"] is None
    finally:
        await produtor.aclose()


ITEM = {
    "garment_type": "tshirt",
    "condition": "reuse",
    "estimated_weight_g": 2000,
    "composition": [{"fibre": "cotton", "pct": 100}],
    "confidence": 1.0,
}


async def _weighed_stop(
    operator: httpx.AsyncClient, locality_id: str, *, unit_g: int | None, items: list[dict[str, object]]
) -> str:
    """Uma paragem pesada (lote por paragem): unidade com peso medido, peças triadas, «Partir»."""
    lot = (await operator.post("/api/v1/lots/stops", json={"locality_id": locality_id})).json()
    if unit_g is not None:
        unit = (await operator.post(f"/api/v1/lots/{lot['code']}/units", json={})).json()
        weighed = await operator.put(f"/api/v1/lots/{lot['code']}/units/{unit['id']}", json={"weight_g": unit_g})
        assert weighed.status_code == 200, weighed.text
    for item in items:
        added = await operator.post(f"/api/v1/lots/{lot['code']}/items", json=item)
        assert added.status_code == 201, added.text
    departed = await operator.post(f"/api/v1/lots/{lot['code']}/departure")
    assert departed.status_code == 200, departed.text
    return lot["code"]


async def test_local_reads_only_its_own_stops(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    """O local só vê as suas paragens: o local deduz-se da conta, nunca de um parâmetro do pedido."""
    admin = await make_user("boss@x.pt", "admin")
    abacao = await _locality(session, "Abação")
    aldao = await _locality(session, "Aldão")

    await admin.post(
        f"{U}/invitations",
        json={"email": "a@ae.pt", "role": "local", "locality_id": str(abacao.id), "local_kind": "assistido"},
    )
    await admin.post(
        f"{U}/invitations",
        json={"email": "b@lar.pt", "role": "local", "locality_id": str(aldao.id), "local_kind": "b2b"},
    )
    escola = httpx.AsyncClient(transport=client._transport, base_url="http://test")
    accepted = await escola.post(
        f"{AUTH}/invitations/accept", json={"token": token_of(outbox, -2), "name": "A", "password": PASSWORD}
    )
    assert accepted.status_code == 200, accepted.text

    lar = httpx.AsyncClient(transport=client._transport, base_url="http://test")
    accepted_b = await lar.post(
        f"{AUTH}/invitations/accept", json={"token": token_of(outbox), "name": "B", "password": PASSWORD}
    )
    assert accepted_b.status_code == 200, accepted_b.text

    operator = await make_user("via@x.pt", "operator")
    try:
        # Duas paragens na Abação (uma triada, uma na mesa) e uma no Aldão (do outro local).
        code_a1 = await _weighed_stop(
            operator,
            str(abacao.id),
            unit_g=3500,
            items=[
                ITEM,
                {**ITEM, "condition": "recycle", "estimated_weight_g": 1000},
                {**ITEM, "condition": "reject", "estimated_weight_g": 500},
            ],  # 3,5 kg medidos; 2/1/0,5 kg triados
        )
        code_a2 = await _weighed_stop(operator, str(abacao.id), unit_g=800, items=[])  # 0,8 kg ainda em triagem
        await _weighed_stop(operator, str(aldao.id), unit_g=1234, items=[])

        lots = await escola.get(f"{LOCAL}/lots")
        assert lots.status_code == 200, lots.text
        codes = {lot["code"] for lot in lots.json()}
        assert codes == {code_a1, code_a2}  # nunca a paragem do Aldão
        assert all(lot["locality_id"] == str(abacao.id) for lot in lots.json())
        assert all(lot["weight_source"] == "measured" for lot in lots.json())
        assert next(lot for lot in lots.json() if lot["code"] == code_a1)["weight_kg"] == 3.5

        report = await escola.get(f"{LOCAL}/report")
        assert report.status_code == 200, report.text
        r = report.json()
        # A mão: 3,5 kg medidos + 0,8 kg em triagem = 4,3 kg; destinos só dos triados: 2/1/0,5 kg.
        assert r["locality_id"] == str(abacao.id)
        assert r["lots"] == 2 and r["measured_lots"] == 2
        assert r["sorted_lots"] == 1 and r["lots_in_triage"] == 1
        assert r["weight_kg"] == 4.3
        assert r["reuse_kg"] == 2.0 and r["recycle_kg"] == 1.0 and r["reject_kg"] == 0.5
        assert r["first_stop_at"] is not None and r["last_stop_at"] is not None

        # O lar do Aldão vê o espelho: só as paragens dele.
        lots_b = await lar.get(f"{LOCAL}/lots")
        assert {lot["locality_id"] for lot in lots_b.json()} == {str(aldao.id)}
        report_b = (await lar.get(f"{LOCAL}/report")).json()
        assert report_b["lots"] == 1 and report_b["weight_kg"] == 1.234
        assert report_b["sorted_lots"] == 0 and report_b["lots_in_triage"] == 1
        assert report_b["reuse_kg"] == 0 and report_b["locality_id"] == str(aldao.id)
    finally:
        await escola.aclose()
        await lar.aclose()


async def test_certificate_is_public_only_when_opted_in(
    client: httpx.AsyncClient, make_user: Maker, outbox: OutboxSender, session: AsyncSession
) -> None:
    """O certificado público é opt-in: sem opt-in não há página (404); ligado, só kg agregados do sítio."""
    admin = await make_user("boss@x.pt", "admin")
    abacao = await _locality(session, "Abação")
    await admin.post(
        f"{U}/invitations",
        json={"email": "ae@selho.pt", "role": "local", "locality_id": str(abacao.id), "local_kind": "assistido"},
    )
    escola = httpx.AsyncClient(transport=client._transport, base_url="http://test")
    try:
        accepted = await escola.post(
            f"{AUTH}/invitations/accept",
            json={"token": token_of(outbox), "name": "AE Selho", "password": PASSWORD},
        )
        assert accepted.status_code == 200, accepted.text
        account = (await escola.get(f"{LOCAL}/account")).json()
        account_id = account["id"]
        assert account["certificate_opt_in"] is False

        operator = await make_user("via@x.pt", "operator")
        # Uma paragem pesada e triada: 3,5 kg medidos; destinos 50/30/20 (1,75/1,05/0,7 kg).
        await _weighed_stop(
            operator,
            str(abacao.id),
            unit_g=3500,
            items=[
                {**ITEM, "condition": "reuse", "estimated_weight_g": 1750},
                {**ITEM, "condition": "recycle", "estimated_weight_g": 1050},
                {**ITEM, "condition": "reject", "estimated_weight_g": 700},
            ],
        )

        # Desligado por omissão: a página pública não existe (nem para anónimos).
        public = httpx.AsyncClient(transport=client._transport, base_url="http://test")
        try:
            before = await public.get(f"/api/v1/public/locals/{account_id}/certificate")
            assert before.status_code == 404
            assert before.json()["code"] == "certificate_not_public"

            # A própria escola liga o opt-in...
            opt_in = await escola.put(f"{LOCAL}/certificate", json={"opt_in": True})
            assert opt_in.status_code == 200, opt_in.text
            assert opt_in.json()["certificate_opt_in"] is True

            # ...e a página pública aparece, com os kg medidos por destino e sem dados de doadores.
            page = await public.get(f"/api/v1/public/locals/{account_id}/certificate")
            assert page.status_code == 200, page.text
            cert = page.json()
            assert cert["locality_name"] == abacao.name
            assert cert["stops"] == 1 and cert["weight_kg"] == 3.5
            assert cert["reuse_kg"] == 1.75 and cert["recycle_kg"] == 1.05 and cert["reject_kg"] == 0.7
            assert cert["reuse_pct"] == 50 and cert["recycle_pct"] == 30 and cert["reject_pct"] == 20
            body = str(cert)
            assert "donor" not in body and "created_by" not in body  # nunca identificável
            assert "user_email" not in body and "note" not in body

            # Desligar outra vez: a página volta a não existir (404, mesmo código).
            opt_out = await escola.put(f"{LOCAL}/certificate", json={"opt_in": False})
            assert opt_out.json()["certificate_opt_in"] is False
            after = await public.get(f"/api/v1/public/locals/{account_id}/certificate")
            assert after.status_code == 404 and after.json()["code"] == "certificate_not_public"
        finally:
            await public.aclose()

        # A equipa vê o estado na mesa (a escola controla; a equipa só vê).
        team = (await admin.get("/api/v1/locals")).json()
        assert team[0]["certificate_opt_in"] is False
    finally:
        await escola.aclose()
