import { Check } from 'lucide-react';
import { SYMBOL } from '@/components/brand-geometry.gen';
import { cn } from '@/lib/utils';
import type { ApprovalState } from './steps';
import './approval-mark.css';

// Cores pelos tokens da marca: o fio do meio é a floresta, o de dentro é a floresta esbatida e o de fora a areia.
const ARC_CLASS = ['stroke-primary/40', 'stroke-primary', 'stroke-areia'] as const;

/**
 * O símbolo da marca em movimento lento enquanto o pedido espera. Decorativo (o estado é anunciado por texto);
 * com movimento reduzido fica estático. Aprovado: surge um visto; rejeitado: o símbolo pára e esbate.
 */
export function ApprovalMark({ state, className }: { state: ApprovalState; className?: string }) {
  return (
    <div
      data-state={state}
      data-testid="approval-mark"
      aria-hidden="true"
      className={cn('relative mx-auto grid size-40 place-items-center sm:size-52', className)}
    >
      <div className="approval-halo absolute inset-3 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_16%,transparent),transparent)]" />
      <svg
        viewBox="-420 -420 840 840"
        className="relative size-full"
        focusable="false"
        aria-hidden="true"
      >
        {SYMBOL.arcs.map((d, i) => (
          <path
            key={d}
            d={d}
            pathLength={1}
            fill="none"
            strokeWidth={SYMBOL.strokeWidth}
            strokeLinecap="round"
            className={cn('approval-arc', `approval-arc-${i}`, ARC_CLASS[i])}
          />
        ))}
        <path d={SYMBOL.dot} fillRule="evenodd" className="approval-dot fill-foreground" />
      </svg>
      {state === 'approved' && (
        <span className="fade-in-0 zoom-in-50 absolute inset-0 m-auto grid size-16 animate-in place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-8 ring-primary/15 duration-500 sm:size-20">
          <Check className="size-8 sm:size-10" strokeWidth={2.5} />
        </span>
      )}
    </div>
  );
}
