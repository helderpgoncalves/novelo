import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getMeOptions } from '@/client/@tanstack/react-query.gen';
import { BrandLogo, BrandSymbol } from '@/components/brand-logo';

export const Route = createFileRoute('/_auth')({
  // Quem já tem sessão não precisa de ver o ecrã de entrada.
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient
      .fetchQuery({ ...getMeOptions(), staleTime: 30_000 })
      .catch(() => null);
    if (user) throw redirect({ to: '/' });
  },
  component: AuthLayout,
});

const FACTS = [
  ['55', 'freguesias dispersas'],
  ['156 277', 'habitantes'],
  ['17 abr 2028', 'prazo da RAP têxtil'],
] as const;

function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-[#14211d] p-12 text-[#f4f1ea] lg:flex lg:flex-col lg:justify-between">
        <BrandSymbol
          tone="negative"
          className="-right-40 -bottom-40 pointer-events-none absolute size-[640px] opacity-30"
        />
        <BrandLogo tone="negative" />
        <div className="relative max-w-lg space-y-6">
          <p className="font-semibold text-[11px] text-[#7fb39c] uppercase tracking-[0.18em]">
            Hack4Guimarães 2035 · Desafio TexVitrus
          </p>
          <h2 className="text-balance text-5xl leading-[1.05]">
            Recolha seletiva de têxteis, desenhada ao menor custo.
          </h2>
          <p className="max-w-md text-[#f4f1ea]/70 leading-relaxed">
            Do saco ao fio: planear a rede, decidir em português, seguir cada lote até à indústria e
            entregar à câmara o dossiê de 2028.
          </p>
        </div>
        <dl className="relative grid grid-cols-3 gap-6 border-[#f4f1ea]/15 border-t pt-6">
          {FACTS.map(([value, label]) => (
            <div key={label}>
              <dd className="font-medium font-serif text-3xl tabular-nums">{value}</dd>
              <dt className="mt-1 text-[#f4f1ea]/60 text-xs">{label}</dt>
            </div>
          ))}
        </dl>
      </aside>
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <div className="lg:hidden">
          <BrandLogo />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <Outlet />
        </div>
        <p className="text-center text-muted-foreground text-xs">
          © 2026 Novelo · Hélder Gonçalves e Flávio Fernandes
        </p>
      </main>
    </div>
  );
}
