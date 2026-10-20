import { Maximize2, Minus, Plus } from 'lucide-react';
import {
  type KeyboardEvent,
  type MouseEvent,
  memo,
  type PointerEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import {
  buildScale,
  clampView,
  type LabelCandidate,
  type MapView,
  placeLabels,
  zoomAt,
} from './choropleth';
import { LAYER_INFO, valueText } from './layer-info';
import { LayerSwitch } from './layer-switch';
import { dotRadiusPx, MapLegend } from './map-legend';
import { type Direction, LAYERS, type MapModel, neighbourInDirection } from './map-model';
import { MAP_CSS, type Paint, paintFor } from './map-theme';
import type { LayerId } from './tabs';
import { EstimateTag } from './tags';

const FONT_PX = 12;
const LINE_H = FONT_PX * 1.15;
const HALO_PX = 3;
const STRIPE_PX = 7;
const SVG_NS = 'http://www.w3.org/2000/svg';
const DRAG_PX = 4;

const ARROWS: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

interface FillItem {
  code: string;
  name: string;
  outline: string;
  paint: Paint;
  text: string;
}

const Fills = memo(function Fills({
  items,
  uid,
  selected,
}: {
  items: FillItem[];
  uid: string;
  selected: string | null;
}) {
  return (
    <g>
      {items.map((it) => (
        <path
          key={it.code}
          id={`${uid}-${it.code}`}
          data-code={it.code}
          d={it.outline}
          role="option"
          aria-selected={selected === it.code}
          aria-label={it.text}
          style={{ fill: it.paint.fill }}
          className="cursor-pointer"
        />
      ))}
    </g>
  );
});

export interface DecisionMapProps {
  model: MapModel;
  layer: LayerId;
  onLayerChange: (layer: LayerId) => void;
  values: Map<string, number>;
  selected: string | null;
  onSelect: (code: string | null) => void;
  covered: Set<string> | null;
  /** Freguesia a mostrar quando o mapa recebe foco e ainda não há seleção. */
  fallbackCode: string | null;
  /** Frase que explica o contorno das freguesias cobertas pelo orçamento; `null` sem orçamento escolhido. */
  coveredNote?: string | null;
  className?: string;
}

/**
 * Mapa de Guimarães em coropleto sólido: cada freguesia é preenchida com a cor da sua classe (escala sequencial de
 * seis verdes, por quantis), com fronteiras finas, contorno do concelho mais forte e nomes nas freguesias onde cabem.
 * Um só SVG sem bibliotecas de mapas. Zoom e pan são imperativos (refs): arrastar, pinça, Ctrl + roda, botões e teclado
 * (setas, +, −, Esc) não re-renderizam o React; o hover também não (CSS e refs).
 */
export function DecisionMap({
  model,
  layer,
  onLayerChange,
  values,
  selected,
  onSelect,
  covered,
  fallbackCode,
  coveredNote,
  className,
}: DecisionMapProps) {
  const info = LAYER_INFO[layer];
  const meta = LAYERS.find((l) => l.id === layer);
  const kind = meta?.kind ?? 'scale';
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const hatchId = `${uid}-hatch`;
  const [active, setActive] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const geoRef = useRef<SVGGElement>(null);
  const overlayRef = useRef<SVGGElement>(null);
  const hatchRef = useRef<SVGPatternElement>(null);
  const hoverRef = useRef<SVGPathElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipNameRef = useRef<HTMLSpanElement>(null);
  const tipValueRef = useRef<HTMLSpanElement>(null);
  const labelRefs = useRef(new Map<string, SVGTextElement>());
  const dotRefs = useRef(new Map<string, SVGCircleElement>());
  const viewRef = useRef<MapView>({ k: 1, tx: 0, ty: 0 });
  const zoomedRef = useRef(false);
  const hoverCode = useRef<string | null>(null);

  const byCode = useMemo(() => new Map(model.parishes.map((p) => [p.code, p])), [model]);
  const scale = useMemo(() => buildScale(values.values(), 6), [values]);
  const hasNoData = values.size < model.parishes.length;

  const items = useMemo<FillItem[]>(
    () =>
      model.parishes.map((p) => {
        const v = values.get(p.code);
        return {
          code: p.code,
          name: p.name,
          outline: p.outline,
          paint: paintFor(kind, v, scale, `url(#${hatchId})`),
          text: `${p.name}: ${valueText(layer, v)}`,
        };
      }),
    [model, values, kind, scale, hatchId, layer],
  );
  const paints = useMemo(() => new Map(items.map((i) => [i.code, i.paint])), [items]);

  const dots = useMemo(() => {
    if (kind !== 'circles') return [];
    let max = 0;
    for (const v of values.values()) if (v > max) max = v;
    return model.parishes
      .map((p) => ({
        code: p.code,
        x: p.anchor[0],
        y: p.anchor[1],
        r: dotRadiusPx(values.get(p.code) ?? 0, max),
      }))
      .filter((d) => d.r > 0)
      .sort((a, b) => b.r - a.r);
  }, [kind, model, values]);

  const candidates = useMemo<LabelCandidate[]>(() => {
    const dotR = new Map(dots.map((d) => [d.code, d.r]));
    return model.parishes
      .filter((p) => p.chord > 0)
      .map((p) => ({
        code: p.code,
        text: p.label,
        x: p.anchor[0],
        y: p.anchor[1],
        chord: p.chord,
        radius: p.radius,
        priority: p.radius,
        dy: dotR.has(p.code) ? (dotR.get(p.code) ?? 0) + LINE_H * 0.6 + 2 : 0,
      }));
  }, [model, dots]);

  /** Aplica o zoom e a translação, as etiquetas e os círculos diretamente no DOM (sem estado do React). */
  const apply = useCallback(() => {
    const wrap = wrapRef.current;
    const geo = geoRef.current;
    const overlay = overlayRef.current;
    if (!wrap || !geo || !overlay) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0) return;
    const v = viewRef.current;
    const unitPx = rect.width / model.width;
    geo.setAttribute('transform', `translate(${v.tx} ${v.ty}) scale(${v.k})`);

    const stripe = STRIPE_PX / (unitPx * v.k);
    const hatch = hatchRef.current;
    if (hatch) {
      hatch.setAttribute('width', String(stripe));
      hatch.setAttribute('height', String(stripe));
      hatch.children[0]?.setAttribute('width', String(stripe));
      hatch.children[0]?.setAttribute('height', String(stripe));
      hatch.children[1]?.setAttribute('width', String(stripe * 0.28));
      hatch.children[1]?.setAttribute('height', String(stripe));
    }

    overlay.setAttribute('font-size', String(FONT_PX / unitPx));
    const placed = placeLabels(candidates, v, unitPx, FONT_PX, { w: rect.width, h: rect.height });
    const shown = new Set<string>();
    for (const l of placed) {
      const el = labelRefs.current.get(l.code);
      if (!el) continue;
      shown.add(l.code);
      const key = `${l.lines.join('|')}@${unitPx.toFixed(3)}`;
      if (el.dataset.key !== key) {
        el.dataset.key = key;
        el.replaceChildren(
          ...l.lines.map((line, i) => {
            const t = document.createElementNS(SVG_NS, 'tspan');
            t.setAttribute('x', '0');
            t.setAttribute(
              'y',
              String(((i - (l.lines.length - 1) / 2) * LINE_H + FONT_PX * 0.35) / unitPx),
            );
            t.textContent = line;
            return t;
          }),
        );
        el.setAttribute('stroke-width', String(HALO_PX / unitPx));
      }
      el.setAttribute('transform', `translate(${l.px / unitPx} ${l.py / unitPx})`);
      el.style.display = '';
    }
    for (const [code, el] of labelRefs.current) if (!shown.has(code)) el.style.display = 'none';

    for (const d of dots) {
      const el = dotRefs.current.get(d.code);
      if (!el) continue;
      el.setAttribute('cx', String(d.x * v.k + v.tx));
      el.setAttribute('cy', String(d.y * v.k + v.ty));
      el.setAttribute('r', String(d.r / unitPx));
      el.setAttribute('stroke-width', String(1.5 / unitPx));
    }

    wrap.style.touchAction = v.k > 1.001 ? 'none' : 'pan-y';
    wrap.style.cursor = v.k > 1.001 ? 'grab' : '';
    const isZoomed = v.k > 1.001;
    if (zoomedRef.current !== isZoomed) {
      zoomedRef.current = isZoomed;
      setZoomed(isZoomed);
    }
  }, [model, candidates, dots]);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useLayoutEffect(() => {
    apply();
  }, [apply]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let frame = 0;
    const again = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => applyRef.current());
    };
    const observer = new ResizeObserver(again);
    observer.observe(wrap);
    // Ctrl/⌘ + roda (e a pinça do trackpad) amplia; a roda sozinha continua a deslizar a página.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const unitPx = rect.width / model.width;
      const v = viewRef.current;
      viewRef.current = zoomAt(
        v,
        v.k * Math.exp(-e.deltaY * 0.004),
        (e.clientX - rect.left) / unitPx,
        (e.clientY - rect.top) / unitPx,
        model.width,
        model.height,
      );
      again();
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      wrap.removeEventListener('wheel', onWheel);
    };
  }, [model]);

  const setView = useCallback(
    (next: MapView) => {
      viewRef.current = clampView(next, model.width, model.height);
      applyRef.current();
    },
    [model],
  );
  const zoomBy = useCallback(
    (factor: number) => {
      const v = viewRef.current;
      setView(
        zoomAt(v, v.k * factor, model.width / 2, model.height / 2, model.width, model.height),
      );
    },
    [model, setView],
  );
  const reset = useCallback(() => setView({ k: 1, tx: 0, ty: 0 }), [setView]);

  /** Traz a freguesia para dentro do quadro quando há zoom. */
  const reveal = useCallback(
    (code: string | null) => {
      const p = code ? byCode.get(code) : undefined;
      const v = viewRef.current;
      if (!p || v.k <= 1.001) return;
      const sx = p.anchor[0] * v.k + v.tx;
      const sy = p.anchor[1] * v.k + v.ty;
      const mx = model.width * 0.12;
      const my = model.height * 0.12;
      if (sx < mx || sx > model.width - mx || sy < my || sy > model.height - my) {
        setView({
          k: v.k,
          tx: model.width / 2 - p.anchor[0] * v.k,
          ty: model.height / 2 - p.anchor[1] * v.k,
        });
      }
    },
    [byCode, model, setView],
  );
  useEffect(() => reveal(selected), [selected, reveal]);
  useEffect(() => reveal(active), [active, reveal]);

  // ---- Tooltip e hover (DOM direto) ----
  const hideTip = useCallback(() => {
    if (tipRef.current) tipRef.current.style.display = 'none';
    hoverRef.current?.setAttribute('d', '');
    hoverCode.current = null;
  }, []);
  const showTip = useCallback(
    (code: string, x: number, y: number) => {
      const p = byCode.get(code);
      const tip = tipRef.current;
      const wrap = wrapRef.current;
      if (!p || !tip || !wrap) return;
      if (hoverCode.current !== code) {
        hoverCode.current = code;
        hoverRef.current?.setAttribute('d', p.outline);
        if (tipNameRef.current) tipNameRef.current.textContent = p.name;
        if (tipValueRef.current)
          tipValueRef.current.textContent = valueText(layer, values.get(code));
      }
      const w = wrap.clientWidth;
      tip.style.display = 'block';
      tip.style.transform = `translate(${Math.min(w - 8, Math.max(8, x))}px, ${Math.max(40, y)}px) translate(-50%, calc(-100% - 12px))`;
    },
    [byCode, layer, values],
  );
  // Ao mudar de camada o texto do tooltip muda: esconde-se e volta ao próximo movimento.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a camada e os valores invalidam o tooltip
  useEffect(() => hideTip(), [layer, values, hideTip]);

  // ---- Ponteiro: hover, arrastar, pinça e clique ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: 0, pinch: 0, suppress: false });
  const codeAt = (t: EventTarget | null) =>
    t instanceof Element ? (t.closest('[data-code]')?.getAttribute('data-code') ?? null) : null;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) gesture.current.moved = 0;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current.pinch = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const unitPx = rect.width / model.width;
    const prev = pointers.current.get(e.pointerId);
    if (prev) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gesture.current;
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        if (a && b) {
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (g.pinch > 0 && dist > 0) {
            const v = viewRef.current;
            setView(
              zoomAt(
                v,
                (v.k * dist) / g.pinch,
                ((a.x + b.x) / 2 - rect.left) / unitPx,
                ((a.y + b.y) / 2 - rect.top) / unitPx,
                model.width,
                model.height,
              ),
            );
          }
          g.pinch = dist;
          g.moved = DRAG_PX + 1;
          hideTip();
        }
        return;
      }
      if (viewRef.current.k > 1.001 && e.buttons !== 0) {
        g.moved += Math.abs(dx) + Math.abs(dy);
        if (g.moved > DRAG_PX) {
          if (!wrap.hasPointerCapture(e.pointerId)) wrap.setPointerCapture(e.pointerId);
          hideTip();
          const v = viewRef.current;
          setView({ k: v.k, tx: v.tx + dx / unitPx, ty: v.ty + dy / unitPx });
          return;
        }
      }
    }
    if (e.pointerType !== 'mouse' || e.buttons !== 0) return;
    const code = codeAt(e.target);
    if (code) showTip(code, e.clientX - rect.left, e.clientY - rect.top);
    else hideTip();
  };
  const endPointer = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    gesture.current.pinch = 0;
    if (gesture.current.moved > DRAG_PX) {
      gesture.current.suppress = true;
      window.setTimeout(() => {
        gesture.current.suppress = false;
      }, 0);
    }
    if (wrapRef.current?.hasPointerCapture(e.pointerId)) {
      wrapRef.current.releasePointerCapture(e.pointerId);
    }
  };
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (gesture.current.suppress) return;
    const code = codeAt(e.target);
    if (!code) return;
    setActive(code);
    onSelect(code === selected ? null : code);
  };

  // ---- Teclado ----
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = ARROWS[e.key];
    if (dir) {
      e.preventDefault();
      const from = active ?? selected ?? fallbackCode;
      if (!from) return;
      const next = active
        ? neighbourInDirection(
            model.parishes.map((p) => ({ code: p.code, x: p.anchor[0], y: p.anchor[1] })),
            from,
            dir,
          )
        : from;
      if (next) setActive(next);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const code = active ?? selected ?? fallbackCode;
      if (code) onSelect(code);
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomBy(1.6);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomBy(1 / 1.6);
    } else if (e.key === '0') {
      e.preventDefault();
      reset();
    } else if (e.key === 'Escape') {
      if (viewRef.current.k > 1.001) {
        e.preventDefault();
        reset();
      } else if (selected) {
        e.preventDefault();
        onSelect(null);
      }
    }
  };

  const selectedShape = selected ? byCode.get(selected) : undefined;
  const activeShape = focused && active && active !== selected ? byCode.get(active) : undefined;
  const ratio = model.width / model.height;

  return (
    <div className={cn('nv-map flex min-w-0 flex-col gap-3', className)}>
      <style>{MAP_CSS}</style>
      <LayerSwitch layer={layer} onChange={onLayerChange} />

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground leading-snug">
        {meta?.estimate && <EstimateTag />}
        <span>{info.description()}</span>
      </p>

      <div
        className="relative mx-auto w-full"
        style={{ maxWidth: `max(18rem, min(100%, calc((100dvh - 14rem) * ${ratio.toFixed(4)})))` }}
      >
        <div
          ref={wrapRef}
          role="listbox"
          tabIndex={0}
          aria-label={m.home_map_aria_room({ count: model.parishes.length, layer: info.label() })}
          aria-activedescendant={focused && active ? `${uid}-${active}` : undefined}
          className="relative w-full touch-pan-y select-none rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
          style={{ aspectRatio: `${model.width} / ${model.height}` }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            setFocused(true);
            setActive((a) => a ?? selected ?? fallbackCode);
          }}
          onBlur={() => setFocused(false)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onPointerLeave={(e) => e.pointerType === 'mouse' && hideTip()}
          onClick={onClick}
        >
          <svg
            role="presentation"
            viewBox={`0 0 ${model.width} ${model.height}`}
            className="absolute inset-0 block h-full w-full overflow-hidden"
          >
            <defs>
              <pattern
                ref={hatchRef}
                id={hatchId}
                patternUnits="userSpaceOnUse"
                width="8"
                height="8"
                patternTransform="rotate(45)"
              >
                <rect width="8" height="8" fill="var(--nv-nodata)" />
                <rect width="2.2" height="8" fill="var(--nv-stripe)" />
              </pattern>
            </defs>
            <g ref={geoRef}>
              <path d={model.borders} className="nv-underlay" pointerEvents="none" />
              <Fills items={items} uid={uid} selected={selected} />
              <path d={model.borders} className="nv-casing" pointerEvents="none" />
              <path d={model.borders} className="nv-line" pointerEvents="none" />
              {covered && (
                <g pointerEvents="none">
                  {model.parishes
                    .filter((p) => covered.has(p.code))
                    .map((p) => (
                      <g key={p.code}>
                        <path d={p.outline} className="nv-cov-casing" />
                        <path d={p.outline} className="nv-cov-line" />
                      </g>
                    ))}
                </g>
              )}
              {selectedShape && (
                <g pointerEvents="none">
                  <path
                    d={selectedShape.outline}
                    className="nv-sel-fill"
                    style={{ fill: paints.get(selectedShape.code)?.fill }}
                  />
                  <path d={selectedShape.outline} className="nv-sel-casing" />
                  <path d={selectedShape.outline} className="nv-sel-line" />
                </g>
              )}
              {activeShape && <path d={activeShape.outline} className="nv-active" />}
              <path ref={hoverRef} d="" className="nv-hover" />
            </g>
            <g ref={overlayRef} pointerEvents="none">
              {dots.map((d) => (
                <circle
                  key={d.code}
                  ref={(el) => {
                    if (el) dotRefs.current.set(d.code, el);
                    else dotRefs.current.delete(d.code);
                  }}
                  className="nv-dot"
                />
              ))}
              {model.parishes.map((p) => {
                const paint = paints.get(p.code);
                return (
                  <text
                    key={p.code}
                    ref={(el) => {
                      if (el) labelRefs.current.set(p.code, el);
                      else labelRefs.current.delete(p.code);
                    }}
                    className="nv-label"
                    style={{ display: 'none', fill: paint?.text, stroke: paint?.halo }}
                  />
                );
              })}
            </g>
          </svg>
          <div
            ref={tipRef}
            role="presentation"
            className="pointer-events-none absolute top-0 left-0 z-10 hidden w-max max-w-[16rem] rounded-md bg-foreground px-3 py-2 text-background text-sm leading-snug shadow-lg"
          >
            <span ref={tipNameRef} className="block font-semibold" />
            <span ref={tipValueRef} className="block tabular-nums" />
          </div>
        </div>

        <div className="absolute top-2 left-2 flex flex-col gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 bg-card shadow-sm"
            onClick={() => zoomBy(1.6)}
            aria-label={m.home_map_zoom_in()}
          >
            <Plus className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 bg-card shadow-sm"
            onClick={() => zoomBy(1 / 1.6)}
            disabled={!zoomed}
            aria-label={m.home_map_zoom_out()}
          >
            <Minus className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 bg-card shadow-sm"
            onClick={reset}
            disabled={!zoomed}
            aria-label={m.home_map_zoom_reset()}
          >
            <Maximize2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <MapLegend layer={layer} scale={scale} values={values} hasNoData={hasNoData} />

      {coveredNote && (
        <p className="flex items-start gap-2 text-[13px] leading-relaxed">
          <span className="nv-covered-key mt-1 size-3.5 shrink-0 rounded-sm" aria-hidden="true" />
          {coveredNote}
        </p>
      )}
      <p className="text-muted-foreground text-xs leading-relaxed">
        <span className="max-sm:hidden">{m.home_map_keys()} </span>
        {m.home_map_honesty()}
      </p>
    </div>
  );
}
