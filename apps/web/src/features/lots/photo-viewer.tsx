import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPhotoCredit } from '@/lib/lot-photos';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

export interface ViewerPhoto {
  id: string;
  src: string;
  alt: string;
  credit: string | null;
}

/**
 * Miniatura quadrada com dimensões fixas (o layout não salta), `loading="lazy"`, esqueleto enquanto chega
 * e um marcador discreto se falhar. Com `onOpen` torna-se um botão que amplia.
 */
export function ItemThumb({
  src,
  alt,
  size = 56,
  fluid = false,
  onOpen,
  openLabel,
  className,
}: {
  src: string;
  alt: string;
  /** Lado em px (também `width`/`height` do `<img>`). */
  size?: number;
  /** Ocupa a largura da célula (grelha do passaporte) em vez de `size`. */
  fluid?: boolean;
  onOpen?: () => void;
  openLabel?: string;
  className?: string;
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const ref = useRef<HTMLImageElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: nova origem, novo carregamento
  useEffect(() => {
    const img = ref.current;
    setState(img?.complete ? (img.naturalWidth > 0 ? 'ready' : 'error') : 'loading');
  }, [src]);

  const box = (
    <span
      className={cn(
        'relative block aspect-square shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10',
        fluid && 'w-full',
        className,
      )}
      style={fluid ? undefined : { width: size }}
    >
      {state === 'loading' && (
        <Skeleton className="absolute inset-0 rounded-none" aria-hidden="true" />
      )}
      {state === 'error' ? (
        <span
          className="absolute inset-0 grid place-items-center text-muted-foreground"
          role="img"
          aria-label={m.lotphoto_load_error()}
          title={m.lotphoto_load_error()}
        >
          <ImageOff className="size-1/3" aria-hidden="true" />
        </span>
      ) : (
        <img
          ref={ref}
          src={src}
          alt={alt}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
          className={cn(
            'size-full object-cover transition-opacity',
            state === 'ready' ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </span>
  );
  if (!onOpen || state === 'error') return box;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={openLabel}
      className={cn(
        'relative inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        fluid && 'w-full',
      )}
    >
      {box}
    </button>
  );
}

/** Ampliação acessível: diálogo com foco preso, Esc fecha, setas navegam, texto alternativo e crédito. */
export function PhotoViewer({
  photos,
  index,
  onIndexChange,
}: {
  photos: ViewerPhoto[];
  /** `null` fechado. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
}) {
  const open = index !== null;
  const photo = index === null ? undefined : photos[index];
  const total = photos.length;
  const [failed, setFailed] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: repõe o erro ao mudar de fotografia
  useEffect(() => setFailed(false), [photo?.id]);

  const go = (delta: number) => {
    if (index === null || total === 0) return;
    onIndexChange((index + delta + total) % total);
  };
  const credit = formatPhotoCredit(photo?.credit);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onIndexChange(null)}>
      <DialogContent
        className="sm:max-w-2xl"
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') go(-1);
          else if (e.key === 'ArrowRight') go(1);
          else return;
          e.preventDefault();
        }}
      >
        {photo && index !== null && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-8 text-base">
                {m.lotphoto_viewer_title({ current: index + 1, total })}
              </DialogTitle>
              <DialogDescription className="break-words">{photo.alt}</DialogDescription>
            </DialogHeader>
            <div className="grid min-h-48 place-items-center overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
              {failed ? (
                <p
                  className="flex items-center gap-2 p-6 text-muted-foreground text-sm"
                  role="alert"
                >
                  <ImageOff className="size-4" aria-hidden="true" /> {m.lotphoto_load_error()}
                </p>
              ) : (
                <img
                  key={photo.id}
                  src={photo.src}
                  alt={photo.alt}
                  onError={() => setFailed(true)}
                  className="max-h-[60dvh] w-full object-contain"
                />
              )}
            </div>
            {credit && <p className="break-words text-muted-foreground text-xs">{credit}</p>}
            {total > 1 && (
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 gap-1.5"
                  onClick={() => go(-1)}
                >
                  <ChevronLeft aria-hidden="true" /> {m.lotphoto_prev()}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 gap-1.5"
                  onClick={() => go(1)}
                >
                  {m.lotphoto_next()} <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
