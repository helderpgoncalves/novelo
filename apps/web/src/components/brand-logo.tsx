import { cn } from '@/lib/utils';

type Tone = 'color' | 'negative' | 'mono';

const PALETTE: Record<Tone, [string, string, string, string, string]> = {
  color: ['#A9C2B7', '#2E6B57', '#C4A06A', '#14211D', '#F4F1EA'],
  negative: ['#3E6658', '#7FB39C', '#C4A06A', '#F4F1EA', '#14211D'],
  mono: ['currentColor', 'currentColor', 'currentColor', 'currentColor', 'transparent'],
};

/** Símbolo do Novelo: três fios quase fechados à volta do ponto de recolha. */
export function BrandSymbol({ tone = 'color', className }: { tone?: Tone; className?: string }) {
  const [inner, mid, outer, dot, hole] = PALETTE[tone];
  return (
    <svg
      viewBox="-512 -512 1024 1024"
      className={cn('size-8 shrink-0', className)}
      aria-hidden="true"
      role="img"
    >
      <title>Novelo</title>
      <path
        d="M134.99 -160.87A210 210 0 1 1 -117.43 -174.10"
        fill="none"
        stroke={inner}
        strokeWidth="56"
        strokeLinecap="round"
      />
      <path
        d="M192.84 -229.81A300 300 0 1 1 -167.76 -248.71"
        fill="none"
        stroke={mid}
        strokeWidth="56"
        strokeLinecap="round"
      />
      <path
        d="M250.69 -298.76A390 390 0 1 1 -218.09 -323.32"
        fill="none"
        stroke={outer}
        strokeWidth="56"
        strokeLinecap="round"
      />
      <circle r="92" fill={dot} />
      <circle r="38" fill={hole} />
    </svg>
  );
}

export function BrandLogo({ tone = 'color', className }: { tone?: Tone; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandSymbol tone={tone} className="size-8" />
      <span className="font-medium font-serif text-[1.65rem] leading-none tracking-[-0.02em]">
        Novelo
      </span>
    </span>
  );
}
