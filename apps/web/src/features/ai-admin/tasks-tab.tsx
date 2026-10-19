import { Cpu, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { AiSettingsOut, TaskConfigOut } from '@/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';
import {
  type ConfigurableTask,
  capabilityLabel,
  effortLabel,
  TASKS,
  taskDescription,
  taskLabel,
} from './ai';
import { ModelPicker } from './model-picker';
import { SourceBadge } from './source-badge';

export function TasksTab({ settings }: { settings: AiSettingsOut }) {
  const [editing, setEditing] = useState<TaskConfigOut | null>(null);
  const byTask = new Map(settings.tasks.map((t) => [t.task, t]));

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TASKS.map((task) => {
          const config = byTask.get(task);
          return config ? (
            <TaskCard key={task} task={task} config={config} onEdit={() => setEditing(config)} />
          ) : null;
        })}
      </div>
      {editing && (
        <ModelPicker
          key={editing.task}
          settings={settings}
          config={editing}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      )}
    </>
  );
}

function TaskCard({
  task,
  config,
  onEdit,
}: {
  task: ConfigurableTask;
  config: TaskConfigOut;
  onEdit: () => void;
}) {
  const e = config.effective;
  const isRecommended = e.model === config.recommended_model;
  return (
    <article
      data-testid={`ai-task-${task}`}
      className="flex flex-col gap-5 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
    >
      <header className="space-y-1">
        <h3 className="font-semibold text-base">{taskLabel[task]()}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{taskDescription[task]()}</p>
      </header>

      <div className="space-y-2">
        <p className="eyebrow">{m.aiadm_card_model()}</p>
        <p className="flex items-start gap-2 break-all font-mono text-sm">
          <Cpu className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {e.model}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <SourceBadge source={e.model_source} />
          {isRecommended && (
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="size-3" aria-hidden="true" />
              {m.aiadm_recommended()}
            </Badge>
          )}
        </div>
      </div>

      <dl className="divide-y divide-border rounded-lg bg-muted/40 px-4 text-sm">
        <Row label={m.aiadm_card_fallback()} source={e.fallback_source}>
          <span className="break-all font-mono text-xs">{e.fallback_model ?? m.aiadm_none()}</span>
        </Row>
        <Row label={m.aiadm_card_tokens()} source={e.max_tokens_source}>
          {formatNumber(e.max_output_tokens)}
        </Row>
        <Row label={m.aiadm_card_effort()} source={e.reasoning_source}>
          {effortLabel[e.reasoning_effort]()}
        </Row>
      </dl>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-1.5" aria-label={m.aiadm_card_requirements()}>
          {config.requirements.map((r) => (
            <li key={r}>
              <Badge variant="outline">{capabilityLabel(r)}</Badge>
            </li>
          ))}
        </ul>
        <Button variant="outline" className="h-10" onClick={onEdit}>
          {m.aiadm_change()}
          <span className="sr-only"> — {taskLabel[task]()}</span>
        </Button>
      </div>
    </article>
  );
}

function Row({
  label,
  source,
  children,
}: {
  label: string;
  source: TaskConfigOut['effective']['model_source'];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 font-medium">
        {children}
        <SourceBadge source={source} />
      </dd>
    </div>
  );
}
