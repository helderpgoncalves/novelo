import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  Download,
  FileDown,
  FolderInput,
  Link2,
  Link2Off,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Search,
  SquarePen,
  Trash2,
  Users,
} from 'lucide-react';
import { useDeferredValue, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { exportCopilotThread, exportCopilotThreadPdf, type ThreadSummaryOut } from '@/client';
import {
  deleteCopilotThreadMutation,
  listCopilotProjectsOptions,
  listCopilotThreadsOptions,
  shareCopilotThreadMutation,
  unshareCopilotThreadMutation,
  updateCopilotThreadMutation,
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { invalidateCopilot } from './cache';
import { downloadBlob, downloadText } from './download';
import { plainText as plain } from './markdown';
import { groupLabel, groupThreads } from './thread-groups';

type Dialogs =
  | { kind: 'rename'; thread: ThreadSummaryOut }
  | { kind: 'project'; thread: ThreadSummaryOut }
  | { kind: 'delete'; thread: ThreadSummaryOut }
  | { kind: 'share'; thread: ThreadSummaryOut; url: string }
  | null;

const PAGE = 30;

function NameDialog({
  title,
  label,
  initial,
  listId,
  suggestions,
  allowEmpty,
  onSubmit,
  onClose,
  pending,
}: {
  title: string;
  label: string;
  initial: string;
  listId?: string;
  suggestions?: string[];
  allowEmpty?: boolean;
  onSubmit: (value: string) => void;
  onClose: () => void;
  pending: boolean;
}) {
  const [value, setValue] = useState(initial);
  const id = useId();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim() || allowEmpty) onSubmit(value.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">{label}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor={id} className="font-medium text-sm">
              {label}
            </label>
            <Input
              id={id}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              list={listId}
              maxLength={80}
              autoFocus
              className="h-11 text-base md:text-base"
            />
            {listId && (
              <datalist id={listId}>
                {suggestions?.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="h-10" onClick={onClose}>
              {m.common_cancel()}
            </Button>
            <Button
              type="submit"
              className="h-10"
              loading={pending}
              disabled={!value.trim() && !allowEmpty}
            >
              {m.common_save()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Lista de conversas: pesquisa, projetos, arquivo, fixar, renomear, exportar, partilhar e apagar. */
export function ThreadList({
  selectedId,
  onSelect,
  onNew,
  onGone,
  className,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** A conversa deixou de existir (apagada): a página decide o que mostrar. */
  onGone: (id: string) => void;
  className?: string;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [archived, setArchived] = useState(false);
  const [project, setProject] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [dialog, setDialog] = useState<Dialogs>(null);
  const projects = useQuery(listCopilotProjectsOptions());
  const threads = useQuery({
    ...listCopilotThreadsOptions({
      query: { q: q || undefined, archived, project: project || undefined, limit, offset: 0 },
    }),
    placeholderData: (prev) => prev,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: nova pesquisa volta à primeira página
  useEffect(() => setLimit(PAGE), [q, archived, project]);

  const after = (message?: string) => {
    void invalidateCopilot(qc);
    if (message) toast.success(message);
  };
  const fail = (e: unknown) => toast.error(getErrorMessage(e));
  const update = useMutation({
    ...updateCopilotThreadMutation(),
    onSuccess: () => {
      setDialog(null);
      after();
    },
    onError: fail,
  });
  const remove = useMutation({
    ...deleteCopilotThreadMutation(),
    onSuccess: (_d, vars) => {
      setDialog(null);
      after(m.chat_thread_deleted());
      onGone(vars.path.thread_id);
    },
    onError: fail,
  });
  const share = useMutation({
    ...shareCopilotThreadMutation(),
    onSuccess: (res, vars) => {
      const thread = threads.data?.items.find((t) => t.id === vars.path.thread_id);
      if (thread) setDialog({ kind: 'share', thread, url: `${window.location.origin}${res.path}` });
      after();
    },
    onError: fail,
  });
  const unshare = useMutation({
    ...unshareCopilotThreadMutation(),
    onSuccess: () => {
      setDialog(null);
      after(m.chat_share_stopped());
    },
    onError: fail,
  });

  const patch = (t: ThreadSummaryOut, body: Parameters<typeof update.mutate>[0]['body']) =>
    update.mutate({ path: { thread_id: t.id }, body });

  const exportMd = async (t: ThreadSummaryOut) => {
    try {
      const { data } = await exportCopilotThread({ path: { thread_id: t.id }, throwOnError: true });
      downloadText(data.filename, data.markdown);
    } catch (e) {
      fail(e);
    }
  };
  const exportPdf = async (t: ThreadSummaryOut) => {
    try {
      const { data } = await exportCopilotThreadPdf({
        path: { thread_id: t.id },
        parseAs: 'blob',
        throwOnError: true,
      });
      downloadBlob(`${t.title || 'novelo-chat'}.pdf`, data as Blob);
    } catch (e) {
      fail(e);
    }
  };

  const items = [...(threads.data?.items ?? [])].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned),
  );
  const total = threads.data?.total ?? 0;

  return (
    <div className={cn('flex min-h-0 flex-col', className)} data-testid="copilot-thread-list">
      <div className="space-y-2 border-b px-3 pt-3 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3.5 size-4 text-muted-foreground"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={m.chat_search_threads()}
              aria-label={m.chat_search_threads()}
              className="h-11 rounded-full bg-muted/40 pl-10 text-base shadow-none md:text-base"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="size-11 shrink-0 rounded-full"
            onClick={onNew}
            aria-label={m.chat_new()}
            title={m.chat_new()}
          >
            <SquarePen className="size-[1.125rem]" strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-muted-foreground text-xs">
          {(projects.data?.length ?? 0) > 0 && (
            <select
              aria-label={m.chat_project_filter()}
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className="h-10 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-base md:text-sm dark:bg-input/30"
            >
              <option value="">{m.chat_all_projects()}</option>
              {projects.data?.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} ({p.threads})
                </option>
              ))}
            </select>
          )}
          <div className="ml-auto flex min-h-10 items-center gap-2 text-sm">
            <Switch id="threads-archived" checked={archived} onCheckedChange={setArchived} />
            <label htmlFor="threads-archived">{m.chat_archived()}</label>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {threads.isPending ? (
          <p role="status" className="p-6 text-center text-muted-foreground text-sm">
            {m.chat_loading_threads()}
          </p>
        ) : threads.error ? (
          <div className="p-3">
            <ErrorState error={threads.error} onRetry={() => void threads.refetch()} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-3">
            <EmptyState
              title={
                q ? m.chat_no_results() : archived ? m.chat_no_archived() : m.chat_no_threads()
              }
              description={q || archived ? undefined : m.chat_no_threads_hint()}
            />
          </div>
        ) : (
          <div>
            {groupThreads(items).map((g) => (
              <section key={g.key} aria-label={groupLabel[g.key]()}>
                <h3 className="px-4 pt-4 pb-1.5 font-semibold text-[0.6875rem] text-muted-foreground uppercase tracking-[0.16em]">
                  {groupLabel[g.key]()}
                </h3>
                <ul className="divide-y divide-border/60 border-border/60 border-y">
                  {g.items.map((t) => (
                    <li key={t.id} className="relative" data-testid="copilot-thread-item">
                      <button
                        type="button"
                        onClick={() => onSelect(t.id)}
                        aria-current={t.id === selectedId ? 'true' : undefined}
                        className={cn(
                          'flex min-h-14 w-full flex-col items-start justify-center gap-0.5 border-transparent border-l-2 px-4 py-2 pr-14 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2',
                          t.id === selectedId && 'border-primary bg-muted/60',
                        )}
                      >
                        <span className="flex w-full items-center gap-1.5">
                          {t.pinned && (
                            <Pin
                              className="size-3 shrink-0 text-primary"
                              aria-label={m.chat_pinned()}
                            />
                          )}
                          <span className="truncate font-medium text-[0.9375rem]">
                            {t.title || m.chat_untitled()}
                          </span>
                        </span>
                        {t.snippet && (
                          <span className="line-clamp-1 w-full text-muted-foreground text-xs">
                            {plain(t.snippet)}
                          </span>
                        )}
                        <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs tabular-nums">
                          {formatDateTime(t.updated_at)}
                          {t.project && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                              {t.project}
                            </Badge>
                          )}
                          {t.shared && <Users className="size-3" aria-label={m.chat_shared()} />}
                        </span>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-1.5 right-1 size-11"
                            aria-label={m.chat_thread_menu({ title: t.title || m.chat_untitled() })}
                          >
                            <MoreVertical className="size-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem
                            className="min-h-10"
                            onSelect={() => patch(t, { pinned: !t.pinned })}
                          >
                            {t.pinned ? <PinOff /> : <Pin />}
                            {t.pinned ? m.chat_unpin() : m.chat_pin()}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="min-h-10"
                            onSelect={() => setDialog({ kind: 'rename', thread: t })}
                          >
                            <Pencil />
                            {m.chat_rename()}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="min-h-10"
                            onSelect={() => setDialog({ kind: 'project', thread: t })}
                          >
                            <FolderInput />
                            {m.chat_move_project()}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="min-h-10"
                            onSelect={() => patch(t, { archived: !t.archived })}
                          >
                            {t.archived ? <ArchiveRestore /> : <Archive />}
                            {t.archived ? m.chat_unarchive() : m.chat_archive()}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="min-h-10" onSelect={() => void exportMd(t)}>
                            <Download />
                            {m.chat_export_md()}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="min-h-10" onSelect={() => void exportPdf(t)}>
                            <FileDown />
                            {m.chat_export_pdf()}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="min-h-10"
                            onSelect={() => share.mutate({ path: { thread_id: t.id } })}
                          >
                            <Link2 />
                            {m.chat_share()}
                          </DropdownMenuItem>
                          {t.shared && (
                            <DropdownMenuItem
                              className="min-h-10"
                              onSelect={() => unshare.mutate({ path: { thread_id: t.id } })}
                            >
                              <Link2Off />
                              {m.chat_unshare()}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="min-h-10"
                            variant="destructive"
                            onSelect={() => setDialog({ kind: 'delete', thread: t })}
                          >
                            <Trash2 />
                            {m.chat_delete()}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        {items.length > 0 && items.length < total && (
          <div className="p-3">
            <Button
              variant="outline"
              className="h-10 w-full"
              onClick={() => setLimit((l) => l + PAGE)}
            >
              {m.chat_load_more()}
            </Button>
          </div>
        )}
      </div>

      {dialog?.kind === 'rename' && (
        <NameDialog
          title={m.chat_rename()}
          label={m.chat_title_label()}
          initial={dialog.thread.title}
          pending={update.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(title) => patch(dialog.thread, { title })}
        />
      )}
      {dialog?.kind === 'project' && (
        <NameDialog
          title={m.chat_move_project()}
          label={m.chat_project_label()}
          initial={dialog.thread.project}
          listId="copilot-projects"
          suggestions={projects.data?.map((p) => p.name)}
          allowEmpty
          pending={update.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(project) => patch(dialog.thread, { project })}
        />
      )}
      {dialog?.kind === 'share' && (
        <Dialog open onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{m.chat_share_title()}</DialogTitle>
              <DialogDescription>{m.chat_share_description()}</DialogDescription>
            </DialogHeader>
            <Input
              readOnly
              value={dialog.url}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={m.chat_share_link()}
              className="h-11 text-base md:text-base"
            />
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                className="h-10"
                onClick={() => unshare.mutate({ path: { thread_id: dialog.thread.id } })}
              >
                {m.chat_unshare()}
              </Button>
              <Button
                className="h-10"
                onClick={() => {
                  void navigator.clipboard.writeText(dialog.url);
                  toast.success(m.chat_link_copied());
                }}
              >
                {m.chat_copy_link()}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {dialog?.kind === 'delete' && (
        <AlertDialog open onOpenChange={(o) => !o && setDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{m.chat_delete_title()}</AlertDialogTitle>
              <AlertDialogDescription>
                {m.chat_delete_description({ title: dialog.thread.title || m.chat_untitled() })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-10">{m.common_cancel()}</AlertDialogCancel>
              <Button
                variant="destructive"
                className="h-10"
                loading={remove.isPending}
                onClick={() => remove.mutate({ path: { thread_id: dialog.thread.id } })}
              >
                {m.chat_delete()}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
