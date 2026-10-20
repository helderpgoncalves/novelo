import { useState } from 'react';
import { ErrorState } from '@/components/states';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { m } from '@/paraglide/messages';
import { BehaviourSection } from './behaviour-section';
import { DataSection } from './data-section';
import { MemorySection } from './memory-section';
import { PersonaSection } from './persona-section';
import { useCopilotSettings } from './use-settings';

type Section = 'memory' | 'persona' | 'behaviour' | 'data';

/** Definições do copiloto: memória, personalidade, comportamento e os teus dados. */
export function SettingsTab({
  onOpenThread,
  onDeleted,
}: {
  onOpenThread: (id: string) => void;
  onDeleted: () => void;
}) {
  const [section, setSection] = useState<Section>('memory');
  const { query } = useCopilotSettings();
  if (query.isPending) {
    return (
      <p role="status" className="py-10 text-center text-muted-foreground text-sm">
        {m.chat_loading_settings()}
      </p>
    );
  }
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <div className="space-y-5" data-testid="copilot-settings">
      <Tabs value={section} onValueChange={(v) => setSection(v as Section)}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList
            aria-label={m.chat_tab_settings()}
            className="h-auto w-max min-w-full justify-start"
          >
            <TabsTrigger value="memory" className="h-11 px-4">
              {m.chat_section_memory()}
            </TabsTrigger>
            <TabsTrigger value="persona" className="h-11 px-4">
              {m.chat_section_persona()}
            </TabsTrigger>
            <TabsTrigger value="behaviour" className="h-11 px-4">
              {m.chat_section_behaviour()}
            </TabsTrigger>
            <TabsTrigger value="data" className="h-11 px-4">
              {m.chat_section_data()}
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>
      <div className="max-w-5xl">
        {section === 'memory' && <MemorySection onOpenThread={onOpenThread} />}
        {section === 'persona' && <PersonaSection />}
        {section === 'behaviour' && <BehaviourSection />}
        {section === 'data' && <DataSection onDeleted={onDeleted} />}
      </div>
    </div>
  );
}
