import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { toast } from 'sonner';
import type { ArtifactOut } from '@/client';
import {
  deleteCopilotArtifactMutation,
  listCopilotArtifactsInfiniteOptions,
  refreshCopilotArtifactMutation,
} from '@/client/@tanstack/react-query.gen';
import { EmptyState, ErrorState } from '@/components/states';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { getErrorMessage } from '@/lib/errors';
import { getLocale } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { ArtifactView } from './artifacts/artifact-view';
import { invalidateCopilot } from './cache';

const TYPES = [
  'chart',
  'table',
  'map',
  'kpis',
  'comparison',
  'timeline',
  'scenario_card',
  'report',
] as const;
const typeLabel: Record<(typeof TYPES)[number], () => string> = {
  chart: () => m.chat_artifact_chart(),
  table: () => m.chat_artifact_table(),
  map: () => m.chat_artifact_map(),
  kpis: () => m.chat_artifact_kpis(),
  comparison: () => m.chat_artifact_comparison(),
  timeline: () => m.chat_artifact_timeline(),
  scenario_card: () => m.chat_artifact_scenario(),
  report: () => m.chat_artifact_report(),
};

function GalleryItem({
  artifact,
  onOpenThread,
}: {
  artifact: ArtifactOut;
  onOpenThread: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const refresh = useMutation({
    ...refreshCopilotArtifactMutation(),
    onSuccess: () => {
      void invalidateCopilot(qc, /Artifact/);
      toast.success(m.chat_artifact_refreshed());
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const remove = useMutation({
    ...deleteCopilotArtifactMutation(),
    onSuccess: () => {
      setConfirmDelete(false);
      void invalidateCopilot(qc, /Artifact|History/);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  return (
    <li className="min-w-0 space-y-2" data-testid="copilot-gallery-item">
      <ArtifactView
        key={`${artifact.id}-${artifact.refreshed_at}`}
        artifact={artifact}
        initialPinned={artifact.pinned}
        toolbar={
          <>
            {artifact.refreshable && (
              <Button
                variant="ghost"
                size="icon"
                className="-mt-1 size-10 sm:size-8"
                aria-label={m.chat_artifact_refresh()}
                loading={refresh.isPending}
                onClick={() =>
                  refresh.mutate({
                    path: { artifact_id: artifact.id },
                    query: { locale: getLocale() },
                  })
                }
              >
                {!refresh.isPending && <RefreshCw className="size-4" aria-hidden="true" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="-mt-1 -mr-1 size-10 sm:size-8"
              aria-label={m.chat_artifact_delete()}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </>
        }
      />
      {artifact.thread_id && (
        <Button
          variant="link"
          className="h-9 gap-1.5 px-1"
          onClick={() => onOpenThread(artifact.thread_id as string)}
        >
          <MessageSquare className="size-3.5" aria-hidden="true" />
          {m.chat_open_conversation()}
        </Button>
      )}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.chat_artifact_delete_title()}</AlertDialogTitle>
            <AlertDialogDescription>{artifact.title}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10">{m.common_cancel()}</AlertDialogCancel>
            <Button
              variant="destructive"
              className="h-10"
              loading={remove.isPending}
              onClick={() => remove.mutate({ path: { artifact_id: artifact.id } })}
            >
              {m.chat_delete()}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

/** Galeria de artefactos: gráficos, tabelas e mapas que o copiloto desenhou, para fixar, atualizar ou apagar. */
export function GalleryTab({ onOpenThread }: { onOpenThread: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [type, setType] = useState('');
  const [pinned, setPinned] = useState(false);
  const artifacts = useInfiniteQuery({
    ...listCopilotArtifactsInfiniteOptions({
      query: {
        q: q || undefined,
        artifact_type: type || undefined,
        pinned: pinned || undefined,
        limit: 10,
      },
    }),
    // Um objeto vazio (não `null`): o cliente gerado trata `null` como um objeto de parâmetros.
    initialPageParam: {},
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const items = artifacts.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-4" data-testid="copilot-gallery">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
        <div className="relative">
          <Search
            className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={m.chat_search_artifacts()}
            aria-label={m.chat_search_artifacts()}
            className="h-11 pl-9 text-base md:text-base"
          />
        </div>
        <select
          aria-label={m.chat_artifact_type()}
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-11 rounded-md border border-input bg-transparent px-2 text-base md:text-sm dark:bg-input/30"
        >
          <option value="">{m.chat_all_types()}</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {typeLabel[t]()}
            </option>
          ))}
        </select>
        <div className="flex min-h-11 items-center gap-2 text-sm">
          <Switch id="gallery-pinned" checked={pinned} onCheckedChange={setPinned} />
          <label htmlFor="gallery-pinned">{m.chat_only_pinned()}</label>
        </div>
      </div>

      {artifacts.isPending ? (
        <p role="status" className="py-10 text-center text-muted-foreground text-sm">
          {m.chat_loading_artifacts()}
        </p>
      ) : artifacts.error ? (
        <ErrorState error={artifacts.error} onRetry={() => void artifacts.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={m.chat_artifacts_empty()} description={m.chat_artifacts_empty_hint()} />
      ) : (
        <>
          <ul className="grid gap-4 xl:grid-cols-2">
            {items.map((a) => (
              <GalleryItem key={a.id} artifact={a} onOpenThread={onOpenThread} />
            ))}
          </ul>
          {artifacts.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                className="h-11"
                loading={artifacts.isFetchingNextPage}
                onClick={() => void artifacts.fetchNextPage()}
              >
                {m.chat_load_more()}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
