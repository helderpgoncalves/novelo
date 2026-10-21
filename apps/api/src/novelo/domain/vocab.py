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
    CONTAINER_ROWS_REJECTED = "container_rows_rejected"
    CONTAINER_PENDING_LOCATION = "container_pending_location"
    CONTAINER_ASSUMED_VALUES = "container_assumed_values"
    # Pacote QGIS dos contentores municipais (outras frações, não é têxtil): alertas de `municipal_alerts.csv`.
    MUNICIPAL_BLANK_ROWS = "municipal_blank_rows"
    MUNICIPAL_BOUNDARY_TOLERANCE = "municipal_boundary_tolerance"
    MUNICIPAL_CAOP_VERSION = "municipal_caop_version"
    MUNICIPAL_CAOP_VS_OSM = "municipal_caop_vs_osm"
    MUNICIPAL_CAPACITY_OUTLIER = "municipal_capacity_outlier"
    MUNICIPAL_CAPACITY_UNIT_ASSUMED = "municipal_capacity_unit_assumed"
    MUNICIPAL_CAPACITY_UNKNOWN = "municipal_capacity_unknown"
    MUNICIPAL_COORD_SUSPECT = "municipal_coord_suspect"
    MUNICIPAL_COORDS_ARTIFACT = "municipal_coords_artifact"
    MUNICIPAL_COORDS_LOW_PRECISION = "municipal_coords_low_precision"
    MUNICIPAL_COORDS_MISSING = "municipal_coords_missing"
    MUNICIPAL_COORDS_SWAPPED = "municipal_coords_swapped"
    MUNICIPAL_CROSS_FILE_OVERLAP = "municipal_cross_file_overlap"
    MUNICIPAL_EMPTY_ROW = "municipal_empty_row"
    MUNICIPAL_NOT_TEXTILE = "municipal_not_textile"
    MUNICIPAL_OSM_CONTOURS_INCOMPLETE = "municipal_osm_contours_incomplete"
    MUNICIPAL_OUTSIDE_MUNICIPALITY = "municipal_outside_municipality"
    MUNICIPAL_PARISH_MISMATCH = "municipal_parish_mismatch"
    MUNICIPAL_PARISH_NAMES_INCONSISTENT = "municipal_parish_names_inconsistent"
    MUNICIPAL_PARISH_UNMAPPED = "municipal_parish_unmapped"
    MUNICIPAL_QUANTITY_SEMANTICS = "municipal_quantity_semantics"
    MUNICIPAL_STACKED_UNITS = "municipal_stacked_units"
    MUNICIPAL_STREAM_UNKNOWN = "municipal_stream_unknown"


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


class CoverageState(StrEnum):
    OK = "ok"
    AWAITING_DATA = "awaiting_data"  # ainda não há contentores importados


class ScenarioObjective(StrEnum):
    MAX_TONNES = "max_tonnes"  # maximizar o têxtil captado com um orçamento
    MIN_COST = "min_cost"  # minimizar o custo para atingir uma meta de captura


class ScenarioStatus(StrEnum):
    COMPUTED = "computed"
    INFEASIBLE = "infeasible"


class CollectionMode(StrEnum):
    """Modos de recolha de têxteis que o simulador compara.

    A Vitrus não tem contentores de têxtil nem os quer: por omissão só `existing` e `on_demand`. `street` fica no
    vocabulário (base de dados e contrato) apenas como referência explícita, ex.: o benchmark francês.
    """

    EXISTING = "existing"  # local existente, sem contentor novo: entrega assistida ou paragem onde a viatura já passa
    STREET = "street"  # contentor de rua: só referência
    ON_DEMAND = "on_demand"  # recolha a pedido, porta a porta, nos circuitos que já existem


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


class Tipau(StrEnum):
    """Tipologia de Áreas Urbanas do INE: define o custo de recolher em território urbano ou rural."""

    APU = "apu"  # predominantemente urbana
    AMU = "amu"  # mediamente urbana
    APR = "apr"  # predominantemente rural


# --- Rede MUNICIPAL (outras frações; nunca confundir com os contentores de têxteis) -----------------------------


class MunicipalKind(StrEnum):
    """Tipo de contentor municipal (ficheiro de origem + equipamento)."""

    UNDERGROUND = "underground"  # enterrado/semienterrado (molok, bluebee, greenbee)
    PLATFORM = "platform"  # "plataforma": equipamento por esclarecer (2 casos)
    SURFACE = "surface"  # contentor de rodas de 1 100 L
    ORGANIC_COLLECTIVE = "organic_collective"
    ORGANIC_PRODUCER = "organic_producer"  # contentor de um produtor (restauração, escola, lar...)
    GREEN_WASTE = "green_waste"


class MunicipalStream(StrEnum):
    """Fração. Só se afirma o que os ficheiros dizem: enterrados e superfície ficam `unknown`."""

    ORGANIC = "organico"
    GREEN = "verdes"
    UNKNOWN = "desconhecido"


class ProducerType(StrEnum):
    RESTAURANT = "restaurant"
    SCHOOL = "school"
    ESTABLISHMENT = "establishment"
    LARGE_PRODUCER = "large_producer"
    CARE_HOME = "care_home"
    HOSPITALITY = "hospitality"


class SiteClass(StrEnum):
    PUBLIC = "public"  # só contentores de rua
    PRODUCER = "producer"  # só contentores de produtores
    MIXED = "mixed"


class CoordPrecision(StrEnum):
    PRECISE = "precise"  # 4 ou mais casas decimais
    APPROXIMATE = "approximate"  # 3 casas ou menos (~100 m)


class CoordStatus(StrEnum):
    OK = "ok"
    PENDING = "pending"  # sem coordenadas: conta como contentor, não entra no mapa


class CapacityStatus(StrEnum):
    OK = "ok"
    ASSUMED_LITRES = "assumed_litres"  # sem unidade no ficheiro: lido como litros (assumido)
    UNKNOWN = "unknown"


class ParishMatch(StrEnum):
    """Freguesia declarada no ficheiro contra o polígono CAOP que contém o ponto."""

    EQUAL = "igual"
    DIFFERENT = "diferente"
    NO_COORDS = "sem_coord"
    UNMAPPED = "nao_mapeada"  # o nome declarado não é de uma freguesia (ex.: "Cidade")


class ParishMatchLevel(StrEnum):
    EXACT = "exact"
    SAME_WORDS = "same_words"
    CONTAINS_NAME = "contains_name"
    PARTIAL = "partial"
    NONE = "none"


class MunicipalSourceFile(StrEnum):
    UNDERGROUND = "profundidade"
    SURFACE = "superficie"
    ORGANIC_COLLECTIVE = "organico_coletivo"
    ORGANIC_PRODUCER = "organico_tipologia"
    GREEN_WASTE = "residuos_verdes"


PRODUCER_TYPE_LABELS: dict[ProducerType, str] = {
    ProducerType.RESTAURANT: "Restauração",
    ProducerType.SCHOOL: "Escola",
    ProducerType.ESTABLISHMENT: "Estabelecimento",
    ProducerType.LARGE_PRODUCER: "Grandes produtores",
    ProducerType.CARE_HOME: "Lar",
    ProducerType.HOSPITALITY: "Hotelaria",
}
