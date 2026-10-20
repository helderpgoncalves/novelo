import { CircleHelp } from 'lucide-react';
import type { ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { m } from '@/paraglide/messages';

/** Ajuda curta num popover, para não gastar linhas de ecrã com parágrafos. */
export function HelpHint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={m.simx_help_aria({ label })}
        className="-my-2 -mr-2 inline-grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <CircleHelp className="size-4" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end">{children}</PopoverContent>
    </Popover>
  );
}
