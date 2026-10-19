import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface PageTab<T extends string> {
  id: T;
  label: string;
  /** Contagem opcional mostrada ao lado do rótulo. */
  count?: number;
  content: ReactNode;
}

interface PageTabsProps<T extends string> {
  tabs: PageTab<T>[];
  value: T;
  onValueChange: (value: T) => void;
  label: string;
}

/** Separadores de página: uma vista de cada vez para o detalhe secundário, com contagem opcional. */
export function PageTabs<T extends string>({
  tabs,
  value,
  onValueChange,
  label,
}: PageTabsProps<T>) {
  return (
    <Tabs value={value} onValueChange={(v) => onValueChange(v as T)} className="gap-5">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList
          variant="line"
          aria-label={label}
          className="h-auto w-full min-w-max justify-start gap-1 border-border border-b pb-0"
        >
          {tabs.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="h-11 flex-none px-3.5 after:bottom-[-1px] sm:px-4"
            >
              {t.label}
              {t.count !== undefined && (
                <span className="rounded-full bg-muted px-1.5 py-px font-semibold text-[10px] text-muted-foreground tabular-nums">
                  {t.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.id} value={t.id} className="min-w-0">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
