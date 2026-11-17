/**
 * PROTOTIPO (wayfinder #48) — Variante A «Passo a passo».
 * A home é o próximo passo: a jornada como wizard vertical, um passo focado
 * por ecrã, ação primária única, barra de progresso dos marcos.
 * Throwaway.
 */

import { ArrowRight, Check, Mail } from 'lucide-react';
import { useState } from 'react';
import { Panel, SectionTitle } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const STEPS = ['Chegar', 'Conta', 'Saco', 'Entregar', 'Crédito'] as const;

export function VariantA() {
  const [citizen, setCitizen] = useState<CitizenState>(initialCitizen);
  const [emailDraft, setEmailDraft] = useState('');
  const [aliasDraft, setAliasDraft] = useState('');
  const [declaration, setDeclaration] = useState<Declaration | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [parish, setParish] = useState(PARISH_AGENDA[0]?.parish ?? 'Azurém');
  const [showAgenda, setShowAgenda] = useState(false);
  const [showAccountQr, setShowAccountQr] = useState(false);

  const agenda = PARISH_AGENDA.find((p) => p.parish === parish) ?? DEFAULT_AGENDA;
  const activeBag = citizen.bags.find((b) => b.status === 'ativo');
  const pendingBag = citizen.bags.find((b) => b.status === 'recolhido' || b.status === 'pesado');
  const triagedBag = citizen.bags.find((b) => b.status === 'triado');
  const stepIndex =
    citizen.stage === 'visitante'
      ? 0
      : citizen.stage === 'email-enviado'
        ? 1
        : citizen.bags.length === 0
          ? 2
          : activeBag
            ? 3
            : 4;
  const totalPoints = pointsFlat(citizen.bags) + pointsBonus(citizen.bags);

  const enterEmail = () => {
    if (!emailDraft.includes('@')) return;
    setCitizen((c) => ({ ...c, stage: 'email-enviado', email: emailDraft }));
  };
  const confirmMagicLink = () => setCitizen((c) => ({ ...c, stage: 'com-conta' }));
  const activateBag = () => {
    const code = scannedCode ?? nextBagCode();
    setCitizen((c) => ({
      ...c,
      bags: [
        ...c.bags,
        { code, alias: aliasDraft.trim() || null, declaration, status: 'ativo', weightKg: null },
      ],
    }));
    setScannedCode(null);
    setAliasDraft('');
    setDeclaration(null);
  };
  const collectBag = (code: string) =>
    setCitizen((c) => ({
      ...c,
      bags: c.bags.map((b) => (b.code === code ? { ...b, status: 'recolhido' } : b)),
    }));
  const weighBag = (code: string, weight: number) =>
    setCitizen((c) => ({
      ...c,
      bags: c.bags.map((b) => (b.code === code ? { ...b, status: 'pesado', weightKg: weight } : b)),
    }));
  const sortBag = (code: string) =>
    setCitizen((c) => ({
      ...c,
      bags: c.bags.map((b) => (b.code === code ? { ...b, status: 'triado' } : b)),
    }));
  const restart = () => {
    setCitizen(initialCitizen);
    setEmailDraft('');
    setScannedCode(null);
    setAliasDraft('');
    setDeclaration(null);
    setShowAccountQr(false);
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <span className="font-serif text-lg font-medium">Novelo</span>
          <span className="text-xs text-muted-foreground">área do cidadão · protótipo A</span>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-5 px-4 pt-6 pb-40">
        {/* Barra de marcos da jornada */}
        <ol className="flex items-center gap-1" aria-label="Progresso">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <div
                className={cn(
                  'h-1.5 rounded-full',
                  i < stepIndex ? 'bg-primary' : i === stepIndex ? 'bg-primary/60' : 'bg-muted',
                )}
                title={s}
              />
              <p
                className={cn(
                  'mt-1 truncate text-center text-[10px] sm:text-xs',
                  i === stepIndex ? 'font-semibold text-foreground' : 'text-muted-foreground',
                )}
              >
                {s}
              </p>
            </li>
          ))}
        </ol>

        {citizen.stage === 'visitante' && (
          <Panel className="space-y-4">
            <p className="eyebrow">Primeira vez aqui</p>
            <SectionTitle>O teu têxtil tem onde ir</SectionTitle>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Em Guimarães, 9 em cada 10 kg de têxtil ainda vão para o lixo. A rede Novelo recolhe o
              saco fechado à porta, num dia fixo por freguesia — e o que está em bom estado volta a
              ser usado.
            </p>
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
              <Button className="w-full" onClick={enterEmail}>
                <Mail aria-hidden /> Criar conta com email
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Sem password: recebes um link por email. O saldo e o histórico são só teus — o lote
                e o passaporte nunca mostram o doador.
              </p>
            </div>
            <button
              type="button"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setShowAgenda((v) => !v)}
            >
              {showAgenda ? 'Esconder' : 'Ver onde e quando entrego (sem conta)'}
            </button>
            {showAgenda && <AgendaBlock parish={parish} onParish={setParish} agenda={agenda} />}
          </Panel>
        )}

        {citizen.stage === 'email-enviado' && (
          <Panel className="space-y-4">
            <p className="eyebrow">Passo 2 · Conta</p>
            <SectionTitle>Vai um link para {citizen.email}</SectionTitle>
            <p className="text-sm text-muted-foreground">
              Abre-o no teu email e ficas com conta. Sem password, nada para lembrar.
            </p>
            <Button className="w-full" variant="secondary" onClick={confirmMagicLink}>
              Abrir o link mágico (simulado) <ArrowRight aria-hidden />
            </Button>
          </Panel>
        )}

        {citizen.stage === 'com-conta' && citizen.bags.length === 0 && !scannedCode && (
          <Panel className="space-y-4">
            <p className="eyebrow">Passo 3 · Saco</p>
            <SectionTitle>Ativa o teu primeiro saco</SectionTitle>
            <p className="text-sm text-muted-foreground">
              Cada saco da plataforma tem um QR único pré-impresso. Aponta a câmara e diz «este saco
              é meu» — o vínculo fica para sempre, aguenta as lavagens.
            </p>
            <Button className="w-full" onClick={() => setScannedCode(nextBagCode())}>
              Ler o QR do saco (simulado)
            </Button>
          </Panel>
        )}

        {citizen.stage === 'com-conta' && scannedCode && (
          <Panel className="space-y-4">
            <p className="eyebrow">Saco {scannedCode}</p>
            <SectionTitle>Este saco é teu</SectionTitle>
            <Input
              placeholder="Apelido (opcional, privado) — ex.: roupa de inverno"
              value={aliasDraft}
              onChange={(e) => setAliasDraft(e.target.value)}
              aria-label="Apelido do saco"
              className="text-base"
            />
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">O que vai no saco? (opcional)</legend>
              <DeclButtons value={declaration} onChange={setDeclaration} />
              <p className="text-xs text-muted-foreground">
                Declarar dá direito a +{BONUS_CONFORMIDADE} pontos quando a triagem confirmar
                (estimativa). Nunca é público: quem lê o QR só vê o resultado triado.
              </p>
            </fieldset>
            <Button className="w-full" onClick={activateBag}>
              <Check aria-hidden /> Ativar saco
            </Button>
          </Panel>
        )}

        {activeBag?.status === 'ativo' && (
          <Panel className="space-y-4">
            <p className="eyebrow">Passo 4 · Entregar</p>
            <SectionTitle>Saco {activeBag.code} pronto</SectionTitle>
            <p className="text-sm text-muted-foreground">
              {activeBag.alias ? `«${activeBag.alias}» · ` : ''}
              {activeBag.declaration ? 'conteúdo declarado · ' : 'sem declaração · '}
              crédito confirmado na viatura, no scan e na pesagem.
            </p>
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/60 p-3 space-y-2">
                <p className="text-sm font-medium">À porta, sem ninguém</p>
                <p className="text-sm text-muted-foreground">
                  Sai com o saco no dia da tua freguesia:{' '}
                  <span className="font-medium text-foreground">
                    {agenda.dayLabel} em {agenda.parish}
                  </span>{' '}
                  (agenda de exemplo).
                </p>
                <div className="flex flex-wrap gap-1">
                  {PARISH_AGENDA.map((p) => (
                    <button
                      key={p.parish}
                      type="button"
                      onClick={() => setParish(p.parish)}
                      className={cn(
                        'min-h-11 rounded-full border px-3 text-sm',
                        p.parish === parish
                          ? 'border-primary bg-primary/10 font-medium'
                          : 'border-border',
                      )}
                    >
                      {p.parish}
                    </button>
                  ))}
                </div>
                <Button size="sm" variant="outline" onClick={() => collectBag(activeBag.code)}>
                  Simular: a viatura passou e recolheu
                </Button>
              </div>
              <div className="rounded-lg bg-muted/60 p-3 space-y-2">
                <p className="text-sm font-medium">Mão a mão, com o operador</p>
                <p className="text-sm text-muted-foreground">
                  Sem saco da plataforma? Mostra o QR da tua conta e o operador pesa logo.
                </p>
                {!showAccountQr ? (
                  <Button size="sm" variant="outline" onClick={() => setShowAccountQr(true)}>
                    Mostrar o QR da conta
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <FauxQr
                      seed={citizen.email || 'conta'}
                      className="mx-auto w-40"
                      label="QR da conta (ilustrativo)"
                    />
                    <Button size="sm" variant="outline" onClick={() => collectBag(activeBag.code)}>
                      Simular: o operador fez scan
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Panel>
        )}

        {pendingBag && (pendingBag.status === 'recolhido' || pendingBag.status === 'pesado') && (
          <Panel className="space-y-4">
            <p className="eyebrow">Passo 5 · Crédito</p>
            <SectionTitle>Recolhido — a confirmar na viatura</SectionTitle>
            <p className="text-sm text-muted-foreground">
              O crédito nasce no scan e na pesagem, nunca na entrega.
            </p>
            {pendingBag.status === 'recolhido' ? (
              <Button className="w-full" onClick={() => weighBag(pendingBag.code, sampleWeight())}>
                Simular: pesagem na viatura
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Peso medido</span>
                  <span className="font-serif text-2xl">
                    {formatKg(pendingBag.weightKg ?? 0, 1)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Pontos (estimativa)</span>
                  <span className="font-serif text-2xl text-primary">
                    +{formatNumber(POINTS_PER_BAG)}{' '}
                    {pendingBag.declaration && (
                      <span className="text-base text-muted-foreground">
                        (+{BONUS_CONFORMIDADE} pendentes)
                      </span>
                    )}
                  </span>
                </div>
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={() => sortBag(pendingBag.code)}
                >
                  Simular: a triagem confirmou
                </Button>
              </div>
            )}
          </Panel>
        )}

        {triagedBag && !activeBag && !pendingBag && (
          <Panel className="space-y-4">
            <p className="eyebrow">Feito</p>
            <SectionTitle>
              +{formatNumber(totalPoints)} pontos <Badge variant="secondary">estimativa</Badge>
            </SectionTitle>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                Saco {triagedBag.code} · {formatKg(triagedBag.weightKg ?? 0, 1)} · +
                {formatNumber(POINTS_PER_BAG)} pontos
              </li>
              <li>
                {triagedBag.declaration
                  ? `Bónus de conformidade +${BONUS_CONFORMIDADE} — a triagem confirmou o declarado`
                  : 'Sem bónus: não havia declaração. No próximo saco, declara o conteúdo.'}
              </li>
              <li>
                {eurAvoidedLabel(triagedBag.weightKg ?? 0)} de custo de aterro evitado — o teu
                acumulado ambiental, sempre visível.
              </li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setScannedCode(nextBagCode())}>
                Ativar outro saco
              </Button>
              <Button size="sm" variant="ghost" onClick={restart}>
                Recomeçar a jornada
              </Button>
            </div>
            {scannedCode && (
              <p className="text-xs text-muted-foreground">
                Novo scan pronto ({scannedCode}) — o formulário de ativação voltou ao passo 3.
              </p>
            )}
          </Panel>
        )}

        <p className="font-mono text-[10px] text-muted-foreground">
          estado: {citizen.stage} · sacos:{' '}
          {citizen.bags.map((b) => `${b.code}:${b.status}`).join(' ') || '—'} · pontos:{' '}
          {totalPoints}
        </p>
      </main>
    </div>
  );
}

function DeclButtons({
  value,
  onChange,
}: {
  value: Declaration | null;
  onChange: (v: Declaration | null) => void;
}) {
  const options: Array<{ v: Declaration | null; label: string; hint: string }> = [
    { v: null, label: 'Não declarar', hint: 'só os pontos base' },
    { v: 'nivel-a', label: 'Nível A', hint: 'como novo, pronto a vestir' },
    { v: 'nivel-b', label: 'Nível B', hint: 'usado, com defeitos' },
  ];
  return (
    <div className="grid gap-2">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            'flex min-h-11 items-center justify-between rounded-lg border px-3 py-2 text-left text-sm',
            value === o.v ? 'border-primary bg-primary/10' : 'border-border',
          )}
        >
          <span className="font-medium">{o.label}</span>
          <span className="text-xs text-muted-foreground">{o.hint}</span>
        </button>
      ))}
    </div>
  );
}

function AgendaBlock({
  parish,
  onParish,
  agenda,
}: {
  parish: string;
  onParish: (p: string) => void;
  agenda: (typeof PARISH_AGENDA)[number];
}) {
  return (
    <div className="rounded-lg bg-muted/60 p-3 space-y-2">
      <p className="text-sm font-medium">Onde e quando entrego</p>
      <div className="flex flex-wrap gap-1">
        {PARISH_AGENDA.map((p) => (
          <button
            key={p.parish}
            type="button"
            onClick={() => onParish(p.parish)}
            className={cn(
              'min-h-11 rounded-full border px-3 text-sm',
              p.parish === parish ? 'border-primary bg-primary/10 font-medium' : 'border-border',
            )}
          >
            {p.parish}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {agenda.parish}: saco à porta à {agenda.dayLabel}. Ou entrega num local que recebe:{' '}
        {agenda.sites.join(', ')}. <span className="text-xs">(agenda de exemplo)</span>
      </p>
    </div>
  );
}
