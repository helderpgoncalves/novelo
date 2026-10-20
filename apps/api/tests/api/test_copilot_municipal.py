"""Copiloto e rede municipal: ferramentas, verificador de números, menções e ausência de nomes de produtores."""

import json
from collections.abc import Awaitable, Callable
from typing import Any

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novelo.features.copilot.mentions import MentionError, resolve
from novelo.features.copilot.schemas import MentionRef, MentionType
from novelo.features.copilot.tools import CopilotTools
from novelo.features.users.models import User
from tests.conftest import FakeLlm

C = "/api/v1/copilot"
MakeUser = Callable[..., Awaitable[httpx.AsyncClient]]
NAMES = ("Restaurante Teste", "Hotel Teste")


def ask(text: str) -> dict[str, Any]:
    return {"messages": [{"role": "user", "content": text}], "locale": "pt-PT"}


async def user_of(session: AsyncSession, email: str) -> User:
    return (await session.execute(select(User).where(User.email == email))).scalar_one()


async def run_tool(session: AsyncSession, user: User, name: str, args: dict[str, Any]) -> Any:
    outcome = await CopilotTools(session, user).run(name, json.dumps(args))
    return outcome


# --- ferramentas (resultado direto) ----------------------------------------------------------------------------------


async def test_overview_tool_flags_the_network_as_not_textile(
    session: AsyncSession, municipal: None, make_user: MakeUser
) -> None:
    await make_user("op@vitrus.pt", "operator")
    out = await run_tool(session, await user_of(session, "op@vitrus.pt"), "get_municipal_overview", {})
    r = out.result
    assert out.ok and r["is_textile_network"] is False and "not textile" in r["note"]
    assert (r["containers"]["accepted"], r["containers"]["located"], r["sites"]["total"]) == (11, 10, 6)
    assert r["density"]["containers_per_1000_hab"] == 2.2 and r["coverage_of_area_estimate"]["pct_300m"] == 45.0
    assert r["result_id"] == "r1" and r["table"]["total_rows"] == 5  # 5 tipos presentes
    assert out.summary == "10 contentores, 6 locais"


async def test_parish_tool_accepts_names_without_accents_and_flags_estimates(
    session: AsyncSession, municipal: None, make_user: MakeUser
) -> None:
    await make_user("op@vitrus.pt", "operator")
    user = await user_of(session, "op@vitrus.pt")
    out = await run_tool(session, user, "get_parish_municipal", {"parish": "AZUREM"})
    r = out.result
    assert out.ok and r["name"] == "Azurém" and (r["containers"], r["sites"], r["public_sites"]) == (6, 3, 1)
    assert (r["textile_potential_t_estimate"], r["textile_gap_t_estimate"], r["gap_rank_estimate"]) == (25.2, 18.9, 1)
    assert r["producer_containers"]["hospitality"] == 2 and "estimate_note" in r
    by_code = await run_tool(session, user, "get_parish_municipal", {"parish": "030801"})
    assert by_code.result["name"] == "Aldão"
    unknown = await run_tool(session, user, "get_parish_municipal", {"parish": "Atlantida"})
    assert unknown.ok is False and unknown.result["error"] == "unknown_parish"
    partial = await run_tool(session, user, "get_parish_municipal", {"parish": "ald"})  # prefixo único
    assert partial.result["name"] == "Aldão"


async def test_find_sites_tool_filters_and_never_shows_producer_names_even_to_admins(
    session: AsyncSession, municipal: None, make_user: MakeUser
) -> None:
    await make_user("admin@vitrus.pt", "admin")
    admin = await user_of(session, "admin@vitrus.pt")
    out = await run_tool(session, admin, "find_municipal_sites", {"parish": "Azurém", "producer_type": "hospitality"})
    assert out.ok and out.result["total"] == 1 and out.result["producer_names"] == "not shown"
    text = json.dumps(out.result, ensure_ascii=False)
    assert not any(n in text for n in NAMES)
    cands = await run_tool(session, admin, "find_municipal_sites", {"textile_candidate": True, "kind": "surface"})
    assert [r["site_id"] for r in cands.result["table"]["rows"]] == ["S0000002b", "S0000003c"]
    searched = await run_tool(session, admin, "find_municipal_sites", {"query": "hotel teste"})
    assert searched.result["total"] == 0  # a pesquisa por nomes não existe nas ferramentas
    bad = await run_tool(session, admin, "find_municipal_sites", {"parish": "Atlantida"})
    assert bad.ok is False and bad.result["suggestions"] == []
    extra = await run_tool(session, admin, "find_municipal_sites", {"show_names": True})
    assert extra.ok is False and extra.result["error"] == "invalid_arguments"  # a ferramenta nem aceita o parâmetro


async def test_textile_candidates_tool_ranks_and_labels_the_estimate(
    session: AsyncSession, municipal: None, make_user: MakeUser
) -> None:
    await make_user("op@vitrus.pt", "operator")
    user = await user_of(session, "op@vitrus.pt")
    out = await run_tool(session, user, "get_textile_candidates", {})
    r = out.result
    assert out.ok and r["is_estimate"] is True and (r["total"], r["total_precise"]) == (3, 1)
    assert [(row["rank"], row["site_id"]) for row in r["table"]["rows"]] == [
        (1, "S0000001a"),
        (2, "S0000003c"),
        (3, "S0000002b"),
    ]
    assert "Possible places, not recommendations" in r["note"] and r["table"]["estimate"] is True
    precise = await run_tool(session, user, "get_textile_candidates", {"precise_only": True, "limit": 5})
    assert [row["site_id"] for row in precise.result["table"]["rows"]] == ["S0000001a"]
    one = await run_tool(session, user, "get_textile_candidates", {"parish": "Azurém"})
    assert [(row["rank"], row["site_id"]) for row in one.result["table"]["rows"]] == [(2, "S0000003c")]


async def test_tools_are_registered_for_the_model(session: AsyncSession, municipal: None, make_user: MakeUser) -> None:
    await make_user("op@vitrus.pt", "operator")
    specs = {s.name for s in CopilotTools(session, await user_of(session, "op@vitrus.pt")).specs()}
    assert {"get_municipal_overview", "get_parish_municipal", "find_municipal_sites", "get_textile_candidates"} <= specs


# --- verificador de números (pelo endpoint, com o modelo falso) -----------------------------------------------------------


async def test_verifier_accepts_numbers_from_municipal_tools(
    municipal: None, make_user: MakeUser, llm: FakeLlm
) -> None:
    user = await make_user("op@vitrus.pt", "operator")
    llm.queue_chat(
        [("get_municipal_overview", {}), ("get_parish_municipal", {"parish": "Azurém"})],
        "A rede municipal (outras frações) tem 10 contentores com coordenadas, 2,2 por 1 000 habitantes. "
        "Em Azurém a lacuna estimada de têxtil é de 18,9 t por ano.",
    )
    body = (await user.post(f"{C}/chat", json=ask("Fala-me dos contentores municipais e de Azurém"))).json()
    assert body["verified"] is True and body["warning"] is None
    assert [t["name"] for t in body["tools_used"]] == ["get_municipal_overview", "get_parish_municipal"]


async def test_verifier_rejects_an_invented_municipal_number(
    municipal: None, make_user: MakeUser, llm: FakeLlm
) -> None:
    user = await make_user("op@vitrus.pt", "operator")
    llm.queue_chat(
        [("get_textile_candidates", {})],
        "Há 3 locais candidatos, 777 com coordenada precisa.",  # 777 é inventado
        "Há 3 locais candidatos, 1 com coordenada precisa.",
    )
    body = (await user.post(f"{C}/chat", json=ask("Quantos candidatos a têxteis há?"))).json()
    assert body["verified"] is True and "777" not in body["text"]
    assert "777" in llm.calls[1]["user"][-1]["content"]  # type: ignore[index]


# --- menções --------------------------------------------------------------------------------------------------------


async def test_mention_search_finds_sites_by_street_without_accents(municipal: None, make_user: MakeUser) -> None:
    user = await make_user("op@vitrus.pt", "operator")
    out = (await user.get(f"{C}/mentions", params={"q": "tres", "types": ["municipal_site"]})).json()
    item = out["groups"][0]["items"][0]
    assert out["groups"][0]["type"] == "municipal_site" and item["id"] == "S0000003c"
    assert (
        item["label"] == "Rua Três (S0000003c)" and "Azurém" in item["sublabel"] and "3 contentores" in item["sublabel"]
    )
    assert (await user.get(f"{C}/mentions", params={"q": "hotel teste", "types": ["municipal_site"]})).json()[
        "groups"
    ] == []
    everything = (await user.get(f"{C}/mentions", params={"limit": 9})).json()
    assert "municipal_site" in {g["type"] for g in everything["groups"]}


async def test_site_mention_resolves_to_facts_without_names(
    session: AsyncSession, municipal: None, make_user: MakeUser
) -> None:
    await make_user("admin@vitrus.pt", "admin")
    admin = await user_of(session, "admin@vitrus.pt")
    site = await resolve(session, admin, MentionRef(type=MentionType.MUNICIPAL_SITE, id="S0000003c"))
    assert site.label == "Rua Três"
    assert (
        site.facts["containers"] == 3
        and site.facts["textile_candidate"] is True
        and site.facts["neighbours_within_200m"] == 1
    )
    assert "municipal (not textile)" in site.facts["network"]
    producer = await resolve(session, admin, MentionRef(type=MentionType.MUNICIPAL_SITE, id="S0000005e"))
    assert producer.label == "S0000005e" and not any(n in producer.block() for n in NAMES)
    with pytest.raises(MentionError, match="Mention not found"):
        await resolve(session, admin, MentionRef(type=MentionType.MUNICIPAL_SITE, id="S9999999z"))


async def test_parish_mention_carries_municipal_numbers(
    session: AsyncSession, municipal: None, make_user: MakeUser
) -> None:
    await make_user("op@vitrus.pt", "operator")
    user = await user_of(session, "op@vitrus.pt")
    parish = await resolve(session, user, MentionRef(type=MentionType.PARISH, id="030804"))
    assert parish.label == "Azurém"
    assert parish.facts["municipal_network"] == {
        "containers": 6, "containers_per_1000_hab": 2.0, "public_sites": 1, "candidate_sites": 1,
        "textile_gap_t_estimate": 18.9, "gap_rank_estimate": 1,
    }  # fmt: skip


async def test_parish_mention_works_before_the_municipal_import(session: AsyncSession, make_user: MakeUser) -> None:
    from tests.conftest import load_municipal  # noqa: PLC0415

    await load_municipal(session, empty=True)
    await make_user("op@vitrus.pt", "operator")
    user = await user_of(session, "op@vitrus.pt")
    parish = await resolve(session, user, MentionRef(type=MentionType.PARISH, id="030804"))
    assert "municipal_network" not in parish.facts
