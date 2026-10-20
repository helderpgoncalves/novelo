import { Link } from '@tanstack/react-router';
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
import { motionAllowed } from '@/lib/motion';
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

/** Lista do topo com um traço de 2 px que desliza para a secção ativa (sem fundo nem desfocagem). */
function DesktopNav({ activeGroup }: { activeGroup: string | null }) {
  const listRef = useRef<HTMLUListElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const items = navItems();

  const place = useCallback(() => {
    const list = listRef.current;
    const line = lineRef.current;
    if (!list || !line) return;
    const link = activeGroup
      ? list.querySelector<HTMLElement>(`[data-nav="${activeGroup}"]`)
      : null;
    if (!link || link.offsetParent === null) {
      line.style.setProperty('--line-o', '0');
      return;
    }
    line.style.setProperty('--line-x', `${link.offsetLeft}px`);
    line.style.setProperty('--line-w', `${link.offsetWidth}px`);
    line.style.setProperty('--line-o', '1');
  }, [activeGroup]);

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
      <ul ref={listRef} onKeyDown={onKeyDown} className="relative flex items-center gap-1">
        <span aria-hidden="true" ref={lineRef} className="lp-nav-line" />
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
              className={cn(
                'relative inline-flex h-11 items-center px-3.5 text-[0.9375rem] outline-none transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-4px] focus-visible:rounded-[8px]',
                activeGroup === s.id
                  ? 'font-semibold text-foreground'
                  : 'font-medium text-foreground/70 hover:text-foreground',
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

/** Ícone do menu: duas linhas finas de comprimento diferente que se cruzam num × (transição suave, controlada por `open`). */
function MenuGlyph({ open }: { open: boolean }) {
  return (
    <span aria-hidden="true" data-open={open} className="lp-glyph">
      <span className="lp-glyph-a" />
      <span className="lp-glyph-b">
        <span />
      </span>
    </span>
  );
}

/** Idioma e tema na folha: texto e ícones em linha, sem caixas (os menus suspensos ficariam atrás de um <dialog>). */
function SheetPreferences() {
  const label = 'font-mono text-[11px] text-muted-foreground uppercase tracking-[0.14em]';
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex flex-col gap-0.5">
        <p className={label}>{m.landing_menu_language()}</p>
        <LanguageSwitcher variant="inline" />
      </div>
      <div className="flex flex-col gap-0.5">
        <p className={label}>{m.landing_menu_theme()}</p>
        <ThemeToggle variant="inline" />
      </div>
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
  active,
  restoreRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  active: string | null;
  restoreRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
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
    // O foco inicial vai para o painel (sem anel): o anel só aparece quando se navega por teclado.
    panelRef.current?.focus({ preventScroll: true });
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
      <div
        ref={panelRef}
        tabIndex={-1}
        className="flex h-full flex-col pr-[env(safe-area-inset-right)] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] outline-none"
      >
        <div
          className={cn(
            'flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center justify-between gap-3 pt-[env(safe-area-inset-top)]',
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
            className="brand-link flex min-h-11 items-center rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
          >
            <BrandLogo interactive className="h-6" />
          </Link>
          <button type="button" className="lp-menu-btn inline-flex" onClick={() => requestClose()}>
            <MenuGlyph open />
            <span className="sr-only">{m.landing_menu_close()}</span>
          </button>
        </div>
        <nav
          aria-label={m.landing_nav_label()}
          className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain py-2', PUBLIC_GUTTER)}
        >
          <ul className="divide-y divide-border/60">
            {items.map((s) => {
              const on = active !== null && (TOC_ALIAS[active] ?? active) === s.id;
              return (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    aria-current={on ? 'location' : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      requestClose(() => goTo(s.id));
                    }}
                    className="lp-press group flex min-h-14 items-baseline gap-4 py-3 outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]"
                  >
                    <span className="w-6 font-mono text-[11px] text-muted-foreground tabular-nums">
                      {s.n}
                    </span>
                    <span className="font-medium font-serif text-[1.75rem] tracking-tight group-aria-[current=location]:text-primary">
                      {s.label}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className={cn('flex shrink-0 flex-col gap-4 pt-4', PUBLIC_GUTTER)}>
          <SheetPreferences />
          <div className="flex gap-3">
            <Button asChild className="h-12 flex-1 rounded-[10px] font-semibold text-base">
              <Link to="/login" onClick={() => requestClose()}>
                {m.landing_sign_in()}
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 flex-1 rounded-[10px] border-foreground/20 bg-transparent font-medium text-base shadow-none hover:bg-foreground/5"
            >
              <Link to="/register" onClick={() => requestClose()}>
                {m.landing_register()}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

/**
 * Topo da landing. Fixo e com altura estável (`--nav-h`, sem CLS): transparente sobre o hero e, depois de rolar, fundo do
 * papel com um fio de 1 px (sem desfoque). Entrar é a ação principal; Criar conta, texto; atalhos: setas/Home/End dentro da
 * navegação e Alt+1…6 para saltar para a secção.
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
            className="brand-link flex min-h-11 shrink-0 items-center rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
          >
            <BrandLogo interactive className="h-6 lg:h-7" />
          </Link>
          <div className="hidden flex-1 justify-center lg:flex">
            <DesktopNav activeGroup={activeGroup} />
          </div>
          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <div className="mr-1 hidden items-center md:flex">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
            <Link to="/register" className="lp-nav-text hidden md:inline-flex">
              {m.landing_register()}
            </Link>
            <Link to="/login" className="lp-nav-cta lp-press">
              {m.landing_sign_in()}
            </Link>
            <button
              ref={menuButtonRef}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              className="lp-menu-btn inline-flex lg:hidden"
              onClick={() => setMenuOpen(true)}
            >
              <MenuGlyph open={false} />
              <span className="sr-only">{m.landing_menu_open()}</span>
            </button>
          </div>
        </div>
      </header>
      <MobileMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        active={active}
        restoreRef={menuButtonRef}
      />
    </>
  );
}

/**
 * «Nesta página»: coluna fixa à esquerda a partir de 1536 px (por baixo disso a barra do topo já tem âncoras). Só aparece depois
 * do hero, alinhada com a margem do conteúdo; marcador de progresso de leitura, número mono e item ativo em destaque.
 */
export function LandingToc() {
  const items = tocItems();
  const active = useActiveSection(OBSERVED);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const el = navRef.current;
      if (!el) return;
      el.style.setProperty('--read', String(max > 0 ? Math.min(1, window.scrollY / max) : 0));
      el.dataset.shown = String(window.scrollY > window.innerHeight * 0.7);
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
    <nav ref={navRef} aria-label={m.landing_toc_title()} data-shown="false" className="lp-toc">
      <p className="lp-toc-title">{m.landing_toc_title()}</p>
      <div className="lp-toc-rail">
        <span aria-hidden="true" className="lp-toc-fill" />
        <ol>
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
                >
                  <span aria-hidden="true">{s.n}</span>
                  {s.label}
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
