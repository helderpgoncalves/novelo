"""O piloto do ecrã inicial é pedido a cada carga: um convidado do QR não esgota o limite de simulações com isso."""

from collections.abc import Awaitable, Callable

import httpx

from novelo.features.planning import pilot_service

P = "/api/v1/planning"
MakeUser = Callable[..., Awaitable[httpx.AsyncClient]]


async def test_reloading_the_home_does_not_spend_the_guest_solver_budget(make_user: MakeUser) -> None:
    pilot_service._cache.clear()
    guest = await make_user("convidado-piloto@x.pt", "guest")
    # O limite do convidado é de 10 execuções por hora: 15 cargas do ecrã inicial têm de passar todas
    codes = [(await guest.post(f"{P}/pilot", json={})).status_code for _ in range(15)]
    assert codes == [200] * 15


async def test_a_new_computation_still_spends_the_budget_and_cached_answers_are_identical(
    make_user: MakeUser,
) -> None:
    pilot_service._cache.clear()
    guest = await make_user("convidado-piloto2@x.pt", "guest")
    first = (await guest.post(f"{P}/pilot", json={})).json()
    again = (await guest.post(f"{P}/pilot", json={})).json()
    assert first == again  # a cache devolve exatamente o mesmo resultado
    # Pedidos diferentes são cálculos novos: gastam o orçamento do convidado (10 por hora) e o 11.º é recusado
    codes = [(await guest.post(f"{P}/pilot", json={"k": 2, "months": m})).status_code for m in range(3, 15)]
    assert 429 in codes and codes[0] == 200
