"""Referências externas e marcos regulatórios da página inicial.

Só entra aqui o que está registado em docs/pesquisa/registo-de-afirmacoes.md (códigos A, B, C) e em
docs/pesquisa/benchmarks-internacionais.md, com o estado de verificação lá indicado. `verified` é verdadeiro
quando há fonte primária ou secundária lida; "Por verificar" e "Pressuposto" ficam `False`. Para alterar um valor,
altera primeiro o registo.
"""

from dataclasses import dataclass
from datetime import date
from typing import Literal

Evidence = Literal["dado_vitrus", "primary", "secondary", "unverified"]
ReferenceScope = Literal["municipality", "region", "country", "eu"]
WhoPays = Literal["municipality", "producers"]


@dataclass(frozen=True)
class ExternalReference:
    key: str
    label: str
    kg_per_inhab_year: float
    year: int
    scope: ReferenceScope
    evidence: Evidence
    source_label: str
    source_url: str | None

    @property
    def verified(self) -> bool:
        return self.evidence != "unverified"


# Comparáveis externos de recolha seletiva (kg/hab/ano). Os valores de Guimarães calculam-se a partir da BD.
EXTERNAL_REFERENCES: tuple[ExternalReference, ...] = (
    ExternalReference(  # C1
        key="france_2024",
        label="França",
        kg_per_inhab_year=4.27,
        year=2024,
        scope="country",
        evidence="secondary",
        source_label="Refashion, via FashionNetwork",
        source_url="https://fr.fashionnetwork.com/news/La-france-a-collecte-pres-de-300-000-tonnes-de-textiles-usages-en-2024,1746041.html",
    ),
    ExternalReference(  # C8
        key="eu27_2020",
        label="Média UE-27",
        kg_per_inhab_year=4.4,
        year=2020,
        scope="eu",
        evidence="primary",
        source_label="Agência Europeia do Ambiente, Briefing 03/2024",
        source_url="https://www.eea.europa.eu/en/analysis/publications/management-of-used-and-waste-textiles-in-europes-circular-economy",
    ),
    ExternalReference(  # C11
        key="catalonia_2024",
        label="Catalunha",
        kg_per_inhab_year=2.7,
        year=2024,
        scope="region",
        evidence="secondary",
        source_label="Agència de Residus de Catalunya",
        source_url="https://residus.gencat.cat/ca/ambits_dactuacio/tipus_de_residu/residus_textils/",
    ),
    ExternalReference(  # benchmarks-internacionais.md: "cerca de 2 kg/hab em 2022", por verificar
        key="germany_2022",
        label="Alemanha",
        kg_per_inhab_year=2.0,
        year=2022,
        scope="country",
        evidence="unverified",
        source_label="Statista (via pesquisa); por verificar",
        source_url=None,
    ),
)

# Potencial do plano municipal: 0,7 kg/hab/mês (A8, "Por verificar": fonte pública do plano não localizada).
PLAN_KG_PER_INHAB_MONTH = 0.7
PLAN_SOURCE_LABEL = "Plano municipal de resíduos (fonte pública por localizar); por verificar"
FRANCE_KEY = "france_2024"


@dataclass(frozen=True)
class Milestone:
    key: str
    date: date
    who_pays: WhoPays
    evidence: Evidence
    source_label: str
    source_url: str | None

    @property
    def verified(self) -> bool:
        return self.evidence != "unverified"


_APA_FAQ = "https://apambiente.pt/sites/default/files/_Residuos/FluxosEspecificosResiduos/Texteis/perguntas-frequentes_texteis.pdf"
_EURLEX = "https://eur-lex.europa.eu/legal-content/PT/TXT/HTML/?uri=OJ:L_202501892"

# Quem paga: até aos regimes de RAP o município paga sozinho (APA: sem entidade gestora nem regime aprovado, B11);
# depois os produtores, só até ao custo economicamente eficiente (art. 22.º-A n.º 8 e 12, B5 e B6).
MILESTONES: tuple[Milestone, ...] = (
    Milestone(  # B1
        key="municipal_obligation",
        date=date(2025, 1, 1),
        who_pays="municipality",
        evidence="primary",
        source_label="APA, perguntas frequentes sobre têxteis (dez 2025)",
        source_url=_APA_FAQ,
    ),
    Milestone(  # B3
        key="transposition_deadline",
        date=date(2027, 6, 17),
        who_pays="municipality",
        evidence="primary",
        source_label="Diretiva (UE) 2025/1892, art. 2.º; APA",
        source_url=_EURLEX,
    ),
    Milestone(  # B4
        key="epr_regimes",
        date=date(2028, 4, 17),
        who_pays="producers",
        evidence="primary",
        source_label="Diretiva (UE) 2025/1892, art. 22.º-A; APA",
        source_url=_EURLEX,
    ),
)
