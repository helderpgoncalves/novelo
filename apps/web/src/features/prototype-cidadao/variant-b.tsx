/**
 * PROTOTIPO (wayfinder #48) — Variante B «Carteira».
 * App standalone (PWA): barra de separadores inferior, ecrãs densos,
 * saldo e QR da conta em primeiro plano, onboarding como cartão que desaparece.
 * Throwaway.
 */

import { History, Home, Mail, Pencil, QrCode, ShoppingBag, Wallet, X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
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

type Tab = 'inicio' | 'sacos' | 'saldo' | 'historico';

const TABS: Array<{ id: Tab; label: string; icon: typeof Home }> = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'sacos', label: 'Sacos', icon: ShoppingBag },
  { id: 'saldo', label: 'Saldo', icon: Wallet },
  { id: 'historico', label: 'Histórico', icon: History },
];

export function VariantB() {
  const [citizen, setCitizen] = useState<CitizenState>(initialCitizen);
  const [tab, setTab] = useState<Tab>('inicio');
  const [emailDraft, setEmailDraft] = useState('');
  const [aliasDraft, setAliasDraft] = useState('');
  const [declaration, setDeclaration] = useState<Declaration | null>(null);
  const [activating, setActivating] = useState(false);
  const [editingAlias, setEditingAlias] = useState<string | null>(null);
  const [parish] = useState(PARISH_AGENDA[0]?.parish ?? 'Azurém');
  const agenda = PARISH_AGENDA.find((p) => p.parish === parish) ?? DEFAULT_AGENDA;

  const totalPoints = pointsFlat(citizen.bags) + pointsBonus(citizen.bags);
  const totalKg = citizen.bags.reduce((a, b) => a + (b.weightKg ?? 0), 0);

  const mutateBag = (
    code: string,
    fn: (b: CitizenState['bags'][number]) => CitizenState['bags'][number],
  ) => setCitizen((c) => ({ ...c, bags: c.bags.map((b) => (b.code === code ? fn(b) : b)) }));

  if (citizen.stage !== 'com-conta') {
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-4">
        <div className="w-full max-w-sm space-y-5 text-center">
          <p className="font-serif text-2xl font-medium">Novelo</p>
          <h1 className="font-serif text-3xl">A tua carteira de têxtil</h1>
          <p className="text-sm text-muted-foreground">
            Sacos, pontos e histórico. Sem password: um link para o teu email.
          </p>
          {citizen.stage === 'visitante' ? (
            <div className="space-y-2">
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
                className="w-full"
                disabled={!emailDraft.includes('@')}
                onClick={() =>
                  setCitizen((c) => ({ ...c, stage: 'email-enviado', email: emailDraft }))
                }
              >
                <Mail aria-hidden /> Entrar com email
              </Button>
            </div>
          ) : (
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => setCitizen((c) => ({ ...c, stage: 'com-conta' }))}
            >
              Abrir o link enviado a {citizen.email} (simulado)
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            O lote e o passaporte nunca mostram o doador; o saldo é só teu.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-32">
      <header className="sticky top-0 z-10 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <span className="font-serif text-lg font-medium">Novelo</span>
          <div className="flex items-center gap-2">
            <span className="max-w-40 truncate rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {citizen.email}
            </span>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Sair (recomeçar)"
              onClick={() => {
                setCitizen(initialCitizen);
                setEmailDraft('');
                setTab('inicio');
              }}
            >
              <X aria-hidden />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-5 px-4 pt-5">
        {tab === 'inicio' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTab('saldo')}
                className="rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10"
              >
                <p className="text-xs text-muted-foreground">Saldo (estimativa)</p>
                <p className="font-serif text-3xl">{formatNumber(totalPoints)}</p>
                <p className="text-xs text-muted-foreground">pontos · só leitura</p>
              </button>
              <Sheet>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="grid place-items-center rounded-xl bg-primary/10 p-4 text-center ring-1 ring-primary/20"
                  >
                    <QrCode className="mb-1" aria-hidden />
                    <span className="text-sm font-medium">QR da conta</span>
                    <span className="text-xs text-muted-foreground">entrega mão a mão</span>
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="bottom"
                  className="pb-[max(1.5rem,env(safe-area-inset-bottom))]"
                >
                  <SheetHeader>
                    <SheetTitle>QR da conta</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-3 pb-4 text-center">
                    <FauxQr
                      seed={citizen.email}
                      className="mx-auto w-44"
                      label="QR da conta (ilustrativo)"
                    />
                    <p className="text-sm text-muted-foreground">
                      Mostra ao operador da viatura: o scan pesa e credita na hora. O nome nunca é
                      impresso.
                    </p>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {citizen.bags.length === 0 && !activating && (
              <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-3">
                <p className="eyebrow">Começa</p>
                <h2 className="font-serif text-xl">Ativa o teu primeiro saco</h2>
                <p className="text-sm text-muted-foreground">
                  Lê o QR pré-impresso do saco, dá-lhe um apelido se quiseres e declara o que vai
                  dentro.
                </p>
                <Button className="w-full" onClick={() => setTab('sacos')}>
                  Ativar saco
                </Button>
              </div>
            )}

            <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-2">
              <p className="text-sm font-medium">Próxima recolha à porta</p>
              <p className="text-sm text-muted-foreground">
                {agenda.dayLabel} em {agenda.parish} (agenda de exemplo). Locais que recebem:{' '}
                {agenda.sites.join(', ')}.
              </p>
            </div>

            <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-1">
              <p className="text-sm font-medium">O teu acumulado ambiental</p>
              <p className="text-sm text-muted-foreground">
                {formatKg(totalKg, 1)} desviados do lixo · {eurAvoidedLabel(totalKg)} de aterro
                evitado · sempre visível, 100% verificado.
              </p>
            </div>
          </>
        )}

        {tab === 'sacos' && (
          <>
            {activating ? (
              <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-3">
                <p className="eyebrow">Novo saco (scan simulado)</p>
                <Input
                  placeholder="Apelido (opcional, privado)"
                  value={aliasDraft}
                  onChange={(e) => setAliasDraft(e.target.value)}
                  aria-label="Apelido do saco"
                />
                <DeclPicker value={declaration} onChange={setDeclaration} />
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
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
                      setActivating(false);
                      setAliasDraft('');
                      setDeclaration(null);
                    }}
                  >
                    Ativar
                  </Button>
                  <Button variant="ghost" onClick={() => setActivating(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button className="w-full" onClick={() => setActivating(true)}>
                Ler o QR de um saco (simulado)
              </Button>
            )}

            <ul className="space-y-3">
              {citizen.bags.map((bag) => (
                <li
                  key={bag.code}
                  className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm">{bag.code}</p>
                      {editingAlias === bag.code ? (
                        <Input
                          autoFocus
                          defaultValue={bag.alias ?? ''}
                          placeholder="Apelido privado"
                          aria-label="Apelido do saco"
                          onBlur={(e) => {
                            mutateBag(bag.code, (b) => ({
                              ...b,
                              alias: e.target.value.trim() || null,
                            }));
                            setEditingAlias(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                          }}
                          className="mt-1 h-9 text-sm"
                        />
                      ) : (
                        <p className="truncate text-sm text-muted-foreground">
                          {bag.alias ?? 'sem apelido'}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <StatusBadge status={bag.status} />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-9"
                        aria-label="Editar apelido"
                        onClick={() => setEditingAlias(bag.code)}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-9"
                        aria-label="Desativar saco (perda)"
                        onClick={() =>
                          setCitizen((c) => ({
                            ...c,
                            bags: c.bags.filter((b) => b.code !== bag.code),
                          }))
                        }
                      >
                        <X aria-hidden />
                      </Button>
                    </div>
                  </div>
                  <BagActions bag={bag} mutate={mutateBag} />
                </li>
              ))}
              {citizen.bags.length === 0 && !activating && (
                <li className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Ainda não tens sacos. Ativa o primeiro com o botão acima.
                </li>
              )}
            </ul>
          </>
        )}

        {tab === 'saldo' && (
          <>
            <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10 space-y-2 text-center">
              <p className="text-xs text-muted-foreground">
                Saldo <Badge variant="secondary">estimativa</Badge>
              </p>
              <p className="font-serif text-5xl">{formatNumber(totalPoints)}</p>
              <p className="text-sm text-muted-foreground">
                pontos · só leitura — a troca chega no próximo passo
              </p>
            </div>
            <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 space-y-2 text-sm">
              <p className="font-medium">Como se compõe</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>+{POINTS_PER_BAG} por saco ativado e recolhido (nunca por kg)</li>
                <li>+{BONUS_CONFORMIDADE} de bónus quando a triagem confirma a declaração</li>
                <li>1 000 pontos ≈ 5 € num donativo a IPSS (estimativa)</li>
              </ul>
            </div>
            {totalPoints > 0 && (
              <div className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                {formatNumber(Math.min(totalPoints, 120))} pontos expiram em março — os ganhos mais
                antigos saem primeiro, 12 meses por ganho (exemplo).
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Pontos sem valor monetário, não transferíveis. Apagar a conta perde o saldo; lotes e
              passaportes ficam (nunca tiveram doador).
            </p>
          </>
        )}

        {tab === 'historico' && (
          <ul className="space-y-2">
            {citizen.bags.flatMap((bag) => [
              <li
                key={`${bag.code}-at`}
                className="rounded-lg bg-card p-3 ring-1 ring-foreground/10"
              >
                <p className="text-sm">
                  Saco {bag.code} ativado{bag.alias ? ` · «${bag.alias}»` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {bag.declaration ? 'conteúdo declarado' : 'sem declaração'} · privado
                </p>
              </li>,
              ...(bag.status !== 'ativo'
                ? [
                    <li
                      key={`${bag.code}-col`}
                      className="rounded-lg bg-card p-3 ring-1 ring-foreground/10"
                    >
                      <p className="text-sm">Recolhido pela viatura</p>
                      <p className="text-xs text-muted-foreground">scan + confirmação na pesagem</p>
                    </li>,
                  ]
                : []),
              ...(bag.status === 'pesado' || bag.status === 'triado'
                ? [
                    <li
                      key={`${bag.code}-pes`}
                      className="rounded-lg bg-card p-3 ring-1 ring-foreground/10"
                    >
                      <p className="text-sm">
                        Pesado: {formatKg(bag.weightKg ?? 0, 1)} · +{formatNumber(POINTS_PER_BAG)}{' '}
                        pontos
                      </p>
                    </li>,
                  ]
                : []),
              ...(bag.status === 'triado'
                ? [
                    <li
                      key={`${bag.code}-tri`}
                      className="rounded-lg bg-card p-3 ring-1 ring-foreground/10"
                    >
                      <p className="text-sm">
                        {bag.declaration
                          ? `Triagem confirmou a declaração · +${BONUS_CONFORMIDADE} bónus`
                          : 'Triagem concluída · sem bónus (não havia declaração)'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        lote e passaporte:{' '}
                        <span className="underline decoration-dotted">ver passaporte (stub)</span> —
                        nunca mostra o doador
                      </p>
                    </li>,
                  ]
                : []),
            ])}
            {citizen.bags.length === 0 && (
              <li className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                O histórico começa no primeiro saco.
              </li>
            )}
          </ul>
        )}

        <p className="font-mono text-[10px] text-muted-foreground">
          estado: {citizen.stage} · separador: {tab} · sacos:{' '}
          {citizen.bags.map((b) => `${b.code}:${b.status}`).join(' ') || '—'} · pontos:{' '}
          {totalPoints}
        </p>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur">
        <ul className="mx-auto flex max-w-lg">
          {TABS.map((t) => (
            <li key={t.id} className="flex-1">
              <button
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex min-h-14 w-full flex-col items-center justify-center gap-0.5 py-2 text-[11px]',
                  tab === t.id ? 'text-primary' : 'text-muted-foreground',
                )}
                aria-current={tab === t.id ? 'page' : undefined}
              >
                <t.icon className="size-5" aria-hidden />
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function StatusBadge({ status }: { status: 'ativo' | 'recolhido' | 'pesado' | 'triado' }) {
  const map = {
    ativo: { label: 'Ativo', cls: 'bg-primary/10 text-primary' },
    recolhido: { label: 'Recolhido', cls: 'bg-muted text-muted-foreground' },
    pesado: { label: 'Pesado', cls: 'bg-muted text-muted-foreground' },
    triado: { label: 'Creditado', cls: 'bg-primary/10 text-primary' },
  } as const;
  const s = map[status];
  return <span className={cn('rounded-full px-2 py-0.5 text-xs', s.cls)}>{s.label}</span>;
}

function DeclPicker({
  value,
  onChange,
}: {
  value: Declaration | null;
  onChange: (v: Declaration | null) => void;
}) {
  const options: Array<{ v: Declaration | null; label: string }> = [
    { v: null, label: 'Não declarar' },
    { v: 'nivel-a', label: 'Nível A · como novo' },
    { v: 'nivel-b', label: 'Nível B · usado' },
  ];
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">O que vai no saco? (opcional)</p>
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            'min-h-11 rounded-lg border px-3 py-2 text-left text-sm',
            value === o.v ? 'border-primary bg-primary/10' : 'border-border',
          )}
        >
          {o.label}
        </button>
      ))}
      <p className="text-xs text-muted-foreground">
        Declarar vale +{BONUS_CONFORMIDADE} pontos quando a triagem confirmar (estimativa). Nunca é
        público.
      </p>
    </div>
  );
}

function BagActions({
  bag,
  mutate,
}: {
  bag: CitizenState['bags'][number];
  mutate: (
    code: string,
    fn: (b: CitizenState['bags'][number]) => CitizenState['bags'][number],
  ) => void;
}) {
  if (bag.status === 'ativo') {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => mutate(bag.code, (b) => ({ ...b, status: 'recolhido' }))}
      >
        Simular recolha pela viatura
      </Button>
    );
  }
  if (bag.status === 'recolhido') {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          mutate(bag.code, (b) => ({ ...b, status: 'pesado', weightKg: sampleWeight() }))
        }
      >
        Simular pesagem (na viatura)
      </Button>
    );
  }
  if (bag.status === 'pesado') {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => mutate(bag.code, (b) => ({ ...b, status: 'triado' }))}
      >
        Simular confirmação da triagem
      </Button>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      +100 pontos{bag.declaration ? ` e +${BONUS_CONFORMIDADE} de bónus` : ''} creditados
      (estimativa).
    </p>
  );
}
