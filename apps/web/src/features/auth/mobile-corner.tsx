import { useEffect, useState } from 'react';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const QUERY = '(max-width: 1023.98px)';

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const update = () => setNarrow(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return narrow;
}

/**
 * Fundo muito subtil da Penha no canto inferior direito do ecrã de entrada em telemóvel (em desktop já existe o painel
 * de imagem). `absolute` (não `fixed`) para não se mexer com o teclado; dissolve-se por máscara radial a partir do
 * canto; decorativo; só monta (e só pede a imagem) abaixo de 1024 px. Opacidade: 62 % no escuro, 66 % no claro.
 */
export function MobileCorner() {
  const tone = useTheme().resolvedTheme;
  const narrow = useNarrow();
  if (!narrow) return null;
  const dark = tone === 'dark';
  const mask = `radial-gradient(ellipse ${dark ? '95% 62%' : '105% 56%'} at 100% 100%, #000 0%, rgb(0 0 0 / ${dark ? '0.7' : '0.85'}) 42%, transparent 100%)`;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className={cn(
          'absolute right-0 bottom-0 h-[min(110vw,480px)] w-[min(125vw,560px)] overflow-hidden',
          dark ? 'opacity-[0.62]' : 'opacity-[0.66] mix-blend-multiply',
        )}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        <img
          src={`/landing/login-painel-${tone}-960.avif?v=penha2`}
          alt=""
          width={960}
          height={1280}
          loading="lazy"
          decoding="async"
          // A imagem desce um pouco: o campanário da Penha (a ~55–70 % da altura) cai entre o formulário e o rodapé.
          className="absolute right-0 -bottom-[min(28vw,120px)] h-auto w-full max-w-none"
        />
      </div>
    </div>
  );
}
