import { cn } from '@/lib/cn';

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'accent';
}

export function KpiCard({ label, value, hint, tone = 'default' }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-linha bg-white/60 p-5">
      <p className="font-semibold text-floresta text-xs uppercase tracking-[0.22em]">{label}</p>
      <p
        className={cn(
          'mt-2 font-medium font-titulo text-4xl tabular-nums',
          tone === 'accent' && 'text-floresta',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-pedra text-sm">{hint}</p>}
    </div>
  );
}
