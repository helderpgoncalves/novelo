import { ClipboardCopy, Download, FileJson, FileSpreadsheet, FileText } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';
import type { ExportFormat, ExportPrefs } from './export';

interface Props {
  prefs: ExportPrefs;
  onPrefs: (prefs: ExportPrefs) => void;
  counts: { filtered: number; all: number; selected: number };
  onExport: (format: ExportFormat, prefs: ExportPrefs) => void;
  /** Exporta só a seleção, sem opções de âmbito (barra de seleção). */
  selectionOnly?: boolean;
  trigger?: ReactNode;
  align?: 'start' | 'end';
}

export function ExportMenu({
  prefs,
  onPrefs,
  counts,
  onExport,
  selectionOnly,
  trigger,
  align = 'end',
}: Props) {
  const effective: ExportPrefs = selectionOnly ? { ...prefs, scope: 'selected' } : prefs;
  const run = (format: ExportFormat) => onExport(format, effective);
  const patch = (next: Partial<ExportPrefs>) => onPrefs({ ...prefs, ...next });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            className="h-10 gap-2"
            data-testid="dt-export"
            aria-label={m.dt_export()}
            title={m.dt_export()}
          >
            <Download />
            <span className="dt-label hidden lg:inline">{m.dt_export()}</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="max-h-[min(34rem,var(--radix-dropdown-menu-content-available-height))] min-w-64 overflow-y-auto"
      >
        <DropdownMenuItem onSelect={() => run('csv')} className="min-h-10">
          <FileText /> {m.dt_export_csv()}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run('xlsx')} className="min-h-10">
          <FileSpreadsheet /> {m.dt_export_xlsx()}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run('json')} className="min-h-10">
          <FileJson /> {m.dt_export_json()}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run('clipboard')} className="min-h-10">
          <ClipboardCopy /> {m.dt_export_copy()}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {!selectionOnly && (
          <>
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              {m.dt_export_scope()}
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={prefs.scope}
              onValueChange={(v) => patch({ scope: v as ExportPrefs['scope'] })}
            >
              <DropdownMenuRadioItem value="filtered" onSelect={(e) => e.preventDefault()}>
                {m.dt_export_scope_filtered({ n: formatNumber(counts.filtered) })}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="all" onSelect={(e) => e.preventDefault()}>
                {m.dt_export_scope_all({ n: formatNumber(counts.all) })}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                value="selected"
                disabled={counts.selected === 0}
                onSelect={(e) => e.preventDefault()}
              >
                {m.dt_export_scope_selected({ n: formatNumber(counts.selected) })}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          {m.dt_export_columns()}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={prefs.columns}
          onValueChange={(v) => patch({ columns: v as ExportPrefs['columns'] })}
        >
          <DropdownMenuRadioItem value="visible" onSelect={(e) => e.preventDefault()}>
            {m.dt_export_columns_visible()}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="all" onSelect={(e) => e.preventDefault()}>
            {m.dt_export_columns_all()}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          {m.dt_export_values()}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={prefs.raw ? 'raw' : 'formatted'}
          onValueChange={(v) => patch({ raw: v === 'raw' })}
        >
          <DropdownMenuRadioItem value="formatted" onSelect={(e) => e.preventDefault()}>
            {m.dt_export_values_formatted()}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="raw" onSelect={(e) => e.preventDefault()}>
            {m.dt_export_values_raw()}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          {m.dt_export_delimiter()}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={prefs.delimiter}
          onValueChange={(v) => patch({ delimiter: v as ExportPrefs['delimiter'] })}
        >
          <DropdownMenuRadioItem value=";" onSelect={(e) => e.preventDefault()}>
            {m.dt_export_delimiter_semicolon()}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="," onSelect={(e) => e.preventDefault()}>
            {m.dt_export_delimiter_comma()}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
