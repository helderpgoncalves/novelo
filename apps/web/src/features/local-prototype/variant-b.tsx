/**
 * PROTOTIPO (wayfinder #51) — Variante B «Painel do local».
 * Estrutura: painel largo de duas colunas — KPIs e relatório com tabela densa de rondas
 * ao centro, aviso/certificado/acesso na coluna lateral sempre visíveis.
 * Afirmação primária: ler os números; o aviso é um formulário sempre à mão.
 * Throwaway.
 */

import { CalendarDays, Share2, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { formatKg, formatPercent } from '@/lib/format';
import { type PeriodKey, SITE, totalsFor, type Visit, visitsInPeriod } from './data';
import {
  AvisoForm,
  CertificatePreview,
  DestinationBar,
  DestinationLegend,
  PassportLink,
  PeriodChips,
  StateBadge,
} from './parts';

export function VariantB() {
  const [period, setPeriod] = useState<PeriodKey>('letivo');
  const [certOn, setCertOn] = useState(false);
  const visits = visitsInPeriod(period);
  const totals = totalsFor(visits);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-28">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs tracking-wider uppercase">Conta de local</p>
          <h1 className="font-serif text-3xl text-balance">{SITE.displayName}</h1>
          <p className="text-muted-foreground text-sm">{SITE.parish}</p>
        </div>
        <p className="rounded-full border border-primary/40 bg-primary/10 text-primary px-3 py-1 text-sm font-medium">
          Próxima ronda: {SITE.nextRound}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Coluna principal: KPIs + relatório + tabela */}
        <div className="min-w-0 space-y-6">
          <section
            aria-label="Indicadores do período"
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            <Kpi
              label="Total medido"
              value={formatKg(totals.kgTotal)}
              sub={`${totals.sacos} sacos`}
            />
            <Kpi
              label="Para reutilização"
              value={totals.pct ? formatPercent(totals.pct.reutilizacao) : '—'}
              sub={totals.split ? formatKg(totals.split.reutilizacao) : 'sem triagem concluída'}
            />
            <Kpi
              label="Rondas"
              value={String(totals.visitas)}
              sub={
                totals.kgEmTriagem > 0
                  ? `${formatKg(totals.kgEmTriagem)} em triagem`
                  : 'tudo triado'
              }
            />
            <Kpi label="Próxima ronda" value="24 nov" sub="terça-feira" />
          </section>

          <section aria-labelledby="relatorio-b" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="relatorio-b" className="flex items-center gap-2 font-semibold">
                <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
                Relatório por destino
              </h2>
              <PeriodChips value={period} onChange={setPeriod} />
            </div>
            <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
              {totals.split && totals.pct ? (
                <div className="grid gap-5 sm:grid-cols-[1fr_260px]">
                  <div className="space-y-3">
                    <DestinationBar split={totals.split} className="h-3" />
                    <p className="text-muted-foreground text-sm">
                      {formatKg(totals.kgMedido)} já medidos na mesa de triagem
                      {totals.kgEmTriagem > 0 && ` · ${formatKg(totals.kgEmTriagem)} em triagem`}.
                    </p>
                    <table className="w-full text-sm">
                      <caption className="sr-only">Quilogramas por destino no período</caption>
                      <tbody>
                        {(
                          [
                            ['reutilizacao', totals.split.reutilizacao, totals.pct.reutilizacao],
                            ['reciclagem', totals.split.reciclagem, totals.pct.reciclagem],
                            ['rejeito', totals.split.rejeito, totals.pct.rejeito],
                          ] as const
                        ).map(([key, kg, pct]) => (
                          <tr key={key} className="border-b last:border-0">
                            <th scope="row" className="py-2 text-left font-normal">
                              {key === 'reutilizacao'
                                ? 'Reutilização'
                                : key === 'reciclagem'
                                  ? 'Reciclagem'
                                  : 'Rejeito'}
                            </th>
                            <td className="py-2 text-right font-medium tabular-nums">
                              {formatKg(kg)}
                            </td>
                            <td className="py-2 text-right tabular-nums text-muted-foreground">
                              {formatPercent(pct)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <DestinationLegend split={totals.split} pct={totals.pct} />
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Ainda sem triagem concluída neste período — os destinos medem-se a jusante, na
                  mesa de triagem.
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby="rondas-b" className="space-y-3">
            <h2 id="rondas-b" className="font-semibold">
              Rondas e lotes
            </h2>
            <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
              <table className="w-full text-sm">
                <caption className="sr-only">Visitas da viatura de têxtil ao local</caption>
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Data
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Sacos
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      Peso
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Estado
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      Reut.
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      Rec.
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      Rej.
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Lote
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <VisitCells key={v.id} visit={v} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground text-xs">
              Na implementação real, esta tabela usa o componente DataTable do produto (ordenar,
              filtrar, exportar).
            </p>
          </section>
        </div>

        {/* Coluna lateral: ações e definições */}
        <aside className="space-y-5" aria-label="Ações e definições">
          <section
            aria-labelledby="aviso-b"
            className="rounded-xl border border-primary/40 bg-card p-4"
          >
            <h2 id="aviso-b" className="mb-1 font-semibold">
              Avisar sacos prontos
            </h2>
            <p className="text-muted-foreground mb-3 text-sm">
              A viatura recolhe na ronda de {SITE.nextRound}.
            </p>
            <AvisoForm compact />
          </section>

          <section
            aria-labelledby="cert-b"
            className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          >
            <h2 id="cert-b" className="mb-2 flex items-center gap-2 font-semibold">
              <Share2 className="size-4 text-muted-foreground" aria-hidden />
              Certificado público
            </h2>
            <div className="flex items-start justify-between gap-3">
              <span className="text-muted-foreground text-sm">
                Página pública com os kg medidos. Sem doadores.
              </span>
              <Switch
                checked={certOn}
                onCheckedChange={setCertOn}
                aria-label="Partilhar certificado"
              />
            </div>
            {certOn && (
              <div className="mt-3 space-y-3">
                <CertificatePreview className="bg-muted/30" />
                <button
                  type="button"
                  className="text-primary min-h-11 text-sm font-medium hover:underline"
                  onClick={() => toast('Link copiado (demonstração)')}
                >
                  Copiar {SITE.certUrl}
                </button>
              </div>
            )}
          </section>

          <section
            aria-labelledby="acesso-b"
            className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          >
            <h2 id="acesso-b" className="mb-2 flex items-center gap-2 font-semibold">
              <Users className="size-4 text-muted-foreground" aria-hidden />
              Acesso
            </h2>
            <ul className="space-y-1.5 text-sm">
              {SITE.people.map((p) => (
                <li key={p.email} className="flex justify-between gap-2">
                  <span>{p.name}</span>
                  <span className="text-muted-foreground text-xs">{p.role}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-2 text-xs">
              Convites e revogações pela equipa Novelo.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-muted-foreground text-xs tracking-wider uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>
    </div>
  );
}

function VisitCells({ visit }: { visit: Visit }) {
  const d = visit.destinos;
  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-2.5">
        {visit.dateLabel}
        <span className="text-muted-foreground block text-xs">{visit.weekday}</span>
      </td>
      <td className="px-4 py-2.5 tabular-nums">{visit.sacos}</td>
      <td className="px-4 py-2.5 text-right font-medium tabular-nums">
        {formatKg(visit.weightKg)}
      </td>
      <td className="px-4 py-2.5">
        <StateBadge emTriagem={d === null} />
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">{d ? formatKg(d.reutilizacao) : '—'}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{d ? formatKg(d.reciclagem) : '—'}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{d ? formatKg(d.rejeito) : '—'}</td>
      <td className="px-4 py-2.5">
        <PassportLink code={visit.lotCode} />
      </td>
    </tr>
  );
}
