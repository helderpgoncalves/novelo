import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Download, Maximize2, Printer } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getQuickJoinQrOptions } from '@/client/@tanstack/react-query.gen';
import { BrandLogo } from '@/components/brand-logo';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { m } from '@/paraglide/messages';
import { shortHost } from './qr-url';

function useQrImage() {
  const qr = useQuery({ ...getQuickJoinQrOptions(), staleTime: 5 * 60_000 });
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const svg = qr.data?.svg;

  useEffect(() => {
    if (!svg) return;
    // Alguns browsers só desenham SVG com tipo MIME explícito.
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    setBlobUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [svg]);

  return { qr, blobUrl, link: qr.data ? { url: qr.data.url, code: qr.data.code } : null };
}

// Cores fixas (marca): o cartaz imprime-se e projeta-se igual em tema claro e escuro.
function Poster({ blobUrl, host }: { blobUrl: string | null; host: string }) {
  return (
    <div
      id="event-poster"
      data-testid="event-poster"
      className="@container aspect-[1/1.4142] w-full overflow-hidden bg-[#f4f1ea] text-[#14211d] [print-color-adjust:exact]"
    >
      <div className="flex h-full flex-col items-center justify-between p-[7cqw] text-center">
        <BrandLogo tone="color" className="h-[8cqw]" />
        <div className="space-y-[2.5cqw]">
          <p className="font-semibold text-[#2e6b57] text-[2.4cqw] uppercase tracking-[0.18em]">
            {m.auth_aside_eyebrow()}
          </p>
          <h2 className="text-balance font-serif text-[8cqw] leading-[1.05]">
            {m.poster_headline_pt()}
          </h2>
          <p className="text-balance text-[#14211d]/70 text-[3.6cqw] leading-snug" lang="en">
            {m.poster_headline_en()}
          </p>
        </div>
        <div className="rounded-[3cqw] bg-white p-[3cqw] shadow-sm ring-1 ring-[#14211d]/10">
          {blobUrl ? (
            <img src={blobUrl} alt={m.poster_qr_alt()} className="size-[58cqw]" />
          ) : (
            <div className="size-[58cqw]" />
          )}
        </div>
        <div className="space-y-[1.2cqw]">
          <p className="font-serif text-[6cqw] leading-none">{host}</p>
          <p className="text-[#14211d]/60 text-[2.6cqw]">{m.poster_footer()}</p>
        </div>
      </div>
    </div>
  );
}

const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 0; }
  html, body { background: #f4f1ea !important; }
  body * { visibility: hidden !important; }
  [data-slot="dialog-content"] { transform: none !important; animation: none !important; overflow: visible !important; max-height: none !important; }
  #event-poster, #event-poster * { visibility: visible !important; }
  #event-poster { position: fixed; inset: 0; width: 100vw !important; height: 100vh; aspect-ratio: auto; }
}`;

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(m.poster_copy_failed());
    }
  };
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="font-medium text-sm">
        {label}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          readOnly
          value={value}
          className="h-10 font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 shrink-0"
          onClick={copy}
          aria-label={m.poster_copy_aria({ what: label })}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}

/** Cartaz do QR do evento: pronto a imprimir (A4), a projetar em ecrã inteiro ou a descarregar em SVG. */
export function EventPoster() {
  const { qr, blobUrl, link } = useQrImage();
  const stage = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  if (qr.isError) return <ErrorState error={qr.error} onRetry={() => void qr.refetch()} />;

  const host = shortHost(link?.url ?? window.location.href);
  const ready = qr.isSuccess && blobUrl;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
      <style>{PRINT_CSS}</style>
      <div
        ref={stage}
        className={
          fullscreen ? 'flex h-dvh w-screen items-center justify-center bg-[#f4f1ea]' : undefined
        }
      >
        {ready || qr.isSuccess ? (
          <div
            className={
              fullscreen
                ? undefined
                : 'mx-auto w-full max-w-sm overflow-hidden rounded-xl shadow-sm ring-1 ring-foreground/10 lg:max-w-none'
            }
            style={fullscreen ? { width: 'min(100vw, calc(100dvh / 1.4142))' } : undefined}
          >
            <Poster blobUrl={blobUrl} host={host} />
          </div>
        ) : (
          <Skeleton className="mx-auto aspect-[1/1.4142] w-full max-w-sm rounded-xl lg:max-w-none" />
        )}
      </div>

      <div className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-2xl">{m.poster_actions_title()}</h2>
          <p className="max-w-prose text-muted-foreground text-sm leading-relaxed">
            {m.poster_actions_text()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="h-10 gap-2" disabled={!ready} onClick={() => window.print()}>
            <Printer aria-hidden="true" /> {m.poster_print()}
          </Button>
          <Button variant="outline" className="h-10 gap-2" disabled={!ready} asChild={!!ready}>
            {ready ? (
              <a href={blobUrl} download="novelo-qr.svg">
                <Download aria-hidden="true" /> {m.poster_download()}
              </a>
            ) : (
              <span>
                <Download aria-hidden="true" /> {m.poster_download()}
              </span>
            )}
          </Button>
          {typeof document !== 'undefined' && document.fullscreenEnabled && (
            <Button
              variant="outline"
              className="h-10 gap-2"
              disabled={!ready}
              onClick={() => void stage.current?.requestFullscreen()}
            >
              <Maximize2 aria-hidden="true" /> {m.poster_fullscreen()}
            </Button>
          )}
        </div>
        {link ? (
          <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-muted-foreground text-xs leading-relaxed">
              {m.poster_secret_note()}
            </p>
            <CopyField label={m.poster_link()} value={link.url} />
            <CopyField label={m.poster_code()} value={link.code} />
          </div>
        ) : (
          qr.isSuccess && (
            <p className="text-muted-foreground text-xs">{m.poster_link_unreadable()}</p>
          )
        )}
      </div>
    </div>
  );
}
