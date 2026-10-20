import { type PointerEvent, type ReactNode, useRef } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { m } from '@/paraglide/messages';

const CLOSE_DISTANCE = 96;

interface DetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}

/**
 * Folha inferior arrastável para detalhes em telemóvel. Arrastar a pega para baixo fecha-a (mais de 96 px ou um gesto
 * rápido); o arrasto mexe diretamente no elemento, sem re-renderizar nada. Em ecrãs largos usa-se um painel na página.
 */
export function DetailSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: DetailSheetProps) {
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);

  const move = (dy: number, animate: boolean) => {
    const el = sheet.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 180ms ease-out' : 'none';
    el.style.transform = dy > 0 ? `translateY(${dy}px)` : '';
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.dy = Math.max(0, e.clientY - d.y);
    move(d.dy, false);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const fast = d.dy > 40 && d.dy / Math.max(1, performance.now() - d.t) > 0.5;
    if (d.dy > CLOSE_DISTANCE || fast) onOpenChange(false);
    move(0, true);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={sheet}
        side="bottom"
        showCloseButton={false}
        className="max-h-[86dvh] gap-0 rounded-t-2xl p-0"
      >
        <div
          role="presentation"
          className="flex h-8 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <span className="h-1 w-10 rounded-full bg-foreground/25" aria-hidden="true" />
        </div>
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <SheetDescription className="sr-only">
          {description ?? m.home_sheet_hint()}
        </SheetDescription>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
