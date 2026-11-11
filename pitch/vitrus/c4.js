'use strict';
/** Parte 4: a prova (triagem, lote, passaporte, marcas, RAP, «Vai no saco?», rede no terreno e B2B). */
const L = require('./lib');
const { pres, C, H, MX, CW, W, slide, section, card, stat, iconRow, bullets, pill, table, arrow, stepBox, shot, phone, framed, text, chartBase, img, ic, THEME, nf } = L;

module.exports = function build() {
  section('05', 'A prova: do saco ao fio', 'Medir o que acontece a cada peça: triagem, lote, passaporte, marcas, relatório RAP e o conselho ao munícipe. Aplicação aberta.', 'Quinto bloco: a prova. Uma rede destas ou se mede ou é opinião. Vamos percorrer o caminho de uma peça, da fotografia ao relatório de 2028. Os dados que aparecem são de demonstração, com fotografias reais de licença livre.', '1:50');

  // P1. Triagem
  {
    const s = slide({
      kicker: 'Demonstração 2 · Triagem por foto', title: 'Uma fotografia na entrega sugere tipo, estado, composição e marca; a decisão é sempre do operador',
      time: '1:51', core: true,
      sources: '«IA» · «Avaliação da triagem» · «Privacidade das fotografias»',
      app: { route: '/triage', steps: ['Fotografar a peça (camisola) e a etiqueta de composição', 'Carregar em «Analisar peça»; esperar a sugestão: tipo, estado (reutilizar, reciclar, rejeitar), composição, marca', 'O operador confirma ou corrige', 'A peça entra no lote em curso; mostrar o contador do lote', 'Se falhar: usar peça e etiqueta pré-fotografadas ou a miniatura do lote'], planB: 'peça e etiqueta pré-fotografadas' },
      notes: 'A triagem na entrega é o controlo de qualidade, e o problema da Vitrus é a contaminação. O operador fotografa a peça e, se houver, a etiqueta de composição. As fotografias vão, só em memória, a um modelo de visão, e voltam como uma sugestão: tipo de peça, estado, se é para reutilizar, reciclar ou rejeitar, composição por fibra e marca, quando legível. O operador confirma ou corrige: a decisão é sempre humana, a fotografia é o instrumento de medição. A peça entra no lote em curso. O peso é uma estimativa por tipo de peça, até haver balança no ponto. Uma ressalva que um técnico quer ouvir: ainda não corremos uma avaliação com verdade-terreno. A infraestrutura está feita, uma matriz de confusão, o custo e a latência por peça, mas precisa de pelo menos 30 peças já classificadas por uma pessoa; sem elas, não dizemos uma percentagem de acerto. Do custo, o modelo é configurável no painel de administração, com orçamento mensal e teto: são cêntimos por peça.',
    });
    phone(s, 'm-triage.png', MX + 0.1, 1.85, 4.3, 'Triagem de peças, no telemóvel do operador');
    shot(s, 'app-lot.png', 3.9, 1.85, 5.2, 'Lote em curso e peças já triadas');
    const x0 = 9.6;
    const steps = [['Camera', '1 · Fotografar', 'peça e etiqueta'], ['BrainCircuit', '2 · O modelo sugere', 'tipo, estado, composição, marca'], ['CircleCheck', '3 · O operador confirma', 'ou corrige'], ['Package', '4 · Entra no lote', 'só dados, sem imagem']];
    steps.forEach(([icn, t, sub], i) => iconRow(s, x0, 1.9 + i * 0.85, 3.15, icn, t, sub, { h: 0.8, descSize: 11.5, titleSize: 13.5 }));
    card(s, 3.9, 5.55, 8.85, 1.25, { fill: C.background1, name: 'nota-triagem' });
    text(s, [
      { text: 'Ainda por medir: ', options: { bold: true, color: C.accent6 } },
      { text: 'a exatidão da triagem. A avaliação com verdade-terreno está preparada e precisa de ≥ 30 peças classificadas por uma pessoa; até lá, não apresentamos percentagem de acerto. A fotografia vive em memória durante o pedido; a miniatura é opcional.' },
    ], { x: 4.1, y: 5.6, w: 8.45, h: 1.15, fontSize: 12.5, valign: 'middle' });
  }

  // P2. Lote e passaporte
  {
    const s = slide({
      kicker: 'Demonstração 2 · Lote e passaporte', title: 'Cada lote tem um QR e uma página pública que responde à pergunta «para onde foi a minha roupa?»',
      time: '1:56', core: true,
      sources: '«Funcionalidades», secção 2 · «Dados de demonstração» (6 lotes, 24 peças, fotografias da Wikimedia Commons com crédito) · plano municipal de Guimarães (Passaporte Digital do Produto)',
      app: { route: '/lots e /passport/{código}', steps: ['Abrir /lots: 6 lotes de demonstração nos 4 estados (a recolher, triado, reservado, entregue)', 'Pegar no saco de demonstração com o QR do lote e passá-lo à pessoa mais importante da sala', 'Ela lê o QR com o telemóvel: abre o passaporte público, sem conta', 'Mostrar: origem (freguesia), composição, estado das peças, peso (estimativa), histórico', 'Voltar ao ecrã inicial: o fluxo (Sankey) engrossou'], planB: 'abrir /pt/passport/{código} no portátil' },
      notes: 'Cada peça triada entra num lote; cada lote tem um código e um QR. Este é o momento da apresentação: vamos passar o saco de demonstração à pessoa mais importante da sala, para ler o QR no seu telemóvel. O que abre é o passaporte do lote: origem, a freguesia; composição por fibra, ponderada pelo peso das peças; estado, reutilização, reciclagem, rejeito; peso, estimativa; e o histórico, recolhido, triado, reservado, entregue. É público, não precisa de conta, e responde à pergunta que todo o munícipe faz: para onde foi a minha roupa? Os campos seguem o que o plano municipal descreve para a primeira fase do Passaporte Digital do Produto dos têxteis, composição, reciclabilidade e rastreabilidade, por confirmar, para o Novelo encaixar quando a regra chegar. Os seis lotes de demonstração têm 24 peças com fotografias reais de licença livre, da Wikimedia Commons, com crédito do autor e da licença visível. Os dados de composição, nas peças sem etiqueta legível, são os que o operador confirma: pressuposto de demonstração, dito.',
    });
    shot(s, 'app-lots.png', MX, 1.85, 5.4, 'Lotes: 6 lotes de demonstração nos 4 estados');
    shot(s, 'app-lot-delivered.png', MX, 4.95, 3.2, null);
    phone(s, 'm-passport.png', 6.55, 1.85, 4.3, 'Passaporte público do lote, aberto pelo QR');
    bullets(s, ['Origem: freguesia do lote', 'Composição por fibra, pelo peso', 'Estado: reutilização, reciclagem, rejeito', 'Histórico: recolhido, triado, reservado, entregue'], { x: 11.3, y: 2.0, w: 1.5, h: 3.9, size: 10.5, gap: 10 });
    s.addImage({ path: require('node:path').join(__dirname, '../qr-novelo.png'), x: 11.28, y: 6.14, w: 0.62, h: 0.62, altText: 'QR de novelo.helder.si' });
    text(s, 'novelo.helder.si', { x: 11.95, y: 6.2, w: 0.85, h: 0.5, fontSize: 8.5, valign: 'middle', color: H.cinza });
  }

  // P3. Marcas e bolsa
  {
    const s = slide({
      kicker: 'Demonstração 2 · Marcas e bolsa de fibra', title: 'Quilos por marca e por fibra: a base local para a ecomodulação de 2028 e o material limpo que a indústria procura',
      time: '2:01', core: false,
      sources: '«Funcionalidades», secções 2 e 5 · lotes de demonstração (composição de peças sem etiqueta: pressuposto de demonstração) · Diretiva (UE) 2025/1892 (ecomodulação)',
      app: { route: '/lots → Evidência por marca e Bolsa de fibra', steps: ['Abrir «Evidência por marca»: quilos por marca e composição, com o tamanho da amostra', 'Abrir «Bolsa de fibra»: lotes agregados por fibra (algodão, lã, poliéster...)', 'Dizer: dados de demonstração; o tamanho da amostra aparece sempre'], planB: 'diapositivo' },
      notes: 'Dois agregados que saem dos lotes. Do lado de quem paga: a evidência por marca. Na triagem, a fotografia da etiqueta dá também a marca, quando está visível. O Novelo soma quilos por marca e por composição ao longo do tempo. Em 2028, com a ecomodulação, quem vende moda rápida pode pagar mais; Guimarães chega a essa conversa com dados próprios, não com médias europeias. No relatório, aparece sempre com o tamanho da amostra, para não se tirarem conclusões de poucos lotes. Do lado de quem recicla: a bolsa de fibra. Os lotes juntam-se por fibra, algodão, lã, poliéster, e quem recicla no Vale do Ave consulta-os. É o material limpo e homogéneo que falta, segundo o plano municipal, para existir mercado de matérias-primas secundárias. Sem preços nem pagamentos neste momento: o valor está em tornar visível o material. E a prioridade é baixa, porque a Vitrus diz que reciclar custa mais do que fibra virgem: o valor está na reutilização. Os números dos ecrãs são de demonstração, e isso está dito.',
    });
    shot(s, 'app-brands.png', MX, 1.85, 6.0, 'Evidência por marca (dados de demonstração)');
    shot(s, 'app-market.png', 6.9, 1.85, 5.85, 'Bolsa de fibra (dados de demonstração)');
    iconRow(s, MX, 5.55, 5.9, 'Shirt', 'Quem paga: as marcas', 'Quilos por marca e composição, com o tamanho da amostra.', { h: 1.1, descSize: 12 });
    iconRow(s, 6.9, 5.55, 5.85, 'Factory', 'Quem recicla: a indústria', 'Lotes homogéneos por fibra, para o Vale do Ave. Sem preços nem pagamentos.', { h: 1.1, descSize: 12 });
  }

  // P4. RAP
  {
    const s = slide({
      kicker: 'Demonstração 2 · Relatório RAP', title: 'O dossiê para a mesa de 2028 sai num clique, com o método e a fonte de cada número',
      time: '2:06', core: true,
      sources: '«Funcionalidades», secção 3 · dados do ecrã (PDF; WeasyPrint) · relatório gerado a 11 nov 2026 com os cenários B, A e Locais reais',
      app: { route: '/reports', steps: ['Abrir /reports: histórico de relatórios, com data e versão dos parâmetros', 'Abrir o PDF RAP pré-gerado', 'Mostrar: resumo, custo por tipo de território, material por fibra, cenários, evidência por marca, método e fontes', 'Mostrar as cópias impressas para a pasta de cada pessoa'], planB: 'cópias impressas' },
      notes: 'Tudo o que vimos desagua aqui: o relatório para a responsabilidade alargada do produtor, num clique. O PDF abre com um resumo, com os números da casa: 3 003 toneladas por desviar, 301,3 recolhidas em 2025, captura de 9,1 por cento. Depois, o custo por tonelada por tipo de território, urbano, médio e rural; as toneladas por fibra e por destino, a partir dos lotes; os cenários comparados, com o investimento e o custo de operação; a evidência por marca, com a amostra; e o método e as fontes de cada número, com a etiqueta estimativa. Cada relatório fica guardado com data e versão dos parâmetros, para se poder reproduzir. É o dossiê com que a Câmara se senta à mesa de 2028, e a mesa muda: até abril de 2028, são os produtores a pagar o custo eficiente; quem lá chegar com números próprios por tipo de território e por marca, chega em posição de força. E está impresso: não depende do wi-fi.',
    });
    shot(s, 'app-reports.png', MX, 1.85, 6.1, 'Ecrã /reports');
    framed(s, 'rap-1.png', 7.05, 1.8, 2.7, 3.8, 'Capa do PDF');
    framed(s, 'rap-2.png', 10.05, 1.8, 2.7, 3.8, 'Resumo e custo por território');
    table(s, [
      ['Secção do relatório', 'Conteúdo'],
      ['Resumo', 'Toneladas, custo anual e €/t do cenário escolhido'],
      ['Custo por território', '€/t em APU, AMU e APR (TIPAU, INE)'],
      ['Material e evidência', 'Toneladas por fibra e destino; marcas com amostra'],
      ['Método e fontes', 'Fórmulas, pressupostos, origem e selo de cada número'],
    ], { x: MX, y: 4.6, w: 6.1, cols: [1.9, 4.2], size: 11, rowH: 0.42, name: 'rap-seccoes' });
  }

  // P5. Vai no saco?
  {
    const s = slide({
      kicker: 'Demonstração 2 · «Vai no saco?»', title: 'A resposta à sugestão de 4 de novembro: o munícipe fotografa a peça e recebe um conselho, sem conta e sem guardar nada',
      time: '2:11', core: true,
      sources: '«Triagem pré-recolha» (fase 1 feita a 4 nov 2026) · dados do ecrã',
      app: { route: '/bag-check (no telemóvel)', steps: ['Abrir /bag-check no telemóvel e fotografar a toalha velha (molhada)', 'Ler o conselho: «fica fora»; o motivo numa frase', 'Dizer: nada é guardado, ninguém é bloqueado; é conselho, não portagem'], planB: 'captura no diapositivo' },
      notes: 'Uma resposta direta à sugestão de 4 de novembro da Vitrus: mover a triagem para antes da recolha. Fizemos a fase um: a página pública «Vai no saco?». O munícipe, em casa, fotografa a peça e recebe um conselho numa frase: esta toalha, molhada, fica fora; ou: esta camisola vai no saco. Não precisa de conta; a fotografia é analisada e apagada de imediato, não se guarda nada nem dados pessoais. Decidimos que é um conselho e não uma condição: ninguém precisa de autorização para pôr um saco à porta, e a recolha não recusa nada por causa dele. Isto evita atrito com o cidadão e evita criar uma exceção na operação. Analisámos as alternativas, condicionar a recolha com sacos pré-verificados, e pusemo-las de lado por agora: exigem logística de sacos marcados e punem quem não tem telemóvel; só se avalia se o ensaio mostrar abuso. A fase dois é a mesma verificação, mas pelo operador, à porta, no modo ronda, que dá o sinal verdadeiro para o planeamento: freguesia real, autenticado. Está proposta, não feita.',
    });
    phone(s, 'm-bag-check.png', MX + 0.2, 1.85, 4.3, '«Vai no saco?»: página pública, sem conta');
    const flow = [['Smartphone', 'Abre a página', 'sem conta, por QR no saco ou no calendário'], ['Camera', 'Fotografa a peça', 'JPEG, PNG ou WebP até 5 MB'], ['BrainCircuit', 'O modelo aconselha', 'in_bag ou keep_out, com o motivo'], ['Trash2', 'Nada é guardado', 'a foto vive em memória; nenhum IP guardado']];
    flow.forEach(([icn, t, sub], i) => iconRow(s, 5.9, 1.9 + i * 1.12, 3.5, icn, t, sub, { h: 1.0, descSize: 11.5, titleSize: 13.5, circle: 0.55 }));
    table(s, [
      ['Fase', 'Entrega', 'Estado'],
      ['1', 'Módulo, endpoint público e página «Vai no saco?»', 'feita (4 nov)'],
      ['2', 'Operador à porta; registo anónimo por freguesia; KPI «rejeito evitado»', 'proposta'],
      ['3', 'Contadores do cidadão para prever a composição da ronda; B2B', 'hipótese'],
    ], { x: 9.6, y: 1.9, w: 3.15, cols: [0.5, 1.75, 0.9], size: 10.5, rowH: 0.7, name: 'fases-precheck' });
    card(s, 9.6, 5.0, 3.15, 1.75, { fill: C.background1, name: 'decisao-precheck' });
    text(s, 'Decisão: aconselhar, não condicionar', { x: 9.75, y: 5.08, w: 2.85, h: 0.5, fontSize: 12.5, bold: true, color: C.accent1 });
    text(s, 'Sem atrito para o cidadão nem para a operação; condicionar só se o ensaio mostrar abuso.', { x: 9.75, y: 5.6, w: 2.85, h: 1.1, fontSize: 11 });
  }

  // P6. Rede no terreno + B2B
  {
    const s = slide({
      kicker: 'Demonstração 2 · A rede no terreno', title: 'O candidato é o lugar, não o contentor; e lares e hotelaria são um canal à parte, com têxtil limpo de alto valor',
      time: '2:16', core: true,
      sources: 'dados do ecrã (pacote QGIS de 20 out 2026) · «Dados e modelo», secções 6 e 8 · nomes de produtores só para administradores',
      numbers: ['1 187', '86', '26', '17', '9'],
      app: { route: '/municipal', steps: ['Separador «Candidatos a têxteis»: 1 187 locais, 837 com coordenada precisa; dizer que o candidato é o lugar', 'Apontar a regra de ordenação (sem pesos inventados)', 'Separador «Canal B2B»: 26 estabelecimentos (17 lares, 9 hotelaria) em 15 freguesias; toneladas «a medir no piloto»', 'Mostrar a exportação GeoJSON, CSV e XLSX: o QGIS da Vitrus entra aqui'], planB: 'diapositivos 20 e este' },
      notes: 'Onde para a viatura? Em locais que já existem. O candidato é o lugar: o camião já passa, a licença já existe, o munícipe já lá vai. Nenhum saco fica na rua: a paragem é um encontro anunciado, o saco entrega-se à mão. Nas escolas, o saco espera dentro. A lista de candidatos é ordenada por uma regra explícita, sem pesos inventados: coordenada precisa primeiro, depois freguesia com mais lacuna estimada por candidato, depois contentor enterrado, depois orgânico a menos de 15 metros, depois mais contentores. Quando houver rede, a escolha dos pontos é vossa: a Vitrus passa a fixar, excluir e acrescentar pontos na plataforma, hoje só por freguesia e tipo. E há têxtil que não vem das casas: os lares e a hotelaria. São 26 estabelecimentos, 17 lares e 9 de hotelaria, em 15 freguesias: roupa de cama e toalhas, têxtil limpo, do mais alto valor de reutilização. É um canal à parte, já contado do pacote municipal. As toneladas não as sabemos: dizem «a medir no piloto», porque não há quilos por estabelecimento e não os inventamos. É provavelmente a tonelada mais barata e mais limpa que a rede consegue captar.',
    });
    shot(s, 'app-municipal-candidates.png', MX, 1.85, 6.0, 'Candidatos a têxteis: 1 187 locais, 837 com coordenada precisa');
    shot(s, 'app-municipal-b2b.png', 6.9, 1.85, 5.85, 'Canal B2B: lares e hotelaria (toneladas por medir)');
    iconRow(s, MX, 5.55, 5.9, 'MapPin', 'O candidato é o lugar', 'Nenhum saco fica na rua; a paragem é um encontro anunciado.', { h: 1.1, descSize: 12 });
    iconRow(s, 6.9, 5.55, 5.85, 'Hotel', 'Canal B2B', '17 lares e 9 de hotelaria em 15 freguesias; toneladas a medir no piloto.', { h: 1.1, descSize: 12 });
  }
};
