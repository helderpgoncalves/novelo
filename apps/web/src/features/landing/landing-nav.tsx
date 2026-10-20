import { Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import {
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { PUBLIC_GUTTER } from '@/components/public-shell';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { useSwitchLanguage } from '@/features/account/use-switch-language';
import { getLocale, LOCALE_LABELS, type Locale, locales } from '@/lib/i18n';
import { motionAllowed } from '@/lib/motion';
import { type Theme, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { navItems, SECTION_GROUP, TOC_ALIAS, tocItems } from './sections';
import { useActiveSection } from './use-active-section';

const OBSERVED = Object.keys(SECTION_GROUP);

/** Rola até uma âncora respeitando o movimento reduzido e atualiza o hash sem recarregar. */
function goTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: motionAllowed() ? 'smooth' : 'auto', block: 'start' });
  history.replaceState(null, '', `#${id}`);
}

/**
 * Estado do topo escrito direto no DOM (sem renderizar o React a cada scroll):
 * `data-scrolled` depois de 8 px e `data-hidden` ao descer (só abaixo de `lg`), com histerese: esconde ao descer 12 px
 * acumulados depois dos 240 px e volta ao subir 6 px. Fica sempre visível com o foco dentro ou o menu aberto.
 */
function useHeaderState(ref: React.RefObject<HTMLElement | null>, locked: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let lastY = window.scrollY;
    let acc = 0;
    let frame = 0;
    const small = window.matchMedia('(max-width: 1023px)');
    const update = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      const dy = y - lastY;
      lastY = y;
      el.dataset.scrolled = String(y > 8);
      if (!small.matches || locked || y < 240 || el.matches(':focus-within')) {
        acc = 0;
        el.dataset.hidden = 'false';
        return;
      }
      acc = Math.sign(dy) === Math.sign(acc) ? acc + dy : dy;
      if (acc > 12) el.dataset.hidden = 'true';
      else if (acc < -6) el.dataset.hidden = 'false';
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref, locked]);
}

/** Lista do topo com pílula deslizante: segue a secção ativa e, com rato ou teclado, o item sob o cursor/foco. */
function DesktopNav({ activeGroup }: { activeGroup: string | null }) {
  const listRef = useRef<HTMLUListElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const target = hover ?? activeGroup;
  const items = navItems();

  const place = useCallback(() => {
    const list = listRef.current;
    const pill = pillRef.current;
    if (!list || !pill) return;
    const link = target ? list.querySelector<HTMLElement>(`[data-nav="${target}"]`) : null;
    if (!link || link.offsetParent === null) {
      pill.style.setProperty('--pill-o', '0');
      return;
    }
    pill.style.setProperty('--pill-x', `${link.offsetLeft}px`);
    pill.style.setProperty('--pill-w', `${link.offsetWidth}px`);
    pill.style.setProperty('--pill-o', '1');
  }, [target]);

  useLayoutEffect(place, [place]);
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(place);
    ro.observe(list);
    return () => ro.disconnect();
  }, [place]);

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const links = [...e.currentTarget.querySelectorAll<HTMLAnchorElement>('a')].filter(
      (a) => a.offsetParent !== null,
    );
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    const next =
      e.key === 'ArrowRight'
        ? links[(i + 1) % links.length]
        : e.key === 'ArrowLeft'
          ? links[(i - 1 + links.length) % links.length]
          : e.key === 'Home'
            ? links[0]
            : e.key === 'End'
              ? links[links.length - 1]
              : null;
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  return (
    <nav aria-label={m.landing_nav_label()} className="hidden lg:block">
      <ul
        ref={listRef}
        onKeyDown={onKeyDown}
        onPointerLeave={() => setHover(null)}
        className="relative flex items-center gap-0.5"
      >
        <span
          ref={pillRef}
          aria-hidden="true"
          className="lp-pill absolute inset-y-0 left-0 rounded-full bg-foreground/[0.07] dark:bg-foreground/10"
        />
        {items.map((s, i) => (
          <li key={s.id} className={cn(s.xl && 'hidden xl:block')}>
            <a
              href={`#${s.id}`}
              data-nav={s.id}
              aria-keyshortcuts={`Alt+${i + 1}`}
              aria-current={activeGroup === s.id ? 'location' : undefined}
              onClick={(e) => {
                e.preventDefault();
                goTo(s.id);
              }}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(s.id)}
              onFocus={() => setHover(s.id)}
              onBlur={() => setHover(null)}
              className={cn(
                'relative inline-flex h-11 items-center rounded-full px-3.5 font-medium text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                activeGroup === s.id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Seletores compactos de idioma e tema dentro da folha (os menus suspensos ficariam atrás de um <dialog>). */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; lang?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-1 flex-col gap-2 border-0 p-0">
      <legend className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
        {label}
      </legend>
      <div className="flex rounded-lg border border-border bg-secondary/60 p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            lang={o.lang}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'lp-press min-h-11 flex-1 rounded-md px-2 font-medium text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value === o.value
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function SheetPreferences() {
  const { theme, setTheme } = useTheme();
  const switchLanguage = useSwitchLanguage(false);
  const themes: { value: Theme; label: string }[] = [
    { value: 'light', label: m.common_theme_light() },
    { value: 'dark', label: m.common_theme_dark() },
    { value: 'system', label: m.common_theme_system() },
  ];
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <Segmented<Locale>
        label={m.landing_menu_language()}
        value={getLocale()}
        options={locales.map((l) => ({ value: l, label: LOCALE_LABELS[l], lang: l }))}
        onChange={(l) => void switchLanguage(l)}
      />
      <Segmented<Theme>
        label={m.landing_menu_theme()}
        value={theme}
        options={themes}
        onChange={setTheme}
      />
    </div>
  );
}

/**
 * Menu móvel: <dialog> modal de ecrã inteiro (o resto fica inerte, o foco fica preso, Esc fecha). A folha desce do topo;
 * arrastar o cabeçalho para cima fecha-a (a folha segue o dedo e decide pela distância ou velocidade). O scroll da página
 * trava com `overflow: hidden` (sem saltos no iOS); os links grandes (≥ 48 px) respeitam as zonas seguras.
 */
function MobileMenu({
  open,
  onOpenChange,
  activeGroup,
  restoreRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeGroup: string | null;
  restoreRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ y: number; t: number } | null>(null);
  const items = tocItems();

  const finishClose = useCallback(() => {
    const d = dialogRef.current;
    if (d?.open) d.close();
    document.documentElement.style.overflow = '';
    onOpenChange(false);
    restoreRef.current?.focus({ preventScroll: true });
  }, [onOpenChange, restoreRef]);

  const requestClose = useCallback(
    (after?: () => void) => {
      const d = dialogRef.current;
      if (!d) return;
      const run = () => {
        finishClose();
        after?.();
      };
      if (!motionAllowed()) return run();
      d.dataset.state = 'closing';
      window.setTimeout(run, 220);
    },
    [finishClose],
  );

  useEffect(() => {
    const d = dialogRef.current;
    if (!d || !open || d.open) return;
    d.dataset.state = 'opening';
    d.showModal();
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(() => requestAnimationFrame(() => (d.dataset.state = 'open')));
  }, [open]);

  useEffect(
    () => () => {
      document.documentElement.style.overflow = '';
    },
    [],
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { y: e.clientY, t: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (dialogRef.current) dialogRef.current.dataset.dragging = 'true';
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dialogRef.current;
    if (!drag.current || !d) return;
    const dy = Math.min(0, e.clientY - drag.current.y);
    d.style.transform = `translateY(${dy}px)`;
    d.style.opacity = String(1 + dy / 420);
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dialogRef.current;
    const start = drag.current;
    drag.current = null;
    if (!d || !start) return;
    delete d.dataset.dragging;
    const dy = e.clientY - start.y;
    const v = dy / Math.max(1, performance.now() - start.t);
    d.style.transform = '';
    d.style.opacity = '';
    if (dy < -80 || v < -0.5) requestClose();
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: o fecho por teclado é o Esc nativo do <dialog>
    <dialog
      ref={dialogRef}
      aria-label={m.landing_menu_title()}
      className="lp-sheet lg:hidden"
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div className="flex h-full flex-col pr-[env(safe-area-inset-right)] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)]">
        <div
          className={cn(
            'flex shrink-0 items-center justify-between gap-3 pt-[env(safe-area-inset-top)]',
            PUBLIC_GUTTER,
          )}
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <Link
            to="/"
            aria-label="Novelo"
            onClick={() => requestClose()}
            className="brand-link flex h-14 items-center rounded-sm"
          >
            <BrandLogo interactive className="h-7" />
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-12"
            onClick={() => requestClose()}
          >
            <X className="size-6" strokeWidth={1.75} aria-hidden="true" />
            <span className="sr-only">{m.landing_menu_close()}</span>
          </Button>
        </div>
        <nav
          aria-label={m.landing_nav_label()}
          className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain py-2', PUBLIC_GUTTER)}
        >
          <ul className="divide-y divide-border/70">
            {items.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={
                    activeGroup === (SECTION_GROUP[s.id] ?? s.id) ? 'location' : undefined
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    requestClose(() => goTo(s.id));
                  }}
                  className="lp-press group flex min-h-14 items-baseline gap-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="w-6 font-mono text-muted-foreground text-xs tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-medium font-serif text-3xl tracking-tight group-aria-[current=location]:text-primary">
                    {s.label}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className={cn('flex shrink-0 flex-col gap-5 pt-4', PUBLIC_GUTTER)}>
          <SheetPreferences />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-12 flex-1 font-semibold text-base">
              <Link to="/login" onClick={() => requestClose()}>
                {m.landing_sign_in()}
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-12 flex-1 font-medium text-base">
              <Link to="/register" onClick={() => requestClose()}>
                {m.landing_register()}
              </Link>
            </Button>
          </div>
          <p className="text-center font-mono text-[11px] text-muted-foreground">
            {m.landing_menu_hint()}
          </p>
        </div>
      </div>
    </dialog>
  );
}

/**
 * Topo da landing. Fixo e com altura estável (`--nav-h`, sem CLS): transparente sobre o hero, ganha fundo com desfoque e
 * um fio ao rolar. Entrar é a ação principal, Criar conta a secundária; atalhos: setas/Home/End dentro da navegação e
 * Alt+1…6 para saltar para a secção.
 */
export function LandingHeader() {
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const active = useActiveSection(OBSERVED);
  const activeGroup = active ? (SECTION_GROUP[active] ?? null) : null;
  useHeaderState(headerRef, menuOpen);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const match = /^Digit([1-9])$/.exec(e.code);
      const item = match ? navItems()[Number(match[1]) - 1] : undefined;
      if (!item) return;
      e.preventDefault();
      goTo(item.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <header
        ref={headerRef}
        data-scrolled="false"
        data-hidden="false"
        className="lp-header fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]"
      >
        <div
          className={cn(
            'mx-auto flex h-[calc(var(--nav-h)-env(safe-area-inset-top))] w-full max-w-6xl items-center gap-3',
            PUBLIC_GUTTER,
          )}
        >
          <Link
            to="/"
            aria-label="Novelo"
            className="brand-link flex min-h-11 shrink-0 items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandLogo interactive className="h-7 lg:h-8" />
          </Link>
          <div className="hidden flex-1 justify-center lg:flex">
            <DesktopNav activeGroup={activeGroup} />
          </div>
          <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
            <div className="hidden items-center md:flex [&_button]:size-11">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
            <Button
              asChild
              variant="outline"
              className="lp-press hidden h-11 bg-transparent px-4 font-medium md:inline-flex"
            >
              <Link to="/register">{m.landing_register()}</Link>
            </Button>
            <Button asChild className="lp-press h-11 px-4 font-semibold sm:px-5">
              <Link to="/login">{m.landing_sign_in()}</Link>
            </Button>
            <Button
              ref={menuButtonRef}
              type="button"
              variant="ghost"
              size="icon"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              className="size-11 lg:hidden"
              onClick={() => setMenuOpen(true)}
            >
              <svg
                viewBox="0 0 24 24"
                className="size-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 8.5h16M10 15.5h10" />
              </svg>
              <span className="sr-only">{m.landing_menu_open()}</span>
            </Button>
          </div>
        </div>
      </header>
      <MobileMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        activeGroup={activeGroup}
        restoreRef={menuButtonRef}
      />
    </>
  );
}

/** «Nesta página»: índice fixo à esquerda (a partir de 1536 px) com o progresso de leitura. */
export function LandingToc() {
  const items = tocItems();
  const active = useActiveSection(OBSERVED);
  const progressRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      progressRef.current?.style.setProperty(
        '--read',
        String(max > 0 ? Math.min(1, window.scrollY / max) : 0),
      );
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <nav
      aria-label={m.landing_toc_title()}
      className="fixed top-1/2 left-6 z-30 hidden w-44 -translate-y-1/2 2xl:block"
    >
      <p className="mb-3 font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
        {m.landing_toc_title()}
      </p>
      <div className="relative border-border border-l pl-4">
        <span
          ref={progressRef}
          aria-hidden="true"
          className="absolute top-0 -left-px h-full w-px origin-top bg-primary"
          style={{ transform: 'scaleY(var(--read, 0))' }}
        />
        <ul className="flex flex-col">
          {items.map((s) => {
            const on = active !== null && (TOC_ALIAS[active] ?? active) === s.id;
            return (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={on ? 'location' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    goTo(s.id);
                  }}
                  className={cn(
                    'block rounded-sm py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                    on
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {s.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
