import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowUp,
  AtSign,
  FileText,
  Monitor,
  Paperclip,
  Plus,
  Slash,
  Square,
  X,
} from 'lucide-react';
import {
  type ComponentRef,
  forwardRef,
  type KeyboardEvent,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import type { AttachmentOut, MentionType, PageContext } from '@/client';
import {
  listCopilotCommandsOptions,
  searchCopilotMentionsOptions,
  uploadCopilotAttachmentsMutation,
} from '@/client/@tanstack/react-query.gen';
import { BrandSpinner } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getErrorMessage } from '@/lib/errors';
import { getLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { commandDescription, commandLabel, mentionTypeLabel } from './labels';
import { MentionIcon } from './mention-chip';
import {
  findMentionSpans,
  mentionDeletion,
  pruneMentions,
  type ResolvedMention,
  segmentText,
  snapSelection,
  stepIndex,
} from './mentions';
import {
  ACCEPTED_FILES,
  applyTrigger,
  findTrigger,
  MAX_FILE_BYTES,
  MAX_FILES,
  type Trigger,
} from './triggers';
import type { SendInput } from './use-chat';

export interface ComposerHandle {
  addFiles: (files: File[]) => void;
  focus: () => void;
  setText: (text: string) => void;
}

interface Pending {
  key: string;
  file: File;
  preview: string | null;
  status: 'uploading' | 'ready' | 'error';
  result?: AttachmentOut;
}

interface Option {
  id: string;
  label: string;
  hint?: string;
  group?: string;
  /** Tipo da entidade (menções); sem tipo é um comando. */
  type?: MentionType;
  onPick: () => void;
}

/** O item ativo (teclado ou rato) leva fundo suave e uma barra de marca: nunca só uma mudança de cor. */
const ACTIVE_ROW =
  'relative before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary before:opacity-0 aria-selected:bg-primary/10 aria-selected:before:opacity-100 focus:bg-primary/10 focus:before:opacity-100';

/** Apaga um intervalo pelo caminho nativo (mantém o desfazer do browser); sem `execCommand`, muda o estado. */
function deleteRange(
  el: HTMLTextAreaElement,
  start: number,
  end: number,
  fallback: (next: string, caret: number) => void,
) {
  el.focus();
  el.setSelectionRange(start, end);
  let done = false;
  try {
    done = typeof document.execCommand === 'function' && document.execCommand('delete');
  } catch {
    done = false;
  }
  if (!done) fallback(el.value.slice(0, start) + el.value.slice(end), start);
}

interface Props {
  busy: boolean;
  onSend: (input: SendInput) => void;
  onStop: () => void;
  /** Comando `/...`: devolve `true` se foi tratado. */
  onCommand: (name: string) => void;
  getPageContext: () => PageContext | null;
  /** Nome legível do ecrã atual; `null` se não há ecrã para partilhar (a página /chat). */
  pageLabel: string | null;
  /** O copiloto está a ver o ecrã atual (vai com a pergunta). */
  contextOn: boolean;
  onContextChange: (on: boolean) => void;
  compact?: boolean;
  autoFocus?: boolean;
}

let uid = 0;

/** Campo de mensagem flutuante: texto que cresce, anexos, `@` menções, `/` comandos e o ecrã atual, tudo dentro do campo. */
export const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  {
    busy,
    onSend,
    onStop,
    onCommand,
    getPageContext,
    pageLabel,
    contextOn,
    onContextChange,
    autoFocus,
  },
  ref,
) {
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  const [files, setFiles] = useState<Pending[]>([]);
  const [mentions, setMentions] = useState<ResolvedMention[]>([]);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const menuContent = useRef<ComponentRef<typeof DropdownMenuContent>>(null);
  const composing = useRef(false);
  const prevCaret = useRef<number | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const listId = useId();
  const screen = contextOn && pageLabel !== null;
  const upload = useMutation(uploadCopilotAttachmentsMutation());

  const spans = useMemo(() => findMentionSpans(text, mentions), [text, mentions]);
  const segments = useMemo(() => segmentText(text, mentions), [text, mentions]);
  const hasChips = spans.length > 0;
  const trigger: Trigger | null = useMemo(() => {
    const found = findTrigger(text, caret);
    // `@Azurém` já escolhida é uma unidade: com o cursor a seguir não volta a abrir a lista.
    if (found?.kind === 'mention' && spans.some((x) => x.start === found.start)) return null;
    return found;
  }, [text, caret, spans]);
  const open = trigger !== null && dismissed !== text && !menuOpen;
  const mentionQuery = useDeferredValue(trigger?.kind === 'mention' ? trigger.query : '');

  const mentionResults = useQuery({
    ...searchCopilotMentionsOptions({ query: { q: mentionQuery, limit: 8, locale: getLocale() } }),
    enabled: open && trigger?.kind === 'mention',
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const commands = useQuery({
    ...listCopilotCommandsOptions(),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const setTextAndCaret = useCallback((next: string, position: number) => {
    setText(next);
    setCaret(position);
    pendingCaret.current = position;
  }, []);

  const options: Option[] = useMemo(() => {
    if (!open || !trigger) return [];
    if (trigger.kind === 'command') {
      return (commands.data?.commands ?? [])
        .filter((c) => c.name.slice(1).startsWith(trigger.query.toLowerCase()))
        .map((c) => ({
          id: `cmd-${c.name}`,
          label: c.name,
          hint: `${commandLabel(c.label_key)} · ${commandDescription(c.description_key)}`,
          onPick: () => {
            setTextAndCaret('', 0);
            onCommand(c.name);
          },
        }));
    }
    return (mentionResults.data?.groups ?? []).flatMap((g) =>
      g.items.map((it) => ({
        id: `mention-${it.type}-${it.id}`,
        label: it.label,
        hint: it.sublabel ?? undefined,
        group: mentionTypeLabel(g.type as MentionType),
        type: it.type,
        onPick: () => {
          const label = it.label.replace(/\s+/g, ' ').trim();
          const next = applyTrigger(text, caret, trigger, `@${label}`);
          setTextAndCaret(next.text, next.caret);
          setMentions((prev) =>
            prev.some((p) => p.ref.id === it.id && p.ref.type === it.type)
              ? prev
              : [...prev, { ref: { type: it.type, id: it.id }, label }],
          );
        },
      })),
    );
  }, [open, trigger, commands.data, mentionResults.data, text, caret, onCommand, setTextAndCaret]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: volta ao primeiro resultado quando a lista muda
  useEffect(() => setActive(0), [options.length, trigger?.query]);

  // O menu "+" abre com o primeiro item ativo, também quando se abre com o rato.
  useEffect(() => {
    if (!menuOpen) return;
    const frame = requestAnimationFrame(() =>
      menuContent.current
        ?.querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])')
        ?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [menuOpen]);

  // O item ativo está sempre à vista, também quando a lista rola.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, listId]);

  // Cresce com o texto (máx. ~8 linhas) e repõe o cursor depois de escolher uma sugestão.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mede de novo sempre que o texto muda
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 208)}px`;
    if (pendingCaret.current !== null) {
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [text]);

  useEffect(() => {
    if (autoFocus) area.current?.focus();
  }, [autoFocus]);

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (incoming.length === 0) return;
      const room = MAX_FILES - files.length;
      if (room <= 0) {
        toast.error(m.chat_files_max({ max: MAX_FILES }));
        return;
      }
      const accepted: Pending[] = [];
      for (const file of incoming.slice(0, room)) {
        if (file.size > MAX_FILE_BYTES) {
          toast.error(m.chat_file_too_big({ name: file.name }));
          continue;
        }
        accepted.push({
          key: `f${++uid}`,
          file,
          preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
          status: 'uploading',
        });
      }
      if (incoming.length > room) toast.error(m.chat_files_max({ max: MAX_FILES }));
      if (accepted.length === 0) return;
      setFiles((prev) => [...prev, ...accepted]);
      for (const p of accepted) {
        upload
          .mutateAsync({ body: { files: [p.file] } })
          .then((res) =>
            setFiles((prev) =>
              prev.map((x) =>
                x.key === p.key ? { ...x, status: res[0] ? 'ready' : 'error', result: res[0] } : x,
              ),
            ),
          )
          .catch((e: unknown) => {
            toast.error(`${p.file.name}: ${getErrorMessage(e)}`);
            setFiles((prev) => prev.map((x) => (x.key === p.key ? { ...x, status: 'error' } : x)));
          });
      }
    },
    [files.length, upload],
  );

  useImperativeHandle(
    ref,
    () => ({
      addFiles,
      focus: () => area.current?.focus(),
      setText: (t) => {
        setTextAndCaret(t, t.length);
        area.current?.focus();
      },
    }),
    [addFiles, setTextAndCaret],
  );

  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(
    () => () => {
      for (const f of filesRef.current) if (f.preview) URL.revokeObjectURL(f.preview);
    },
    [],
  );

  const removeFile = (key: string) =>
    setFiles((prev) => {
      const gone = prev.find((x) => x.key === key);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return prev.filter((x) => x.key !== key);
    });

  const uploading = files.some((f) => f.status === 'uploading');
  const ready = files.filter((f) => f.status === 'ready' && f.result);
  const canSend = text.trim().length > 0 && !uploading && !busy;

  const submit = () => {
    if (!canSend) return;
    const clean = text.trim();
    onSend({
      text: clean,
      mentions: pruneMentions(clean, mentions),
      attachments: ready.flatMap((f) => (f.result ? [f.result] : [])),
      pageContext: screen ? getPageContext() : null,
    });
    for (const f of files) if (f.preview) URL.revokeObjectURL(f.preview);
    setText('');
    setCaret(0);
    setFiles([]);
    setMentions([]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (open && options.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => stepIndex(a, options.length, 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => stepIndex(a, options.length, -1));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        options[active]?.onPick();
        return;
      }
    }
    if (open && e.key === 'Escape') {
      e.preventDefault();
      setDismissed(text);
      return;
    }
    // Backspace/Delete junto a uma menção apaga-a inteira, como uma unidade.
    if ((e.key === 'Backspace' || e.key === 'Delete') && !composing.current) {
      const el = e.currentTarget;
      const found = mentionDeletion(
        findMentionSpans(el.value, mentions),
        el.selectionStart,
        el.selectionEnd,
        e.key,
      );
      if (found) {
        e.preventDefault();
        deleteRange(el, found.start, found.end, setTextAndCaret);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Um comando escrito por inteiro (/compact) executa-se com Enter.
      const typed = text.trim();
      if (trigger?.kind === 'command' && commands.data?.commands.some((c) => c.name === typed)) {
        setTextAndCaret('', 0);
        onCommand(typed);
        return;
      }
      submit();
    }
  };

  const insertTrigger = (char: '@' | '/') => {
    const before = char === '/' ? '' : text.slice(0, caret);
    const rest = char === '/' ? '' : text.slice(caret);
    const pad = char === '@' && before && !/\s$/.test(before) ? ' ' : '';
    const next = `${before}${pad}${char}${rest}`;
    setTextAndCaret(next, before.length + pad.length + 1);
    setDismissed(null);
  };

  // Cursor fora do interior das menções; a posição anterior diz para que margem saltar.
  const onSelectField = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (composing.current) return;
    const [from, to] = snapSelection(
      findMentionSpans(el.value, mentions),
      el.selectionStart,
      el.selectionEnd,
      prevCaret.current,
    );
    if (from !== el.selectionStart || to !== el.selectionEnd)
      el.setSelectionRange(from, to, el.selectionDirection ?? 'none');
    prevCaret.current = el.selectionDirection === 'backward' ? from : to;
    setCaret(from);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const pasted = Array.from(e.clipboardData.files);
    if (pasted.length > 0) {
      e.preventDefault();
      addFiles(pasted);
    }
  };

  // Agrupa por tipo mantendo o índice global, para o teclado correr a lista toda.
  const rows = options.reduce<{ group?: string; items: { o: Option; i: number }[] }[]>(
    (acc, o, i) => {
      const last = acc[acc.length - 1];
      if (last && last.group === o.group) last.items.push({ o, i });
      else acc.push({ group: o.group, items: [{ o, i }] });
      return acc;
    },
    [],
  );

  return (
    <div className="relative" data-testid="copilot-composer">
      {open && options.length > 0 && (
        <div
          id={listId}
          role="listbox"
          aria-label={trigger?.kind === 'command' ? m.chat_commands() : m.chat_mentions()}
          className="absolute right-0 bottom-full left-0 z-20 mb-2 max-h-64 overflow-y-auto overscroll-contain rounded-xl border bg-popover p-1 shadow-lg"
        >
          {rows.map((row, r) => (
            // biome-ignore lint/a11y/useSemanticElements: um grupo de opções dentro do listbox não é um fieldset
            <div
              key={row.items[0]?.o.id}
              role="group"
              aria-label={row.group}
              className={cn(r > 0 && 'mt-1 border-border/60 border-t pt-1')}
            >
              {row.group && (
                <p
                  aria-hidden="true"
                  className="px-3 pt-1.5 pb-0.5 font-semibold text-[0.6875rem] text-muted-foreground uppercase tracking-[0.14em]"
                >
                  {row.group}
                </p>
              )}
              {row.items.map(({ o, i }) => (
                <div
                  key={o.id}
                  id={`${listId}-${i}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    o.onPick();
                  }}
                  onMouseMove={() => active !== i && setActive(i)}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-1.5 text-sm',
                    ACTIVE_ROW,
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground',
                      i === active && 'bg-primary/15 text-primary',
                    )}
                  >
                    {o.type ? (
                      <MentionIcon type={o.type} className="size-4" />
                    ) : (
                      <Slash className="size-4" strokeWidth={1.75} />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{o.label}</span>
                    {o.hint && (
                      <span className="truncate text-muted-foreground text-xs">{o.hint}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {open &&
        trigger?.kind === 'mention' &&
        options.length === 0 &&
        !mentionResults.isFetching && (
          <p
            role="status"
            className="absolute right-0 bottom-full left-0 z-20 mb-2 rounded-xl border bg-popover px-3 py-2.5 text-muted-foreground text-sm shadow-lg"
          >
            {m.chat_mentions_empty()}
          </p>
        )}

      <div className="flex flex-col rounded-[1.375rem] border bg-card transition-colors focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/25">
        {(files.length > 0 || screen) && (
          <ul className="flex flex-wrap gap-1.5 px-3 pt-2.5" aria-label={m.chat_attachments()}>
            {screen && (
              <li
                data-testid="copilot-context-chip"
                className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border bg-background pr-0.5 pl-2.5 text-muted-foreground text-xs"
              >
                <Monitor className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span className="min-w-0 truncate">
                  {m.cp_ctx_label({ page: pageLabel ?? '' })}
                </span>
                <button
                  type="button"
                  onClick={() => onContextChange(false)}
                  aria-label={m.cp_ctx_remove()}
                  className="-my-2 -mr-1 flex size-11 shrink-0 items-center justify-center rounded-full hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            )}
            {files.map((f) => (
              <li
                key={f.key}
                data-testid="copilot-attachment-chip"
                data-status={f.status}
                className={cn(
                  'inline-flex h-11 max-w-full items-center gap-2 rounded-xl border bg-background pr-1 pl-1.5 text-xs',
                  f.status === 'error' && 'border-destructive/50',
                )}
              >
                {f.preview ? (
                  <img src={f.preview} alt="" className="size-8 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                )}
                <span className="min-w-0 max-w-40 truncate">{f.file.name}</span>
                {f.status === 'uploading' && (
                  <>
                    <BrandSpinner className="size-4 shrink-0" />
                    <span className="sr-only">{m.chat_file_uploading()}</span>
                  </>
                )}
                {f.status === 'error' && (
                  <span className="text-destructive">{m.chat_file_failed()}</span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0"
                  onClick={() => removeFile(f.key)}
                  aria-label={m.chat_remove_file({ name: f.file.name })}
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-0.5 p-1">
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            accept={ACCEPTED_FILES}
            data-testid="copilot-file-input"
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0 rounded-full text-muted-foreground"
                aria-label={m.cp_plus_label()}
              >
                <Plus className="size-5" strokeWidth={1.75} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              ref={menuContent}
              side="top"
              align="start"
              loop
              className="min-w-60 rounded-xl p-1.5"
              // Ao fechar (Esc, escolha) o foco volta ao campo de texto.
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                area.current?.focus();
              }}
            >
              <DropdownMenuItem
                className={cn('min-h-11', ACTIVE_ROW)}
                onSelect={() => picker.current?.click()}
              >
                <Paperclip />
                {m.chat_attach_file()}
              </DropdownMenuItem>
              {pageLabel !== null && (
                <DropdownMenuItem
                  className={cn('min-h-11', ACTIVE_ROW)}
                  onSelect={() => onContextChange(!screen)}
                >
                  <Monitor />
                  {screen ? m.cp_ctx_remove() : m.chat_attach_screen()}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className={cn('min-h-11', ACTIVE_ROW)}
                onSelect={() => insertTrigger('@')}
              >
                <AtSign />
                {m.cp_plus_mention()}
              </DropdownMenuItem>
              <DropdownMenuItem
                className={cn('min-h-11', ACTIVE_ROW)}
                disabled={text.trim().length > 0}
                onSelect={() => insertTrigger('/')}
              >
                <Slash />
                {m.cp_plus_commands()}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="relative min-w-0 flex-1">
            {hasChips && (
              <div
                ref={overlay}
                aria-hidden="true"
                data-testid="copilot-composer-overlay"
                className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-1.5 py-[0.6875rem] text-base text-foreground leading-[1.375rem]"
              >
                {segments.map((seg, i) =>
                  seg.mention ? (
                    <mark
                      // biome-ignore lint/suspicious/noArrayIndexKey: os troços seguem o texto
                      key={i}
                      data-testid="copilot-mention-mark"
                      className="rounded-[0.3rem] bg-primary/12 text-primary box-decoration-clone"
                    >
                      {/* O "@" mantém a largura mas dá lugar ao ícone do tipo: o texto não se desalinha. */}
                      <span className="relative">
                        <span className="text-transparent">@</span>
                        <span className="absolute inset-0 flex items-center justify-center">
                          <MentionIcon type={seg.mention.ref.type} className="size-[0.8125em]" />
                        </span>
                      </span>
                      {seg.text.slice(1)}
                    </mark>
                  ) : (
                    // biome-ignore lint/suspicious/noArrayIndexKey: os troços seguem o texto
                    <span key={i}>{seg.text}</span>
                  ),
                )}
                {'​'}
              </div>
            )}
            <textarea
              ref={area}
              value={text}
              rows={1}
              maxLength={4000}
              onChange={(e) => {
                setText(e.target.value);
                setCaret(e.target.selectionStart);
                setDismissed(null);
              }}
              onSelect={onSelectField}
              onScroll={(e) => {
                if (overlay.current) overlay.current.scrollTop = e.currentTarget.scrollTop;
              }}
              onCompositionStart={() => {
                composing.current = true;
              }}
              onCompositionEnd={() => {
                composing.current = false;
              }}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              role="combobox"
              aria-expanded={open && options.length > 0}
              aria-controls={open && options.length > 0 ? listId : undefined}
              aria-activedescendant={open && options.length > 0 ? `${listId}-${active}` : undefined}
              aria-autocomplete="list"
              aria-label={m.copilot_input_label()}
              placeholder={m.cp_placeholder()}
              className={cn(
                'relative block max-h-48 min-h-11 w-full resize-none bg-transparent px-1.5 py-[0.6875rem] text-base leading-[1.375rem] caret-foreground outline-none selection:bg-primary/20 placeholder:text-muted-foreground',
                // Com menções, o texto desenha-se na camada de baixo; sem barra de rolagem para as larguras coincidirem.
                hasChips && 'text-transparent [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              )}
            />
          </div>
          {busy ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-11 shrink-0 rounded-full"
              aria-label={m.chat_stop()}
              onClick={onStop}
            >
              <Square className="size-3.5 fill-current" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              className="size-11 shrink-0 rounded-full transition-opacity disabled:opacity-35"
              aria-label={m.copilot_send()}
              disabled={!canSend}
              onClick={submit}
            >
              <ArrowUp className="size-5" strokeWidth={2} aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});
