# Plano do vídeo — apresentação à Vitrus e à Câmara

Adaptação do vídeo do hackathon (Remotion, `video/`, 2 min 14 s em 16:9 e 9:16) à sessão de **12 de novembro de 2026**. O vídeo não se passa na sala se a demonstração ao vivo correr — a demo é que vale. Serve para:

1. **Plano B** — se a produção ou a rede falharem a meio da demo (blocos 5 e 6 do [guião](apresentacao-vitrus-guiao.md));
2. **Deixar na pasta** — pen/QR para o presidente e a Vitrus verem depois, com o fecho certo (os três pedidos, não os critérios do júri).

## 1. O que muda em relação ao vídeo do hackathon

| Agora (2:14) | Passa a (~90 s) |
| --- | --- |
| Abertura sem contexto de sessão | Linha «Vitrus · Município de Guimarães · novembro 2026» |
| «Em resumo»: impacto, inovação, viabilidade, continuidade (critérios do júri) | **Fora.** Nenhuma referência a júri, prémios ou critérios de hackathon |
| Pedido final: «piloto de 3 meses» | Fecho novo: **frase-âncora + os três pedidos + QR** |
| Sem cenário «Piloto» | Cena nova (8 s): o piloto de Aldão + Arosa e Castelões no mapa |
| Sem «Vai no saco?» | Micro-cena (4 s), **só se o deploy do PR #20 sair** |

Mantêm-se, porque já vêm dos dados reais: o número (51 250,6 t × 5,86% ≈ 3 003,3 t, estimativa), os 9 em cada 10, o destino (59,4/26,5/14,1), a lei (1 jan 2025; 17 abr 2028), a viragem (sem contentores; viatura nova), a rede com rotas por estrada (OSRM), o resultado (431,1 t · 101,9 €/t · evitado 45 542 €) e os ecrãs reais do produto.

## 2. Storyboard (~90 s, 16:9)

| # | Tempo | Cena | Conteúdo | Fonte |
| --- | --- | --- | --- | --- |
| 1 | 0:00–0:08 | Abertura | A Penha em meio-tom; «Novelo — do saco ao fio»; linha «Vitrus · Município de Guimarães · novembro 2026» | marca |
| 2 | 0:08–0:20 | O número | ≈ 51 250,6 t de indiferenciado × 5,86% ≈ 3 003,3 t/ano no lixo (estimativa); 9 em cada 10 kg; 301,3 t medidas à parte | Vitrus R&C 2025, APA RARU 2025 |
| 3 | 0:20–0:27 | A lei | Recolha obrigatória desde 1 jan 2025; RAP até 17 abr 2028 | Diretiva (UE) 2025/1892 |
| 4 | 0:27–0:40 | A viragem e a rede | Contentores de têxtil, não; o saco não vai no camião do lixo; a viatura nova de têxtil sai de Polvoreira; saco à porta + locais existentes + escolas; rotas pelas estradas reais | Vitrus 21–22 out; cenário B |
| 5 | 0:40–0:48 | O resultado | 431,1 t/ano · 101,9 €/t · tratamento evitado 45 542 € paga a operação · viatura 42 500 € (estimativas) | cenário B (60 000 €/ano) |
| 6 | 0:48–1:08 | O produto | Três momentos rápidos dos ecrãs reais: «E se...?» → triagem + QR + passaporte no telemóvel → relatório RAP; (se sair o deploy: «Vai no saco?» 4 s) | capturas de produção |
| 7 | 1:08–1:20 | O piloto | «Duas freguesias, oito a doze semanas»: mapa do cenário Piloto (Aldão + Arosa e Castelões); métricas: conformidade ≥ 80%, rejeito do verde ≤ 15% | cenário «Piloto» (novo) |
| 8 | 1:20–1:30 | Fecho | Frase-âncora; «Três pedidos: piloto · dados · desenho da triagem»; QR `novelo.helder.si` | — |

Uma linha discreta de rigor cabe na cena 6 ou 8: «1 164 testes à API · 449 à web · 155 perguntas ao copiloto verificadas».

## 3. Números a verificar antes de renderizar

- Correr `prepare-numbers.mjs` contra a produção **depois** de o cenário «Piloto» existir (checklist do plano, 15h00).
- O novo nos slides — **317 269 €/ano** de aterro evitado no alvo — só entra se aparecer na cena 2 ou 5; conferir com o [deck](apresentacao-vitrus-slides.md).
- A frase-âncora tem de ser **igual** à do slide 9 e à falada: 431,1 t · 101,9 €/t · 45 542 €.
- Toda a estimativa com a palavra «estimativa» no ecrã, como no vídeo atual.

## 4. Produção (véspora curta — três níveis)

Esforço estimado por cima do que já existe (`video/README.md` tem os comandos):

| Nível | O que é | Tempo | Quando escolher |
| --- | --- | --- | --- |
| 1 | Reabrir o vídeo atual (2:14), trocar só a cena final («Em resumo» → três pedidos + âncora + QR) e a linha da abertura | 30–45 min | Se só sobrar a noite |
| 2 | **Recomendado:** recorte para ~90 s segundo o storyboard, com fecho novo; sem cenas novas | ~2 h | Se começar depois das 16h com o deck já entregue |
| 3 | Nível 2 + cena do cenário «Piloto» (captura nova) + micro-cena «Vai no saco?» | ~3 h | Só com a checklist do dia toda verde |

Passos (nível 2): editar as composições em `video/src` (cortar cenas «Destino», «Onde se perde» e «Em resumo», encurtar «Produto»), nova cena final (âncora + pedidos + QR), reutilizar a banda sonora existente, `node render.mjs all` e `--silent`. O nível 3 acrescenta `prepare-data.mjs` apontado ao cenário «Piloto» e capturas novas (`capture.mjs`).

## 5. Aceitação

- [ ] Duração ≤ 95 s; 16:9 (`out/novelo-16x9.mp4`) e versão silenciosa
- [ ] Zero referências a júri, hackathon ou critérios de avaliação
- [ ] Frase-âncora e números iguais ao deck, ao guião e ao one-pager
- [ ] «Estimativa» visível onde aplica; fontes no fecho
- [ ] Copiado para o portátil **e** para o telemóvel; reproduzido uma vez com som antes de sair de casa
