/**
 * PROTOTIPO (wayfinder #48) — Variante C «Rede primeiro».
 * A porta pública é o herói («onde e quando entrego», números da rede) e a
 * conta é uma camada: uma folha inferior com tudo o que é pessoal, compacto.
 * Testa: a área do cidadão é um destino ou uma camada do serviço público?
 * Throwaway.
 */

import { Check, Mail, QrCode } from 'lucide-react';
import { useState } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { WeekdayDots } from '@/components/weekdays';
import { formatKg, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FauxQr } from './faux-qr';
import {
  BONUS_CONFORMIDADE,
  type CitizenState,
  DEFAULT_AGENDA,
  type Declaration,
  eurAvoidedLabel,
  initialCitizen,
  nextBagCode,
  PARISH_AGENDA,
  POINTS_PER_BAG,
  pointsBonus,
  pointsFlat,
  sampleWeight,
} from './journey';

export function VariantC() {
  const [citizen, setCitizen] = useState<CitizenState>(initialCitizen);
  const [emailDraft, setEmailDraft] = useState('');
  const [aliasDraft, setAliasDraft] = useState('');
  const [declaration, setDeclaration] = useState<Declaration | null>(null);
  const [scanning, setScanning] = useState(false);
  const [parish, setParish] = useState(PARISH_AGENDA[0]?.parish ?? 'Azurém');
  const agenda = PARISH_AGENDA.find((p) => p.parish === parish) ?? DEFAULT_AGENDA;
  const totalPoints = pointsFlat(citizen.bags) + pointsBonus(citizen.bags);
  const totalKg = citizen.bags.reduce((a, b) => a + (b.weightKg ?? 0), 0);

  const advance = (code: string) =>
    setCitizen((c) => ({
      ...c,
      bags: c.bags.map((b) => {
        if (b.code !== code) return b;
        if (b.status === 'ativo') return { ...b, status: 'recolhido' };
        if (b.status === 'recolhido') return { ...b, status: 'pesado', weightKg: sampleWeight() };
        return { ...b, status: 'triado' };
      }),
    }));

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5">
        <BrandLogo className="h-7" />
        <Sheet>
          <SheetTrigger asChild>
            <Button size="sm" variant="outline">
              A minha conta
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="mx-auto max-h-[85dvh] max-w-3xl overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          >
            <SheetHeader>
              <SheetTitle>A minha conta</SheetTitle>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-6">
              {citizen.stage === 'visitante' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Para pontos, histórico e recolha a pedido (mais tarde). A rede recolhe o saco na
                    mesma, com ou sem conta — sem conta não há crédito.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="email"
                      inputMode="email"
                      placeholder="oteuemail@exemplo.pt"
                      value={emailDraft}
                      onChange={(e) => setEmailDraft(e.target.value)}
                      aria-label="Email"
                      className="text-base"
                    />
                    <Button
                      disabled={!emailDraft.includes('@')}
                      onClick={() =>
                        setCitizen((c) => ({ ...c, stage: 'email-enviado', email: emailDraft }))
                      }
                    >
                      <Mail aria-hidden /> Criar conta
                    </Button>
                  </div>
                </div>
              )}
              {citizen.stage === 'email-enviado' && (
                <Button
                  variant="secondary"
                  onClick={() => setCitizen((c) => ({ ...c, stage: 'com-conta' }))}
                >
                  Abrir o link enviado a {citizen.email} (simulado)
                </Button>
              )}
              {citizen.stage === 'com-conta' && (
                <>
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Os meus sacos</h3>
                    {scanning ? (
                      <div className="space-y-2 rounded-lg bg-muted/60 p-3">
                        <Input
                          placeholder="Apelido (opcional, privado)"
                          value={aliasDraft}
                          onChange={(e) => setAliasDraft(e.target.value)}
                          aria-label="Apelido do saco"
                        />
                        <div className="grid gap-1">
                          {(
                            [
                              [null, 'Não declarar'],
                              ['nivel-a', 'Nível A · como novo'],
                              ['nivel-b', 'Nível B · usado'],
                            ] as Array<[Declaration | null, string]>
                          ).map(([v, label]) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setDeclaration(v)}
                              className={cn(
                                'min-h-11 rounded-lg border px-3 text-left text-sm',
                                declaration === v
                                  ? 'border-primary bg-primary/10'
                                  : 'border-border',
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Declarar vale +{BONUS_CONFORMIDADE} quando a triagem confirmar
                          (estimativa).
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setCitizen((c) => ({
                                ...c,
                                bags: [
                                  ...c.bags,
                                  {
                                    code: nextBagCode(),
                                    alias: aliasDraft.trim() || null,
                                    declaration,
                                    status: 'ativo',
                                    weightKg: null,
                                  },
                                ],
                              }));
                              setScanning(false);
                              setAliasDraft('');
                              setDeclaration(null);
                            }}
                          >
                            <Check aria-hidden /> Ativar saco
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setScanning(false)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setScanning(true)}>
                        Ler QR de um saco (simulado)
                      </Button>
                    )}
                    <ul className="space-y-2">
                      {citizen.bags.map((bag) => (
                        <li
                          key={bag.code}
                          className="flex items-center justify-between gap-2 rounded-lg bg-card p-3 ring-1 ring-foreground/10"
                        >
                          <div className="min-w-0">
                            <p className="font-mono text-xs">{bag.code}</p>
                            <p className="truncate text-sm">
                              {bag.alias ?? 'sem apelido'} ·{' '}
                              {bag.status === 'triado'
                                ? `+${formatNumber(bag.declaration ? POINTS_PER_BAG + BONUS_CONFORMIDADE : POINTS_PER_BAG)} pts`
                                : bag.status}
                            </p>
                          </div>
                          {bag.status !== 'triado' && (
                            <Button size="sm" variant="ghost" onClick={() => advance(bag.code)}>
                              {bag.status === 'ativo'
                                ? 'recolher'
                                : bag.status === 'recolhido'
                                  ? 'pesar'
                                  : 'confirmar triagem'}
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">
                      Saldo <Badge variant="secondary">estimativa</Badge>
                    </h3>
                    <p className="font-serif text-3xl">{formatNumber(totalPoints)} pontos</p>
                    <p className="text-sm text-muted-foreground">
                      {formatKg(totalKg, 1)} desviados · {eurAvoidedLabel(totalKg)} de aterro
                      evitado. Só leitura; a troca chega depois.
                    </p>
                  </section>
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">
                      <QrCode className="mr-1 inline size-4 align-[-2px]" aria-hidden />
                      QR da conta (entrega mão a mão)
                    </h3>
                    <FauxQr
                      seed={citizen.email}
                      className="w-36"
                      label="QR da conta (ilustrativo)"
                    />
                  </section>
                  <p className="text-xs text-muted-foreground">
                    Apagar a conta perde o saldo e desativa os sacos; lotes e passaportes ficam —
                    nunca tiveram doador.
                  </p>
                </>
              )}
              <p className="border-t pt-3 font-mono text-[10px] text-muted-foreground">
                estado: {citizen.stage} · sacos:{' '}
                {citizen.bags.map((b) => `${b.code}:${b.status}`).join(' ') || '—'} · pontos:{' '}
                {totalPoints}
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 pb-40">
        <div className="space-y-3">
          <p className="eyebrow">Rede de recolha de têxtil · Guimarães</p>
          <h1 className="font-serif text-4xl tracking-wide sm:text-5xl">Onde e quando entrego</h1>
          <p className="max-w-xl text-muted-foreground">
            O saco fechado, à porta, no dia fixo da tua freguesia — ou num local que recebe. Sem
            contentores: o têxtil limpo e seco é o que vale.
          </p>
        </div>

        <section className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {PARISH_AGENDA.map((p) => (
              <button
                key={p.parish}
                type="button"
                onClick={() => setParish(p.parish)}
                className={cn(
                  'min-h-11 rounded-full border px-4 text-sm',
                  p.parish === parish
                    ? 'border-primary bg-primary/10 font-medium'
                    : 'border-border',
                )}
              >
                {p.parish}
              </button>
            ))}
          </div>
          <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{agenda.parish}</p>
                <p className="font-serif text-3xl">{agenda.dayLabel}</p>
              </div>
              <WeekdayDots days={[agenda.day]} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Locais que recebem o saco: {agenda.sites.join(' · ')}.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Agenda de exemplo — tabela operacional mantida pela Vitrus, não saída do otimizador.
            </p>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/60 p-4">
            <p className="font-serif text-2xl">9 em 10</p>
            <p className="text-sm text-muted-foreground">
              kg de têxtil do concelho ainda vão para o lixo (captura ≈ 9,1%)
            </p>
          </div>
          <div className="rounded-xl bg-muted/60 p-4">
            <p className="font-serif text-2xl">à porta</p>
            <p className="text-sm text-muted-foreground">
              um dia fixo por freguesia, recolha dedicada sem compactação
            </p>
          </div>
          <div className="rounded-xl bg-muted/60 p-4">
            <p className="font-serif text-2xl">sem contentor</p>
            <p className="text-sm text-muted-foreground">
              o saco fechado protege a reutilização — 59,4% do recolhido é reutilizado
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-2xl">Como funciona</h2>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li>
              1. Ativa o saco no telemóvel (QR único do saco) — ou entrega mão a mão com o QR da
              conta.
            </li>
            <li>2. Sai com o saco no dia da tua freguesia, ou leva-o a um local que recebe.</li>
            <li>
              3. A viatura pesa e credita: pontos por saco, bónus se declarares o conteúdo
              (estimativa).
            </li>
          </ol>
          <p className="text-sm">
            <span className="underline decoration-dotted">
              «Vai no saco?» — o que é reutilizável (stub)
            </span>
          </p>
        </section>
      </main>
    </div>
  );
}
