import { Link } from '@tanstack/react-router';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motionAllowed, useInViewOnce } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { CONTAINER, Heading, MONO, Section } from './layout';

/**
 * Conversa gravada em «janela de app» que «escreve» uma só vez ao entrar: pergunta, passos de ferramenta, resposta (sem
 * números: o modelo nunca faz contas), a citação da fonte e o selo do verificador de números. Com movimento reduzido aparece
 * tudo de uma vez. O relógio é derivado de um só intervalo.
 */
function ChatWindow() {
  const question = m.landing_chat_question();
  const answer = m.landing_chat_answer();
  const ref = useRef<HTMLElement>(null);
  const seen = useInViewOnce(ref);
  const animate = motionAllowed();
  const [tick, setTick] = useState(0);
  const stepsAt = question.length + 6;
  const answerAt = stepsAt + 4 * 10 + 4;
  const total = answerAt + Math.ceil(answer.length / 2) + 4;

  useEffect(() => {
    if (!seen || !animate) return;
    const id = window.setInterval(() => {
      setTick((t) => {
        if (t + 1 >= total) window.clearInterval(id);
        return t + 1;
      });
    }, 32);
    return () => window.clearInterval(id);
  }, [seen, animate, total]);

  const t = animate ? tick : total;
  const q = question.slice(0, Math.min(question.length, t));
  const stepsShown = Math.max(0, Math.min(4, Math.floor((t - stepsAt) / 10) + 1));
  const a = answer.slice(0, Math.max(0, Math.min(answer.length, (t - answerAt) * 2)));
  const done = t >= total;
  const steps = [
    m.landing_chat_step_1(),
    m.landing_chat_step_2(),
    m.landing_chat_step_3(),
    m.landing_chat_step_4(),
  ];
  return (
    <figure
      ref={ref}
      aria-label={m.landing_chat_label()}
      className="overflow-hidden rounded-[1.5rem] border border-border bg-background shadow-[0_30px_80px_-40px_rgb(0_0_0/0.7)] max-sm:-mx-4 max-sm:rounded-[1.75rem] max-sm:border-x-0"
    >
      <div className="flex items-center gap-3 border-border border-b bg-secondary/50 px-4 py-3 sm:px-5">
        <span aria-hidden="true" className="flex gap-1.5">
          <i className="size-2.5 rounded-full bg-foreground/25" />
          <i className="size-2.5 rounded-full bg-foreground/25" />
          <i className="size-2.5 rounded-full bg-foreground/25" />
        </span>
        <span className={cn(MONO, 'flex-1 truncate text-center')}>
          {m.landing_copilot_eyebrow()} · Novelo
        </span>
        <Badge variant="outline">{m.landing_chat_example()}</Badge>
      </div>
      <div className="flex flex-col gap-5 p-5 sm:p-7">
        <p
          className={cn(
            'max-w-[90%] self-end text-pretty rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground',
            t < question.length && 'lp-caret',
          )}
        >
          <span className="sr-only">{question}</span>
          <span aria-hidden="true">{q}</span>
        </p>
        <ol
          aria-label={m.landing_chat_label()}
          className="min-h-[8.5rem] space-y-2 rounded-xl border border-border bg-card/70 p-4"
        >
          {steps.slice(0, stepsShown).map((s, i) => {
            const ok = i < stepsShown - 1 || done;
            return (
              <li key={s} className={cn(MONO, 'flex items-center gap-2.5 text-foreground/90')}>
                {ok ? (
                  <Check className="size-3.5 text-primary" strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  <span aria-hidden="true" className="lp-led size-2" />
                )}
                {s}
              </li>
            );
          })}
        </ol>
        <div className="min-h-[8.5rem] max-w-[94%] space-y-3">
          <p className={cn('text-pretty leading-relaxed', !done && a && 'lp-caret')}>
            <span className="sr-only">{answer}</span>
            <span aria-hidden="true">{a}</span>
          </p>
          <p
            className={cn(
              MONO,
              'inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 transition-opacity duration-500',
              done ? 'opacity-100' : 'opacity-0',
            )}
          >
            <sup className="text-primary">1</sup>
            {m.landing_chat_source()}
          </p>
        </div>
        <p
          className={cn(
            'flex items-center gap-3 rounded-xl border border-primary/50 bg-primary/10 px-4 py-3 font-medium text-sm transition-[opacity,transform] duration-500',
            done ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-30',
          )}
        >
          <ShieldCheck
            className="size-5 shrink-0 text-primary"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          {m.landing_chat_checked()}
        </p>
      </div>
      <div className="flex border-border border-t bg-secondary/30 px-5 py-3 sm:px-7">
        <Button asChild variant="outline" size="sm" className="lp-press h-11 gap-1.5 px-5">
          <Link to="/register">
            {m.landing_chat_cta()}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </figure>
  );
}

/** Copiloto: secção escura. À esquerda o título e os quatro compromissos (o verificador em destaque), à direita a conversa. */
export function Copilot() {
  const points = [
    m.landing_copilot_point_1(),
    m.landing_copilot_point_2(),
    m.landing_copilot_point_3(),
    m.landing_copilot_point_4(),
  ];
  return (
    <Section id="copiloto" tone="dark">
      <div className={`${CONTAINER} grid gap-12 lg:grid-cols-12 lg:gap-16`}>
        <div className="flex flex-col gap-10 lg:sticky lg:top-28 lg:col-span-5 lg:self-start">
          <Heading
            id="copiloto"
            n="06"
            size="md"
            eyebrow={m.landing_copilot_eyebrow()}
            title={m.landing_copilot_title()}
            lead={m.landing_copilot_lead()}
          />
          <ol data-reveal="" data-fx="stagger" className="flex flex-col gap-3">
            {points.map((p, i) => (
              <li
                key={p}
                data-s=""
                style={{ '--i': i } as React.CSSProperties}
                className={cn(
                  'flex gap-4 rounded-2xl border p-4',
                  i === 1 ? 'border-primary/50 bg-primary/10' : 'border-transparent px-0',
                )}
              >
                {i === 1 ? (
                  <ShieldCheck
                    className="mt-0.5 size-5 shrink-0 text-primary"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                ) : (
                  <span aria-hidden="true" className={cn(MONO, 'mt-0.5 w-5 shrink-0 text-primary')}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                )}
                <span
                  className={cn(
                    'text-pretty leading-relaxed',
                    i === 1 ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {p}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="lg:col-span-7">
          <ChatWindow />
        </div>
      </div>
    </Section>
  );
}
