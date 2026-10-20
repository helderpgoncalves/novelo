import { Link } from '@tanstack/react-router';
import { ArrowRight, LineChart, MessageCircleQuestion, PackageCheck } from 'lucide-react';
import { PublicShell } from '@/components/public-shell';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';

/** Etiqueta "estimativa": todo o número que não foi medido a leva (regra do projeto). */
function Estimate() {
  return (
    <span className="ml-1.5 inline-flex rounded-full border border-border px-2 py-0.5 align-middle font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
      {m.landing_estimate_tag()}
    </span>
  );
}

/**
 * Página inicial pública (sem sessão): nome, o que faz, números reais com fonte, Entrar/Registar e, no rodapé,
 * Privacidade, Termos e contacto. É a "Application home page" do ecrã de consentimento da Google.
 */
export function LandingPage() {
  const what = [
    { icon: LineChart, text: m.landing_what_1() },
    { icon: MessageCircleQuestion, text: m.landing_what_2() },
    { icon: PackageCheck, text: m.landing_what_3() },
  ] as const;
  const stats = [
    {
      id: 'collected',
      value: m.landing_stat_collected_value(),
      label: m.landing_stat_collected_label(),
      source: m.landing_stat_collected_source(),
      estimate: false,
    },
    {
      id: 'capture',
      value: m.landing_stat_capture_value(),
      label: m.landing_stat_capture_label(),
      source: m.landing_stat_capture_source(),
      estimate: true,
    },
    {
      id: 'benchmark',
      value: m.landing_stat_benchmark_value(),
      label: m.landing_stat_benchmark_label(),
      source: m.landing_stat_benchmark_source(),
      estimate: false,
    },
  ] as const;

  return (
    <PublicShell
      width="max-w-6xl"
      actions={
        <Button asChild variant="ghost" className="hidden h-10 sm:inline-flex">
          <Link to="/login">{m.landing_sign_in()}</Link>
        </Button>
      }
    >
      <main
        id="content"
        className="mx-auto w-full max-w-6xl space-y-14 px-4 pt-6 pb-16 sm:px-6 sm:pt-12"
      >
        <section aria-labelledby="landing-title" className="max-w-3xl space-y-6">
          <p className="eyebrow">{m.landing_eyebrow()}</p>
          <h1
            id="landing-title"
            className="text-balance font-medium text-[2.4rem] leading-[1.05] tracking-tight sm:text-6xl"
          >
            <span className="text-primary">Novelo</span>
            <span className="sr-only">: </span>
            <span className="block">{m.landing_title()}</span>
          </h1>
          <ul className="space-y-3 text-pretty text-lg leading-relaxed">
            {what.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3">
                <Icon className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button asChild size="lg" className="h-12 gap-2 px-6 text-base">
              <Link to="/login">
                {m.landing_sign_in()}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
              <Link to="/register">{m.landing_register()}</Link>
            </Button>
          </div>
        </section>

        <section aria-labelledby="landing-numbers" className="space-y-6">
          <div className="space-y-2">
            <h2 id="landing-numbers" className="text-3xl">
              {m.landing_numbers_title()}
            </h2>
            <p className="max-w-2xl text-muted-foreground">{m.landing_numbers_note()}</p>
          </div>
          <dl className="grid gap-4 md:grid-cols-3">
            {stats.map((s) => (
              <div key={s.id} className="flex flex-col rounded-lg border border-border bg-card p-5">
                <dd className="order-2 mt-2 text-pretty">
                  {s.label}
                  {s.estimate && <Estimate />}
                </dd>
                <dt className="order-1 font-medium font-serif text-4xl text-primary tabular-nums">
                  {s.value}
                </dt>
                <dd className="order-3 mt-3 text-pretty text-muted-foreground text-xs leading-relaxed">
                  {s.source}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </PublicShell>
  );
}
