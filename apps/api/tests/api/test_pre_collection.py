import base64

import httpx

from novelo.features.pre_collection.schemas import PreCheckAnalysis
from tests.conftest import FakeLlm

# PNG 1x1 válido
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


async def test_pre_collection_check_advises_in_bag_without_session(client: httpx.AsyncClient, llm: FakeLlm) -> None:
    """A rota é pública (sem sessão) e o veredicto é aconselhamento: `reuse` vai no saco."""
    llm.queue(
        "PreCheckAnalysis",
        PreCheckAnalysis(condition="reuse", reason="Limpa e seca: vai no saco.", confidence=0.9),
    )
    resp = await client.post("/api/v1/public/pre-collection/check", files={"photo": ("a.png", PNG, "image/png")})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["decision"] == "in_bag" and body["condition"] == "reuse"
    assert body["prompt_version"] == "v1" and body["model"] == "fake/model"
    sent = llm.calls[0]["user"]
    assert isinstance(sent, list) and sum(1 for p in sent if p["type"] == "image_url") == 1  # type: ignore[index]
    assert "reason`: pt-PT" in sent[0]["text"]  # type: ignore[index]  # o motivo vem na língua do ecrã


async def test_pre_collection_check_keeps_reject_out_of_the_bag(client: httpx.AsyncClient, llm: FakeLlm) -> None:
    """`reject` fica em casa (indiferenciado): é o rejeito que não deve entrar na viatura."""
    llm.queue(
        "PreCheckAnalysis",
        PreCheckAnalysis(condition="reject", reason="Molhada e com bolor: não vai no saco.", confidence=0.7),
    )
    resp = await client.post("/api/v1/public/pre-collection/check", files={"photo": ("a.png", PNG, "image/png")})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["decision"] == "keep_out" and body["condition"] == "reject"


async def test_pre_collection_check_uses_the_requested_locale(client: httpx.AsyncClient, llm: FakeLlm) -> None:
    llm.queue("PreCheckAnalysis", PreCheckAnalysis(condition="recycle", reason="Worn but clean.", confidence=0.8))
    resp = await client.post(
        "/api/v1/public/pre-collection/check",
        files={"photo": ("a.png", PNG, "image/png")},
        params={"locale": "en"},
    )
    assert resp.status_code == 200 and resp.json()["condition"] == "recycle"
    sent = llm.calls[0]["user"]
    assert isinstance(sent, list) and "reason`: en" in sent[0]["text"]  # type: ignore[index]


async def test_pre_collection_check_rejects_non_images(client: httpx.AsyncClient, llm: FakeLlm) -> None:
    resp = await client.post(
        "/api/v1/public/pre-collection/check", files={"photo": ("a.png", b"not an image", "image/png")}
    )
    assert resp.status_code == 400
    assert not llm.calls  # nada chegou ao modelo
