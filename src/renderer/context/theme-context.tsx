// src/renderer/context/theme-context.tsx
// RULE: No Bun imports, no node:fs — renderer isolation boundary.
// All persistence goes through IPC → UPDATE_PREFERENCES.
import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';

type Theme = 'mountain' | 'seaside';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: Theme;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(initialTheme ?? 'mountain');

  // Keep [data-theme] on <html> in sync with React state
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Returns the current theme value. Re-renders when theme changes. */
export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx.theme;
}

/** Returns the theme setter. Used by PreferencesPopover to apply live switching. */
export function useSetTheme(): (t: Theme) => void {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useSetTheme must be used within <ThemeProvider>');
  return ctx.setTheme;
}
