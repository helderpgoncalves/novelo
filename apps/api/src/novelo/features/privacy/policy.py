"""A política de privacidade da conta de doador: UMA fonte, tipada, renderizada tal e qual.

O ecrã público (/politica-dados no web) lê-a da API (`GET /public/privacy-policy`) — nunca há uma
segunda cópia em TypeScript nem em Markdown: mudou algo, muda AQUI e a página segue. Prazos por
categoria são obrigatórios (art. 13.º/2/a RGPD; omiti-los é contraordenação muito grave, Lei 58/2019
art. 37.º/1/h) e cada um aponta para o sítio do código que o aplica, para a política não envelhecer
longe da implementação.

Bases legais (ADR «RGPD da conta de doador»): conta e crédito = contrato (art. 6.º/1/b); antifraude e
tetos = interesse legítimo declarado (art. 6.º/1/f); marketing e parcerias = consentimento prévio e
expresso em duas camadas (art. 6.º/1/a + Lei 41/2004, art. 13.º-A). Responsável: a Vitrus; a plataforma
Novelo é subresponsável (DPA antes de qualquer piloto com dados reais).
"""

from enum import StrEnum

from pydantic import BaseModel, ConfigDict

# Muda quando o texto ou os prazos mudarem: é esta chave que fica nos registos de consentimento.
POLICY_VERSION = "doadores-2026-11"

CONTROLLER = (
    "Vitrus — Gestão e Valorização de Resíduos Sólidos, E.M. (responsável pelo tratamento). "
    "A plataforma Novelo é subresponsável, por conta e instruções da Vitrus."
)


class PurposeId(StrEnum):
    """Identificadores estáveis das finalidades (o contrato público da política entre versões)."""

    CONTA = "conta"
    SACOS = "sacos"
    PEDIDOS = "pedidos"
    PONTOS = "pontos"
    TRIAGEM = "triagem"
    LOGS = "logs_autenticacao"
    MARKETING = "marketing"
    PARCERIAS = "parcerias"


class PolicyCategory(BaseModel):
    """Uma categoria de dados dentro de uma finalidade, com o SEU prazo de conservação."""

    model_config = ConfigDict(frozen=True)

    name: str
    retention: str
    applied_by: str  # onde o prazo vive no código (documentação viva, não texto morto)


class PolicyPurpose(BaseModel):
    """Uma finalidade de tratamento: base legal, texto claro e as categorias com prazos."""

    model_config = ConfigDict(frozen=True)

    id: PurposeId
    title: str
    legal_basis: str
    description: str
    consent_required: bool = False
    categories: list[PolicyCategory]


class PolicyOut(BaseModel):
    """A política inteira, como a página pública a recebe (JSON; a web só desenha)."""

    model_config = ConfigDict(frozen=True)

    version: str
    controller: str
    minimum_age: int
    rights: list[str]
    purposes: list[PolicyPurpose]


def policy() -> PolicyOut:
    """A política em vigor. ÚNICA fonte: a página pública e os registos de consentimento daqui saem."""
    return PolicyOut(
        version=POLICY_VERSION,
        controller=CONTROLLER,
        minimum_age=13,
        rights=[
            "Aceder aos teus dados e exportá-los (portabilidade, formato JSON)",
            "Corrigir ou apagar a conta — o apagamento perde o saldo de pontos",
            "Retirar o consentimento de marketing e parcerias a qualquer momento",
            "Reclamar à CNPD (cnpd.pt)",
        ],
        purposes=[
            PolicyPurpose(
                id=PurposeId.CONTA,
                title="A conta de doador e a entrada sem password",
                legal_basis="Contrato — art. 6.º/1/b RGPD (a conta é o serviço que pedes)",
                description=(
                    "O email é o identificador da conta e basta (nome é opcional). A entrada é por "
                    "magic link enviado para o teu email, sem password. Menores de 13 anos não abrem "
                    "conta (recusa explícita na criação; art. 16.º da Lei 58/2019)."
                ),
                categories=[
                    PolicyCategory(
                        name="Email e perfil (nome, idade declarada, código NVA- da conta)",
                        retention="Enquanto a conta existir; apagada com ela",
                        applied_by="users (a linha da conta é apagada no apagamento)",
                    ),
                    PolicyCategory(
                        name="Registos de entrada por magic link (IP e dispositivo)",
                        retention="12 meses",
                        applied_by="features/privacy/service.py (purga diária; ADR: logs de autenticação)",
                    ),
                ],
            ),
            PolicyPurpose(
                id=PurposeId.SACOS,
                title="Sacos ativados (o crédito é por saco, nunca por kg)",
                legal_basis="Contrato — art. 6.º/1/b RGPD",
                description=(
                    "O QR do saco liga a entrega à tua conta no momento da pesagem. O apelido do saco "
                    "é privado (só tu o vês) e lotes e passaportes públicos nunca mostram doadores."
                ),
                categories=[
                    PolicyCategory(
                        name="Código do saco e declaração «Vai no saco?»",
                        retention="Sobrevive à conta em forma anónima (sem pessoa; alimenta agregados)",
                        applied_by="bag_activations.user_id é SET NULL no apagamento",
                    ),
                    PolicyCategory(
                        name="Apelido privado do saco",
                        retention="Apagado com a conta",
                        applied_by="features/privacy/service.py (apagamento: nickname a nulo)",
                    ),
                ],
            ),
            PolicyPurpose(
                id=PurposeId.PEDIDOS,
                title="Pedidos de recolha a pedido (fora do dia da ronda)",
                legal_basis="Contrato — art. 6.º/1/b RGPD",
                description=(
                    "A morada que escreves serve só a esse pedido (nunca GPS; a freguesia liga o pedido "
                    "à ronda). Depois da purga fica a freguesia — é ela que alimenta as estatísticas."
                ),
                categories=[
                    PolicyCategory(
                        name="Morada do pedido",
                        retention="12 meses (e imediatamente se apagares a conta)",
                        applied_by="domain/collection_requests.py ADDRESS_RETENTION_MONTHS; purga à leitura",
                    ),
                    PolicyCategory(
                        name="Estado e contagem do pedido (freguesia, sacos, data)",
                        retention="Sobrevive à conta em forma anónima (histórico estatístico)",
                        applied_by="collection_requests.requester_id é SET NULL no apagamento",
                    ),
                ],
            ),
            PolicyPurpose(
                id=PurposeId.PONTOS,
                title="O livro de pontos",
                legal_basis="Contrato — art. 6.º/1/b RGPD",
                description=(
                    "Cada ganho por saco, cada resgate e cada anulação ficam num livro-razão imutável "
                    "(auditoria). Os pontos valem 12 meses por ganho, os mais antigos primeiro, e não "
                    "são dinheiro nem conversíveis."
                ),
                categories=[
                    PolicyCategory(
                        name="Extrato e saldo da tua conta",
                        retention="Enquanto a conta existir; apagados com ela",
                        applied_by="points_entries.user_id é SET NULL no apagamento (o crédito morre)",
                    ),
                    PolicyCategory(
                        name="Linhas do livro-razão sem pessoa (código do saco, lote, data)",
                        retention="Sem prazo — agregados estatísticos (art. 89.º/1 RGPD)",
                        applied_by="features/points/models.py (linhas órfãs alimentam os agregados)",
                    ),
                ],
            ),
            PolicyPurpose(
                id=PurposeId.TRIAGEM,
                title="Triagem das peças (confirmar o destino e o bónus de conformidade)",
                legal_basis="Contrato e interesse legítimo declarado — art. 6.º/1/b e 1/f RGPD",
                description=(
                    "A triagem é feita por operadores e confirmada por pessoas; o crédito do saco é "
                    "execução do contrato, não decisão automatizada (art. 22.º). As fotos nunca "
                    "mostram doadores nem são públicas além do passaporte do lote."
                ),
                categories=[
                    PolicyCategory(
                        name="Miniaturas opcionais das peças (sem pessoas, confirmadas pelo operador)",
                        retention="90 dias",
                        applied_by="LOT_PHOTO_RETENTION_DAYS + purga diária (features/lots/photo_store.py)",
                    ),
                ],
            ),
            PolicyPurpose(
                id=PurposeId.LOGS,
                title="Segurança da entrada (registos de magic link)",
                legal_basis="Interesse legítimo declarado — art. 6.º/1/f RGPD (segurança da conta)",
                description=(
                    "Guardamos o registo de cada pedido de entrada (quando, IP, dispositivo) para "
                    "deteção de abuso. O código do link em si nunca é guardado — só o facto."
                ),
                categories=[
                    PolicyCategory(
                        name="Registos de tentativa de entrada (magic link)",
                        retention="12 meses",
                        applied_by="features/privacy/service.py (purga diária de login_tokens)",
                    ),
                ],
            ),
            PolicyPurpose(
                id=PurposeId.MARKETING,
                title="Comunicações de marketing da Vitrus (novidades da rede)",
                legal_basis="Consentimento prévio e expresso — art. 6.º/1/a RGPD + Lei 41/2004, art. 13.º-A",
                description=(
                    "Caixa própria, desligada por defeito, nunca dentro dos termos. Podes retirar "
                    "quando quiseres, aqui na tua conta ou em cada mensagem — é tão fácil retirar "
                    "como dar."
                ),
                consent_required=True,
                categories=[
                    PolicyCategory(
                        name="Envios de marketing (só se activares esta camada)",
                        retention="Até retirares o consentimento",
                        applied_by="donor_consents (última linha por finalidade)",
                    ),
                    PolicyCategory(
                        name="Registo das tuas decisões de consentimento (prova auditável)",
                        retention="Enquanto útil como prova; anónimo após o apagamento da conta",
                        applied_by="donor_consents.user_id é SET NULL no apagamento",
                    ),
                ],
            ),
            PolicyPurpose(
                id=PurposeId.PARCERIAS,
                title="Ofertas de parceiros (prémios do catálogo)",
                legal_basis=(
                    "Consentimento prévio e expresso — Lei 41/2004, art. 13.º-A; o soft opt-in nunca "
                    "vale para parceiros (CNPD, DIRETRIZ/2022/1)"
                ),
                description=(
                    "Camada separada do marketing da Vitrus, desligada por defeito. O soft opt-in "
                    "nunca vale para parceiros. ZERO partilha por defeito: o parceiro nunca recebe os "
                    "teus dados — só vê o código pseudónimo do resgate quando o apresentas."
                ),
                consent_required=True,
                categories=[
                    PolicyCategory(
                        name="Envios de parceiros (só se activares esta camada)",
                        retention="Até retirares o consentimento",
                        applied_by="donor_consents (última linha por finalidade)",
                    ),
                    PolicyCategory(
                        name="Código de resgate pseudónimo (o único contacto com o parceiro)",
                        retention="A vida do prémio; sem qualquer ligação visível à tua identidade",
                        applied_by="resgate por código pseudónimo (ADR «resgate-por-codigo-pseudonimo»)",
                    ),
                ],
            ),
        ],
    )


__all__ = ["POLICY_VERSION", "PolicyCategory", "PolicyOut", "PolicyPurpose", "PurposeId", "policy"]
