import { type ReactNode, useEffect, useRef } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { cn } from '@/lib/utils';

interface ErrorScreenProps {
  eyebrow: string;
  title: string;
  /** Número grande e decorativo (404, 403). */
  code?: string;
  children?: ReactNode;
  actions?: ReactNode;
  /** `page`: ocupa o ecrã (fora da app); `panel`: dentro da área de conteúdo, mantendo o menu. */
  layout?: 'page' | 'panel';
}

/**
 * Esqueleto de todos os ecrãs de erro: eyebrow, título serifado, texto e ações. O foco vai para o título ao
 * montar (quem usa leitor de ecrã ouve-o, quem usa teclado começa aqui), por isso não leva `role="alert"`.
 */
export function ErrorScreen({
  eyebrow,
  title,
  code,
  children,
  actions,
  layout = 'panel',
}: ErrorScreenProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  const page = layout === 'page';
  return (
    <div
      className={cn(
        'flex flex-col items-center',
        page
          ? 'min-h-dvh bg-background px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pr-[max(1.5rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))]'
          : 'px-2 py-6 sm:py-16',
      )}
    >
      {page && <BrandLogo className="h-8 self-start" />}
      <div
        className={cn(
          'flex w-full max-w-lg flex-col items-center gap-4 text-center sm:gap-5',
          page && 'my-auto py-10',
        )}
      >
        {code && (
          <p
            aria-hidden="true"
            className="select-none font-medium font-serif text-6xl text-areia tabular-nums leading-none sm:text-8xl"
          >
            {code}
          </p>
        )}
        <div className="space-y-3">
          <p className="eyebrow">{eyebrow}</p>
          <h1
            ref={heading}
            tabIndex={-1}
            className="text-balance text-3xl outline-none sm:text-4xl"
          >
            {title}
          </h1>
        </div>
        {children && (
          <div className="max-w-md space-y-3 text-pretty text-muted-foreground text-sm leading-relaxed sm:text-base">
            {children}
          </div>
        )}
        {actions && (
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
