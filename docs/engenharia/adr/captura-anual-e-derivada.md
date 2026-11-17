# Captura anual é derivada, nunca auto-calibrada pelo piloto

O que a rede observa (pesos medidos por paragem, pedidos) calibra **quatro métricas operacionais** — taxa de geração (kg/dia por local), kg por saco, sacos por ronda por freguesia, pedidos por semana — e a captura anual passa a ser **derivada** (taxa × frequência do degrau; sacos por ronda × rondas por ano), limitada pela procura da APA. O *q* (1,596 kg/hab/mês) e os priores dos locais nunca visitados **nunca são substituídos automaticamente**, e a calibração só entra quando alguém recalcula o cenário.

- **Decidido a 17 de novembro de 2026** ([#53](https://github.com/helderpgoncalves/novelo/issues/53)); mecanismo (janela de 12 semanas, mediana, pseudo-contagem) em [dados-e-modelo](../dados-e-modelo.md#calibração).
- **Porquê:** quem adere nos primeiros meses de um piloto não é representativo (viés de adoção); deixar o observado reescrever a procura faria o modelo «ver» menos têxtil do que existe e encolher o plano em silêncio.
- **Alternativa rejeitada:** calibração automática semanal da taxa de captura por modo (era a fórmula documentada antes da escada de frequências; substituída por esta decisão).
