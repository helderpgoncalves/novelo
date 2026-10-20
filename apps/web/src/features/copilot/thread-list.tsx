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
  SlidersHorizontal,
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { invalidateCopilot } from './cache';
import { downloadBlob, downloadText } from './download';
import { useGeneratingThreadIds, useUnreadThreadIds } from './generation';
import { plainText as plain } from './markdown';
import { dateGroup, groupLabel, groupThreads, threadTime } from './thread-groups';

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

/** Três pontos a saltar: a conversa está a gerar uma resposta (parados com movimento reduzido). */
export function GeneratingDots() {
  return (
    <span role="img" aria-label={m.cp_generating()} className="flex shrink-0 items-center gap-0.5">
      {[0, 1, 2].map((n) => (
        <span
          key={n}
          aria-hidden="true"
          style={{ animationDelay: `${n * 150}ms` }}
          className="size-1.5 animate-bounce rounded-full bg-primary motion-reduce:animate-none"
        />
      ))}
    </span>
  );
}

/** Lista de conversas: pesquisa, projetos, arquivo, fixar, renomear, exportar, partilhar e apagar. */
export function ThreadList({
  selectedId,
  onSelect,
  onNew,
  onGone,
  heading,
  headingClassName,
  className,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** A conversa deixou de existir (apagada): a página decide o que mostrar. */
  onGone: (id: string) => void;
  /** Mostra «Conversas» à esquerda do botão «Nova conversa» (a coluna do desktop e a folha). */
  heading?: boolean;
  headingClassName?: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [archived, setArchived] = useState(false);
  const [project, setProject] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [dialog, setDialog] = useState<Dialogs>(null);
  const generating = useGeneratingThreadIds();
  const unread = useUnreadThreadIds();
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
  const filtering = archived || project !== '';

  return (
    <div className={cn('flex min-h-0 flex-col', className)} data-testid="copilot-thread-list">
      <div className={cn('flex h-12 shrink-0 items-center gap-2 px-3', headingClassName)}>
        {heading && (
          <h2 className="min-w-0 flex-1 truncate px-1 font-medium font-serif text-[1.0625rem] tracking-tight">
            {m.chat_threads()}
          </h2>
        )}
        <Button
          className={cn('h-10 gap-1.5 rounded-lg px-3 md:h-9', !heading && 'w-full')}
          onClick={onNew}
        >
          <SquarePen className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {m.chat_new()}
        </Button>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 px-3 pt-1 pb-2.5">
        <div className="relative min-w-0 flex-1">
          <Search
            className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={m.chat_search_threads()}
            aria-label={m.chat_search_threads()}
            className="h-11 rounded-lg border-transparent bg-muted/60 pl-9 text-base shadow-none md:h-9 md:text-sm"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'relative size-11 shrink-0 rounded-lg text-muted-foreground md:size-9',
                filtering && 'text-primary',
              )}
              aria-label={m.chat_filters()}
            >
              <SlidersHorizontal className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {filtering && (
                <span
                  role="img"
                  aria-label={m.chat_filters_active()}
                  className="absolute top-2 right-2 size-1.5 rounded-full bg-primary md:top-1.5 md:right-1.5"
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3">
            <div className="flex min-h-10 items-center justify-between gap-3">
              <label htmlFor="threads-archived" className="font-medium">
                {m.chat_archived()}
              </label>
              <Switch id="threads-archived" checked={archived} onCheckedChange={setArchived} />
            </div>
            {(projects.data?.length ?? 0) > 0 && (
              <select
                aria-label={m.chat_project_filter()}
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-2 text-base md:h-10 md:text-sm"
              >
                <option value="">{m.chat_all_projects()}</option>
                {projects.data?.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.threads})
                  </option>
                ))}
              </select>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {threads.isPending ? (
          <div role="status" aria-label={m.chat_loading_threads()} className="space-y-px px-2 py-1">
            <span className="sr-only">{m.chat_loading_threads()}</span>
            {[0, 1, 2, 3, 4].map((n) => (
              <div key={n} aria-hidden="true" className="space-y-2 px-3 py-3">
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
              </div>
            ))}
          </div>
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
          <div className="pb-3">
            {groupThreads(items).map((g) => (
              <section key={g.key} aria-label={groupLabel[g.key]()}>
                <h3 className="px-5 pt-4 pb-1.5 font-semibold font-sans text-[0.6875rem] text-muted-foreground uppercase tracking-[0.14em]">
                  {groupLabel[g.key]()}
                </h3>
                <ul className="space-y-0.5 px-2">
                  {g.items.map((t) => {
                    const busy = generating.has(t.id);
                    const fresh = !busy && unread.has(t.id);
                    return (
                      <li key={t.id} className="relative" data-testid="copilot-thread-item">
                        <button
                          type="button"
                          onClick={() => onSelect(t.id)}
                          aria-current={t.id === selectedId ? 'true' : undefined}
                          className={cn(
                            'flex min-h-14 w-full flex-col items-start justify-center gap-0.5 rounded-lg px-3 py-2 pr-11 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2',
                            t.id === selectedId && 'bg-primary/10 hover:bg-primary/10',
                          )}
                        >
                          <span className="flex w-full items-center gap-2">
                            {t.pinned && (
                              <Pin
                                className="size-3 shrink-0 text-primary"
                                aria-label={m.chat_pinned()}
                              />
                            )}
                            <span className="min-w-0 flex-1 truncate font-medium text-[0.9375rem] leading-snug">
                              {t.title || m.chat_untitled()}
                            </span>
                            {busy ? (
                              <GeneratingDots />
                            ) : (
                              <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs tabular-nums">
                                {fresh && (
                                  <span
                                    role="img"
                                    aria-label={m.cp_unread()}
                                    className="size-2 rounded-full bg-primary"
                                  />
                                )}
                                <time dateTime={t.updated_at}>
                                  {threadTime(
                                    t.updated_at,
                                    g.key === 'pinned' ? dateGroup(t.updated_at) : g.key,
                                  )}
                                </time>
                              </span>
                            )}
                          </span>
                          {t.snippet && (
                            <span className="line-clamp-1 w-full text-muted-foreground text-xs leading-snug">
                              {plain(t.snippet)}
                            </span>
                          )}
                          {(t.project || t.shared) && (
                            <span className="flex flex-wrap items-center gap-1.5 pt-0.5 text-muted-foreground text-xs">
                              {t.project && (
                                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                  {t.project}
                                </Badge>
                              )}
                              {t.shared && (
                                <Users className="size-3" aria-label={m.chat_shared()} />
                              )}
                            </span>
                          )}
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="-translate-y-1/2 absolute top-1/2 right-1 size-10 text-muted-foreground md:size-8"
                              aria-label={m.chat_thread_menu({
                                title: t.title || m.chat_untitled(),
                              })}
                            >
                              <MoreVertical
                                className="size-4"
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
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
                            <DropdownMenuItem
                              className="min-h-10"
                              onSelect={() => void exportMd(t)}
                            >
                              <Download />
                              {m.chat_export_md()}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="min-h-10"
                              onSelect={() => void exportPdf(t)}
                            >
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
                    );
                  })}
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
