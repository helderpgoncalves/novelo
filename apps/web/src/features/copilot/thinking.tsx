import { useEffect, useState } from 'react';
import { BrandSpinner } from '@/components/brand-logo';
import { m } from '@/paraglide/messages';
import type { ChatMessage, StatusInfo } from './types';
import { useReducedMotion } from './use-reduced-motion';

type Family =
  | 'thinking'
  | 'planning'
  | 'data'
  | 'flows'
  | 'optimizer'
  | 'compare'
  | 'coverage'
  | 'search'
  | 'web'
  | 'attachment'
  | 'memory'
  | 'draw'
  | 'action'
  | 'report'
  | 'verify'
  | 'write'
  | 'compact'
  | 'working';

const PHRASES: Record<Family, () => string[]> = {
  thinking: () => [m.chat_think_thinking_1(), m.chat_think_thinking_2(), m.chat_think_thinking_3()],
  planning: () => [m.chat_think_planning_1(), m.chat_think_planning_2(), m.chat_think_planning_3()],
  data: () => [m.chat_think_data_1(), m.chat_think_data_2(), m.chat_think_data_3()],
  flows: () => [m.chat_think_flows_1(), m.chat_think_flows_2(), m.chat_think_flows_3()],
  optimizer: () => [
    m.chat_think_optimizer_1(),
    m.chat_think_optimizer_2(),
    m.chat_think_optimizer_3(),
  ],
  compare: () => [m.chat_think_compare_1(), m.chat_think_compare_2(), m.chat_think_compare_3()],
  coverage: () => [m.chat_think_coverage_1(), m.chat_think_coverage_2(), m.chat_think_coverage_3()],
  search: () => [m.chat_think_search_1(), m.chat_think_search_2(), m.chat_think_search_3()],
  web: () => [m.chat_think_web_1(), m.chat_think_web_2(), m.chat_think_web_3()],
  attachment: () => [
    m.chat_think_attachment_1(),
    m.chat_think_attachment_2(),
    m.chat_think_attachment_3(),
  ],
  memory: () => [m.chat_think_memory_1(), m.chat_think_memory_2(), m.chat_think_memory_3()],
  draw: () => [m.chat_think_draw_1(), m.chat_think_draw_2(), m.chat_think_draw_3()],
  action: () => [m.chat_think_action_1(), m.chat_think_action_2(), m.chat_think_action_3()],
  report: () => [m.chat_think_report_1(), m.chat_think_report_2(), m.chat_think_report_3()],
  verify: () => [m.chat_think_verify_1(), m.chat_think_verify_2(), m.chat_think_verify_3()],
  write: () => [m.chat_think_write_1(), m.chat_think_write_2(), m.chat_think_write_3()],
  compact: () => [m.chat_think_compact_1(), m.chat_think_compact_2(), m.chat_think_compact_3()],
  working: () => [m.chat_think_working_1(), m.chat_think_working_2(), m.chat_think_working_3()],
};

const FAMILY_OF: Record<string, Family> = {
  thinking: 'thinking',
  planning: 'planning',
  reading_baseline: 'data',
  listing_scenarios: 'data',
  reading_scenario: 'data',
  reading_parishes: 'data',
  reading_network: 'data',
  reading_benchmarks: 'data',
  reading_assumptions: 'data',
  reading_lots: 'data',
  reading_alerts: 'data',
  reading_ai_usage: 'data',
  reading_flows: 'flows',
  running_optimizer: 'optimizer',
  running_sensitivity: 'optimizer',
  computing_pareto: 'optimizer',
  planning_pilot: 'optimizer',
  comparing_scenarios: 'compare',
  computing_coverage: 'coverage',
  searching_data: 'search',
  searching_history: 'search',
  searching_web: 'web',
  finding_gaps: 'coverage',
  reading_reports: 'report',
  reading_admin: 'data',
  analyzing_data: 'compare',
  reading_attachment: 'attachment',
  image_unsupported: 'attachment',
  recalling_memory: 'memory',
  reviewing_memory: 'memory',
  remembering: 'memory',
  drawing: 'draw',
  preparing_action: 'action',
  preparing_navigation: 'action',
  asking: 'action',
  generating_report: 'report',
  verifying_numbers: 'verify',
  writing: 'write',
  suggesting: 'write',
  compacting: 'compact',
  working: 'working',
};

/** A família de frases de um `label_key` (`status.running_optimizer`); desconhecidos caem em "a trabalhar". */
export function familyOf(labelKey: string): Family {
  return FAMILY_OF[labelKey.replace(/^status\./, '')] ?? 'working';
}

/**
 * Fase da frase do indicador. Usa o `status` do servidor; sem ele (entre eventos) deduz: ferramenta por
 * acabar = "a consultar", texto a fluir = "a escrever", senão "a pensar". Nunca devolve "nada": o indicador
 * não desaparece enquanto a mensagem está a fazer streaming.
 */
export function indicatorLabelKey(
  message: Pick<ChatMessage, 'text' | 'tools'> & { webSearches?: ChatMessage['webSearches'] },
  status: StatusInfo | null,
): string {
  if (message.webSearches?.some((w) => w.state === 'searching')) return 'status.searching_web';
  if (status?.labelKey) return status.labelKey;
  if (message.tools.some((t) => t.ok === null)) return 'status.working';
  if (message.text.length > 0) return 'status.writing';
  return 'status.thinking';
}

const ROTATE_MS = 2600;

/** Frases temáticas (têxtil, recolha, otimização) que rodam enquanto o copiloto trabalha. */
export function ThinkingLine({
  status,
  message,
}: {
  status: StatusInfo | null;
  message?: Pick<ChatMessage, 'text' | 'tools'> & { webSearches?: ChatMessage['webSearches'] };
}) {
  const reduced = useReducedMotion();
  const family = familyOf(indicatorLabelKey(message ?? { text: '', tools: [] }, status));
  const phrases = PHRASES[family]();
  const [step, setStep] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: recomeça a rotação quando a fase muda
  useEffect(() => {
    setStep(0);
    if (reduced) return;
    const id = setInterval(() => setStep((s) => s + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, [family, reduced]);

  const phrase = phrases[step % phrases.length] ?? phrases[0] ?? '';
  // Consulta da pesquisa na web em curso (já sanitizada pelo servidor).
  const searching = message?.webSearches?.findLast((w) => w.state === 'searching');
  const lastWeb = message?.webSearches?.at(-1);
  const found =
    lastWeb?.state === 'done' && lastWeb.results > 0 && !message?.text
      ? m.chat_web_found({ count: lastWeb.results })
      : null;
  const detail = searching?.query ?? status?.detail ?? found;

  return (
    <div
      data-testid="copilot-thinking"
      className="flex h-7 min-w-0 items-center gap-2.5 text-[0.9375rem]"
    >
      <BrandSpinner />
      {/* O leitor de ecrã ouve só a fase (a primeira frase da família), não cada frase que roda. */}
      <span className="sr-only" role="status">
        {phrases[0]}
      </span>
      <span
        key={phrase}
        aria-hidden="true"
        className="min-w-0 truncate text-muted-foreground motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-500"
      >
        {phrase}
        {detail && <span className="ml-1.5 text-xs opacity-80">· {detail}</span>}
      </span>
    </div>
  );
}
