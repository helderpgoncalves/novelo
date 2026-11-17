# Novelo

Glossário canónico do domínio do Novelo, a ferramenta de decisão da rede de recolha de têxteis de Guimarães. Definições de termos; decisões e razões estão nos [ADR](docs/engenharia/adr/README.md).

## Rede e recolha

**Ronda**:
Volta universal da viatura de têxtil à porta de uma freguesia, num dia fixo. Todo o saco bem posto é recolhido, tenha ou não pedido.
_Avoid_: circuito (é do RSU da Vitrus), volta

**Recolha a pedido**:
Pedido opcional, com conta, que dá certeza de recolha (data e aviso) num saco que a ronda já apanha. Não encolhe a ronda.
_Avoid_: recolha expressa

**Aviso («sacos prontos»)**:
Sinal de um local («estou pronto, vem cá») que garante paragem nesse dia. Única escrita da conta de local no MVP.

**Política de paragem**:
Regra que decide quando a viatura para: aviso garante; sem aviso, a frequência segue a procura na escada; visita publicada nunca é saltada.

**Escada de frequências**:
Degraus discretos de visita a um local (semanal, quinzenal, mensal, trimestral) entre os quais o otimizador escolhe.
_Avoid_: limiar contínuo

**Sinal de procura**:
Pedido do cidadão ou aviso de local: primeira classe no planeamento, sempre agregado (nunca evento individual).

**Paragem**:
Âncora do lote: uma paragem da viatura, à porta ou num local. Dela nasce um lote de recolha.

**Local assistido**:
Sítio com pessoas (escolas no MVP) com conta própria de leitura e aviso. A conta pertence ao local, não à pessoa.
_Avoid_: ponto assistido

**Produtor B2B**:
Lar ou unidade hoteleira (17 + 9 nos dados da Vitrus) que usa a conta de local com pedido de recolha de volume e sem pontos.

**Viatura de têxtil**:
Viatura nova, de caixa fechada e sem compactação, dedicada ao têxtil, sediada no estaleiro de Polvoreira. O saco nunca vai na compactadora do RSU.

**Modo de recolha**:
`existing` (local existente, sem contentor novo), `on_demand` (saco à porta na ronda) e `street` (contentor de rua, só referência — a Vitrus não quer contentores de têxtil).

## Lotes e triagem

**Lote de recolha**:
O que nasce na viatura: um lote por paragem, pesado e etiquetado no momento.
_Avoid_: lote do circuito

**Lote de escoamento**:
Lote vendável, fechado por (estado, tipologia, estação, género), com linhagem preservada até aos lotes de recolha.

**Passaporte**:
Página pública de um lote (origem, composição, peso, histórico), aberta pelo QR. Nunca mostra o doador.

**Estado fino**:
Nível de qualidade em 4 graus + reciclar/rejeitar, mapeado nos 3 destinos. Atributo confirmável pelo operador (padrão-ouro) e estimado pela IA.

**Taxonomia da triagem**:
Vocabulário fechado e versionado (`domain/taxonomy.py`, v1) dos seis eixos — estado fino, tipologia (+ calçado e acessório), estação, cor, género e tamanho em bandas lidas só da etiqueta. A chave do lote de escoamento usa estado fino, tipologia, estação e género; cor e tamanho ficam para filtros.

**Proveniência**:
De onde veio o valor de um atributo: proposto pela IA («IA», com a confiança da proposta) ou definido pelo operador («confirmado»). Guardada por atributo e mostrada em selos no ecrã de triagem.

**Linhagem**:
Rastreio das peças de um lote de escoamento até aos lotes de recolha de origem.

**Rótulo dourado**:
Correção do operador à triagem da IA; vira exemplo de avaliação por eixo.

**Triagem pré-recolha**:
A decisão antes de fechar o saco («Vai no saco?»): o cidadão declara em binário, o operador confirma na triagem.

**Bónus de conformidade**:
Pontos extra creditados a quem declarou o conteúdo do saco e a triagem confirmou.

## Cidadão, pontos e parcerias

**Doador**:
Entidade com conta a quem o saco ativado é creditado. Sem conta, o saco entra sem crédito.
_Avoid_: utilizador (é a conta da app de gestão), cliente

**Saco ativado**:
Saco da plataforma com QR único, ativado no app com apelido privado; unidade de crédito (nunca kg).
_Avoid_: saco registado

**Pontos**:
Moeda de incentivo, ganha por saco recolhido (mais bónus de conformidade), com teto mensal. Não são dinheiro nem conversíveis.
_Avoid_: prémios (estão no catálogo), ponto assistido/paragem (são sítios)

**Código de resgate**:
Código pseudónimo que troca pontos por prémio sem revelar o doador ao parceiro.

**Catálogo de prémios**:
Donativos a IPSS (âncora em €) e prémios cedidos por parceiros locais. Nunca dinheiro nem vouchers de moda.

**Acumulado ambiental**:
Total verificado de têxtil entregue pelo doador, em kg, sem valor comercial.

**Campanha de pontos**:
Janela sazonal da Vitrus que aumenta o ganho ou muda o catálogo.

**Gestor de parcerias**:
Ecrã da app de gestão onde um parceiro local é proposto (freguesias podem propor) e administrado.

**Benefício municipal**:
Vantagem em serviços municipais trocável por pontos, criada por deliberação ou regulamento (fases 2–4, pós-MVP).

**Mecenato**:
Enquadramento contabilístico do donativo a IPSS (EBF art. 62.º, redação DL 167/2026).

## Modelo e planeamento

**Pressuposto**:
Valor sem fonte local, sempre etiquetado «estimativa» e editável nos pressupostos. O contrário de medido.

**Custo evitado**:
Tratamento de indiferenciado que se deixa de pagar por tonelada desviada: 105,64 €/t (TGR + Resinorte).
_Avoid_: receita

**Captura**:
Fatia da procura que a rede recolhe. Anual e derivada (taxa × frequência; sacos por ronda × rondas), nunca auto-calibrada pelo piloto.

**Taxa de geração**:
Estado calibrado de um local: kg/dia derivados do peso medido ÷ intervalo entre visitas. Kg/visita = taxa × intervalo do degrau.

**Prior de procura**:
Estimativa antes de amostra: proxy de litros × captura no local novo; calibrado concelho afora pelos locais visitados.

**Janela de observação**:
12 semanas móveis de medições por métrica e unidade, resumidas pela mediana.

**Retroalimentação**:
Ciclo que troca pressupostos por observado (pesos, pedidos) nas métricas operacionais, ao recalcular o cenário.
_Avoid_: recalibração automática

**Cenário**:
Execução do otimizador com parâmetros fotográficos (incluindo a calibração usada), comparável com outros.

## Siglas e entidades

**RAP**: responsabilidade alargada do produtor (diretiva até 17 abr 2028). **PAP**: porta a porta. **Molok**: contentor enterrado/semienterrado. **PAYT**: pay-as-you-throw. **RSU**: resíduos sólidos urbanos. **TIPAU**: tipologia de áreas urbanas do INE. **Vitrus**: empresa municipal de resíduos de Guimarães. **IPSS**: instituição particular de solidariedade social.
