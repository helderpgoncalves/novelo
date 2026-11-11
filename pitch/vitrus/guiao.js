'use strict';
/**
 * Gera docs/projeto/apresentacao-vitrus-completa-guiao.md a partir de guiao.json (as mesmas notas do PowerPoint).
 *   node pitch/vitrus/guiao.js
 */
const fs = require('node:fs');
const path = require('node:path');

const G = JSON.parse(fs.readFileSync(path.join(__dirname, 'guiao.json'), 'utf8'));
const OUT = path.join(__dirname, '../../docs/projeto/apresentacao-vitrus-completa-guiao.md');

// Caminho curto (25 min): diapositivos pelo início do título.
const SHORT = [
  'Do saco ao fio', 'Sem um único contentor novo, a rede desvia', '9 em cada 10 kg', 'O têxtil por desviar sai de dados', 'Há 1 273 candidatos',
  'Com 60 000 € por ano a rede gasta', 'Cada orçamento compra', 'Pergunta-se em português', 'Cada lote tem um QR', 'O dossiê para a mesa de 2028',
  'A proposta tem cinco camadas', 'Dez dados que só a Vitrus', 'A plataforma fica',
];
const isShort = (x) => x.kind === 'capa' || x.kind === 'fecho' || SHORT.some((p) => (x.title || '').startsWith(p));

const dur = (x) => (x.kind === 'secao' ? 0.5 : x.kind === 'capa' ? 1 : x.kind === 'fecho' ? 2 : /anexo/i.test(x.time || '') ? 0 : x.app ? 3.5 : 1.5);
const shortDur = (x) => (x.kind === 'capa' ? 1 : x.kind === 'fecho' ? 1.5 : x.app ? 3 : 1.5);

let clock = 0; let sclock = 0;
const rows = G.map((x) => {
  const start = clock; const sstart = sclock;
  clock += dur(x); if (isShort(x) && x.kind !== 'secao') sclock += shortDur(x);
  return Object.assign({}, x, { start, sstart, short: isShort(x) && x.kind !== 'secao' });
});
const mm = (m) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`;

const L = [];
const p = (s = '') => L.push(s);

p('# Apresentação completa à Vitrus e ao Município de Guimarães: guião');
p();
p('Guião falado, diapositivo a diapositivo, da apresentação completa do Novelo, para fazer **com a aplicação a funcionar**. O deck é `pitch/out/novelo-apresentacao-vitrus-completa.pptx` (' + G.length + ' diapositivos, notas do orador preenchidas); este ficheiro tem as mesmas notas, mais a preparação, as perguntas esperadas e as regras para o dia. Os dois saem da mesma fonte (`pitch/vitrus/`), por isso não divergem.');
p();
p('**Quem ouve:** o presidente da Câmara Municipal de Guimarães e a Câmara; a Vitrus Ambiente (direção e operação). **Para quê:** que quem pode dar seguimento tenha tudo na mão: números, pressupostos, limites, dúvidas e o que falta. Não é um pitch.');
p();
p('| | |');
p('| --- | --- |');
p('| Duração | cerca de 2 horas com a conversa (versão completa); **25 minutos** no caminho curto (secção 3) |');
p(`| Diapositivos | ${G.length}: ${G.filter((x) => x.kind === 'secao').length} separadores, ${G.filter((x) => x.kind === 'slide' && !/anexo/i.test(x.time || '')).length} de conteúdo, ${G.filter((x) => /anexo/i.test(x.time || '') && x.kind === 'slide').length} anexos |`);
p('| Aplicação | ao vivo nos blocos 04 e 05; cada diapositivo de demonstração tem os passos e o plano B |');
p('| Quem apresenta | Flávio Fernandes e Hélder Gonçalves |');
p();
p('## 1. Como se lê cada número');
p();
p('Todos os números da apresentação trazem um de três selos, e diz-se em voz alta:');
p();
p('- **Medido:** vem dos dados da Vitrus, do INE ou da APA, sem conta nossa que o altere (301,3 t; 105,64 €/t).');
p('- **Estimativa:** derivado por conta a partir de valores medidos e de uma fonte (≈ 3 003,3 t por desviar; 431,1 t do cenário B).');
p('- **Pressuposto:** valor da equipa, com fonte escrita e editável no ecrã de pressupostos (viatura 42 500 €; 30 km/h; 6 € por recolha).');
p();
p('> Regra: nenhum valor se apresenta como medido quando é estimativa, e quando não se sabe, anota-se («boa pergunta, anotamos e respondemos com número»).');
p();
p('## 2. Antes de começar');
p();
p('**Uma semana antes**');
p();
p('- [ ] Confirmar com a Vitrus a data e quem estará na sala; enviar o deck em PDF, se pedido.');
p('- [ ] Produção a responder (`novelo.helder.si`); login com palavra-passe (não com ligação por email); saldo da IA (OpenRouter) e teto mensal verificados.');
p('- [ ] Cenários `Demo · …` e relatório RAP pré-gerado presentes; lotes de demonstração com miniaturas (expiram aos 90 dias: repetir o seed se necessário; ver «Dados de demonstração»).');
p('- [ ] Criar em produção o cenário «Duas freguesias · Aldão + Arosa e Castelões» (restrições a essas duas freguesias, 30 000 €/ano) e confirmar as rotas «Por estrada».');
p('- [ ] Imprimir: relatório RAP (uma cópia por pessoa-chave), este guião (uma cópia para quem apresenta), um A4 com a frase final e os quatro números.');
p();
p('**No dia, 30 minutos antes**');
p();
p('- [ ] Produção a responder **fora da rede de casa** (dados móveis); telemóvel com hotspot pronto.');
p('- [ ] Separadores abertos **por ordem** (secção 4): nunca procurar um ecrã ao vivo.');
p('- [ ] Saco de demonstração com o **QR de um lote entregue** colado (em produção: `NOV-BXS4UW`; confirmar o código na lista de lotes) e lido antes com um telemóvel que não é o vosso.');
p('- [ ] Uma peça de roupa com etiqueta legível e uma toalha velha (para o «Vai no saco?»); fotografadas antes, em plano B.');
p('- [ ] «E se...?» de aquecimento com a pergunta de reserva (menos de 15 s). Zoom e resolução testados no ecrã da sala.');
p('- [ ] Água; bloco de notas para as perguntas sem resposta.');
p();
p('> **As capturas do deck vêm da stack de desenvolvimento local** (11 nov 2026) com os dados de demonstração. Em produção os códigos dos lotes e algumas décimas dos cenários por locais reais podem diferir (±1% entre execuções); os números de referência do deck são os da secção 7.');
p();
p('## 3. Duas versões da sessão');
p();
p('| Versão | Duração | O que inclui |');
p('| --- | --- | --- |');
p(`| Completa | cerca de 2 h com a conversa | Todos os diapositivos, com a aplicação aberta nos blocos 04 e 05 |`);
p(`| **Caminho curto** | **25 min** | Os diapositivos marcados **curto** na tabela da secção 4 (${rows.filter((r) => r.short).length}), com um só momento ao vivo de cada tipo: «E se...?» e o QR do passaporte |`);
p();
p('Nas duas versões: a frase final, os dois pedidos de ouvir (as perguntas nossas) e o que se segue não se cortam.');
p();
p('## 4. Mapa da sessão');
p();
p('Tempos acumulados indicativos (a versão completa soma cerca de ' + mm(clock) + '). **Curto** = faz parte do caminho de 25 minutos; **app** = tem demonstração ao vivo.');
p();
p('| N.º | Diapositivo | Início | Curto | App |');
p('| ---: | --- | ---: | :---: | :---: |');
for (const r of rows) {
  const t = (r.title || '').replace(/\|/g, '/');
  p(`| ${r.n} | ${r.kind === 'secao' ? `**${t}**` : t} | ${/anexo/i.test(r.time || '') ? 'anexo' : mm(r.start)} | ${r.short ? `sim (${mm(r.sstart)})` : ''} | ${r.app ? 'sim' : ''} |`);
}
p();
p('Separadores da aplicação, por ordem (abrir todos antes de entrar): `/` · `/scenarios` (comparação A/B e cadeia de orçamentos) · cenário B com os separadores «Rede e rotas», «Cobertura», «Incerteza» e «E se...?» · cenário «Duas freguesias» · `/pilot` · `/triage` · `/lots` · `/passport/{código}` · `/lots?tab=brands` e `?tab=market` · `/reports` · `/bag-check` (no telemóvel) · `/municipal` (separadores «Candidatos a têxteis» e «Canal B2B») · `/validation` · `/assumptions`.');
p();
p('## 5. Guião diapositivo a diapositivo');
p();
p('Cada entrada tem: o que se diz (as notas do orador do PowerPoint), os números que aparecem no ecrã, os passos na aplicação e o plano B quando há demonstração.');
p();
let lastSection = null;
for (const r of rows) {
  if (r.kind === 'secao') { p(`### ${r.title}`); p(); p(`*${/anexo/i.test(r.time || '') ? 'Anexos' : mm(r.start)}.* ${r.notes}`); p(); lastSection = r.title; continue; }
  p(`#### ${r.n}. ${r.title}`);
  p();
  const tags = [];
  tags.push(/anexo/i.test(r.time || '') ? 'anexo' : `início ${mm(r.start)}`);
  if (r.short) tags.push(`**caminho curto** (${mm(r.sstart)})`);
  if (r.app) tags.push('**com a aplicação**');
  p(`*${tags.join(' · ')}*`);
  p();
  p('**O que dizer**');
  p();
  p(`> ${(r.notes || '').replace(/\n/g, '\n> ')}`);
  p();
  if (r.numbers && r.numbers.length) { p(`**Números no ecrã:** ${r.numbers.join(' · ')}`); p(); }
  if (r.app) {
    p(`**Na aplicação (${r.app.route})**`);
    p();
    r.app.steps.forEach((s, i) => p(`${i + 1}. ${s}`));
    if (r.app.planB) { p(); p(`**Plano B:** ${r.app.planB}.`); }
    p();
  }
  if (r.sources) { p(`*Fontes no diapositivo:* ${r.sources}`); p(); }
}

p('## 6. Perguntas esperadas e respostas curtas');
p();
p('**As nossas primeiro, sempre.** Ouvir sem contestar, tomar nota, não responder a objeções antes de acabar:');
p();
p('1. «O que teria o Novelo de fazer para entrar no vosso dia a dia, na segunda-feira e não em 2028?»');
p('2. «O que não vos convence nos números? Onde é que carregam?»');
p();
p('Se a Vitrus propuser um ensaio, uma freguesia, um contacto ou uma data: **aceitar na hora**, agradecer e anotar. Não empurrar mais nada.');
p();
p('### Da operação');
p();
p('| Pergunta | Resposta (20 segundos) |');
p('| --- | --- |');
const qa1 = [
  ['O munícipe não vai pôr lixo no saco?', 'O peso denuncia, o motorista recusa à porta com nota educativa, e nunca se paga por quilo nem por peça. Os 56,9% vieram do canal sem controlo; a porta é o controlo.'],
  ['O saco não fica na chuva num local público?', 'O candidato é o lugar, não o contentor: a paragem é um encontro anunciado e o saco entrega-se à mão. Quem não puder estar à hora guarda o saco para a ronda seguinte ou leva-o a um ponto assistido, onde espera dentro.'],
  ['Podemos escolher os pontos?', 'Sim. Hoje restringe-se por freguesia e tipo; com rede, a Vitrus fixa, exclui e acrescenta pontos na plataforma. As 350 coordenadas aproximadas confirmam-se no terreno.'],
  ['Como sabem que a escola tem sacos?', 'A viatura pára sempre no dia anunciado e a escola avisa por telefone, como hoje; o sinal digital vem depois e serve para prever, nunca para autorizar. Com dados, a paragem vazia (3 rondas seguidas) sai da rota, sempre anunciado.'],
  ['O motorista anda com telemóvel?', 'Um Android da viatura (150 a 300 €), 3 botões, QR, offline. A rota é o plano do dia; ele não navega pela aplicação.'],
  ['E se o munícipe não puser o saco no dia?', 'Guarda-o para a ronda seguinte (a cada 2 semanas) ou leva-o a um ponto assistido. Sem marcação nem aplicação.'],
  ['A cada 2 semanas não é pouco (ou muito)?', 'É um pressuposto editável, com sensibilidade; a recolha real calibra o intervalo com número, não com opinião.'],
  ['Que viatura e quanto custa?', 'Furgoneta de caixa fechada sem compactação, 42 500 € (adjudicação de Gaia; pressuposto, por confirmar no portal Base). Os €/h e €/km são um dos dados a fechar.'],
  ['Isto substitui as entidades que triam?', 'Não; continuam a triar profissionalmente. O Novelo é a camada de decisão e de evidência, e a bolsa liga-as ao material por fibra.'],
  ['Fotografias, marcas, RGPD?', 'A foto vive em memória durante o pedido; a miniatura é opcional, sem metadados, apagada aos 90 dias; a marca é de uma empresa, nunca de uma pessoa. A análise é técnica e carece de parecer do encarregado de proteção de dados.'],
  ['Quanto custa a IA?', 'Cêntimos por peça, com orçamento mensal e teto; sem chave de IA o resto da aplicação funciona.'],
  ['Qual é a exatidão da triagem por foto?', 'Ainda não a medimos com verdade-terreno: a avaliação está preparada e precisa de pelo menos 30 peças classificadas por uma pessoa. Até lá não damos uma percentagem.'],
];
qa1.forEach(([q, a]) => p(`| ${q} | ${a} |`));
p();
p('### Da gestão e do município');
p();
p('| Pergunta | Resposta (20 segundos) |');
p('| --- | --- |');
const qa2 = [
  ['Quanto custa ao município?', 'Com 60 000 €/ano, o aterro evitado (45 542 €) paga a operação: custo líquido de −1 628 €/ano no caso central. Estimativa; no percentil 90 do custo por tonelada (139,7 €/t) já não chega, e por isso há números a fechar e rede a medir.'],
  ['O que ganha o cidadão?', 'Saco grátis, dia fixo e resposta: o passaporte diz para onde foi a roupa. Sem aplicação obrigatória.'],
  ['O que muda em 2028?', 'Os produtores pagam o custo eficiente, determinado com as autoridades locais. Guimarães chega a essa mesa com números próprios por tipo de território e por marca.'],
  ['E o emprego e a economia social?', 'Os lotes por fibra ligam ao tecido do Vale do Ave; as entidades que hoje recolhem as 301 t continuam e ganham mais material e evidência.'],
  ['Funciona noutros concelhos?', 'Sim: INE, OpenStreetMap e CAOP são de todos; faltam os custos locais. Guimarães seria o primeiro.'],
  ['Porque é que o contentor de rua (cenário A) não é a proposta, se capta mais?', 'Porque a Vitrus não o quer (a contaminação estraga a reutilização) e o modelo não desconta essa contaminação: o A fica como referência, nunca como proposta.'],
  ['Quem mantém isto?', 'Nós: é a oferta. Mantemos, desenvolvemos e desenhamos a rede convosco. A contratação pública segue o caminho que a Vitrus e o município indicarem.'],
  ['E a To Be Green?', 'Complementar: eles trabalham o cidadão e a reutilização; o Novelo, a decisão e a evidência de quem opera a recolha.'],
];
qa2.forEach(([q, a]) => p(`| ${q} | ${a} |`));
p();
p('## 7. Números de referência');
p();
p('Os números abaixo são os do deck. Os do cenário B e dos orçamentos vêm do modelo, recalculado a 11 nov 2026 (rotas pela estrada); os de documentação são de 23 out 2026. Entre execuções, os cenários por locais reais variam cerca de ±1%.');
p();
p('| Número | Valor | Origem | Selo |');
p('| --- | --- | --- | --- |');
[
  ['Têxtil recolhido à parte, 2025', '301,3 t (0,16 kg/hab/mês)', 'Vitrus, 4 entidades', 'medido'],
  ['Destino do recolhido', '59,4% reutilização · 26,5% reciclagem · 14,1% rejeito', 'Vitrus, 2025', 'medido'],
  ['Rejeito por canal', 'Ultriplo 14,5% · H Sarah Trading 13,0% · Nova Etapa 10,0% · recolha Vitrus (amostra de 5,6 t) 56,9%', 'Vitrus e To Be Green', 'medido; a amostra é estimativa'],
  ['Indiferenciado do concelho', '≈ 51 250,6 t = 43 050,5 t ÷ 0,840', 'Vitrus (R&C 2025, p. 8)', 'estimativa'],
  ['Têxtil por desviar', '≈ 3 003,3 t/ano (1,596 kg/hab/mês)', '51 250,6 t × 5,86% (APA, RARU 2025, p. 24)', 'estimativa'],
  ['Captura atual', '9,1% (≈ 3 304,6 t geradas)', 'cálculo', 'estimativa'],
  ['Tratamento do indiferenciado', '105,64 €/t = 40 € (TGR) + 65,64 € (Resinorte)', 'Vitrus, 22 out 2026', 'medido'],
  ['Prazo da RAP têxtil', '17 abr 2028 (522 dias a 12 nov 2026)', 'Diretiva (UE) 2025/1892', 'público'],
  ['Rede municipal', '2 751 contentores, 2 026 locais, 48 freguesias, 156 830 habitantes', 'pacote QGIS (20 out 2026); INE', 'medido'],
  ['Candidatos a paragem', '1 187 públicos + 86 escolas = 1 273 (837 precisos; 350 aproximados)', 'pacote QGIS; verificado a 11 nov 2026', 'medido'],
  ['Viatura', '42 500 €, 8 anos (5 312,50 €/ano), 2 t, 30 km/h, 1 820 h/ano', 'Gaia (TED) e equipa', 'pressuposto'],
  ['Cenário A (contentor de rua, só referência)', '652,1 t · 71,7 €/t · 46 738 € · 75,9% de cobertura', 'modelo', 'estimativa'],
  ['**Cenário B, 60 000 €/ano**', '**431,1 t · 101,9 €/t · 43 914 € · 70,4% de cobertura**', 'modelo', 'estimativa'],
  ['Custo do cenário B', 'operação 35 702 € + viatura 5 312,50 € + locais 2 900 €', 'modelo', 'estimativa'],
  ['Tratamento evitado e custo líquido (B)', '45 542 € e −1 628 €/ano (−3,8 €/t)', 'modelo', 'estimativa'],
  ['Reutilizável (B)', '256,1 t (215,6 a 314,1); 171,5 €/t reutilizável', 'modelo', 'estimativa'],
  ['Intervalo do €/t (B)', 'P10 81,6 · P50 103,4 · P90 139,7; toneladas 331 a 537', 'Monte Carlo, 500 amostras', 'estimativa'],
  ['Orçamentos (por freguesia)', '40 k€: 364,3 t, 66,0 €/t · 90 k€: 525,3 t, 139,1 €/t · 150 k€: 676,9 t, 186,6 €/t · teto: 772,1 t, 228,9 €/t', 'modelo', 'estimativa'],
  ['Por locais reais, 60 000 €/ano', '300 m: 474,6 t, 125,6 €/t, 87,8% · 500 m: 549,5 t, 107,3 €/t, 95,7%', 'modelo (±1%)', 'estimativa'],
  ['Cobertura (B)', 'urbanas 72,8% · mediamente urbanas 57,4% · rural 0% · restante 55,5% · razão 0,762', 'modelo', 'estimativa'],
  ['Desvio estrada ÷ linha reta', 'mediana 1,48 (freguesias) e 1,37 (locais); inicial 1,3', 'calibração OSRM, 23 out 2026', 'medido'],
  ['Duas freguesias (ensaio, 3 meses)', 'piso 1,71 t; previsto 2,43 t (1,87 a 2,99); 538 €/t (424 a 706), sem a viatura', 'modelo', 'estimativa'],
  ['Escala', '≈ 1 M peças (301 t) → ≈ 10 M peças (3 003 t), a 0,3 kg por peça', 'pressuposto', 'estimativa'],
  ['Triagem peça a peça', '32 a 48 ETC; 55 000 a 83 000 h/ano; IA 24,5 a 98 mil €/ano', 'análise da equipa', 'estimativa'],
  ['Triagem em camadas', '2 a 3 ETC; sacos 50 a 200 mil €/ano no pico; aterro evitado 317 269 €/ano; 385 sacos por trimestre dão ±5 p.p. a 95%', 'análise da equipa', 'estimativa'],
  ['Métricas do ensaio', 'conformidade ≥ 80% · rejeito do verde ≤ 15% · recusados à porta < 5%', 'proposta', 'proposta'],
].forEach((r) => p(`| ${r.join(' | ')} |`));
p();
p('## 8. Regras de ouro');
p();
p('1. **Nunca procurar um ecrã ao vivo:** tudo aberto por ordem antes de entrar.');
p('2. **Só dois momentos ao vivo** na versão curta («E se...?» e o QR); na completa, todos os do guião, com plano B à mão.');
p('3. **Se algo falhar:** dizer a frase do plano B, sem desculpas longas, e seguir (os ecrãs estão nos diapositivos).');
p('4. **Nenhum número sem o seu selo:** «estimativa» diz-se sempre.');
p('5. **Não sabes?** «Boa pergunta, anotamos e respondemos com número.»');
p('6. **Uma frase por ecrã e apontar:** não ler o ecrã em voz alta.');
p('7. **O QR lê-se no telemóvel da pessoa mais importante da sala**, com o saco na mão dela.');
p('8. **Falar com a Vitrus, não para o projetor:** a aplicação é o pretexto, a conversa é o objetivo. A ferramenta ajuda a decidir; não decide por eles.');
p('9. **Honestidade antes de entusiasmo:** dizer o que não está medido (exatidão da triagem, preço da viatura no Base, captura por modo) antes de ser perguntado.');
p();
p('## 9. Plano B');
p();
p('| Falha | O que fazer |');
p('| --- | --- |');
[
  ['Sem rede ou produção em baixo', 'Os diapositivos têm as capturas de todos os ecrãs; relatório RAP impresso; hotspot do telemóvel como rede de reserva.'],
  ['IA sem saldo ou sem resposta', '«E se...?» com a pergunta de reserva em cache («E se o orçamento subir de 60 000 para 90 000 €?»); na triagem, usar a peça e a etiqueta pré-fotografadas ou o lote existente. O resto da aplicação não depende da IA.'],
  ['QR não abre', 'Abrir `/pt/passport/{código}` no portátil e mostrar no ecrã.'],
  ['Projetor falha', 'A aplicação no telemóvel (PWA) e o relatório impresso; os diapositivos são apoio, não a espinha dorsal.'],
  ['Pergunta hostil sem resposta', 'Regra 5, anotar, e responder por escrito com número.'],
].forEach((r) => p(`| ${r.join(' | ')} |`));
p();
p('## 10. O que não está verificado ou ficou por fazer');
p();
p('Para não haver margem para dúvidas, o que o deck **não** afirma ou afirma com reserva:');
p();
p('- **Exatidão da triagem por foto:** nunca foi medida com verdade-terreno; o deck não dá percentagem.');
p('- **Preço da viatura (42 500 €):** lido do anúncio TED da adjudicação de Gaia; por confirmar no portal Base.');
p('- **Taxas de captura (18% e 25%), custo por recolha (6 €) e por quilómetro (1,10 €), quilos por saco (25 kg), frequência (2 semanas):** pressupostos sem dado local; são os que mais pesam no intervalo de incerteza.');
p('- **Têxtil por freguesia:** não existe; a procura é proporcional à população, com a média nacional da APA (5,86%).');
p('- **Referência francesa (4,27 kg/hab/ano):** por verificar; só serve de comparação.');
p('- **Passaporte Digital do Produto (2027):** contexto do plano municipal, por confirmar.');
p('- **Locais:** 350 dos 1 187 têm coordenada aproximada; cada paragem é «lugar possível, a validar com a Vitrus».');
p('- **Contaminação:** o modelo não a desconta; o cenário A (contentor de rua) parece mais barato por tonelada por causa disso, e é só referência.');
p('- **Cenário «Duas freguesias»:** como cenário autónomo (a viatura toda paga por duas freguesias) dá 9,7 t/ano a 1 057 €/t; serve para aprender a escala, e a rede é a do concelho. Os números do ensaio de 3 meses (1,71 t; 2,43 t; 538 €/t) não contam a viatura.');
p('- **RGPD:** a avaliação é técnica; a base jurídica e a avaliação de impacto têm de ser validadas pelo encarregado de proteção de dados.');
p('- **Dados de demonstração:** composição das peças sem etiqueta legível é a que o operador confirma (pressuposto de demonstração); fotografias da Wikimedia Commons, com crédito.');
p();
p('## 11. Como se regenera');
p();
p('O deck e este guião saem do mesmo código. Para os refazer (a partir da raiz do repositório, com a stack de desenvolvimento a correr e o seed de demonstração aplicado):');
p();
p('```bash');
p('python3 pitch/vitrus/maps.py "$PWD"          # mapas a partir de data/processed');
p('node pitch/vitrus/icons.cjs                  # (já não usado no deck; ícones Lucide)');
p('node pitch/vitrus/shots.cjs                  # capturas da app (precisa de CHROME=... se o Playwright não tiver o browser)');
p('node pitch/vitrus/mobile.cjs                 # capturas de telemóvel');
p('cd pitch/vitrus && NODE_PATH=../node_modules node build.js   # PPTX e guiao.json');
p('node pitch/vitrus/guiao.js                   # este guião');
p('```');
p();
p('Os números dos cenários vêm de `pitch/vitrus/data/*.json` (API local, 11 nov 2026). Se os dados ou o modelo mudarem, voltar a exportar esses ficheiros e refazer.');
p();

fs.writeFileSync(OUT, L.join('\n'));
console.log('ok', OUT, L.length, 'linhas');
