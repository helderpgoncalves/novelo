"""Vocabulário fechado do domínio. Fonte única dos valores: o ORM, a API (OpenAPI/hey-api) e o web usam-nos.

São `StrEnum`: o valor guardado na base de dados e enviado na API é a string em inglês; as traduções
vivem no web (messages/*.json). Para acrescentar um valor: aqui, migração, `just gen`, tradução.
"""

from enum import StrEnum


class Typology(StrEnum):
    """Tipologia de resíduo do circuito (folha "Resumo")."""

    ORGANIC = "organic"
    UNDIFFERENTIATED = "undifferentiated"
    RECYCLABLE = "recyclable"
    BULKY = "bulky"
    PAYT = "payt"
    SUPPORT = "support"
    TO_CONFIRM = "to_confirm"
    UNASSIGNED = "unassigned"


class CollectionType(StrEnum):
    DOOR_TO_DOOR = "door_to_door"  # PAP
    MOLOKS = "moloks"
    CONTAINERS = "containers"
    UNSPECIFIED = "unspecified"


class CircuitStatus(StrEnum):
    OK = "ok"
    NO_VEHICLE = "no_vehicle"
    WEEKEND_ONLY = "weekend_only"
    UNASSIGNED = "unassigned"


class DayGroup(StrEnum):
    WEEKDAY = "weekday"  # segunda a sexta
    SATURDAY = "saturday"
    SUNDAY = "sunday"


class Shift(StrEnum):
    MORNING = "morning"
    AFTERNOON = "afternoon"
    NIGHT = "night"


class AlertKind(StrEnum):
    CIRCUIT_WITHOUT_VEHICLE = "circuit_without_vehicle"
    VEHICLE_CODE = "vehicle_code"
    UNKNOWN_CIRCUIT = "unknown_circuit"
    INCOMPLETE_CIRCUIT = "incomplete_circuit"
    DUPLICATE_VEHICLE = "duplicate_vehicle"
    POSSIBLE_PLATE_ERROR = "possible_plate_error"
    MULTI_TYPOLOGY_VEHICLE = "multi_typology_vehicle"
    VEHICLE_WITHOUT_CIRCUIT = "vehicle_without_circuit"
    UNDOCUMENTED_CIRCUITS = "undocumented_circuits"
    DIFFERENT_DATES = "different_dates"
    NORMALIZED_SPELLING = "normalized_spelling"


class AlertStatus(StrEnum):
    OPEN = "open"
    RESOLVED = "resolved"
    WONT_FIX = "wont_fix"


class TextileDestination(StrEnum):
    REUSE = "reuse"
    RECYCLE = "recycle"
    REJECT = "reject"


class WeighingMethod(StrEnum):
    WEIGHED = "weighed"  # kg exatos por destino
    PERCENTAGE = "percentage"  # percentagens de um relatório aplicadas ao total pesado


class WasteScope(StrEnum):
    EUROPE = "europe"
    PORTUGAL = "portugal"


class WasteCategory(StrEnum):
    BIOWASTE = "biowaste"
    UNDIFFERENTIATED = "undifferentiated"
    PAPER = "paper"
    PLASTIC = "plastic"
    GLASS = "glass"
    WOOD = "wood"
    METALS = "metals"
    OTHERS = "others"
    COMPOSITES = "composites"
    TEXTILES = "textiles"
    SANITARY_TEXTILES = "sanitary_textiles"
    BULKY = "bulky"


class ContainerKind(StrEnum):
    TEXTILE = "textile"
    UNDIFFERENTIATED = "undifferentiated"
    ORGANIC = "organic"
    RECYCLABLE = "recyclable"
    OTHER = "other"


class ContainerStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    PLANNED = "planned"


class ScenarioObjective(StrEnum):
    MAX_TONNES = "max_tonnes"  # maximizar o têxtil captado com um orçamento
    MIN_COST = "min_cost"  # minimizar o custo para atingir uma meta de captura


class ScenarioStatus(StrEnum):
    COMPUTED = "computed"
    INFEASIBLE = "infeasible"


class CollectionMode(StrEnum):
    """Modos de recolha de têxteis que o simulador compara."""

    EXISTING = "existing"  # ponto em local existente (junta, escola, supermercado)
    STREET = "street"  # contentor de rua
    ON_DEMAND = "on_demand"  # recolha a pedido, aproveitando rotas existentes


class Fibre(StrEnum):
    COTTON = "cotton"
    WOOL = "wool"
    POLYESTER = "polyester"
    NYLON = "nylon"
    VISCOSE = "viscose"
    LINEN = "linen"
    ACRYLIC = "acrylic"
    ELASTANE = "elastane"
    SILK = "silk"
    OTHER = "other"
    UNKNOWN = "unknown"


class GarmentType(StrEnum):
    TSHIRT = "tshirt"
    SHIRT = "shirt"
    TROUSERS = "trousers"
    JUMPER = "jumper"
    JACKET = "jacket"
    DRESS = "dress"
    SKIRT = "skirt"
    BEDDING = "bedding"
    TOWEL = "towel"
    OTHER = "other"


class LotState(StrEnum):
    COLLECTED = "collected"  # aberto no ponto de recolha, a receber peças
    SORTED = "sorted"  # triado e fechado: visível na bolsa de fibra
    RESERVED = "reserved"  # um reciclador manifestou interesse
    DELIVERED = "delivered"  # entregue ao destino


class LotEventKind(StrEnum):
    OPENED = "opened"
    ITEM_ADDED = "item_added"
    SORTED = "sorted"
    RESERVED = "reserved"
    DELIVERED = "delivered"


class WhatIfStatus(StrEnum):
    PROPOSED = "proposed"  # o modelo percebeu a pergunta; aguarda confirmação
    APPLIED = "applied"  # confirmada e calculada
    REJECTED = "rejected"  # ambígua ou fora das listas fechadas
