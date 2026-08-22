import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { THEME_OPTIONS } from '@/lib/constants';

type Theme = (typeof THEME_OPTIONS)[keyof typeof THEME_OPTIONS];
type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return THEME_OPTIONS.SYSTEM;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === THEME_OPTIONS.LIGHT || stored === THEME_OPTIONS.DARK ? stored : THEME_OPTIONS.SYSTEM;
}

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(theme: Theme): ResolvedTheme {
  return theme === THEME_OPTIONS.DARK || (theme === THEME_OPTIONS.SYSTEM && prefersDark()) ? 'dark' : 'light';
}

function applyResolvedTheme(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolve(theme));

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    const resolved = resolve(next);
    setResolvedTheme(resolved);
    applyResolvedTheme(resolved);
  }, []);

  useEffect(() => {
    if (theme !== THEME_OPTIONS.SYSTEM) return undefined;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    function onChange() {
      const resolved = resolve(THEME_OPTIONS.SYSTEM);
      setResolvedTheme(resolved);
      applyResolvedTheme(resolved);
    }

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export default ThemeProvider;
