import { CircleCheckIcon, InfoIcon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { BrandSpinner } from '@/components/brand-logo';
import { useTheme } from '@/lib/theme';

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <BrandSpinner className="size-4" />,
      }}
      // Fora das zonas do sistema: acima da barra de separadores (--tabbar-h inclui a barra inicial; sem barra, só esta) e do entalhe.
      offset={{
        bottom: 'calc(var(--tabbar-h, env(safe-area-inset-bottom)) + 24px)',
        right: 'calc(env(safe-area-inset-right) + 24px)',
      }}
      mobileOffset={{
        bottom: 'calc(var(--tabbar-h, env(safe-area-inset-bottom)) + 12px)',
        left: 'calc(env(safe-area-inset-left) + 12px)',
        right: 'calc(env(safe-area-inset-right) + 12px)',
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
