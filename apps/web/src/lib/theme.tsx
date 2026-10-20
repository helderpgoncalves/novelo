import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'novelo-theme';
const MEDIA = '(prefers-color-scheme: dark)';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const readStored = (): Theme => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
};

const resolve = (theme: Theme): 'light' | 'dark' =>
  theme === 'system' ? (window.matchMedia(MEDIA).matches ? 'dark' : 'light') : theme;

/** Cores da barra do sistema (mesmas do fundo do topo: linho e tinta). */
export const THEME_COLOR = { light: '#F4F1EA', dark: '#0F1815' } as const;

/**
 * Atualiza as `<meta name="theme-color">`. Com tema fixo na app, as duas variantes (por esquema do sistema)
 * ficam com a mesma cor, para a barra do browser seguir a app e não o sistema; em "sistema" voltam as originais.
 */
function syncThemeColor(theme: Theme, resolved: 'light' | 'dark') {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = THEME_COLOR[theme === 'system' ? own : resolved];
  }
}

/** Tema claro, escuro ou automático. O script em index.html aplica-o antes da primeira pintura. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStored);
  const [resolvedTheme, setResolved] = useState<'light' | 'dark'>(() => resolve(readStored()));

  useEffect(() => {
    const apply = () => {
      const next = resolve(theme);
      setResolved(next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      document.documentElement.style.colorScheme = next;
      syncThemeColor(theme, next);
    };
    apply();
    const media = window.matchMedia(MEDIA);
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // armazenamento indisponível (modo privado): o tema vale só nesta sessão
    }
    setThemeState(next);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme tem de estar dentro de <ThemeProvider>');
  return ctx;
}
