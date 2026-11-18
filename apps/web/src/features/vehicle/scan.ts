/** Câmara para ler o QR do saco: BarcodeDetector (Android + Chrome) sobre um <video>; noutras plataformas o
 * ecrã mostra a leitura manual (teclado ou leitor HID por USB/Bluetooth, o plano B da pesquisa de hardware).
 * Sem dependências novas: a API nativa cobre o alvo real da viatura.
 */

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

interface WindowWithBarcodeDetector {
  BarcodeDetector?: BarcodeDetectorConstructor;
}

const QR_FORMATS = ['qr_code'];

export function barcodeScannerSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

/** Abre a câmara traseira no <video> (tem de estar a reproduzir para o detector ver frames). */
export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

export function stopCamera(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
}

/** Uma leitura do QR à frente da câmara; `null` quando não há código legível neste instante. */
export async function detectOnce(video: HTMLVideoElement): Promise<string | null> {
  const Detector = (window as unknown as WindowWithBarcodeDetector).BarcodeDetector;
  if (!Detector) return null;
  try {
    const detector = new Detector({ formats: QR_FORMATS });
    const codes = await detector.detect(video);
    const first = codes[0]?.rawValue.trim();
    return first ? first : null;
  } catch {
    return null;
  }
}
