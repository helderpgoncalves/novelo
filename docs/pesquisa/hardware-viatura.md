# Pesquisa: hardware de pesagem e etiquetagem para a viatura

Ticket wayfinder #33. Pergunta: que hardware leva a viatura dedicada de têxtil a pesar cada saco no local e a imprimir a etiqueta com QR que cria o lote no Novelo — balanças e impressoras, integração com web app, robustez, bateria, preços e funcionamento offline.

Data de consulta das fontes: **13 de novembro de 2026**. Preços de lojas são o preço de lista visto nessa data, sem IVA salvo indicação; oscilam com o revendedor e o câmbio. Tudo o que não tem fonte pública fica marcado «a orçar».

Alvo de integração: a PWA do Novelo (React) num telemóvel/tablet **Android** na viatura — ver §4.1 porque o Android é um requisito técnico, não uma preferência.

## Resumo executivo

- **Impressora:** uma impressora térmica portátil «rugged» com Bluetooth Classic + BLE e linguagem ZPL resolve a etiqueta com QR. Zebra ZQ511 é a referência (€494–775 s/IVA na UE); Honeywell RP4f e Brother RJ-3230B/3250WB ficam na mesma faixa ($880–1 310 nos EUA); TSC Alpha-40L é a alternativa de preço intermédio (€780 s/IVA). As económicas (Munbyn ~$160, NIIMBOT) servem para demonstração, não para operação.
- **Balança:** o caminho limpo é uma balança de plataforma industrial com BLE de fábrica: KERN IXC 10K-3M (€680 s/IVA na KERN; €550,80 noutro revendedor), 6/15 kg com leitura de 2/5 g, célula de carga IP65, bateria opcional. A alternativa de menor custo é uma balança com saída serial (Adam CBK, RS-232/USB) mais um adaptador, ou uma balança BLE que «escreve» o peso como teclado Bluetooth (HID) — integra com qualquer web app sem código nativo.
- **Integração com a PWA:** no Android, o **Web Bluetooth** fala BLE (GATT) diretamente do Chrome. As impressoras Zebra Link-OS expõem um serviço GATT documentado («BLE Parser Service») para onde se escreve ZPL — é o mesmo padrão que bibliotecas não-oficiais já usam em Flutter sem SDK. Balanças com o perfil BLE padrão de peso (serviço 0x181D) lêem-se por notificações GATT.
- **Offline:** pesar e imprimir são 100% locais (BLE não usa rede). A PWA guarda os registos em IndexedDB com uma fila de saída e sincroniza quando há rede (Background Sync API). A etiqueta leva um UUID gerado no dispositivo que reconcilia com o lote criado depois no servidor.
- **Custo por viatura (estimativa):** combinação robusta ~€1 300–1 600 s/IVA; combinação de demonstração ~€200–350. Detalho em §7.

## 1. Balanças

O caso de uso: pesar sacos fechados à porta, de 2 a ~15 kg (modelos até 150 kg existem na mesma família para produtores B2B/escolas), leitura de 5 g mais que suficiente (o Novelo regista kg com 2 decimais), a funcionar a bateria no degrau da viatura.

### 1.1 KERN IXC 10K-3M — plataforma industrial com BLE (a escolha «de catálogo»)

| Campo | Valor | Fonte |
| --- | --- | --- |
| Capacidade / leitura | 6 kg (d = 2 g) / 15 kg (d = 5 g), multi-intervalo | [Loja KERN](https://www.kern-sohn.com/shop/en/products/industrial-scales/platform-scales/tixc-15k-3m-a/) |
| Plataforma | Inox 300×240×109 mm; célula de carga IP65; indicador em aço inox IP68, dígitos de 48 mm | Loja KERN |
| Interfaces | Até 4 em simultâneo: 2 cabladas (RS-232, Ethernet, USB ou analógica) + 2 sem fios (Wi-Fi, **Bluetooth**) — configuração a fazer na encomenda | Loja KERN; [IoT-Line](https://lp.kern-sohn.com/iot-line/en) |
| Protocolo | KCP (KERN Communication Protocol), comandos ASCII bidirecionais; app EasyTouch | Loja KERN |
| Bateria | Pack recarregável opcional **KERN YKR-01** — tem de ser encomendado à compra (preço a orçar) | Loja KERN |
| Temperatura | −10 °C a 40 °C | Loja KERN |
| Preço | **€680,00 s/IVA** na loja KERN (+€88 verificação NAWI 2014/31/UE, opcional); €550,80 s/IVA na [esd.equipment](https://esd.equipment/en/kern-ixc-10k-3m-iot-line-platform-scale-en.html) | ambas, 13-11-2026 |
| Garantia | 36 meses | Loja KERN |

Notas: a família IXC vai até 150 kg com d = 5 g (ex.: IXC 100K-3, [esd.equipment](https://esd.equipment/en/kern-ixc-100k-3-iot-line-platform-scale-en.html)) se a Vitrus quiser uma só balança para tudo, incluindo sacos grandes. A loja KERN vende apenas a empresas (B2B). **Ponto a validar em prova de conceito:** o BLE da IoT-Line fala KCP (ASCII) sobre GATT — confirmar com a KERN a característica/UUID antes de comprar, para garantir leitura por Web Bluetooth.

### 1.2 Adam Equipment CBK — bancada robusta, mas serial (precisa de adaptador)

A série CBK (checkweighing de bancada, 3–48 kg conforme modelo) tem plataforma em inox, bateria recarregável (~90 h no CBK 16aH) e **RS-232 bidirecional, com USB opcional** — não tem Bluetooth nativo ([ficha CBK](https://adamequipment.com/media/docs/data_sheets/CBK-DS-A4-EN.pdf); [manual CBK2](https://www.adamequipment.com/media/docs/Print%20Publications/Manuals/CBK2_UM_EN.pdf); [CBK 16aH](https://www.hogentogler.com/adam-equipment/cbk-16ah-usb-check-weighing-scale.asp)). Para a viatura seria preciso um conversor serial→BLE (ou serial→USB + OTG), o que acrescenta um elo e atrito. Preço: sem preço público verificado nas fontes consultadas (13-11-2026); loja dos EUA tequipment.com lista a família CBK c/USB.

### 1.3 Balanças BLE «de integração» — perfil padrão Bluetooth SIG e HID

A [WSI Scales](https://wsi-scales.com/ble-weighing-scales.html) (fabricante indiano, venda a orçamento) documenta três variantes úteis para perceber o panorama de integração:

- **Perfil BLE padrão:** serviço Weight Scale do Bluetooth SIG (**UUID 0x181D**), característica Weight Measurement **0x2A9D**, resolução de 5 g, peso em notificações GATT em tempo real. É o formato que o Web Bluetooth lê sem qualquer SDK — e serve de referência para pedir a qualquer fabricante.
- **GATT proprietário ASCII** (UUID 0xFFF1, string legível): típico de balanças baratas; lê-se igualmente por Web Bluetooth depois de identificado o UUID.
- **Balança teclado Bluetooth (HID):** emparelha como um teclado e «escreve» o peso no campo de texto com o foco, em qualquer browser/SO, com sufixo configurável (Enter/Tab). É o caminho de menor risco para integrar com a PWA sem Web Bluetooth (funciona até em iOS).

### 1.4 A&D e MyWeigh (mencionados no ticket)

Sem linha industrial com BLE documentada para integração: a A&D tem BLE sobretudo em balanças médicas/pessoais (ex.: UC-356BLE, [Walmart](https://www.walmart.com/ip/PREMIUM-Wireless-Wide-Base-Weight-Scale-550-lbs-capacity-UC-356BLE/1501587274)); a linha industrial/laboratorial comunica por RS-232/USB. A MyWeigh é marca de consumo sem história de BLE para integração (pesquisa 13-11-2026). Nem uma nem outra responde ao caso «plataforma a bateria com BLE» melhor do que a KERN.

## 2. Impressoras de etiquetas portáteis

Todas as que interessam são térmicas diretas (sem tinta/ribbon), 203 dpi (QR fica nítido; 300 dpi existe nas gamas altas), etiquetas de 58–112 mm.

### 2.1 Zebra ZQ511 / ZQ521 — a referência do mercado

| Campo | Valor | Fonte |
| --- | --- | --- |
| Largura de impressão | ZQ511: 72 mm (ideal para etiqueta de saco); ZQ521: 104 mm | [Ficha ZQ511/ZQ521](https://www.zebra.com/us/en/products/spec-sheets/printers/mobile/zq511-zq521.html) |
| Velocidade / resolução | Até 5 ips (127 mm/s); 203 dpi | Ficha Zebra |
| Conectividade | Bluetooth 4.1 **Classic + BLE** (MFi), Wi-Fi 802.11ac (rádio duplo em simultâneo), USB 2.0 OTG, NFC tap-to-pair | Ficha Zebra |
| Robustez | IP54 de fábrica sem case; MIL-STD 810G (queda/choque); quedas múltiplas de 2 m em betão; 1 300 tumblings de 1 m; exoskeleton opcional → queda de 3 m e IP65 | Ficha Zebra |
| Temperatura | −20 °C a 55 °C (compensação térmica de impressão a frio) | Ficha Zebra |
| Bateria | 3 250 mAh PowerPrecision+ (amovível); estendida 6 500 mAh; sleep e acorda por Bluetooth/Wi-Fi | Ficha Zebra |
| Linguagens | ZPL e CPCL nativas; QR Code nativo; ZBI 2.x | Ficha Zebra |
| Viatura | Cradle de viatura (montagem RAM, IP43), adaptador veicular duplo (impressora + telemóvel em simultâneo), fonte 12–24 V DC | Ficha Zebra |
| Garantia | 2 anos | Ficha Zebra |
| Preço UE | **€493,62** ([Logiscenter](https://www.logiscenter.eu/zebra-zq511-ticket-printer)) · **€608,61 s/IVA** c/ bateria ([posdata.eu](https://www.posdata.eu/product/2177/zebra-zq511-printer-203dpi-3400-mah-battery-usb-bt.html)) · desde **€774,99** ([Bechtle](https://www.bechtle.com/de-en/shop/product-family/zebra-zq511-mobile-label-printer--3601--f)); versão RFID ~€1 709 ([megakassen.de](https://megakassen.de/en/Mobiler-Etikettendrucker-Zebra-ZQ511-thermodirekt-203dpi-Druckbreite-72mm-Bluetooth-WLAN-RFID-Schreiber-ZQ51-BUW030E-00)) | todas, 13-11-2026 |
| Dimensões/peso | ZQ511: 150×120×62 mm, 0,63 kg | Ficha Zebra |

### 2.2 Honeywell RP4f — alternativa robusta com emulação ZPL

A RP4f (a divisão passou para a Brady) imprime 25,4–104,1 mm a 5 ips, 203 dpi ([página oficial](https://automation.honeywell.com/us/en/products/productivity-solutions/printers/mobile-printers/rp4f-mobile-thermal-printers)): IP54, queda de 2 m, 1 000 tumblings de 0,5 m, **Bluetooth 5.0 + LE**, Wi-Fi ac, NFC para emparelhar, USB 2.0, bateria 4 900 mAh, −20 a 55 °C, garantia 2 anos. Fala DPL, Direct Protocol, Fingerprint **e ZSim2 (emulação ZPL-II)** — ou seja, a mesma etiqueta ZPL serve. Tem kit de montagem em empilhador e conversor de tensão ([documentação](https://automation.honeywell.com/us/en/products/productivity-solutions/printers/mobile-printers/rp4f-mobile-thermal-printers) → guides) e SDKs de impressão Android/iOS ([Honeywell Android Printing SDKs](https://sps-support.honeywell.com/s/article/Honeywell-Android-Printing-SDKs)). Preço: $1 119,20 ([BarcodeFactory](https://www.barcodefactory.com/honeywell/printers/rp4f/rp4f00n0b12)) a $1 309,99 ([CDW](https://www.cdw.com/product/honeywell-rp4f-direct-thermal-mobile-printer/7384439)) — lojas dos EUA, 13-11-2026.

### 2.3 Brother RuggedJet RJ-3230B-L / RJ-3250WB-L

3 polegadas (80 mm) a 5 ips, 203 dpi. O RJ-3250WB-L (Wi-Fi + Bluetooth MFi + USB-C) custa **$933** e o RJ-3230B-L (Bluetooth, USB-C) **$880** na [Brother EUA](https://www.brother-usa.com/p/thermal-printers-labelers/RJ3250WBL) (13-11-2026): queda de 6 pés, **IP54 sem case**, bateria Li-ion «para o dia todo», AirPrint, garantia 2 anos Premier, adaptadores DC de viatura como acessório ([página oficial](https://www.brother-usa.com/p/thermal-printers-labelers/RJ3250WBL)). O RJ-3150 (geração anterior) declara rendimento de 5 300 etiquetas por carga ([especificações Brother](https://support.brother.com/g/b/spec.aspx?c=us&lang=en&prod=rj3150eus)). Integração: SDKs móveis da Brother para Android/iOS; sem linguagem ZPL — usa o formato próprio raster/ESC da Brother.

### 2.4 TSC Alpha-40L — o «bom e menos caro»

4 polegadas (104 mm), 203 dpi, 5 ips, Bluetooth 5.0 MFi com NFC tap-to-pair, menos de 1 kg ([TSC](https://www.tsc-drucker.com/en/Portable-Direct-Thermal-Printer/Alpha-40L-Series/); [datasheet Alpha-30L/40L](https://image.makewebcdn.com/makeweb/0/jxlPpOYv8/Document/TSC_Alpha_30L_40L_Datasheet.pdf)); bateria de 6 200 mAh ([AtlasRFID](https://www.atlasrfidstore.com/tsc-alpha-40l-mobile-label-receipt-printer/)); IP54 e queda de 1,8 m com o case opcional ([Alpha série 4"](https://usca.tscprinters.com/en/products/alpha-series-4-inch-performance-mobile-rfid-printer)). Fala TSPL e emula Datamax; a TSC tem app de impressão e «web print» via PrintSuite ([TSC PrintSuite](https://usca.tscprinters.com/en/printsuite)). Preços UE: **€779,90 s/IVA** ([auto-id247](https://www.auto-id247.com/en/tsc-alpha-40l-label-printer-direct-thermal-roll-11.2-cm/A40L-A001-0012)), desde €872,24 ([scanshop.ee](https://scanshop.ee/en/collections/tsc-alpha-40l)), €1 065 ([Jarltech](https://www.jarltech.com/en/tsc-alpha-40l)) — 13-11-2026.

### 2.5 Segmento económico (demonstração apenas)

- **Munbyn** (RealWriter RW402B, 4×6" Bluetooth ~**$159,99** em promoção; [munbyn.com](https://munbyn.com/)) e a gama 3" com «5 h de bateria». Integração pensada para a app Munbyn; emparelhamento por PIN 1234/0000 e porta serial virtual no desktop ([FAQ Munbyn](https://munbyn.com/pages/faqs-of-mini-printer-for-small-business)).
- **NIIMBOT B21** (~2", ~€40–60 na Amazon; [niimbot.com](https://www.niimbot.com/us/downloadcenter)): só através da app NIIMBOT; sem SDK pública.
- **DYMO**: os portáteis são de consumidor — LetraTag 200B Bluetooth a pilhas AA (cassetes de etiqueta, sem SDK pública) e LabelManager 280 USB recarregável ([dymo.com](https://www.dymo.com/label-makers-printers/letratag-label-makers/dymo-letratag-200b-bluetooth-label-maker/SP_2607111.html)). Não servem para a operação.

Para estes equipamentos o caminho de integração é a comunidade (bibliotecas BLE ESC/POS genéricas, ex.: [bluetooth_print_plus](https://pub.dev/packages/bluetooth_print_plus) em Flutter), sem garantia de estabilidade entre firmware. São úteis para provar o fluxo no hackathon; não para a viatura real.

## 3. Como se integram com a web app do Novelo

### 3.1 Web Bluetooth (o caminho da PWA, Android obrigatório)

- A [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API) (MDN) liga uma página a periféricos **BLE (GATT)**: `navigator.bluetooth.requestDevice()`, ligação ao GATT server, leitura de características e subscrição de notificações. É experimental, exige HTTPS (contexto seguro) e gesto do utilizador.
- **Suporte:** Chrome/Edge no desktop e **Chrome em Android** funcionam; **Safari/iOS não suportam** (MDN, «limited availability»; tabela em [caniuse](https://caniuse.com/mdn-api_bluetooth)). Conclusão prática: o telemóvel/tablet da viatura é Android. (iOS existiria só com app nativa.)
- **Impressão Zebra por BLE:** a Zebra documenta na AppNote «Link-OS Environment Bluetooth Low Energy» ([PDF](https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/application-notes/AppNote-BlueToothLE-v4.pdf)) o **Zebra Bluetooth LE Parser Service**, um serviço GATT mínimo que funciona como porta série para o parser da impressora:
  - Serviço `38eb4a80-c570-11e3-9507-0002a5d5c51b`
  - Característica de escrita (ZPL/SGD): `38eb4a82-c570-11e3-9507-0002a5d5c51b`
  - Respostas da impressora por indicações: `38eb4a81-c570-11e3-9507-0002a5d5c51b`

  O pacote Flutter [zebra_ble_printer](https://pub.dev/packages/zebra_ble_printer) (out/2026) prova o padrão sem SDK oficial: negociar MTU, escrever ZPL em blocos com response. O mesmo faz-se em TypeScript com Web Bluetooth. A AppNote avisa: BLE é para cargas leves (benchmark de ~80 B/s em câmara anóica, 2014) — usar etiquetas pequenas (a nossa tem um QR e pouco mais) e Bluetooth Classic/SPP quando o volume domina.
- **Leitura da balança por BLE:** balanças com o perfil padrão (serviço 0x181D, característica 0x2A9D) lêem-se por notificação GATT; GATT proprietário (ex.: 0xFFF1 da WSI) lê-se igual depois de identificado o UUID com o nRF Connect ([WSI BLE](https://wsi-scales.com/ble-weighing-scales.html)). A balança HID dispensa tudo: o peso «tecla-se» no campo da PWA.
- **SPP/serial clássico não é acessível ao browser** — só via app nativa Android (SDK) ou adaptador BLE/HID. É por isto que equipamento «Bluetooth» sem BLE não integra com PWA.

### 3.2 Caminhos alternativos (quando não há Web Bluetooth)

- **Zebra Browser Print** ([Zebra](https://developer.zebra.com/products/printers/browser-print)): utilitário local Windows/macOS que expõe a impressora (USB/rede/Bluetooth) a web apps por JS; serve para a cabine/estaleiro com desktop, não para o telemóvel.
- **Zebra Print / Print Connect no Android** ([Google Play](https://play.google.com/store/apps/details?id=com.zebra.channelaps)): integra a impressora no framework de impressão Android (imprimir PDF/imagens de qualquer app).
- **SDKs nativos** (se um dia houver app Android fechada): Zebra Link-OS, [Honeywell Printing SDKs](https://sps-support.honeywell.com/s/article/Honeywell-Android-Printing-SDKs) (Android 4+, RP2/RP4/RP2f/RP4f…), Brother mobile SDKs.
- **Balança HID teclado**: ver §1.3 — funciona até em iOS, sem Web Bluetooth nem SDK.

### 3.3 Nota ZPL para o piloto

A etiqueta do lote é trivial em ZPL: `^BC` (Code 128) ou `^BQN` (QR) com o UUID/URL público do passaporte do lote, mais texto humano (freguesia, data, peso). Como o QR é nativo do ZPL, não há renderização de imagem — payload pequeno, ideal para BLE. A RP4f da Honeywell aceita o mesmo ZPL via ZSim2 (§2.2).

## 4. Robustez e energia na viatura

- **IP54 é o padrão mínimo da classe** (ZQ511/521, RP4f, RJ-3250WB sem case, Alpha-40L com case) — pó e borrifos; a ZQ aguenta IP65 e queda de 3 m com exoskeleton (§2.1). Balança KERN: célula IP65 e coluna IP68 (§1.1).
- **Temperatura:** as impressoras da classe vão de −20 °C a 55 °C — inverno de Guimarães e interior de viatura ao sol. A KERN IXC declara −10 °C a 40 °C: no dias mais frios fica na cabine (não no cofre da caixa).
- **Bateria:** ZQ511 3 250 mAh (6 500 opcional, amovível); RP4f 4 900 mAh; Alpha-40L 6 200 mAh; RJ Brother «um dia de trabalho» (5 300 etiquetas no RJ-3150). KERN: pack YKR-01 opcional — **encomendar com a balança**.
- **Carga a bordo:** a Zebra vende cradle de viatura e adaptador 12–24 V (carrega impressora + telemóvel em simultâneo) e a Brother/RP4f têm adaptadores DC/kits de forklift (§2.1–2.3). Na prática: carregar no isqueiro/acendedor durante a rota resolve o dia inteiro.

## 5. Conectividade intermitente: offline com sincronização

O desenho que a pergunta pede é o clássico **offline-first com fila de saída**:

1. **Pesar e imprimir são locais.** BLE não depende de rede móvel — no ponto de recolha sem cobertura nada bloqueia: lê-se o peso, gera-se o registo, imprime-se o QR.
2. **Registo com identidade offline.** Cada pesagem gera um UUID no dispositivo (crypto.randomUUID), gravado em **IndexedDB** com estado «pendente». A etiqueta imprime esse UUID (e o URL público do futuro passaporte do lote). Nada de numeração dependente do servidor.
3. **Sincronização automática.** A PWA regista uma tarefa na **Background Sync API** ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)): quando a conectividade volta, o service worker dispara o evento `sync` e esvazia a fila (criar lote na API FastAPI, enviar foto se houver). Chrome Android suporta; Safari não — mais um motivo para Android.
4. **Reconciliação.** O servidor aceita o UUID impresso como idempotência: se a etiqueta foi lida no depósito antes de a rede sincronizar, o lote aparece quando a fila despejar; duplicados colidem no UUID.
5. **UX de estado:** indicador «N registos pendentes» no ecrã da rota — o operador sabe sempre o que ainda não chegou ao servidor.

## 6. Preços típicos por unidade (resumo)

| Equipamento | Preço típico | Fonte (13-11-2026) |
| --- | --- | --- |
| Zebra ZQ511 (72 mm, BLE) | €494–775 s/IVA (UE) | Logiscenter, posdata.eu, Bechtle |
| Honeywell RP4f (104 mm, BLE) | $1 119–1 310 (EUA) | BarcodeFactory, CDW |
| Brother RJ-3250WB-L / RJ-3230B-L | $933 / $880 (EUA, Brother direto) | brother-usa.com |
| TSC Alpha-40L (104 mm, BLE) | €780–1 065 s/IVA (UE) | auto-id247, scanshop.ee, Jarltech |
| Munbyn RW402B 3"/4×6" | ~$160 | munbyn.com |
| KERN IXC 10K-3M (15 kg, BLE opc.) | €550,80–680 s/IVA (+bateria a orçar) | esd.equipment, loja KERN |
| Adam CBK (serial, sem BLE) | a orçar | — |
| Balança BLE WSI (0x181D ou HID) | a orçamento (fabricante) | wsi-scales.com |

## 7. Recomendação para o piloto do Novelo

### Combinação A — piloto com a viatura real da Vitrus (recomendada)

Telemóvel/tablet **Android** com Chrome a correr a PWA do Novelo + **Zebra ZQ511** (Bluetooth Classic + BLE, ZPL, cradle 12–24 V) + **KERN IXC 10K-3M** com interface Bluetooth e bateria YKR-01.

- Impressão: Web Bluetooth → serviço BLE Parser da Zebra → etiqueta ZPL 58×40 mm com QR (UUID + URL do passaporte). Etiqueta pequena = payload leve = BLE confortável.
- Pesagem: Web Bluetooth → KCP/KERN ou (plano B de integração) balança HID que escreve o peso no campo. Confirmar com a KERN a característica BLE antes da compra (§1.1).
- Custo por viatura (estimativa, s/IVA): ZQ511 €600–775 + IXC 10K-3M €550–680 + bateria YKR-01 e cradle/adaptador de viatura a orçar ⇒ **~€1 300–1 600 s/IVA por viatura (estimativa)**. Consumíveis (rolos térmicos 58–80 mm) a orçar com o fornecedor local de etiquetas.

Porquê a Zebra como primeira opção: BLE documentado pelo fabricante com UUIDs públicos, ZPL é o padrão da indústria (a etiqueta é portável para Honeywell/outras), NFC tap-to-pair, rede de assistência em Portugal e acessórios de viatura de fábrica. A Alpha-40L fica ~€100–200 mais barata e é uma segunda fonte válida se a integração TSPL/Web Bluetooth for validada em prova de conceito.

### Combinação B — demonstração do fluxo (hackathon/testes, sem robustez)

Android + **Munbyn RW402B** (~$160) via biblioteca BLE genérica da comunidade (bluetooth_print_plus em prova de conceito Flutter, ou implementação ESC/POS BLE própria na PWA) + balança BLE de bancada barata ou leitura manual do peso.

- Custo (estimativa): **~€200–350**. Serve para provar o fluxo pesar → etiqueta QR → lote offline → sincronização; não serve para chuva, pó e quedas do trabalho real.

### Riscos e próximas validações

1. **Confirmar por escrito com a KERN** a característica/UUID do BLE da IoT-Line (a ficha não publica o GATT) — ou escolher a balança HID, que integra sem Web Bluetooth.
2. **Provar o Web Bluetooth no Android alvo** com uma ZQ511 de demonstração (revendedor ZE in Portugal empresta habitualmente para PoC — a pedir).
3. **MTU/velocidade BLE:** manter a etiqueta < 1 KB; se um dia a etiqueta crescer (fotografia, logótipo grande), mudar para Bluetooth Classic (app nativa) ou Wi-Fi direto.
4. **iOS ficou de fora por desenho** (Web Bluetooth e Background Sync não existem no Safari). Se a Vitrus quiser iOS na viatura, o custo é uma app nativa — não compensa.

## Fontes

Todas consultadas a 13 de novembro de 2026.

**Impressoras**
- Zebra ZQ511/ZQ521 — ficha de especificações: https://www.zebra.com/us/en/products/spec-sheets/printers/mobile/zq511-zq521.html
- Zebra AppNote BLE (Parser Service, UUIDs, benchmarks): https://www.zebra.com/content/dam/support-dam/en/documentation/unrestricted/application-notes/AppNote-BlueToothLE-v4.pdf
- Zebra Browser Print: https://developer.zebra.com/products/printers/browser-print · Zebra Print (Android): https://play.google.com/store/apps/details?id=com.zebra.channelaps
- zebra_ble_printer (padrão BLE sem SDK, com tabela de UUIDs): https://pub.dev/packages/zebra_ble_printer
- Honeywell RP4f (specs oficiais + documentos): https://automation.honeywell.com/us/en/products/productivity-solutions/printers/mobile-printers/rp4f-mobile-thermal-printers · SDKs: https://sps-support.honeywell.com/s/article/Honeywell-Android-Printing-SDKs · preços: https://www.barcodefactory.com/honeywell/printers/rp4f/rp4f00n0b12 · https://www.cdw.com/product/honeywell-rp4f-direct-thermal-mobile-printer/7384439
- Brother RJ-3250WB-L ($933) e RJ-3230B-L ($880): https://www.brother-usa.com/p/thermal-printers-labelers/RJ3250WBL · https://www.brother-usa.com/p/thermal-printers-labelers/RJ3230BL · RJ-3150 (rendimento 5 300 etiquetas): https://support.brother.com/g/b/spec.aspx?c=us&lang=en&prod=rj3150eus
- TSC Alpha-40L: https://usca.tscprinters.com/en/products/alpha-series-4-inch-performance-mobile-rfid-printer · datasheet: https://image.makewebcdn.com/makeweb/0/jxlPpOYv8/Document/TSC_Alpha_30L_40L_Datasheet.pdf · bateria 6 200 mAh: https://www.atlasrfidstore.com/tsc-alpha-40l-mobile-label-receipt-printer/ · preços: https://www.auto-id247.com/en/tsc-alpha-40l-label-printer-direct-thermal-roll-11.2-cm/A40L-A001-0012 · https://scanshop.ee/en/collections/tsc-alpha-40l · https://www.jarltech.com/en/tsc-alpha-40l · https://scanprinter.eu/products/tsc-alpha-40l-mobile-printer-a40lr-a001-0002
- Munbyn (preços, FAQ): https://munbyn.com/ · https://munbyn.com/pages/faqs-of-mini-printer-for-small-business · NIIMBOT: https://www.niimbot.com/us/downloadcenter · DYMO LetraTag 200B: https://www.dymo.com/label-makers-printers/letratag-label-makers/dymo-letratag-200b-bluetooth-label-maker/SP_2607111.html

**Balanças**
- KERN IXC 10K-3M (loja oficial, €680, interfaces, bateria YKR-01, IP): https://www.kern-sohn.com/shop/en/products/industrial-scales/platform-scales/tixc-15k-3m-a/ · KERN IoT-Line: https://lp.kern-sohn.com/iot-line/en · revendedor (€550,80): https://esd.equipment/en/kern-ixc-10k-3m-iot-line-platform-scale-en.html · IXC 100K-3 (150 kg): https://esd.equipment/en/kern-ixc-100k-3-iot-line-platform-scale-en.html
- Adam Equipment CBK (RS-232/USB, bateria): https://adamequipment.com/media/docs/data_sheets/CBK-DS-A4-EN.pdf · https://www.hogentogler.com/adam-equipment/cbk-16ah-usb-check-weighing-scale.asp
- WSI BLE (0x181D/0x2A9D, 0xFFF1, HID): https://wsi-scales.com/ble-weighing-scales.html
- Bluetooth SIG Weight Scale Service 1.0.1: https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/WSS_v1.0.1/out/en/index-en.html
- A&D Medical UC-356BLE (BLE médico, contexto): https://www.walmart.com/ip/PREMIUM-Wireless-Wide-Base-Weight-Scale-550-lbs-capacity-UC-356BLE/1501587274

**Preços Zebra (UE)**
- https://www.logiscenter.eu/zebra-zq511-ticket-printer · https://www.posdata.eu/product/2177/zebra-zq511-printer-203dpi-3400-mah-battery-usb-bt.html · https://www.bechtle.com/de-en/shop/product-family/zebra-zq511-mobile-label-printer--3601--f · https://megakassen.de/en/Mobiler-Etikettendrucker-Zebra-ZQ511-thermodirekt-203dpi-Druckbreite-72mm-Bluetooth-WLAN-RFID-Schreiber-ZQ51-BUW030E-00 · https://www.itgstore.eu/zebra-zq511-mobile-label-printer-bluetooth-wi-fi-linerless-p-ZQ51-BUW100E-00-22976

**Integração web e offline**
- Web Bluetooth API (MDN, disponibilidade e segurança): https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API · compatibilidade: https://caniuse.com/mdn-api_bluetooth
- Web Bluetooth em Chrome (visão geral Google): https://developer.chrome.com/docs/capabilities/bluetooth
- Background Synchronization API (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API
