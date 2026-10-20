import { dataSaver } from '@/lib/motion';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const BASE = '/landing';

const set = (name: string, widths: readonly number[], saver: boolean) =>
  (saver ? widths.slice(0, 1) : widths).map((w) => `${BASE}/${name}-${w}.avif ${w}w`).join(', ');

/** Painel do ecrã de entrada (3:4, 960/1440 px). Lazy: é decorativo e não pode competir com o formulário. */
export function PanelPicture({ className }: { className?: string }) {
  const tone = useTheme().resolvedTheme;
  const saver = dataSaver();
  return (
    <picture>
      <source
        type="image/avif"
        srcSet={set(`login-painel-${tone}`, [960, 1440], saver)}
        sizes="(min-width: 1024px) 54vw, 100vw"
      />
      <img
        src={`${BASE}/login-painel-${tone}-960.avif`}
        alt=""
        width={960}
        height={1280}
        loading="lazy"
        decoding="async"
        className={cn('size-full object-cover object-[58%_60%]', className)}
      />
    </picture>
  );
}
