import type { ExportLotState, TriageProvenance } from '@/client';
import { Badge } from '@/components/ui/badge';
import { AttributeSeal } from '@/features/triage/attribute-seal';
import { m } from '@/paraglide/messages';

/** Estado do lote de escoamento: aberto (a juntar peças) ou selado (seguiram para o mercado). */
export function ExportStateBadge({ state }: { state: ExportLotState }) {
  return (
    <Badge variant={state === 'open' ? 'secondary' : 'outline'}>
      {state === 'open' ? m.export_state_open() : m.export_state_closed()}
    </Badge>
  );
}

/** Os selos «Confirmado»/«IA» da triagem de uma peça (um por eixo com proveniência registada). */
export function ProvenanceSeals({ provenance }: { provenance: TriageProvenance }) {
  const sources = [
    provenance.fine_state,
    provenance.garment_type,
    provenance.season,
    provenance.colour,
    provenance.gender,
    provenance.size_band,
  ].filter((s) => s !== null && s !== undefined);
  return (
    <span className="flex flex-wrap gap-1">
      {sources.map((s) => (
        <AttributeSeal
          key={`${s.origin}-${s.confidence}`}
          origin={s.origin}
          confidence={s.confidence}
        />
      ))}
    </span>
  );
}

/** Resumo textual da proveniência (para pesquisa e exportação da tabela). */
export function provenanceSummary(provenance: TriageProvenance): string {
  const sources = [
    provenance.fine_state,
    provenance.garment_type,
    provenance.season,
    provenance.colour,
    provenance.gender,
    provenance.size_band,
  ].filter((s) => s !== null && s !== undefined);
  const confirmed = sources.filter((s) => s.origin === 'confirmed').length;
  return `${confirmed}/${sources.length}`;
}
