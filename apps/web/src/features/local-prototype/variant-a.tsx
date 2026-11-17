/**
 * PROTOTIPO (wayfinder #51) — Variante A «Caderno de rondas».
 * Estrutura: coluna de telemóvel, caderno cronológico (rondas mais recentes primeiro),
 * aviso em cartão destacado no topo, relatório como resumo compacto, certificado no fim.
 * Afirmação primária: avisar a viatura; a leitura é o caderno.
 * Throwaway.
 */
import { useState } from 'react';
import { CalendarDays, Share2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { formatKg } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SITE, totalsFor, visitsInPeriod, type PeriodKey, type Visit } from './data';
import {
  AvisoForm,
  CertificatePreview,
  DestinationBar,
  DestinationLegend,
  PassportLink,
  PeriodChips,
  StateBadge,
} from './parts';

export function VariantA() {
  const [period, setPeriod] = useState<PeriodKey>('letivo');
  const [certOn, setCertOn] = useState(false);
  const visits = visitsInPeriod(period);
  const totals = totalsFor(visits);

  return (
    <div className="mx-auto max-w-md space-y-6 pb-28">
      {/* Cabeçalho do caderno */}
      <header className="space-y-1">
        <p className="text-muted-foreground text-xs tracking-wider uppercase">Conta de local</p>
        <h1 className="font-serif text-3xl leading-tight text-balance">{SITE.displayName}</h1>
        <p className="text-muted-foreground text-sm">
          {SITE.parish} · próxima ronda: {SITE.nextRound}
        </p>
      </header>

      {/* A ação: avisar sacos prontos */}
      <section aria-labelledby="aviso-a" className="rounded-xl border border-primary/40 bg-card p-4">
        <h2 id="aviso-a" className="mb-1 font-semibold">
          Tem sacos prontos?
        </h2>
        <p className="text-muted-foreground mb-3 text-sm">
          A única coisa que a escola faz ativamente. A viatura recolhe na ronda da freguesia.
        </p>
        <AvisoForm compact />
      </section>

      {/* Resumo do período */}
      <section aria-labelledby="relatorio-a" className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
          <h2 id="relatorio-a" className="font-semibold">
            O que já foi medido
          </h2>
        </div>
        <PeriodChips value={period} onChange={setPeriod} />
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-3xl font-semibold tabular-nums">{formatKg(totals.kgTotal)}</p>
          <p className="text-muted-foreground mb-3 text-sm">
            em {totals.visitas} {totals.visitas === 1 ? 'ronda' : 'rondas'} ·{' '}
            {totals.sacos} {totals.sacos === 1 ? 'saco' : 'sacos'} ·{' '}
            {totals.kgEmTriagem > 0 && `${formatKg(totals.kgEmTriagem)} ainda em triagem`}
          </p>
          {totals.split && totals.pct ? (
            <div className="space-y-3">
              <DestinationBar split={totals.split} />
              <DestinationLegend split={totals.split} pct={totals.pct} />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Ainda sem triagem concluída neste período.
            </p>
          )}
        </div>
      </section>

      {/* O caderno: rondas mais recentes primeiro */}
      <section aria-labelledby="rondas-a" className="space-y-3">
        <h2 id="rondas-a" className="font-semibold">
          Caderno de rondas
        </h2>
        <ol className="relative space-y-3 border-l pl-4">
          {visits.map((v) => (
            <VisitRow key={v.id} visit={v} />
          ))}
        </ol>
      </section>

      {/* Certificado público */}
      <section aria-labelledby="cert-a" className="space-y-3">
        <div className="flex items-center gap-2">
          <Share2 className="size-4 text-muted-foreground" aria-hidden />
          <h2 id="cert-a" className="font-semibold">
            Certificado público
          </h2>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-3">
          <label className="flex items-start justify-between gap-3">
            <span className="text-sm">
              Partilhar os nossos kg num página pública
              <span className="text-muted-foreground mt-0.5 block text-xs">
                Sem doadores, só o que foi medido. O link divulga-se a partir da escola.
              </span>
            </span>
            <Switch checked={certOn} onCheckedChange={setCertOn} aria-label="Partilhar certificado" />
          </label>
          {certOn && (
            <div className="space-y-3">
              <CertificatePreview />
              <Button
                variant="outline"
                className="min-h-11 w-full"
                onClick={() => toast('Link copiado (demonstração)')}
              >
                Copiar link público
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Acesso */}
      <section aria-labelledby="acesso-a" className="space-y-2">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" aria-hidden />
          <h2 id="acesso-a" className="font-semibold">
            Quem entra nesta conta
          </h2>
        </div>
        <ul className="text-muted-foreground space-y-1 text-sm">
          {SITE.people.map((p) => (
            <li key={p.email}>
              {p.name} · {p.role} — {p.email}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-xs">
          A equipa Novelo convida e revoga pessoas; a conta pertence à escola.
        </p>
      </section>
    </div>
  );
}

function VisitRow({ visit }: { visit: Visit }) {
  const emTriagem = visit.destinos === null;
  return (
    <li className="relative">
      <span
        className={cn(
          'absolute top-5 -left-[21px] size-2.5 rounded-full ring-4 ring-background',
          emTriagem ? 'bg-muted-foreground/40' : 'bg-primary',
        )}
        aria-hidden
      />
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="font-medium">{visit.dateLabel}</p>
            <p className="text-muted-foreground text-xs">{visit.weekday}</p>
          </div>
          <p className="text-xl font-semibold tabular-nums">{formatKg(visit.weightKg)}</p>
        </div>
        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span>
            {visit.sacos} {visit.sacos === 1 ? 'saco' : 'sacos'}
          </span>
          <span aria-hidden>·</span>
          <StateBadge emTriagem={emTriagem} />
          {visit.viaAviso && (
            <>
              <span aria-hidden>·</span>
              <span className="rounded-full bg-areia/60 px-2 py-0.5 text-xs">
                via aviso · {visit.viaAviso}
              </span>
            </>
          )}
        </div>
        <div className="mt-2">
          {visit.destinos ? (
            <DestinationBar split={visit.destinos} />
          ) : (
            <p className="text-muted-foreground text-xs">
              Destinos por medir na mesa de triagem.
            </p>
          )}
        </div>
        <div className="mt-2">
          <PassportLink code={visit.lotCode} />
        </div>
      </div>
    </li>
  );
}
