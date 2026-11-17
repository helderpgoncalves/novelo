/**
 * PROTOTIPO (wayfinder #48) — QR ilustrativo, determinístico a partir do código.
 * Não é um QR válido; serve só para discutir presença e hierarquia do QR.
 */

const N = 21;

function buildPattern(seed: string): boolean[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const cells: boolean[] = [];
  for (let i = 0; i < N * N; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    cells.push(((h >>> 0) % 1000) / 1000 > 0.52);
  }
  return cells;
}

function finderFill(x: number, y: number): 'dark' | 'light' | null {
  const zones = [
    { x0: 0, y0: 0 },
    { x0: N - 7, y0: 0 },
    { x0: 0, y0: N - 7 },
  ];
  for (const z of zones) {
    if (x >= z.x0 && x < z.x0 + 7 && y >= z.y0 && y < z.y0 + 7) {
      const lx = x - z.x0;
      const ly = y - z.y0;
      const ring =
        Math.max(lx, ly) <= 1 ||
        Math.max(6 - lx, 6 - ly) <= 1 ||
        (lx >= 2 && ly >= 2 && lx <= 4 && ly <= 4);
      return ring ? 'dark' : 'light';
    }
  }
  return null;
}

function inFinder(x: number, y: number): boolean {
  return finderFill(x, y) !== null;
}

export function FauxQr({
  seed,
  className,
  label,
}: {
  seed: string;
  className?: string;
  label?: string;
}) {
  const cells = buildPattern(seed);
  let d = '';
  for (let i = 0; i < cells.length; i++) {
    const x = i % N;
    const y = Math.floor(i / N);
    const f = finderFill(x, y);
    const dark = f !== null ? f === 'dark' : cells[i] && !inFinder(x, y);
    if (dark) d += `M${x} ${y}h1v1h-1z`;
  }
  return (
    <figure className={className}>
      <div className="rounded-md bg-white p-2 ring-1 ring-foreground/15">
        <svg
          viewBox={`0 0 ${N} ${N}`}
          role="img"
          aria-label={label ?? 'QR ilustrativo'}
          className="block w-full"
        >
          <path d={d} fill="currentColor" className="text-foreground" />
        </svg>
      </div>
      <figcaption className="mt-1 text-center font-mono text-[10px] text-muted-foreground">
        QR ilustrativo · {seed}
      </figcaption>
    </figure>
  );
}
