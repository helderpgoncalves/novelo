# Política de paragem: dinâmica na frequência, nunca no salto

A viatura para à porta em **toda a ronda** (universal, um dia fixo por freguesia) e nos locais por uma frequência escolhida pelo otimizador numa **escada discreta** (semanal, quinzenal, mensal, trimestral). O aviso «sacos prontos» de um local **garante paragem** nesse dia; a falta de aviso **nunca corta uma visita publicada** — a agenda pública é uma promessa do serviço municipal e um saco que fica ao tempo perde reutilização, que é onde está o valor.

- **Decidido a 17 de novembro de 2026** ([#42](https://github.com/helderpgoncalves/novelo/issues/42)); os degraus exatos da escada ficam como pressuposto com fonte em [dados-e-modelo](../dados-e-modelo.md).
- **Alternativas rejeitadas:** parar só onde há pedido ou aviso (transfere o risco de procura para o cidadão e esvazia a agenda pública); limiar contínuo de kg/visita (ilegível na agenda e não encaixa no parâmetro inteiro de recolhas por ano).
- **Consequências:** a poupança mora em parar **com menos frequência** onde há menos procura, não em saltar visitas; nenhuma visita publicada é saltada à míngua de aviso, e urgências são exceção despachada pela Vitrus.
