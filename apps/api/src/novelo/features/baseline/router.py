from fastapi import APIRouter

from novelo.features.baseline import service
from novelo.features.baseline.schemas import CircuitsSummary, Flows, TextileBaseline, WasteComposition

router = APIRouter()


@router.get("/textile", response_model=TextileBaseline)
def get_textile_baseline() -> TextileBaseline:
    """Têxtil recolhido em 2025 por entidade e destino, face à procura estimada."""
    return service.get_textile_baseline()


@router.get("/circuits", response_model=CircuitsSummary)
def list_circuits() -> CircuitsSummary:
    """Circuitos e viaturas de recolha atuais da Vitrus (base para a recolha a pedido)."""
    return service.get_circuits()


@router.get("/flows", response_model=Flows)
def get_observed_flows() -> Flows:
    """Fluxo observado entidade → destino em toneladas (Sankey do ponto de partida)."""
    return service.get_observed_flows()


@router.get("/waste", response_model=WasteComposition)
def get_waste_composition() -> WasteComposition:
    """Composição dos resíduos urbanos: onde os têxteis pesam face ao resto."""
    return service.get_waste_composition()
