/**
 * PROTOTIPO (wayfinder #51) — Variante C «Duas portas».
 * Estrutura: portões grandes e poucos — avisar sacos prontos (herói), ver as nossas
 * rondas, partilhar o certificado. Tudo o resto fica a um toque de distância, em folhas
 * inferiores. Para quem abre a app duas vezes por mês.
 * Afirmação primária: a ação de avisar; a leitura é secundária e profunda.
 * Throwaway.
 */

import { Bell, CalendarDays, Share2, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { formatKg } from '@/lib/format';
import { type PeriodKey, SITE, totalsFor, type Visit, visitsInPeriod } from './data';
import {
  AvisoForm,
  CertificatePreview,
  DestinationBar,
  PassportLink,
  PeriodChips,
  StateBadge,
} from './parts';

export function VariantC() {
  const [open, setOpen] = useState<'aviso' | 'rondas' | 'cert' | 'acesso' | null>(null);

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-28">
      <header className="space-y-1 pt-2">
        <p className="text-muted-foreground text-xs tracking-wider uppercase">Conta de local</p>
        <h1 className="font-serif text-3xl leading-tight text-balance">
          Bom dia, {SITE.shortName}
        </h1>
        <p className="text-muted-foreground text-sm">A viatura de têxtil passa {SITE.nextRound}.</p>
      </header>

      {/* Porta 1 — o herói */}
      <Sheet open={open === 'aviso'} onOpenChange={(v) => setOpen(v ? 'aviso' : null)}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex min-h-28 w-full flex-col items-start justify-between gap-3 rounded-2xl bg-primary p-5 text-left text-primary-foreground ring-4 ring-primary/20 transition-transform active:scale-[0.99] sm:flex-row sm:items-center"
          >
            <span className="space-y-1">
              <span className="block text-xl font-semibold">Tem sacos prontos?</span>
              <span className="block text-sm opacity-85">
                Diga quantos — a viatura recolhe na ronda de terça
              </span>
            </span>
            <Bell className="size-8 shrink-0 opacity-90" aria-hidden />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="px-4 pb-8">
          <SheetHeader className="text-left">
            <SheetTitle>Avisar sacos prontos</SheetTitle>
            <SheetDescription>
              A única ação da escola. A viatura de têxtil recolhe na ronda de {SITE.nextRound}.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <AvisoForm />
          </div>
        </SheetContent>
      </Sheet>

      {/* Porta 2 — leitura */}
      <Sheet open={open === 'rondas'} onOpenChange={(v) => setOpen(v ? 'rondas' : null)}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex min-h-24 w-full items-center justify-between gap-3 rounded-2xl bg-card p-5 text-left ring-1 ring-foreground/10 transition-transform active:scale-[0.99]"
          >
            <span className="flex items-center gap-4">
              <CalendarDays className="text-muted-foreground size-7 shrink-0" aria-hidden />
              <span className="space-y-0.5">
                <span className="block text-lg font-semibold">As nossas rondas</span>
                <span className="text-muted-foreground block text-sm">
                  84,1 kg em 5 rondas · 44,7 kg para reutilização
                </span>
              </span>
            </span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto px-4 pb-8">
          <SheetHeader className="text-left">
            <SheetTitle>As nossas rondas</SheetTitle>
            <SheetDescription>
              Cada ronda pesa os sacos à porta; a triagem mede os destinos a jusante.
            </SheetDescription>
          </SheetHeader>
          <RondasSheet />
        </SheetContent>
      </Sheet>

      {/* Porta 3 — certificado */}
      <Sheet open={open === 'cert'} onOpenChange={(v) => setOpen(v ? 'cert' : null)}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex min-h-20 w-full items-center justify-between gap-3 rounded-2xl bg-card p-5 text-left ring-1 ring-foreground/10 transition-transform active:scale-[0.99]"
          >
            <span className="flex items-center gap-4">
              <Share2 className="text-muted-foreground size-6 shrink-0" aria-hidden />
              <span className="space-y-0.5">
                <span className="block font-semibold">Certificado público</span>
                <span className="text-muted-foreground block text-sm">
                  Partilhar os kg da escola com a comunidade
                </span>
              </span>
            </span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto px-4 pb-8">
          <SheetHeader className="text-left">
            <SheetTitle>Certificado público</SheetTitle>
            <SheetDescription>
              Opt-in: só é público se a escola decidir partilhar. Sem doadores, sem estimativas.
            </SheetDescription>
          </SheetHeader>
          <CertSheet />
        </SheetContent>
      </Sheet>

      <button
        type="button"
        onClick={() => setOpen('acesso')}
        className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm hover:text-foreground"
      >
        <Users className="size-4" aria-hidden />
        Quem tem acesso a esta conta
      </button>

      <Sheet open={open === 'acesso'} onOpenChange={(v) => setOpen(v ? 'acesso' : null)}>
        <SheetContent side="bottom" className="px-4 pb-8">
          <SheetHeader className="text-left">
            <SheetTitle>Quem tem acesso</SheetTitle>
            <SheetDescription>
              A conta pertence à escola; a equipa Novelo convida e revoga pessoas.
            </SheetDescription>
          </SheetHeader>
          <ul className="mt-4 space-y-2 text-sm">
            {SITE.people.map((p) => (
              <li key={p.email} className="rounded-lg bg-muted/40 px-4 py-3">
                {p.name} · {p.role}
                <span className="text-muted-foreground block text-xs">{p.email}</span>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RondasSheet() {
  const [period, setPeriod] = useState<PeriodKey>('letivo');
  const visits = visitsInPeriod(period);
  const totals = totalsFor(visits);
  return (
    <div className="mt-4 space-y-4">
      <PeriodChips value={period} onChange={setPeriod} />
      <div className="rounded-xl bg-muted/40 p-4">
        <p className="text-2xl font-semibold tabular-nums">{formatKg(totals.kgTotal)}</p>
        <p className="text-muted-foreground text-sm">
          em {totals.visitas} {totals.visitas === 1 ? 'ronda' : 'rondas'}
          {totals.kgEmTriagem > 0 && ` · ${formatKg(totals.kgEmTriagem)} ainda em triagem`}
        </p>
        {totals.split && <DestinationBar split={totals.split} className="mt-3" />}
      </div>
      <ul className="space-y-3">
        {visits.map((v) => (
          <VisitCard key={v.id} visit={v} />
        ))}
      </ul>
    </div>
  );
}

function VisitCard({ visit }: { visit: Visit }) {
  const emTriagem = visit.destinos === null;
  return (
    <li className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">
          {visit.dateLabel}
          <span className="text-muted-foreground ml-2 text-xs">{visit.weekday}</span>
        </p>
        <p className="font-semibold tabular-nums">{formatKg(visit.weightKg)}</p>
      </div>
      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
        <span>
          {visit.sacos} {visit.sacos === 1 ? 'saco' : 'sacos'}
        </span>
        <StateBadge emTriagem={emTriagem} />
        {visit.viaAviso && (
          <span className="rounded-full bg-areia/60 px-2 py-0.5 text-xs">via aviso</span>
        )}
      </div>
      <div className="mt-2">{visit.destinos && <DestinationBar split={visit.destinos} />}</div>
      <div className="mt-2">
        <PassportLink code={visit.lotCode} />
      </div>
    </li>
  );
}

function CertSheet() {
  const [on, setOn] = useState(false);
  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-start justify-between gap-3 rounded-xl bg-muted/40 p-4">
        <span className="text-sm font-medium">
          Publicar o certificado da escola
          <span className="text-muted-foreground mt-0.5 block text-xs font-normal">
            {on ? SITE.certUrl : 'Desligado — nada é público'}
          </span>
        </span>
        <Switch checked={on} onCheckedChange={setOn} aria-label="Publicar certificado" />
      </div>
      {on ? (
        <>
          <CertificatePreview />
          <Button
            variant="outline"
            className="min-h-11 w-full"
            onClick={() => toast('Link copiado (demonstração)')}
          >
            Copiar link para partilhar
          </Button>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          Ao ligar, aparece uma página pública com os kg medidos por destino no ano letivo.
          Pré-visualize antes de partilhar.
        </p>
      )}
    </div>
  );
}
