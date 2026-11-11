'use strict';
/** Introdução: o que é o Novelo, percurso, quem usa, o que faz e glossário. */
const L = require('./lib');
const { pres, C, H, MX, CW, W, slide, section, card, stat, iconRow, bullets, pill, table, arrow, stepBox, shot, text, img, ic, THEME } = L;

module.exports = function build() {
  section('00', 'Introdução', 'O que é o Novelo, de onde vem, para quem serve e as palavras que vamos usar.', 'Antes dos números, uma introdução: o que é o Novelo numa frase, como chegámos aqui, quem o usa e as palavras que vamos usar ao longo da sessão. Quem já conhece pode saltar; quem chega agora fica com tudo.', '0:07');

  // O que é
  {
    const s = slide({
      kicker: 'O que é o Novelo', title: 'O Novelo é a ferramenta de decisão que desenha a rede de recolha de têxteis ao menor custo e prova o que acontece a cada saco',
      time: '0:08', core: true,
      sources: '«Visão geral do projeto» · «Funcionalidades» · novelo.helder.si',
      notes: 'Numa frase: o Novelo é a ferramenta de decisão que desenha a rede de recolha de têxteis de Guimarães ao menor custo. Entram um orçamento e uma meta; saem cenários comparáveis em euros, toneladas e euros por tonelada. Mas não pára no plano. O diagrama mostra a ideia a que chamamos do saco ao fio: planear a rede, decidir em português, seguir cada saco até à indústria e entregar à Câmara o dossiê de 2028. Cada passo alimenta o seguinte: o plano diz onde parar; a recolha gera lotes; os lotes geram o passaporte, a evidência por marca e o relatório da responsabilidade alargada do produtor; e o que se mede no terreno volta a calibrar o plano. Esta sessão percorre esse caminho, com a aplicação aberta.',
    });
    s.addImage({ path: require('node:path').join(__dirname, '../../docs/img/diagrama-do-saco-ao-fio.png'), x: MX, y: 1.8, w: 7.7, h: 7.7 * (0.5), sizing: { type: 'contain', w: 7.7, h: 4.9 }, altText: 'Do saco ao fio: planear, decidir, seguir, provar' });
    iconRow(s, 8.65, 1.9, 4.1, 'Map', 'Planear', 'Orçamento e meta entram; saem cenários comparáveis com rotas pelas estradas.', { h: 1.1, descSize: 12 });
    iconRow(s, 8.65, 3.15, 4.1, 'MessageSquare', 'Decidir em português', '«E se...?» traduz a pergunta, o otimizador calcula, o verificador confere.', { h: 1.1, descSize: 12 });
    iconRow(s, 8.65, 4.4, 4.1, 'Package', 'Seguir cada saco', 'Triagem por foto, lote com QR e passaporte público, bolsa de fibra.', { h: 1.1, descSize: 12 });
    iconRow(s, 8.65, 5.65, 4.1, 'FileText', 'Provar', 'Evidência por marca e relatório RAP em PDF para 2028.', { h: 1.1, descSize: 12 });
  }

  // Percurso
  {
    const s = slide({
      kicker: 'Quem somos e como chegámos aqui', title: 'Em poucas semanas passámos de um desafio de hackathon a uma plataforma em produção com dados reais da Vitrus',
      time: '0:10', core: true,
      sources: 'Hack4Guimarães 2035 · desafio 5 TexVitrus · documentação do projeto',
      notes: 'Quem somos. Hélder Gonçalves e Flávio Fernandes. Construímos isto no Hack4Guimarães 2035, no desafio 5, o TexVitrus, e ganhámos esse desafio e o prémio geral. Mas o que interessa é o que veio depois, porque a Vitrus foi respondendo. A 20 de outubro chegou o pacote QGIS dos contentores municipais. A 21 e 22, as restrições: sem contentores, sem compactador, com um meio novo de recolha, e os dados que faltavam, o custo de tratamento, a percentagem do concelho que a Vitrus recolhe. A 23, a plataforma passou a usar rotas pelas estradas reais, a viatura dedicada e os cenários de demonstração em produção. A 4 de novembro a Vitrus sugeriu mudar a triagem para antes da recolha, e construímos o «Vai no saco?». Hoje, 12 de novembro, estamos aqui. A plataforma está em produção e a documentação está em português, para que quem vier a trabalhar com isto tenha tudo escrito.',
    });
    const ty = 3.4;
    s.addShape(pres.ShapeType.line, { x: MX + 0.2, y: ty, w: CW - 0.4, h: 0, line: { color: H.tinta, width: 1 }, objectName: 'linha-tempo' });
    const ev = [
      ['out 2026', 'Hack4Guimarães 2035', 'Desafio 5 TexVitrus; vencedor do desafio e do prémio geral', C.accent2],
      ['20 out', 'Pacote QGIS', '2 751 contentores municipais em 2 026 locais', C.accent1],
      ['21 e 22 out', 'Restrições da Vitrus', 'Sem contentores; sem compactador; meio novo; 105,64 €/t; 84,0%', C.accent1],
      ['23 out', 'Rotas por estrada', 'OSRM, viatura dedicada, cenários de demonstração em produção', C.accent1],
      ['4 nov', 'Sugestão da Vitrus', 'Triagem antes da recolha: nasce o «Vai no saco?»', C.accent1],
      ['12 nov', 'Hoje', 'Esta sessão, com a aplicação a funcionar', C.accent3],
    ];
    const step = (CW - 0.4) / 5;
    ev.forEach(([d, t, sub, col], i) => {
      const x = MX + 0.2 + i * step;
      s.addShape(pres.ShapeType.rect, { x: x - 0.09, y: ty - 0.09, w: 0.18, h: 0.18, fill: { color: col }, line: { color: col, width: 0 }, objectName: 'marco' });
      const bx = Math.min(Math.max(x - 1.0, MX), W - MX - 2.0);
      const up = i % 2 === 0;
      text(s, d, { x: bx, y: up ? ty - 1.5 : ty + 0.3, w: 2.0, h: 0.3, fontFace: THEME.headFontFace, fontSize: 15, bold: true, align: 'center', color: col === C.accent3 ? C.accent3 : C.accent1 });
      text(s, t, { x: bx, y: up ? ty - 1.18 : ty + 0.62, w: 2.0, h: 0.3, fontSize: 12, bold: true, align: 'center' });
      text(s, sub, { x: bx - 0.1, y: up ? ty - 0.9 : ty + 0.92, w: 2.2, h: 0.62, fontSize: 10.5, color: H.cinza, align: 'center' });
    });
    stat(s, MX, 5.25, 3.9, 1.55, '2 pessoas', 'Hélder e Flávio', 'Hélder Gonçalves e Flávio Fernandes: consultoria e solução tecnológica', { bigSize: 24, subSize: 11 });
    stat(s, MX + 4.1, 5.25, 3.9, 1.55, '48 freguesias', 'modeladas, 156 830 habitantes', '2 751 contentores e 2 026 locais da Vitrus analisados', { bigSize: 24, subSize: 11 });
    stat(s, MX + 8.2, 5.25, 3.93, 1.55, 'Em produção', 'novelo.helder.si', 'com dados reais da Vitrus e rotas pelas estradas', { bigSize: 24, subSize: 11 });
  }

  // Quem usa
  {
    const s = slide({
      kicker: 'Para quem é', title: 'Cada pessoa da cadeia usa o Novelo de forma diferente: decide, opera, tria, entrega ou recicla',
      time: '0:13', core: true,
      sources: '«Funcionalidades» · «Arquitetura» (utilizadores e permissões) · «Visão geral do projeto»',
      notes: 'Cinco papéis, para perceberem quem usa o quê. O decisor municipal, o presidente, os vereadores, o financeiro: usa o simulador, os cenários e o relatório, e quer saber quanto custa, quanto rende e quanto arrisca. A operação da Vitrus: usa o plano de recolha, as rotas, as viaturas e os alertas de dados, e quer saber qual é o dia, a viatura e a ronda. O operador de triagem, à entrega: fotografa a peça, confirma a sugestão e abre o lote. O munícipe: não precisa de conta; usa o «Vai no saco?» e o passaporte público lido por QR, e quer saber para onde foi a sua roupa. E o reciclador ou a indústria: consulta a bolsa de fibra, lotes homogéneos por fibra. Nenhum papel precisa de saber de otimização: a mesma plataforma, cinco entradas.',
    });
    const people = [
      ['Landmark', 'Decisor municipal', 'Presidente, vereação, finanças', 'Simulador, cenários, comparação, relatório RAP', 'Quanto custa, rende e arrisca?'],
      ['Truck', 'Operação da Vitrus', 'Planeamento e motoristas', 'Plano de recolha, rotas, viaturas, alertas de dados', 'Que dia, que viatura, que ronda?'],
      ['Camera', 'Operador de triagem', 'À entrega do têxtil', 'Foto da peça e da etiqueta, lote, estado', 'O que é esta peça e para onde vai?'],
      ['Smartphone', 'Munícipe', 'Sem conta nem app obrigatória', '«Vai no saco?», passaporte do lote por QR', 'Para onde foi a minha roupa?'],
      ['Factory', 'Reciclador e indústria', 'Vale do Ave', 'Bolsa de fibra: lotes por fibra e composição', 'Há material limpo e homogéneo?'],
    ];
    table(s, [['Papel', 'Quem é e o que usa', 'A pergunta que faz'], ...people.map((p) => [p[1], `${p[2]} · ${p[3]}`, p[4]])], { x: MX, y: 1.9, w: CW, cols: [2.5, 6.2, 3.43], size: 13, rowH: [0.45, 0.9, 0.9, 0.9, 0.9, 0.9], boldFirst: true, name: 'papeis' });
  }

  // O que faz
  {
    const s = slide({
      kicker: 'O que a plataforma já faz', title: 'Doze funcionalidades já a funcionar em produção, todas ligadas ao mesmo modelo de dados',
      time: '0:15', core: true,
      sources: '«Funcionalidades» · novelo.helder.si',
      notes: 'O mapa do que existe, e que vamos ver ao vivo. Na linha de cima, planear: o simulador, que gera cenários por freguesia ou por locais reais; os cenários e a comparação, lado a lado; o «E se...?» em português; a rede municipal com os locais candidatos. Na linha do meio, provar: a triagem por foto; o lote com QR e passaporte público; a bolsa de fibra para os recicladores; a evidência por marca. Na linha de baixo: o relatório RAP em PDF; o «Vai no saco?» para o munícipe; o copiloto conversacional, com 52 ferramentas e confirmação antes de qualquer ação; e o mapa e a cobertura. Tudo funciona sobre os mesmos dados e o mesmo contrato, em português, em telemóvel e computador.',
    });
    table(s, [
      ['Funcionalidade', 'O que faz', 'Para quem'],
      ['Simulador', 'Rede por freguesia ou por locais reais, com orçamento ou meta', 'Decisor'],
      ['Cenários e comparação', 'Guardar, comparar A/B e cadeia de orçamentos', 'Decisor'],
      ['«E se...?»', 'Pergunta em português; o otimizador calcula; o verificador confere', 'Decisor'],
      ['Rede municipal', '2 751 contentores, 1 273 candidatos, canal B2B, lacunas, qualidade', 'Decisor e operação'],
      ['Triagem por foto', 'Tipo, estado, composição e marca; a decisão é do operador', 'Operador'],
      ['Lote e passaporte', 'Lote com QR e página pública', 'Operador e munícipe'],
      ['Bolsa de fibra', 'Lotes agregados por fibra para recicladores', 'Reciclador'],
      ['Evidência por marca', 'Quilos por marca e composição, com a amostra', 'Decisor'],
      ['Relatório RAP', 'PDF para a mesa de 2028, com método e fontes', 'Decisor'],
      ['«Vai no saco?»', 'Conselho ao munícipe; nada guardado', 'Munícipe'],
      ['Assistente conversacional', 'Responde com os dados da aplicação; ações só com confirmação', 'Todos'],
      ['Cobertura e validação', 'Equidade, incerteza e qualidade dos dados', 'Decisor'],
    ], { x: MX, y: 1.75, w: CW, cols: [2.6, 6.5, 3.03], size: 11.5, rowH: [0.38, ...Array(12).fill(0.385)], boldFirst: true, name: 'funcionalidades' });
  }

  // Glossário
  {
    const s = slide({
      kicker: 'Glossário essencial', title: 'As palavras que vamos usar: dez termos explicados em uma linha',
      time: '0:17', core: false,
      sources: '«Dados e modelo» · Diretiva (UE) 2025/1892 · documentação do OR-Tools · OSRM',
      notes: 'Um glossário rápido, para ninguém se perder. Indiferenciado: o lixo comum. RAP, responsabilidade alargada do produtor: quem põe têxtil no mercado paga a sua recolha e tratamento. Ecomodulação: o valor pago varia com o tipo de produto. TGR: a taxa de gestão de resíduos. TIPAU: a tipologia urbano-rural do INE. CAOP: os contornos oficiais das freguesias. CP-SAT: o solver que escolhe locais e modos. VRP: o problema das rotas de veículos. OSRM: o motor de rotas pelas estradas reais. Estimativa: um número derivado por conta, nunca apresentado como medição. P10, P50 e P90: o intervalo de uma simulação, o cenário otimista, o central e o pessimista. ETC: equivalente a tempo completo, uma pessoa a tempo inteiro.',
    });
    table(s, [
      ['Termo', 'Significa', 'Termo', 'Significa'],
      ['Indiferenciado', 'Lixo comum, recolhido sem separação', 'CP-SAT', 'Solver do OR-Tools que escolhe locais e modos'],
      ['RAP', 'Responsabilidade alargada do produtor: quem vende têxtil paga a sua recolha', 'VRP', 'Problema de rotas de veículos (as viagens da viatura)'],
      ['Ecomodulação', 'Taxa RAP que varia com o tipo de produto', 'OSRM', 'Motor de rotas pelas estradas reais (OpenStreetMap)'],
      ['TGR', 'Taxa de gestão de resíduos (40 €/t no aterro)', 'Estimativa', 'Número derivado por conta; nunca apresentado como medido'],
      ['TIPAU', 'Tipologia urbano-rural do INE (APU, AMU, APR)', 'P10 · P50 · P90', 'Otimista, central e pessimista de uma simulação'],
      ['CAOP', 'Contornos oficiais das freguesias (2019)', 'ETC', 'Equivalente a tempo completo: uma pessoa a tempo inteiro'],
    ], { x: MX, y: 1.9, w: CW, cols: [1.9, 4.2, 1.9, 4.13], size: 12, rowH: 0.64, name: 'glossario' });
  }
};
