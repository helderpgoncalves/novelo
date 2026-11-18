/** A porta do dispositivo da viatura: balança + impressora, o padrão da porta `RoadRouter` da API.
 *
 * Como lá, o ecrã e os testes dependem só desta interface; o Web Bluetooth vive SÓ no adaptador
 * (`bluetooth-device.ts`, importado a pedido, Android + Chrome). Quando o dispositivo não responde:
 * `fingerprint` a `null`, `weigh()` a `null`, `printLabel()` a `false` — o ecrã nunca adivinha hardware.
 */

/** O que a impressora recebe: ZPL com o QR nativo (`^BQN`) e o código legível por humanos. */
export interface LabelJob {
  /** O que vai no QR: o QR do saco lido, ou o UUID da etiqueta (imprime-se e reconcilia-se pelo código). */
  code: string;
  /** Linha humana na etiqueta (o local da paragem). */
  caption: string;
  zpl: string;
}

export interface VehicleDevice {
  /** Identifica o dispositivo ligado; `null` quando não há dispositivo. */
  readonly fingerprint: string | null;
  /** Leitura atual da balança em gramas; `null` quando a balança não está disponível (ou prato vazio/instável). */
  weigh(): Promise<number | null>;
  /** Imprime a etiqueta (ZPL com QR nativo); `false` quando a impressora não está disponível. */
  printLabel(label: LabelJob): Promise<boolean>;
  /** Desliga com limpeza (GATT, o que houver). */
  release(): Promise<void>;
}

const ZPL_ESCAPES: Record<string, string> = { '\\': '\\\\', '^': '\\^', '~': '\\~' };

const escapeZpl = (text: string): string => text.replace(/[\\^~]/g, (ch) => ZPL_ESCAPES[ch] ?? ch);

/** Etiqueta 58×40 mm na térmica da viatura (Zebra ZQ511, BLE Parser Service): QR com o código + texto humano.
 *
 * O QR é nativo do ZPL (`^BQN`) — não se renderiza imagem nenhuma, payload leve para o BLE. No QR vai o código
 * nu (o UUID da etiqueta, ou o QR do saco), como no SVG do servidor, para reconciliar offline.
 */
export function labelZpl(code: string, caption: string): string {
  return [
    '^XA',
    '^PW448^LL312^LH0,0',
    `^FO24,24^BQN,4,6^FDQA,${escapeZpl(code)}^FS`,
    `^FO24,208^A0N,40,40^FD${escapeZpl(caption.toUpperCase())}^FS`,
    `^FO24,256^A0N,32,32^FD${escapeZpl(code.toUpperCase())}^FS`,
    '^XZ',
  ].join('\n');
}

/** Fábrica da porta: o falso é a omissão (dev, testes, browsers sem Web Bluetooth). */
export async function openDevice(
  prefer: 'fake' | 'bluetooth',
  programG?: number[],
): Promise<VehicleDevice> {
  if (prefer === 'bluetooth') {
    // Importado só aqui, a pedido do toque do operador: nenhum outro módulo conhece o Web Bluetooth.
    const { createBluetoothDevice } = await import('./bluetooth-device');
    return createBluetoothDevice();
  }
  const { createFakeDevice } = await import('./fake-device');
  return createFakeDevice(programG);
}
