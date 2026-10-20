"""Conversas: propriedade, listagem/pesquisa, fixar/arquivar/pastas, partilha, ramos, exportação, anexos e apagar."""

from typing import Any

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.copilot.models import CopilotAttachment, CopilotMessage
from tests.conftest import FakeLlm
from tests.sse import CSV, stream, text_of


def _pdf_ok() -> bool:
    try:
        from weasyprint import HTML  # noqa: PLC0415

        HTML(string="<p>x</p>").write_pdf()
    except Exception:
        return False
    return True


S = "/api/v1/copilot/stream"
T = "/api/v1/copilot/threads"


async def say(c: httpx.AsyncClient, llm: FakeLlm, message: str, reply: str = "Ok.", **extra: Any) -> dict[str, Any]:
    llm.queue_rounds({"text": [reply]})
    events = await stream(c, S, {"message": message, "locale": "pt-PT", **extra})
    return {"thread_id": events[0]["thread_id"], "events": events}


async def test_threads_are_private_to_their_owner(logged_in: httpx.AsyncClient, llm: FakeLlm, make_user: Any) -> None:
    mine = (await say(logged_in, llm, "Olá, isto é meu"))["thread_id"]
    other = await make_user("rui@x.pt")
    assert (await other.get(f"{T}/{mine}")).status_code == 404  # 404 igual: não revela que existe
    assert (await other.patch(f"{T}/{mine}", json={"title": "roubado"})).status_code == 404
    assert (await other.delete(f"{T}/{mine}")).status_code == 404
    assert (await other.post(f"{T}/{mine}/compact")).status_code == 404
    assert (await other.get(f"{T}/{mine}/export")).status_code == 404
    assert (await other.get(f"{T}/{mine}/timeline")).status_code == 404
    assert (await other.post(S, json={"message": "continua", "thread_id": mine})).status_code == 404
    assert (await other.post(f"{T}/{mine}/regenerate")).status_code == 404
    assert (await other.get(T)).json()["total"] == 0 and (await logged_in.get(T)).json()["total"] == 1
    msg_id = (await logged_in.get(f"{T}/{mine}")).json()["messages"][1]["id"]
    assert (await other.put(f"/api/v1/copilot/messages/{msg_id}/feedback", json={"rating": 1})).status_code == 404


async def test_list_search_pin_archive_project_and_pagination(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    ids = []
    for i, topic in enumerate(
        ["Serzedelo cobertura", "Azurém orçamento", "Selho piloto", "Ponte frota", "Caldelas lotes"]
    ):
        ids.append((await say(logged_in, llm, f"Pergunta {i} sobre {topic}"))["thread_id"])
    page = (await logged_in.get(T, params={"limit": 2})).json()
    assert page["total"] == 5 and len(page["items"]) == 2 and page["items"][0]["id"] == ids[-1]  # mais recente primeiro
    second = (await logged_in.get(T, params={"limit": 2, "offset": 2})).json()
    assert {t["id"] for t in page["items"]} & {t["id"] for t in second["items"]} == set()

    found = (await logged_in.get(T, params={"q": "serzedêlo"})).json()  # sem acentos e com prefixo
    assert [t["id"] for t in found["items"]] == [ids[0]]
    assert (await logged_in.get(T, params={"q": "azur"})).json()["total"] == 1

    await logged_in.patch(f"{T}/{ids[0]}", json={"pinned": True, "project": "Piloto"})
    listing = (await logged_in.get(T)).json()["items"]
    assert listing[0]["id"] == ids[0] and listing[0]["pinned"] is True and listing[0]["project"] == "Piloto"
    assert [p["name"] for p in (await logged_in.get("/api/v1/copilot/projects")).json()] == ["Piloto"]
    assert (await logged_in.get(T, params={"project": "Piloto"})).json()["total"] == 1

    await logged_in.patch(f"{T}/{ids[1]}", json={"archived": True, "title": "Arquivada"})
    assert (await logged_in.get(T)).json()["total"] == 4
    archived = (await logged_in.get(T, params={"archived": True})).json()
    assert [t["title"] for t in archived["items"]] == ["Arquivada"]


async def test_share_link_is_read_only_for_other_authenticated_users(
    logged_in: httpx.AsyncClient, llm: FakeLlm, make_user: Any
) -> None:
    tid = (await say(logged_in, llm, "Segredo do projeto Selho"))["thread_id"]
    other = await make_user("rui@x.pt")
    link = (await logged_in.post(f"{T}/{tid}/share")).json()
    assert (
        link["path"].endswith(link["token"])
        and (await logged_in.post(f"{T}/{tid}/share")).json()["token"] == link["token"]
    )
    shared = await other.get(f"/api/v1/copilot/shared/{link['token']}")
    assert shared.status_code == 200 and shared.json()["messages"][0]["text"] == "Segredo do projeto Selho"
    assert shared.json()["summary"] == "" and all(m["feedback"] is None for m in shared.json()["messages"])
    assert (
        await other.post(S, json={"message": "escrever na alheia", "thread_id": tid})
    ).status_code == 404  # só leitura
    assert (await logged_in.delete(f"{T}/{tid}/share")).status_code == 204
    assert (await other.get(f"/api/v1/copilot/shared/{link['token']}")).status_code == 404


async def test_editing_a_message_branches_the_conversation(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    first = await say(logged_in, llm, "Primeira pergunta", "Primeira resposta.")
    tid = first["thread_id"]
    await say(logged_in, llm, "Segunda pergunta", "Segunda resposta.", thread_id=tid)
    messages = (await logged_in.get(f"{T}/{tid}")).json()["messages"]
    second_user = next(m for m in messages if m["text"] == "Segunda pergunta")
    llm.queue_rounds({"text": ["Resposta ao texto editado."]})
    events = await stream(
        logged_in, S, {"message": "Segunda pergunta editada", "thread_id": tid, "edit_message_id": second_user["id"]}
    )
    branch_id = events[0]["thread_id"]
    assert branch_id != tid and text_of(events) == "Resposta ao texto editado."
    branch = (await logged_in.get(f"{T}/{branch_id}")).json()
    assert [m["text"] for m in branch["messages"]] == [
        "Primeira pergunta",
        "Primeira resposta.",
        "Segunda pergunta editada",
        "Resposta ao texto editado.",
    ]
    assert branch["parent_thread_id"] == tid
    original = (await logged_in.get(f"{T}/{tid}")).json()
    assert [m["text"] for m in original["messages"]][-2:] == [
        "Segunda pergunta",
        "Segunda resposta.",
    ]  # a original fica intacta
    wrong = await logged_in.post(S, json={"message": "x", "thread_id": tid, "edit_message_id": messages[1]["id"]})
    assert wrong.status_code == 404  # só mensagens do utilizador se editam


async def test_export_markdown_and_timeline(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    llm.queue_rounds({"tools": [("get_baseline", {})]}, {"text": ["Recolheram-se 301,3 t."]})
    events = await stream(logged_in, S, {"message": "Quanto recolhemos?", "locale": "pt-PT"})
    tid = events[0]["thread_id"]
    md = (await logged_in.get(f"{T}/{tid}/export")).json()
    assert (
        md["filename"].endswith(".md") and "Recolheram-se 301,3 t." in md["markdown"] and "Utilizador" in md["markdown"]
    )
    timeline = (await logged_in.get(f"{T}/{tid}/timeline")).json()
    kinds = [e["kind"] for e in timeline]
    assert kinds[0] == "thread" and "message" in kinds and "tool" in kinds
    assert any(e["kind"] == "tool" and e["label"] == "get_baseline" for e in timeline)


async def test_feedback_is_per_message_and_replaces(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    tid = (await say(logged_in, llm, "Olá"))["thread_id"]
    msg = (await logged_in.get(f"{T}/{tid}")).json()["messages"][1]["id"]
    assert (await logged_in.put(f"/api/v1/copilot/messages/{msg}/feedback", json={"rating": -1})).json()["rating"] == -1
    await logged_in.put(f"/api/v1/copilot/messages/{msg}/feedback", json={"rating": 1})
    assert (await logged_in.get(f"{T}/{tid}")).json()["messages"][1]["feedback"] == 1
    user_msg = (await logged_in.get(f"{T}/{tid}")).json()["messages"][0]["id"]
    assert (await logged_in.put(f"/api/v1/copilot/messages/{user_msg}/feedback", json={"rating": 1})).status_code == 404


async def test_deleting_a_thread_removes_derived_history(
    logged_in: httpx.AsyncClient, llm: FakeLlm, session: AsyncSession
) -> None:
    files = {"files": ("t.csv", CSV.encode(), "text/csv")}
    att = (await logged_in.post("/api/v1/copilot/attachments", files=files)).json()[0]
    llm.queue_rounds({"tools": [("get_baseline", {})]}, {"tools": [("show_table", {})]}, {"text": ["Feito."]})
    tid = (await say(logged_in, llm, "Analisa o ficheiro", attachment_ids=[att["id"]]))["thread_id"]
    assert (await session.execute(select(CopilotAttachment))).first() is not None
    assert (await logged_in.delete(f"{T}/{tid}")).status_code == 204
    assert (await session.execute(select(CopilotAttachment))).first() is None
    assert (await session.execute(select(CopilotMessage))).first() is None
    assert (await logged_in.get(f"{T}/{tid}")).status_code == 404


@pytest.mark.parametrize(
    "path",
    ["/api/v1/copilot/threads", "/api/v1/copilot/history", "/api/v1/copilot/actions", "/api/v1/copilot/settings"],
)
async def test_requires_login(client: httpx.AsyncClient, path: str) -> None:
    assert (await client.get(path)).status_code == 401


async def test_shared_view_hides_attachments_and_actions(
    logged_in: httpx.AsyncClient, llm: FakeLlm, make_user: Any
) -> None:
    att = (
        await logged_in.post("/api/v1/copilot/attachments", files={"files": ("t.csv", CSV.encode(), "text/csv")})
    ).json()[0]
    alert = (await logged_in.get("/api/v1/datasets/quality")).json()["alerts"][0]
    llm.queue_rounds(
        {"tools": [("propose_action", {"type": "ignore_alert", "params": {"alert_id": alert["id"]}})]},
        {"text": ["Proposto."]},
    )
    ev = await stream(logged_in, S, {"message": "Olá", "locale": "pt-PT", "attachment_ids": [att["id"]]})
    link = (await logged_in.post(f"{T}/{ev[0]['thread_id']}/share")).json()
    other = await make_user("rui@x.pt")
    shared = (await other.get(f"/api/v1/copilot/shared/{link['token']}")).json()
    assert all(m["attachments"] == [] and m["actions"] == [] for m in shared["messages"])  # só o texto da conversa
    assert "Selho" not in str(shared)


@pytest.mark.skipif(not _pdf_ok(), reason="WeasyPrint precisa das bibliotecas Pango do sistema")
async def test_export_pdf(logged_in: httpx.AsyncClient, llm: FakeLlm) -> None:
    tid = (await say(logged_in, llm, "Olá <b>mundo</b>", "Resposta."))["thread_id"]
    resp = await logged_in.get(f"{T}/{tid}/export.pdf")
    assert (
        resp.status_code == 200
        and resp.headers["content-type"] == "application/pdf"
        and resp.content.startswith(b"%PDF")
    )
