/**
 * PROTOTIPO (wayfinder #51) — peças partilhadas pelas variantes.
 * Conteúdo (formulário do aviso, certificado, barras) partilhado de propósito:
 * as variantes divergem na estrutura, não nos dados nem no comportamento.
 * Throwaway.
 */

import { ArrowUpRight, Check, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatKg, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type DestinationSplit, PERIODS, type PeriodKey, SITE } from './data';

/** Cores por destino: a mesma da composição do lote no produto. */
const DESTINO_SHADE = {
  reutilizacao: 'bg-chart-1',
  reciclagem: 'bg-chart-2',
  rejeito: 'bg-muted-foreground/40',
} as const;

export const DESTINO_LABEL = {
  reutilizacao: 'Reutilização',
  reciclagem: 'Reciclagem',
  rejeito: 'Rejeito',
} as const;

export function StateBadge({ emTriagem }: { emTriagem: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase',
        emTriagem
          ? 'border-areia/70 text-muted-foreground'
          : 'border-primary/50 bg-primary/10 text-primary',
      )}
    >
      {emTriagem ? 'Em triagem' : 'Triagem concluída'}
    </span>
  );
}

export function DestinationBar({
  split,
  className,
}: {
  split: DestinationSplit;
  className?: string;
}) {
  const total = split.reutilizacao + split.reciclagem + split.rejeito;
  const seg = (kg: number) => `${(kg / total) * 100}%`;
  return (
    <div className={cn('flex h-2.5 w-full gap-px overflow-hidden rounded-full', className)}>
      <div className={DESTINO_SHADE.reutilizacao} style={{ width: seg(split.reutilizacao) }} />
      <div className={DESTINO_SHADE.reciclagem} style={{ width: seg(split.reciclagem) }} />
      <div className={DESTINO_SHADE.rejeito} style={{ width: seg(split.rejeito) }} />
    </div>
  );
}

export function DestinationLegend({
  split,
  pct,
}: {
  split: DestinationSplit;
  pct?: DestinationSplit | null;
}) {
  const rows: { key: keyof DestinationSplit; kg: number }[] = [
    { key: 'reutilizacao', kg: split.reutilizacao },
    { key: 'reciclagem', kg: split.reciclagem },
    { key: 'rejeito', kg: split.rejeito },
  ];
  return (
    <dl className="space-y-1.5 text-sm">
      {rows.map((row) => (
        <div key={row.key} className="flex items-baseline justify-between gap-3">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <span className={cn('size-2 rounded-full', DESTINO_SHADE[row.key])} aria-hidden />
            {DESTINO_LABEL[row.key]}
            {pct && <span className="text-xs">({formatPercent(pct[row.key])})</span>}
          </dt>
          <dd className="font-medium tabular-nums">{formatKg(row.kg)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PeriodChips({
  value,
  onChange,
}: {
  value: PeriodKey;
  onChange: (p: PeriodKey) => void;
}) {
  return (
    <div role="tablist" aria-label="Período" className="flex flex-wrap gap-1.5">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          role="tab"
          aria-selected={p.key === value}
          onClick={() => onChange(p.key)}
          className={cn(
            'min-h-9 rounded-full border px-3.5 text-sm font-medium transition-colors',
            p.key === value
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border text-muted-foreground hover:text-foreground',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/** O aviso «sacos prontos»: a única ação de escrita da conta de local. Estado em memória. */
export function AvisoForm({ compact = false }: { compact?: boolean }) {
  const [sacos, setSacos] = useState(2);
  const [nota, setNota] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/10 p-4">
        <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="font-medium">
            Aviso enviado: {sacos} {sacos === 1 ? 'saco pronto' : 'sacos prontos'}
          </p>
          <p className="text-muted-foreground text-sm">
            A viatura de têxtil recolhe na ronda de {SITE.nextRound}.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-2 text-muted-foreground"
            onClick={() => {
              setSent(false);
              setNota('');
              toast('Aviso anulado (demonstração)');
            }}
          >
            Anular aviso
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className={cn('space-y-3', compact && 'space-y-2.5')}
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Sacos prontos</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            aria-label="Menos um saco"
            disabled={sacos <= 1}
            onClick={() => setSacos((n) => Math.max(1, n - 1))}
          >
            <Minus className="size-4" aria-hidden />
          </Button>
          <Input
            readOnly
            value={sacos}
            aria-label="Número de sacos"
            className="h-10 w-14 text-center font-semibold tabular-nums"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            aria-label="Mais um saco"
            disabled={sacos >= 12}
            onClick={() => setSacos((n) => Math.min(12, n + 1))}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
      <Textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        maxLength={80}
        rows={compact ? 2 : 2}
        placeholder="Nota para a equipa (opcional) — ex.: sala 12, porta dos fundos"
        className="min-h-11 text-base"
      />
      <Button type="submit" className="min-h-11 w-full">
        Avisar a viatura
      </Button>
    </form>
  );
}

/** Pré-visualização do certificado público (a página que quem recebe o link vê). */
export function CertificatePreview({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4 rounded-xl border p-5', className)}>
      <div>
        <p className="text-muted-foreground text-xs tracking-wider uppercase">
          Certificado de recolha · rede Novelo
        </p>
        <p className="mt-1 font-serif text-2xl text-balance">{SITE.displayName}</p>
        <p className="text-muted-foreground text-sm">{SITE.parish}</p>
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs tracking-wider uppercase">Ano letivo 2026/27</p>
        <p className="text-3xl font-semibold tabular-nums">84,1 kg</p>
        <p className="text-muted-foreground text-sm">
          de têxtil recolhido e pesado à porta, em 5 rondas
        </p>
      </div>
      <div className="space-y-2">
        <DestinationBar split={{ reutilizacao: 44.7, reciclagem: 12.6, rejeito: 4.7 }} />
        <DestinationLegend
          split={{ reutilizacao: 44.7, reciclagem: 12.6, rejeito: 4.7 }}
          pct={{ reutilizacao: 72.1, reciclagem: 20.3, rejeito: 7.6 }}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        Valores medidos na pesagem de cada lote. Sem dados de doadores. Operação da Vitrus ·
        Guimarães.
      </p>
    </div>
  );
}

/** O passaporte do lote é público; no protótipo apenas sinalizamos para onde iria. */
export function PassportLink({ code }: { code: string }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-1 text-primary text-sm font-medium hover:underline"
      onClick={() => toast(`No produto: abre o passaporte público do lote ${code}`)}
    >
      Passaporte {code}
      <ArrowUpRight className="size-4" aria-hidden />
    </button>
  );
}
