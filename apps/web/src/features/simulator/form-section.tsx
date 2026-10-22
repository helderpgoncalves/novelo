import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface FormSectionProps {
  id: string;
  title: string;
  /** Valor escolhido, mostrado na linha do título mesmo com a secção recolhida. */
  summary: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invalid?: boolean;
  children: ReactNode;
}

/** Secção colapsável a toda a largura: título serifado e, por baixo, o valor escolhido. */
export function FormSection({
  id,
  title,
  summary,
  open,
  onOpenChange,
  invalid,
  children,
}: FormSectionProps) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      asChild
      // O cabeçalho fixo e o resumo não podem tapar o título ao saltar para a secção.
    >
      <section
        id={id}
        className={cn(
          'scroll-mt-20 rounded-xl bg-card ring-1 ring-foreground/10',
          invalid && 'ring-destructive/60',
        )}
      >
        <h2 className="font-sans text-base leading-normal tracking-normal">
          <CollapsibleTrigger className="group flex min-h-16 w-full items-center gap-3 rounded-xl px-4 py-3 text-left outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-ring sm:px-5">
            <span className="min-w-0 flex-1">
              <span className="block font-medium font-serif text-[1.25rem] leading-tight tracking-tight">
                {title}
              </span>
              <span
                className={cn(
                  'mt-0.5 block text-pretty font-normal text-sm',
                  invalid ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {summary}
              </span>
            </span>
            <ChevronDown
              className="size-5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
              aria-hidden="true"
            />
          </CollapsibleTrigger>
        </h2>
        <CollapsibleContent className="space-y-5 border-border/70 border-t px-4 py-4 sm:px-5 sm:py-5">
          {children}
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
