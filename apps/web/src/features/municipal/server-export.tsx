import { useMutation } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { type ExportFormat, type ExportScope, exportMunicipalSites } from '@/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';

interface Choice {
  format: ExportFormat;
  scope: ExportScope;
  label: () => string;
}

const CHOICES: Choice[] = [
  { format: 'csv', scope: 'sites', label: () => m.mun_export_csv_sites() },
  { format: 'csv', scope: 'containers', label: () => m.mun_export_csv_containers() },
  { format: 'xlsx', scope: 'sites', label: () => m.mun_export_xlsx_sites() },
  { format: 'geojson', scope: 'sites', label: () => m.mun_export_geojson_sites() },
];

/** Descarrega o ficheiro completo gerado pela API (todos os locais ou contentores, sem nomes de produtores). */
export function ServerExport() {
  const download = useMutation({
    mutationFn: async (c: Choice) => {
      const { data } = await exportMunicipalSites({
        query: { format: c.format, scope: c.scope },
        parseAs: 'blob',
        throwOnError: true,
      });
      if (!(data instanceof Blob)) throw new Error(m.mun_export_failed());
      return { blob: data, name: `rede-municipal-${c.scope}.${c.format}` };
    },
    onSuccess: ({ blob, name }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(m.mun_export_done({ name }));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-10 gap-2" loading={download.isPending}>
          <Download aria-hidden="true" />
          {m.mun_export_full()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {CHOICES.map((c) => (
          <DropdownMenuItem
            key={`${c.scope}-${c.format}`}
            className="min-h-10"
            onSelect={() => download.mutate(c)}
          >
            {c.label()}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
