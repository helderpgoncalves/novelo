/** ADAPTADOR Web Bluetooth — o único ficheiro que conhece `navigator.bluetooth`.
 *
 * Só Android + Chrome têm Web Bluetooth (ver `docs/engenharia/features.md` §12 e o branch
 * `research/hardware-viatura`); é importado a pedido (`openDevice('bluetooth')`), nunca no arranque do ecrã.
 *
 * Hardware alvo (estimativa, a provar à mão no Android da viatura):
 *  - Balança: KERN IXC (IoT-Line, KCP em ASCII por notificação GATT) ou balança com o perfil padrão
 *    Weight Scale (serviço 0x181D, característica 0x2A9D).
 *  - Impressora: Zebra ZQ511 pelo BLE Parser Service (escrita de ZPL em blocos; o QR é nativo do ZPL).
 *
 * A porta (`port.ts`) é que o ecrã conhece; este ficheiro trata de GATT, MTU e timeouts.
 */
import type { LabelJob, VehicleDevice } from './port';

// ---- Tipos mínimos do Web Bluetooth (a lib padrão do TypeScript não os inclui) --------------------

interface BluetoothCharacteristic {
  readonly uuid: string;
  readonly value: DataView | null;
  startNotifications(): Promise<BluetoothCharacteristic>;
  stopNotifications(): Promise<BluetoothCharacteristic>;
  writeValue(data: BufferSource): Promise<void>;
  addEventListener(
    type: 'characteristicvaluechanged',
    listener: (event: Event) => void,
    options?: AddEventListenerOptions,
  ): void;
}

interface BluetoothService {
  readonly uuid: string;
  getCharacteristic(uuid: number | string): Promise<BluetoothCharacteristic>;
  getCharacteristics(): Promise<BluetoothCharacteristic[]>;
}

interface BluetoothServer {
  connected: boolean;
  connect(): Promise<BluetoothServer>;
  disconnect(): void;
  getPrimaryService(uuid: number | string): Promise<BluetoothService>;
}

interface BluetoothDeviceLike {
  readonly name: string | null;
  readonly gatt?: BluetoothServer;
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void;
}

interface NavigatorWithBluetooth {
  bluetooth?: {
    requestDevice(options: {
      filters?: Array<{ services?: Array<number | string>; namePrefix?: string }>;
      optionalServices?: Array<number | string>;
      acceptAllDevices?: boolean;
    }): Promise<BluetoothDeviceLike>;
  };
}

// ---- UUIDs (branch `research/hardware-viatura`, Zebra AppNote BLE + perfil Bluetooth SIG) ----------

const ZEBRA_PARSER_SERVICE = '38eb4a80-c570-11e3-9507-0002a5d5c51b';
const ZEBRA_WRITE_CHARACTERISTIC = '38eb4a82-c570-11e3-9507-0002a5d5c51b';
const WEIGHT_SCALE_SERVICE = 0x181d;
const WEIGHT_SCALE_MEASUREMENT = 0x2a9d;
const KERN_SERVICE_PREFIX = '0000fff';

/** Escrita em blocos: o BLE Parser Service pede payloads leves (a AppNote da Zebra manda etiquetas pequenas). */
const WRITE_CHUNK_BYTES = 512;
const READING_TIMEOUT_MS = 4_000;

/** Leitura estável da balança: o último valor notificado (a KERN manda a leitura por ASCII KCP ou perfil SIG). */
function parseGramsFromText(text: string): number | null {
  // KCP/KERN: «K+   12.345 kg»; também aceita «g» e vírgula decimal.
  const match = /(-?\d+(?:[.,]\d+)?)\s*(kg|g)\b/i.exec(text);
  if (!match) return null;
  const value = Number.parseFloat((match[1] ?? '').replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  const grams = /kg/i.test(match[2] ?? '') ? Math.round(value * 1000) : Math.round(value);
  return Math.abs(grams);
}

/** Perfil Weight Scale (0x2A9D): flags u8, expoente SI s8, valor u16 little-endian (kg). */
function parseGramsFromWeightScale(view: DataView): number | null {
  if (view.byteLength < 4) return null;
  const flags = view.getUint8(0);
  const exponent = view.getInt8(1);
  const raw = view.getUint16(2, true);
  const kilograms = raw * 10 ** exponent;
  const grams = Math.round(kilograms * 1000);
  // bit 0: imperial (lb) — não compramos balança imperial; recusa em vez de errar.
  return flags & 0x01 ? null : Math.abs(grams);
}

const waitEvent = <T>(promise: Promise<T>, ms: number, fallback: () => T): Promise<T> =>
  Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback()), ms))]);

export async function createBluetoothDevice(): Promise<VehicleDevice> {
  const bluetooth = (navigator as NavigatorWithBluetooth).bluetooth;
  if (!bluetooth)
    throw new Error('Web Bluetooth indisponível neste browser (exige Android + Chrome)');
  // acceptAllDevices: a viatura liga-se ao que está à mão (balança e impressora pedem-se em toques separados).
  const device = await bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [ZEBRA_PARSER_SERVICE, WEIGHT_SCALE_SERVICE, `${KERN_SERVICE_PREFIX}01`],
  });
  device.addEventListener('gattserverdisconnected', () => undefined);

  let server: BluetoothServer | null = null;
  const ensureServer = async (): Promise<BluetoothServer> => {
    if (server?.connected) return server;
    if (!device.gatt) throw new Error('Dispositivo sem GATT');
    server = await device.gatt.connect();
    return server;
  };

  const readOnceFromScale = async (): Promise<number | null> => {
    const gatt = await ensureServer();
    // Primeiro o perfil padrão; senão, qualquer serviço da KERN com notificação ASCII.
    let characteristic: BluetoothCharacteristic | null = null;
    let parse: (value: DataView) => number | null = parseGramsFromWeightScale;
    try {
      const service = await gatt.getPrimaryService(WEIGHT_SCALE_SERVICE);
      characteristic = await service.getCharacteristic(WEIGHT_SCALE_MEASUREMENT);
    } catch {
      try {
        const service = await gatt.getPrimaryService(`${KERN_SERVICE_PREFIX}01`);
        const candidates = await service.getCharacteristics();
        characteristic = candidates[0] ?? null;
        parse = (value: DataView) => parseGramsFromText(new TextDecoder().decode(value));
      } catch {
        return null; // sem balança ao alcance: a porta devolve `null`, o ecrã pede leitura manual
      }
    }
    if (!characteristic) return null;
    let latest: number | null = characteristic.value ? parse(characteristic.value) : null;
    characteristic.addEventListener('characteristicvaluechanged', (event: Event) => {
      const target = event.target as unknown as BluetoothCharacteristic;
      const view = target.value;
      if (view) latest = parse(view);
    });
    await characteristic.startNotifications();
    // Espera curta pela notificação (a balança manda a leitura a cada instante).
    await waitEvent(
      new Promise((resolve) => setTimeout(resolve, READING_TIMEOUT_MS)),
      READING_TIMEOUT_MS,
      () => undefined,
    );
    await characteristic.stopNotifications().catch(() => undefined);
    return latest;
  };

  return {
    fingerprint: `${device.name ?? 'Bluetooth'} (BLE)`,

    async weigh() {
      try {
        return await readOnceFromScale();
      } catch {
        return null;
      }
    },

    async printLabel({ zpl }: LabelJob) {
      try {
        const gatt = await ensureServer();
        const service = await gatt.getPrimaryService(ZEBRA_PARSER_SERVICE);
        const write = await service.getCharacteristic(ZEBRA_WRITE_CHARACTERISTIC);
        const bytes = new TextEncoder().encode(zpl);
        for (let offset = 0; offset < bytes.length; offset += WRITE_CHUNK_BYTES) {
          await write.writeValue(bytes.slice(offset, offset + WRITE_CHUNK_BYTES));
        }
        return true;
      } catch {
        return false;
      }
    },

    async release() {
      server?.disconnect();
      server = null;
    },
  };
}
