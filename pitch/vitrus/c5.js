'use strict';
/** Parte 5: triagem à escala, riscos e validação, seguimento e anexos. */
const L = require('./lib');
const { pres, C, H, MX, CW, W, slide, section, card, stat, iconRow, bullets, pill, table, arrow, stepBox, shot, phone, framed, text, chartBase, img, THEME, nf, rule, vrule } = L;

module.exports = function build() {
  // ================================================================== 06 Triagem à escala
  section('06', 'Triagem à escala', 'A resposta à sugestão da Vitrus de 4 de novembro: a direção está certa, mas a escala muda a conta.', 'Sexto bloco: a resposta à sugestão de 4 de novembro, passar parte da triagem para o munícipe, em casa. Analisámo-la a fundo. É uma proposta para desenharmos com a operação, não uma decisão fechada.', '2:20');

  // T1. A escala
  {
    const s = slide({
      kicker: 'Triagem à escala', title: 'Hoje são cerca de 1 milhão de peças por ano; o alvo são cerca de 10 milhões',
      time: '2:21', core: true,
      sources: '301,3 t e 3 003,3 t (Vitrus; APA; estimativa) · 0,3 kg por peça (pressuposto) · análise da equipa',
      numbers: ['≈ 1 M peças', '≈ 10 M peças'],
      notes: 'A conta que decide a triagem é a de escala. Com 0,3 quilos por peça, que é pressuposto, as 301 toneladas de hoje são cerca de um milhão de peças por ano. O alvo, 3 003 toneladas, são cerca de dez milhões. Tudo o que for «peça a peça» tem de se pensar nessa ordem de grandeza: dez milhões de decisões por ano. A direção que a Vitrus sugeriu, a de que o cidadão participe na separação, está certa; o que muda com a escala é a letra: o que serve para um milhão de peças não serve para dez.',
    });
    s.addChart(pres.charts.BAR, [{ name: 'Milhões de peças por ano', labels: ['Hoje: 301 t', 'Alvo: 3 003 t'], values: [1, 10] }], Object.assign(chartBase(), {
      x: MX, y: 1.85, w: 5.6, h: 4.85, barDir: 'col', chartColors: [H.floresta, H.areia], showLegend: false, showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0" milhões"', showTitle: true, title: 'Peças por ano (estimativa, 0,3 kg por peça)', titleFontSize: 12.5, titleColor: H.tinta,
      valAxisMinVal: 0, valAxisMaxVal: 12, barGapWidthPct: 70,
    }));
    table(s, [
      ['', 'Hoje', 'Alvo'],
      ['Têxtil por ano', '301,3 t', '3 003,3 t'],
      ['Peças por ano (0,3 kg/peça)', '≈ 1 milhão', '≈ 10 milhões'],
      ['Triagem peça a peça, a 20 a 30 s', '—', '55 000 a 83 000 h/ano'],
      ['Equivalente a tempo completo', '—', '32 a 48 ETC'],
      ['IA peça a peça (estimativa)', '—', '24,5 a 98 mil €/ano'],
    ], { x: 6.7, y: 1.95, w: 6.05, cols: [3.05, 1.3, 1.7], size: 12.5, rowH: 0.62, align: ['left', 'right', 'right'], name: 'escala' });
    text(s, 'Pressupostos: 0,3 kg por peça; 20 a 30 segundos por peça em uso real; ETC de cerca de 1 720 h por ano. Todos por validar com a operação.', { x: 6.7, y: 6.05, w: 6.05, h: 0.7, fontSize: 11.5, color: H.cinza });
  }

  // T2. Dois extremos
  {
    const s = slide({
      kicker: 'Triagem à escala', title: 'Dois extremos não funcionam: triar peça a peça custa 32 a 48 pessoas, e não controlar à entrada deixa passar 56,9% de rejeito',
      time: '2:24', core: true,
      sources: 'Análise da equipa (estimativas) · To Be Green/Vitrus 2025 (56,9%, amostra de 5,6 t) · 3 003,3 t × 56,9% ≈ 1 709 t',
      numbers: ['32 a 48 ETC', '24,5 a 98 mil €', '56,9%', '1 709 t'],
      notes: 'Os dois extremos. Primeiro, triar tudo, peça a peça, seja quem for a fazê-lo: com operadores são 32 a 48 pessoas a tempo inteiro, 55 a 83 mil horas por ano; com inteligência artificial, 24 500 a 98 mil euros por ano, estimativas. Segundo, o oposto: não controlar nada à entrada. É o cenário que a Vitrus conhece: o canal sem triagem deu 56,9 por cento de rejeito numa amostra de 5,6 toneladas, e à escala do alvo seriam cerca de 1 709 toneladas por ano desperdiçadas. Entre os dois, há um desenho por camadas, que vem no diapositivo seguinte.',
    });
    const cw = 5.85;
    [['Triar peça a peça', ['32 a 48 ETC', '55 000 a 83 000 horas por ano', '24,5 a 98 mil € por ano de IA, se for a IA a triar', 'Não escala com o orçamento de uma recolha municipal'], C.accent1], ['Sem controlo à entrada', ['56,9% de rejeito no canal sem controlo', '≈ 1 709 t por ano desperdiçadas no alvo', 'A contaminação estraga a reutilização, que é onde está o valor', 'Amostra pequena (5,6 t): estimativa']
      , C.accent6]].forEach(([t, items, col], i) => {
      const x = MX + i * (cw + 0.43);
      rule(s, x, 1.9, cw, { color: H.tinta });
      text(s, t, { x, y: 2.05, w: cw, h: 0.5, fontFace: THEME.headFontFace, fontSize: 24, bold: true, color: col });
      bullets(s, items, { x, y: 2.8, w: cw, h: 2.6, size: 15, gap: 10 });
    });
    rule(s, MX, 5.5, CW, { color: H.linha });
    text(s, [{ text: 'O meio-termo está no diapositivo seguinte: ', options: { bold: true } }, { text: 'verificar à porta, auditar por amostragem e usar a triagem por foto só onde acrescenta informação.' }], { x: MX, y: 5.65, w: CW, h: 0.8, fontSize: 15 });
  }

  // T3. Sete abordagens
  {
    const strike = { strike: 'sngStrike', color: H.cinza };
    const s = slide({
      kicker: 'Triagem à escala', title: 'Analisámos sete abordagens, e a triagem partilhada em camadas é a que se aguenta à escala do alvo',
      time: '2:27', core: false,
      sources: 'Análise da equipa · AEA (2024) · Fashion for Good, Sorting for Circularity (2025) · estimativas',
      notes: 'As sete abordagens analisadas. A, o statu quo, o operador triar peça a peça: não escala, fica como auditoria. B, o cidadão triar peça a peça em casa: a participação morre. C, declaração do saco sem verificação: reproduz os 56,9 por cento. D, triagem partilhada em camadas: a recomendada. E, a versão mínima, dois sacos e verificação à porta: o arranque. F, pontos comunitários, escolas e juntas: complemento educativo. G, externalizar nos licenciados, o que se faz hoje: sem dados próprios para 2028. As linhas B, C e G ficam riscadas porque não funcionam à escala; a D é a recomendada; a E é por onde se começa.',
    });
    table(s, [
      ['Abordagem', 'Veredicto'],
      ['A · Operador tria peça a peça (o que existe)', 'não escala; fica como auditoria'],
      [{ text: 'B · Cidadão tria peça a peça em casa', options: strike }, { text: 'a participação morre', options: strike }],
      [{ text: 'C · Declaração do saco, sem verificação', options: strike }, { text: 'reproduz os 56,9% de rejeito', options: strike }],
      [{ text: 'D · Triagem partilhada em camadas', options: { bold: true, color: C.accent1 } }, { text: 'recomendada', options: { bold: true, color: C.accent1 } }],
      ['E · Mínima: dois sacos e verificação à porta', 'arranque'],
      ['F · Pontos comunitários (escolas, juntas)', 'complemento de educação'],
      [{ text: 'G · Externalizar nos licenciados (o que se faz hoje)', options: strike }, { text: 'sem dados próprios para 2028', options: strike }],
    ], { x: MX, y: 1.9, w: CW, cols: [7.6, 4.53], size: 14.5, rowH: 0.54, name: 'sete-abordagens' });
    text(s, 'Riscado: não funciona à escala do alvo. Em destaque: a recomendada. É uma proposta para desenhar com a operação, não uma decisão fechada.', { x: MX, y: 6.4, w: CW, h: 0.4, fontSize: 12, color: H.cinza });
  }

  // T4. Cinco camadas
  {
    const s = slide({
      kicker: 'Triagem à escala', title: 'A proposta tem cinco camadas: dois sacos, declaração opcional, verificação de 10 segundos, auditoria por amostragem e feedback',
      time: '2:30', core: true,
      sources: 'Análise da equipa (estimativas) · amostragem: n = 385 sacos por trimestre para ±5 p.p. a 95% · 3 003,3 t × 105,64 €/t (cálculo)',
      numbers: ['2 a 3 ETC', '50 a 200 mil €/ano', '317 269 €/ano', '385 sacos'],
      notes: 'As cinco camadas, de cima para baixo. Um: dois sacos de cor, verde para «vestir de novo» e azul para «deu a vida», com a regra de três perguntas impressa. Dois: declaração opcional por QR, trinta segundos, que funciona sem aplicação. Três: verificação à porta, dez segundos, com três resultados: conforme, em dúvida, recusado. Quatro: auditoria por amostragem, cerca de 20 por cento, com a triagem por fotografia que já existe; 385 sacos por trimestre dão uma margem de mais ou menos 5 pontos percentuais a 95 por cento. Cinco: feedback ao munícipe, educativo, nunca multa. Em números: duas a três pessoas a tempo inteiro para o concelho, em vez de 32 a 48; os sacos custam entre 50 e 200 mil euros por ano no pico, cerca de um milhão de sacos a 5 a 20 cêntimos cada; e o aterro evitado no alvo, 317 269 euros por ano, paga-os. Tudo estimativa. E começa-se pelo mínimo, dois sacos e a porta; o digital liga ao segundo mês.',
    });
    const bw = 2.3; const g = 0.155; const y = 1.95; const bh = 2.7;
    [['1', 'Dois sacos', 'Verde «vestir de novo», azul «deu a vida»; regra de 3 perguntas impressa'], ['2', 'Declaração opcional', 'QR, 30 segundos; funciona sem aplicação'], ['3', 'Porta: 10 segundos', 'Conforme, em dúvida ou recusado'], ['4', 'Auditoria por amostragem', 'Cerca de 20%, com a triagem por foto; 385 sacos por trimestre dão ±5 p.p. a 95%'], ['5', 'Feedback', 'Educativo, nunca multa']].forEach(([n, t, sub], i) => {
      const x = MX + i * (bw + g);
      stepBox(s, x, y, bw, bh, null, t, sub, { n, subSize: 11.5, dark: i === 2 });
      if (i < 4) arrow(s, x + bw + 0.01, y + bh / 2, x + bw + g - 0.01, y + bh / 2);
    });
    table(s, [
      ['', 'Triagem peça a peça', 'Em camadas (proposta)'],
      ['Pessoas a tempo completo', '32 a 48', '2 a 3 no concelho'],
      ['Custo de IA ou de sacos', '24,5 a 98 mil €/ano (IA)', '50 a 200 mil €/ano (sacos, no pico)'],
      ['Aterro evitado no alvo', '317 269 €/ano', '317 269 €/ano (paga os sacos)'],
    ], { x: MX, y: 4.95, w: CW, cols: [3.6, 4.2, 4.33], size: 12.5, rowH: 0.45, name: 'camadas-numeros' });
  }

  // T5. Métricas
  {
    const s = slide({
      kicker: 'Triagem à escala', title: 'Se houver um ensaio, três métricas dizem se a proposta funciona: conformidade, rejeito do verde e recusados à porta',
      time: '2:34', core: false,
      sources: 'Proposta da equipa · «Dados e modelo», secção 5 (piso de sinal: p = 14,1%, h = 3 p.p., deff = 2; 0,415 kg por peça)',
      notes: 'Uma proposta só vale se se puder medir. Se houver um ensaio, propomos três métricas: conformidade dos sacos, pelo menos 80 por cento; rejeito do saco verde, no máximo 15 por cento, que é próximo dos 14,1 por cento que a Vitrus mede hoje; e sacos recusados à porta, menos de 5 por cento. Para o ensaio ter sinal, o modelo calcula um piso de toneladas: com o rejeito a 14,1 por cento e uma margem de 3 pontos percentuais, e um efeito de desenho de 2, porque as peças de um mesmo saco não são independentes, são cerca de 1 030 peças por célula, 0,43 toneladas; com duas freguesias e dois modos, 1,71 toneladas em três meses. Os pressupostos de amostragem estão assinalados para validar.',
    });
    stat(s, MX, 1.9, 3.6, 2.3, '≥ 80%', 'conformidade dos sacos', 'proposta de métrica', { bigSize: 44 });
    stat(s, MX + 4.2, 1.9, 3.6, 2.3, '≤ 15%', 'rejeito do saco verde', 'hoje a Vitrus mede 14,1%', { bigSize: 44 });
    stat(s, MX + 8.4, 1.9, 3.73, 2.3, '< 5%', 'recusados à porta', 'proposta de métrica', { bigSize: 44 });
    table(s, [
      ['Piso de sinal do ensaio', 'Valor', 'Pressuposto'],
      ['Rejeito de partida (p)', '14,1%', 'Vitrus, 2025'],
      ['Margem (h) e efeito de desenho (deff)', '3 p.p. e 2', 'convenção de amostragem; a validar'],
      ['Peças por célula (freguesia × modo)', '≈ 1 030 (0,43 t)', 'cálculo; 0,415 kg por peça (pressuposto)'],
      ['2 freguesias × 2 modos, 3 meses', '1,71 t', 'cálculo'],
    ], { x: MX, y: 4.5, w: CW, cols: [5.0, 2.4, 4.73], size: 12.5, rowH: 0.45, name: 'piso' });
  }

  // ================================================================== 07 Riscos e validação
  section('07', 'Riscos e validação', 'O que está validado, o que não está, e o que fazemos em cada risco.', 'Sétimo bloco: honestidade. O que está validado e o que não está, o que pode correr mal e quem o resolve. Quem vai dar seguimento a isto precisa de ver os riscos escritos.', '2:38');

  // V1. Validação
  {
    const s = slide({
      kicker: 'Validação do modelo', title: 'O potencial foi triangulado por quatro leituras e a procura por freguesia explica 76% da distribuição dos contentores',
      time: '2:39', core: true,
      sources: '«Dados e modelo», secção 7 (ecrã /validation) · 5,86% × 51 250,6 t; 4,55% × 517 kg; 5,4% × 315 kg; 0,7 kg/hab/mês · validação cruzada deixando uma freguesia de fora (48 freguesias)',
      numbers: ['19,15', '23,5', '17,0', '8,4', 'R² 0,76'],
      app: { route: '/validation', steps: ['Abrir /validation: triangulação do potencial e validação cruzada espacial', 'Dizer: não há backtest temporal porque só há 2025; não fingimos um'], planB: 'diapositivo' },
      notes: 'Como validámos o modelo, e o que não conseguimos validar. Só há um ano de têxtil, 2025, em totais anuais por entidade; por isso não há backtest temporal e não fingimos um. O que fizemos: a triangulação do potencial. A leitura principal, a da Vitrus e da APA, dá 19,15 quilos por habitante por ano por desviar, captura de 9,1 por cento. Outras leituras publicadas: 4,55 por cento de 517 quilos da composição dos resíduos em Portugal, 23,5 quilos; 5,4 por cento de 315 quilos, 17,0; e os 0,7 quilos por mês do plano municipal, 8,4 quilos por ano, que a Vitrus não usa. A banda está entre 8 e 24 quilos: o nosso valor está dentro dela. Depois, a validação cruzada espacial: cada freguesia prevista só com as outras 47, na proporção da população, e comparada com os contentores que lá estão. R² de 0,76 e erro mediano de 36 por cento em todos os contentores; 0,84 nos enterrados; 0,06 nos de superfície, onde a população não diz onde estão. Isto não prova a procura de têxtil: mostra que a população é um proxy razoável do sítio onde a recolha existe.',
    });
    s.addChart(pres.charts.BAR, [{ name: 'kg por habitante por ano', labels: ['Vitrus e APA (usada)', '4,55% × 517 kg', '5,4% × 315 kg', 'Plano municipal (0,7 kg/mês)'], values: [19.15, 23.5, 17.0, 8.4] }], Object.assign(chartBase(), {
      x: MX, y: 1.85, w: 6.2, h: 4.85, barDir: 'bar', chartColors: [H.floresta, H.verdeClaro, H.verdeClaro, H.verdeClaro], showLegend: false, showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0.0', showTitle: true, title: 'Têxtil por desviar, kg por habitante por ano (estimativa)', titleFontSize: 12.5, titleColor: H.tinta,
      catAxisOrientation: 'maxMin', valAxisMinVal: 0, valAxisMaxVal: 28, barGapWidthPct: 45,
    }));
    table(s, [
      ['Validação cruzada (48 freguesias)', 'R²'],
      ['Todos os contentores (erro mediano 36%)', '0,76'],
      ['Contentores enterrados', '0,84'],
      ['Contentores de superfície', '0,06'],
      ['Em capacidade (litros)', '0,80'],
    ], { x: 7.2, y: 1.95, w: 5.55, cols: [4.4, 1.15], size: 12.5, rowH: 0.5, align: ['left', 'right'], name: 'r2' });
    text(s, 'Mostra que a população é um proxy razoável de onde a recolha existe, e onde deixa de ser. Não prova a procura de têxtil. Sem série temporal não há backtest, e não fingimos um.', { x: 7.2, y: 4.7, w: 5.55, h: 1.5, fontSize: 12.5, color: H.cinza });
  }

  // V2. Riscos
  {
    const s = slide({
      kicker: 'Riscos', title: 'Dez riscos conhecidos, cada um com a sua mitigação e quem a fecha',
      time: '2:43', core: true,
      sources: '«Dados e modelo» (pressupostos e limites) · «Privacidade das fotografias» · «Avaliação da triagem» · análise da equipa',
      notes: 'O registo de riscos. Lê-se por linhas. Captura sem dado local: são os pressupostos mais sensíveis, e fecham-se com recolha real. Custos por hora e por quilómetro: dependem do financeiro da Vitrus. Contaminação: dois sacos, verificação à porta, auditoria, nunca multa. As 350 coordenadas aproximadas: validação no terreno. O têxtil por habitante igual em todo o concelho: uma caracterização do indiferenciado resolve. A triagem por foto sem avaliação: precisa de 30 peças classificadas. A dependência de um serviço externo de IA: sem a chave, a aplicação arranca e só as funcionalidades de IA respondem 503. A carga útil real da viatura: ficha técnica. A participação do munícipe: só o ensaio responde. E o RGPD: a nossa análise é técnica, e tem de ser validada pelo encarregado de proteção de dados.',
    });
    table(s, [
      ['Risco', 'Impacto', 'Mitigação', 'Quem fecha'],
      ['Captura sem dado local (18% e 25%)', '± 53,5 €/t cada', 'Calibrar com recolha real, semana a semana', 'Vitrus e equipa'],
      ['€/h e €/km das viaturas por receber', 'Custo anual', 'Substituir nos pressupostos da aplicação', 'Financeiro da Vitrus'],
      ['Contaminação do saco', 'Rejeito alto', 'Dois sacos, porta, auditoria; nunca multa', 'Operação'],
      ['350 coordenadas aproximadas', 'Paragem no sítio errado', 'Validação no terreno', 'Vitrus'],
      ['Têxtil por habitante igual em todo o concelho', 'Procura por freguesia', 'Caracterização do indiferenciado', 'Vitrus'],
      ['Triagem por foto sem verdade-terreno', 'Exatidão desconhecida', '≥ 30 peças classificadas por uma pessoa', 'Equipa e operação'],
      ['Dependência de IA externa', 'Funcionalidades de IA', 'Sem chave só a IA responde 503; teto mensal', 'Equipa'],
      ['Carga útil real da viatura', 'Nº de viaturas', 'Ficha técnica da viatura escolhida', 'Vitrus'],
      ['Participação do munícipe', 'Conformidade', 'Ensaio com métricas (≥ 80%; ≤ 15%; < 5%)', 'Operação e equipa'],
      ['Proteção de dados (RGPD)', 'Fotografias', 'Análise técnica feita; validar com o encarregado', 'Vitrus ou município'],
    ], { x: MX, y: 1.8, w: CW, cols: [3.9, 2.2, 3.9, 2.13], size: 11.5, rowH: 0.47, name: 'riscos' });
  }

  // V3. Privacidade e segurança
  {
    const s = slide({
      kicker: 'Privacidade e segurança', title: 'A fotografia vive em memória, a miniatura é opcional e apaga-se aos 90 dias, e ninguém identifica quem entrega',
      time: '2:47', core: false,
      sources: '«Privacidade das fotografias» (avaliação técnica, não aconselhamento jurídico) · «Arquitetura» e ambiente.md · estado a 23 out 2026',
      notes: 'Privacidade e segurança, resumidas. Uma nota de método: a nossa avaliação de privacidade é técnica, lida no código, e não é aconselhamento jurídico; a base jurídica, a avaliação de impacto e os textos de informação têm de ser validados pelo encarregado de proteção de dados da entidade responsável, a Vitrus ou o município. O que o código faz: a fotografia da triagem vive só em memória durante o pedido. O operador pode guardar, por peça, uma miniatura opcional, de no máximo 640 pixéis e 150 quilobytes, sem metadados, reconstruída só com os píxeis, depois de confirmar que não há pessoas; é apagada ao fim de 90 dias. Nunca se guardam dados de quem entregou a peça. A marca é de uma empresa, não de uma pessoa. Os nomes de produtores, estabelecimentos privados, só os vê um administrador. Quanto a segurança: contas com aprovação, pedidos limitados e auditoria das ações de administração.',
    });
    table(s, [
      ['Guarda-se', 'Não se guarda'],
      ['Miniatura opcional por peça: ≤ 640 px, ≤ 150 KB, sem metadados', 'A fotografia original'],
      ['Crédito de licença (fotos de terceiros), até 240 caracteres', 'EXIF, GPS, modelo da câmara'],
      ['Momento em que o operador confirmou que não há pessoas', 'Nome, contacto ou dado de quem entregou'],
      ['Fim da retenção: 90 dias por omissão', 'A foto da etiqueta (só vai à triagem, em memória)'],
    ], { x: MX, y: 1.9, w: 7.3, cols: [3.8, 3.5], size: 11.5, rowH: 0.7, name: 'privacidade' });
    text(s, 'Acesso e segurança', { x: 8.3, y: 1.9, w: 4.45, h: 0.35, fontSize: 15, bold: true });
    bullets(s, ['Acesso com conta e aprovação', 'Pedidos limitados para evitar abusos', 'Ações de administração auditadas', 'Nomes de produtores privados: só para administradores', 'Passaporte público sem dados pessoais'], { x: 8.3, y: 2.4, w: 4.45, h: 3.5, size: 13, gap: 10 });
    text(s, 'Esta avaliação é técnica e não substitui o parecer do encarregado de proteção de dados.', { x: MX, y: 6.0, w: 7.3, h: 0.6, fontSize: 12, color: C.accent6, bold: true });
  }

  // ================================================================== 08 Seguimento
  section('08', 'Seguimento e conversa', 'O que falta, quem o tem e como se pode continuar.', 'Último bloco: o que se segue. Não há pedidos: há uma lista de dados que só a Vitrus tem, uma sessão com a operação e a oferta do que somos. Depois, a vossa vez.', '2:50');

  // S1. Dados a fechar
  {
    const s = slide({
      kicker: 'O que se segue', title: 'Dez dados que só a Vitrus tem fecham a maior parte da incerteza, e é cerca de meio dia de trabalho',
      time: '2:51', core: true,
      sources: '«Dados e modelo» (pressupostos e perguntas abertas) · «Análise dos dados recebidos»',
      notes: 'O primeiro passo do que se segue é fechar os dados. Dez itens, com quem os tem e o que muda no modelo. Os euros por hora e por quilómetro das viaturas, que o financeiro ainda não enviou. Os quilos mensais por entidade, que permitem série temporal. O tempo e o custo de uma paragem num local municipal. O orçamento dos sacos. A folha de turnos corrigida, e a confirmação de que duas viaturas estão ativas. A ficha técnica da viatura escolhida: carga útil e preço. Uma caracterização do indiferenciado, que substitui os 5,86 por cento nacionais. A confirmação das três localidades sem freguesia. A validação no terreno das 350 coordenadas aproximadas. E a decisão sobre a exposição dos nomes de produtores. É cerca de meio dia de trabalho vosso, e a plataforma afina-se toda: os pressupostos saem, entram os vossos valores.',
    });
    table(s, [
      ['Dado', 'Quem tem', 'O que muda no modelo'],
      ['€/h e €/km das viaturas', 'Financeiro', 'Substitui 6 € por recolha e 1,10 €/km'],
      ['Kg mensais por entidade', 'Entidades e Vitrus', 'Série temporal; calibração da captura'],
      ['Tempo e custo de uma paragem num local', 'Operação', 'Custo do modo «local existente»'],
      ['Orçamento dos sacos', 'Compras', 'Custo da camada 1 da triagem'],
      ['Folha de turnos corrigida; viaturas ativas', 'Operação', 'Acessibilidade; hábito de dias fixos'],
      ['Ficha técnica da viatura escolhida', 'Compras', 'Carga útil e preço (hoje 2 t e 42 500 €)'],
      ['Caracterização do indiferenciado', 'Vitrus e Resinorte', 'Substitui os 5,86% nacionais'],
      ['3 localidades sem freguesia', 'Operação', 'Fecha os alertas dos circuitos'],
      ['350 coordenadas aproximadas', 'Operação, no terreno', 'Candidatos fiáveis'],
      ['Nomes de produtores privados', 'Direção', 'Exposição nos ecrãs (hoje só administradores)'],
    ], { x: MX, y: 1.8, w: CW, cols: [4.6, 2.8, 4.73], size: 11.5, rowH: 0.43, name: 'dados-a-fechar' });
  }

  // S2. Roteiro
  {
    const s = slide({
      kicker: 'O que se segue', title: 'Uma sequência possível: dados e sessão com a operação agora, calibração em dois meses, e 2028 como horizonte',
      time: '2:54', core: true,
      sources: 'Proposta da equipa; datas por acordar com a Vitrus · Diretiva (UE) 2025/1892 (17 abr 2028)',
      notes: 'Uma sequência possível, que é proposta e não compromisso. Agora, nas próximas duas semanas: fechar os dez dados e fazer uma sessão com a operação. Nessa sessão, a triagem e a rede desenham-se com quem as faz: a nossa análise está na mesa, falta a vossa leitura, o que está certo, o que é ingénuo, o que falta. Em um a dois meses: substituir pressupostos por valores reais, validar no terreno as coordenadas aproximadas, avaliar a triagem por foto com pelo menos 30 peças classificadas, e fechar a regra das paragens vazias, a paragem que sai da rota depois de três rondas consecutivas vazias, sempre anunciado. Depois, se fizer sentido, um ensaio com métricas, que já está desenhado, e a edição dos pontos pela Vitrus na própria plataforma. O horizonte é abril de 2028, com o relatório RAP já com números do concelho. Não pedimos nenhum piloto: se a Vitrus o propuser, aceitamos na hora.',
    });
    const ty = 3.4;
    s.addShape(pres.ShapeType.line, { x: MX, y: ty, w: CW, h: 0, line: { color: H.tinta, width: 1 }, objectName: 'linha-tempo' });
    const cols = [
      ['Agora', 'Próximas 2 semanas', ['Fechar os 10 dados', 'Sessão com a operação: ler a análise da triagem e da rede']],
      ['Depois', '1 a 2 meses', ['Pressupostos trocados por valores reais', 'Validar 350 coordenadas no terreno', 'Avaliar a triagem por foto (≥ 30 peças)', 'Regra das paragens vazias']],
      ['Se fizer sentido', 'Ensaio', ['Duas freguesias, métricas definidas', 'Vitrus edita os pontos na plataforma']],
      ['Horizonte', '17 abr 2028', ['RAP têxtil em vigor', 'Relatório com números do concelho']],
    ];
    const cw = 2.85; const g = 0.243;
    cols.forEach(([t, when, items], i) => {
      const x = MX + i * (cw + g);
      s.addShape(pres.ShapeType.rect, { x, y: ty - 0.09, w: 0.18, h: 0.18, fill: { color: i === 3 ? C.accent3 : C.accent1 }, line: { color: i === 3 ? C.accent3 : C.accent1, width: 0 }, objectName: 'marco' });
      text(s, t, { x, y: ty - 1.2, w: cw, h: 0.5, fontFace: THEME.headFontFace, fontSize: 24, bold: true });
      text(s, when, { x, y: ty - 0.7, w: cw, h: 0.35, fontSize: 13, color: H.cinza });
      bullets(s, items, { x, y: ty + 0.35, w: cw, h: 2.6, size: 12.5, gap: 6 });
    });
  }

  // S3. Como podemos trabalhar
  {
    const s = slide({
      kicker: 'O que se segue', title: 'A plataforma fica: já está em produção e nós mantemos, desenvolvemos e desenhamos a rede convosco',
      time: '2:57', core: true,
      sources: 'novelo.helder.si · documentação do projeto (em português)',
      notes: 'O que somos e o que fica. Somos quem construiu a plataforma, e é isto que sabemos fazer: programar soluções sobre dados reais. O que já existe: uma plataforma em produção, com os dados da Vitrus, os pressupostos todos visíveis e editáveis, e documentação completa em português, para quem vier a trabalhar com isto ter tudo escrito. O que fazemos: consultoria e solução tecnológica; mantemos a plataforma, desenvolvemo-la ao ritmo que a operação pedir, e desenhamos a rede convosco. E o que precisamos de vocês: os dados da lista, uma sessão com a operação, e a vossa leitura crítica. O que se faz a seguir é o que fizer sentido para vocês.',
    });
    const cw = 3.9; const g = 0.215;
    [['O que existe', ['Plataforma em produção, com os dados reais da Vitrus', 'Cada pressuposto visível, com fonte, e editável', 'Documentação completa em português', 'Relatório RAP gerado num clique']],
      ['O que fazemos', ['Consultoria e solução tecnológica', 'Manter a plataforma e desenvolvê-la ao ritmo da operação', 'Desenhar a rede convosco, com os vossos dados', 'Ligar o relatório RAP aos números do concelho']],
      ['O que precisamos', ['Os dez dados da lista anterior', 'Uma sessão com a operação', 'A vossa leitura crítica: o que está certo, o que é ingénuo, o que falta']]].forEach(([t, items], i) => {
      const x = MX + i * (cw + g);
      rule(s, x, 1.95, cw, { color: H.tinta });
      text(s, t, { x, y: 2.1, w: cw, h: 0.5, fontFace: THEME.headFontFace, fontSize: 24, bold: true });
      bullets(s, items, { x, y: 2.9, w: cw - 0.2, h: 3.6, size: 15, gap: 12 });
    });
  }

  // S4. Perguntas nossas
  {
    const s = slide({
      kicker: 'A vossa vez', title: 'Duas perguntas para começar, e seis para a operação e para a gestão',
      time: '3:00', core: true,
      sources: 'Guião de ensaio (perguntas nossas primeiro) · «Dados e modelo»',
      notes: 'Antes de responder ao que vos ocorrer, duas perguntas nossas, e ouvimos sem contestar. Primeira: o que é que o Novelo teria de fazer para entrar no vosso dia a dia, não em abril de 2028, na segunda-feira? Segunda: o que é que não vos convence nos números? Onde é que carregam? As respostas são o que mais nos ajuda, e vamos tomar nota. As seis seguintes são perguntas de reserva, se a conversa precisar de um ponto de partida. Se a Vitrus propuser um ensaio, uma freguesia, um contacto ou uma data: aceitamos na hora, agradecemos e anotamos.',
    });
    text(s, 'Para começar', { x: MX, y: 1.85, w: 5.6, h: 0.4, fontFace: THEME.headFontFace, fontSize: 22, bold: true });
    rule(s, MX, 2.35, 5.6, { color: H.tinta });
    bullets(s, ['O que teria o Novelo de fazer para entrar no vosso dia a dia, na segunda-feira e não em 2028?', 'O que não vos convence nos números? Onde é que carregam?'], { x: MX, y: 2.5, w: 5.6, h: 3.5, size: 17, gap: 18 });
    text(s, 'De reserva', { x: 6.9, y: 1.85, w: 5.85, h: 0.4, fontFace: THEME.headFontFace, fontSize: 22, bold: true });
    rule(s, 6.9, 2.35, 5.85, { color: H.tinta });
    bullets(s, ['Quanto demora e custa uma paragem num local municipal?', 'Que viatura vão escolher e com que carga útil?', 'Qual é a frequência de ronda que a operação aceitaria?', 'Que parte da triagem em camadas faz sentido na vossa operação?', 'Que pontos devem ficar fixos ou excluídos da rede?', 'Quem na equipa pode validar as 350 coordenadas?'], { x: 6.9, y: 2.5, w: 5.85, h: 4.0, size: 13.5, gap: 9 });
  }

  require('./c6')();

  // ================================================================== Anexos
  section('A', 'Anexos', 'Números canónicos, stack, perguntas esperadas e fontes.', 'Anexos de consulta: só se abrem se houver pergunta.', 'anexo');

  // A1. Números canónicos
  {
    const s = slide({
      kicker: 'Anexo A1', title: 'Números canónicos: cada valor, a sua origem e o seu selo',
      time: 'anexo', core: false,
      sources: '«Dados e modelo» · dados do cenário B (11 nov 2026)',
      notes: 'Tabela de consulta. Todos os números usados nesta apresentação, com a origem e o selo. Se alguma coisa for citada que não está aqui, é porque não a usámos.',
    });
    table(s, [
      ['Número', 'Valor', 'Origem', 'Selo'],
      ['Têxtil recolhido à parte, 2025', '301,3 t (0,16 kg/hab/mês)', 'Vitrus, 4 entidades', 'medido'],
      ['Indiferenciado do concelho', '≈ 51 250,6 t', '43 050,5 t ÷ 0,840', 'estimativa'],
      ['Têxtil por desviar', '≈ 3 003,3 t/ano (1,596 kg/hab/mês)', '51 250,6 t × 5,86% (APA)', 'estimativa'],
      ['Captura atual', '9,1% (≈ 3 304,6 t geradas)', 'cálculo', 'estimativa'],
      ['Destino do recolhido', '59,4% · 26,5% · 14,1%', 'Vitrus 2025', 'medido'],
      ['Aterro evitado por tonelada', '105,64 € (40 + 65,64)', 'Vitrus, 22 out 2026', 'medido'],
      ['Viatura', '42 500 €, 8 anos, 2 t, 30 km/h', 'Gaia (TED) e equipa', 'pressuposto'],
      ['Cenário B, 60 000 €/ano', '431,1 t · 101,9 €/t · 43 914 €', 'modelo', 'estimativa'],
      ['Tratamento evitado e custo líquido', '45 542 € · −1 628 €/ano', 'modelo', 'estimativa'],
      ['Reutilizável no B', '256,1 t (215,6 a 314,1)', 'modelo', 'estimativa'],
      ['Intervalo do €/t no B', 'P10 81,6 · P50 103,4 · P90 139,7', 'Monte Carlo, 500 amostras', 'estimativa'],
      ['Candidatos a paragem', '1 187 + 86 = 1 273 (837 precisos)', 'pacote QGIS, 20 out 2026', 'medido'],
      ['Rede municipal', '2 751 contentores, 2 026 locais', 'pacote QGIS', 'medido'],
      ['Triagem em camadas', '2 a 3 ETC; sacos 50 a 200 mil €/ano', 'análise da equipa', 'estimativa'],
    ], { x: MX, y: 1.65, w: CW, cols: [3.2, 3.9, 3.4, 1.63], size: 10.5, rowH: 0.335, name: 'canonicos' });
  }

  require('./c2').arquitetura();

  // A2. Stack
  {
    const s = slide({
      kicker: 'Anexo A3', title: 'Stack e entrega técnica: o que está em cada camada e como se verifica',
      time: 'anexo', core: false,
      sources: '«Arquitetura» · «Testes» · «Deploy»',
      notes: 'Anexo para quem vai dar seguimento técnico. A API é FastAPI em Python 3.12, organizada por funcionalidades, com mypy estrito e Ruff; o domínio, as fórmulas e a otimização, são funções puras testadas com valores calculados à mão. O otimizador é OR-Tools. As rotas usam um OSRM próprio. A web é React com Vite e TanStack, estrita em TypeScript. O contrato OpenAPI é exportado e dele se gera o cliente. A verificação é local: just check-fast em menos de 90 segundos e just check completo, sem integração contínua remota por agora. O deploy é automático a cada merge na main, em contentores.',
    });
    table(s, [
      ['Camada', 'Tecnologia', 'Notas'],
      ['API', 'FastAPI, Python 3.12, uv, Pydantic v2', 'Features em features/<nome>/; erros {code, message, details}'],
      ['Domínio e otimização', 'Funções puras; OR-Tools (CP-SAT e VRP)', 'Sementes fixas; limite de tempo do solver; testes à mão'],
      ['Rotas', 'OSRM próprio sobre OpenStreetMap', 'Perfil novelo-van; fallback marcado «estimate»'],
      ['IA', 'OpenRouter; JSON validado por Pydantic', 'Prompts versionados; verificador de números; teto mensal'],
      ['Base de dados', 'PostgreSQL; migrações Alembic', 'Seed idempotente com SHA-256 dos ficheiros'],
      ['Web', 'React, Vite, TanStack Router e Query, Tailwind v4, shadcn/ui', 'TypeScript estrito; cliente gerado (hey-api); PWA'],
      ['Verificação', 'Ruff, mypy, pytest, Biome, tsc, Vitest, Playwright', 'just check-fast (< 90 s) e just check (limites reais)'],
      ['Entrega', 'Docker; Coolify numa VPS', 'Deploy a cada merge na main; trabalho em ramos com PR'],
    ], { x: MX, y: 1.9, w: CW, cols: [2.4, 5.0, 4.73], size: 12, rowH: 0.56, boldFirst: true, name: 'stack' });
  }

  // A3. Perguntas esperadas 1
  {
    const s = slide({
      kicker: 'Anexo A4', title: 'Perguntas esperadas da operação e respostas curtas',
      time: 'anexo', core: false,
      sources: '«Plano da sessão», secção 6 · «Dados e modelo»',
      notes: 'Respostas de 20 segundos às perguntas mais prováveis da operação. Se a pergunta não tiver resposta aqui: «boa pergunta, anotamos e respondemos com número».',
    });
    table(s, [
      ['Pergunta', 'Resposta'],
      ['O munícipe não vai pôr lixo no saco?', 'O peso denuncia, o motorista recusa à porta com nota educativa, e nunca se paga por quilo nem por peça. Os 56,9% vieram do canal sem controlo.'],
      ['O saco não fica na chuva num local público?', 'O candidato é o lugar, não o contentor: a paragem é um encontro anunciado e o saco entrega-se à mão. Nas escolas espera dentro.'],
      ['Podemos escolher os pontos?', 'Sim. Hoje restringe-se por freguesia e tipo; com rede, a Vitrus fixa, exclui e acrescenta pontos na plataforma.'],
      ['O motorista anda com telemóvel?', 'Um Android da viatura (150 a 300 €), 3 botões, QR, offline. A rota é o plano do dia; não navega pela aplicação.'],
      ['Que viatura e quanto custa?', 'Caixa fechada sem compactação, 42 500 € (Gaia, pressuposto); €/h e €/km são um dos dados a fechar.'],
      ['Isto substitui as entidades que triam?', 'Não. Continuam a triar. O Novelo é a camada de decisão e evidência.'],
      ['E o RGPD das fotografias?', 'Em memória durante o pedido; miniatura opcional sem metadados, 90 dias; a marca é de uma empresa. A análise é técnica e carece de parecer.'],
    ], { x: MX, y: 1.8, w: CW, cols: [4.0, 8.13], size: 11, rowH: 0.6, boldFirst: true, name: 'qa-operacao' });
  }

  // A4. Perguntas esperadas 2
  {
    const s = slide({
      kicker: 'Anexo A5', title: 'Perguntas esperadas da gestão e do município e respostas curtas',
      time: 'anexo', core: false,
      sources: '«Plano da sessão», secção 6 · cenário B (11 nov 2026) · Diretiva (UE) 2025/1892',
      notes: 'Respostas curtas às perguntas de gestão. Os números são os do cenário B; qualquer dúvida remete-se para o anexo de números canónicos.',
    });
    table(s, [
      ['Pergunta', 'Resposta'],
      ['Quanto custa ao município?', 'Com 60 000 €/ano, o aterro evitado (45 542 €) paga a operação: custo líquido de −1 628 €/ano no caso central. Estimativa; nos casos pessimistas não chega.'],
      ['O que ganha o cidadão?', 'Saco grátis, dia fixo e resposta: o passaporte diz para onde foi a roupa. Sem aplicação obrigatória.'],
      ['O que muda em 2028?', 'Os produtores pagam o custo eficiente, determinado com as autoridades locais. Guimarães chega com números próprios por território e por marca.'],
      ['E o emprego e a economia social?', 'Os lotes por fibra ligam ao Vale do Ave; as entidades que hoje recolhem as 301 t continuam e ganham mais material e evidência.'],
      ['Funciona noutros concelhos?', 'Sim: INE, OSM e CAOP são de todos; faltam os custos locais. O texto da triagem já nasce neutro em relação ao concelho.'],
      ['Quem mantém isto?', 'Nós: é a oferta. Mantemos e desenvolvemos; a contratação pública segue o caminho que a Vitrus indicar.'],
      ['E a To Be Green?', 'Complementar: eles trabalham o cidadão e a reutilização; o Novelo, a decisão e a evidência de quem opera a recolha.'],
    ], { x: MX, y: 1.8, w: CW, cols: [4.0, 8.13], size: 11, rowH: 0.6, boldFirst: true, name: 'qa-gestao' });
  }

  // A5. Fontes
  {
    const s = slide({
      kicker: 'Anexo A6', title: 'Fontes e documentação de apoio',
      time: 'anexo', core: false,
      sources: 'índice da documentação (índice completo)',
      notes: 'Onde está cada coisa. A documentação está no repositório, em português, com índice em docs/README.md.',
    });
    table(s, [
      ['Documento', 'Conteúdo'],
      ['docs/engenharia/dados-e-modelo.md', 'Dados, fórmulas, pressupostos, validação, rede por locais, viatura, cobertura'],
      ['docs/dados/analise-dados-recebidos.md', 'O que a Vitrus enviou, limites e perguntas abertas'],
      ['docs/dados/analise-contentores-municipais.md', 'Pacote QGIS: contentores, locais, qualidade'],
      ['docs/engenharia/rotas-reais.md', 'OSRM, calibração do desvio, perfil da viatura'],
      ['docs/engenharia/triagem-pre-recolha.md', '«Vai no saco?»: decisão, desenho e fases'],
      ['docs/engenharia/privacidade-fotografias.md', 'Avaliação técnica de privacidade das fotografias'],
      ['docs/engenharia/avaliacao-triagem.md', 'Como avaliar a triagem com verdade-terreno'],
      ['docs/engenharia/features.md · arquitetura.md · testes.md', 'Funcionalidades, arquitetura e verificação'],
      ['docs/projeto/apresentacao-vitrus-*.md', 'Plano da sessão, guião, números e perguntas'],
    ], { x: MX, y: 1.9, w: CW, cols: [5.2, 6.93], size: 12, rowH: 0.5, name: 'fontes-docs' });
  }
};
