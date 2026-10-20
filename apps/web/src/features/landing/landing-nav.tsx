import { Link } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { m } from '@/paraglide/messages';
import { CTA_PRIMARY, CTA_SECONDARY } from './layout';

/** Secções com âncora: o mesmo conjunto no topo (ecrã largo) e no menu (telemóvel). */
function sections() {
  return [
    { id: 'como-funciona', label: m.landing_nav_how() },
    { id: 'funcionalidades', label: m.landing_nav_features() },
    { id: 'copiloto', label: m.landing_nav_copilot() },
    { id: 'dados', label: m.landing_nav_data() },
    { id: 'perguntas', label: m.landing_nav_faq() },
  ];
}

/** Navegação do topo (a partir de `lg`). */
export function LandingNav() {
  return (
    <nav aria-label={m.landing_nav_label()}>
      <ul className="flex items-center gap-1">
        {sections().map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="inline-flex min-h-11 items-center rounded-md px-3 font-medium text-muted-foreground text-sm outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Entrar e Criar conta no topo (a partir de `md`); abaixo disso vivem no menu. */
export function LandingActions() {
  return (
    <div className="hidden items-center gap-2 md:flex">
      <Button asChild variant="ghost" className={CTA_SECONDARY}>
        <Link to="/login">{m.landing_sign_in()}</Link>
      </Button>
      <Button asChild className={CTA_PRIMARY}>
        <Link to="/register">{m.landing_register()}</Link>
      </Button>
    </div>
  );
}

/** Menu em folha lateral para ecrãs estreitos (< `lg`): âncoras de 48 px e os dois botões de conta. */
export function LandingMenu() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 lg:hidden">
          <Menu className="size-5" strokeWidth={1.75} aria-hidden="true" />
          <span className="sr-only">{m.landing_menu_open()}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-xs gap-0 sm:max-w-xs">
        <SheetHeader className="px-6 pt-5 pb-2">
          <SheetTitle className="font-serif font-medium text-xl">
            {m.landing_menu_title()}
          </SheetTitle>
          <SheetDescription className="sr-only">{m.landing_nav_label()}</SheetDescription>
        </SheetHeader>
        <nav aria-label={m.landing_nav_label()} className="flex-1 overflow-y-auto px-3 py-2">
          <ul>
            {sections().map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={close}
                  className="flex min-h-12 items-center rounded-md px-3 font-medium text-base outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <SheetFooter className="gap-3 border-border border-t p-6">
          <Button asChild className={CTA_PRIMARY}>
            <Link to="/register" onClick={close}>
              {m.landing_register()}
            </Link>
          </Button>
          <Button asChild variant="outline" className={CTA_SECONDARY}>
            <Link to="/login" onClick={close}>
              {m.landing_sign_in()}
            </Link>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
