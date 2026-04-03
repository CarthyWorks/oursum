// src/renderer/context/locale-context.tsx
// Replaces the scaffold version entirely.
// RULE: No Bun.file() — renderer has no filesystem access. No formatAmount/formatDate helpers
//       here — those are in src/renderer/hooks/useFormatAmount.ts and useFormatDate.ts.
import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { LocaleSettings } from '../../core/i18n/types';
import { SupportedLanguage } from '../../core/i18n/types';

// Matches DEFAULT_PREFERENCES in src/core/persistence/defaults.ts
// Inlined here to avoid renderer importing from persistence layer.
const DEFAULT_LOCALE_SETTINGS: LocaleSettings = {
  language: SupportedLanguage.EN,
  numberFormat: '1,234.56',
  dateFormat: 'dd/mm/yyyy',
  currencySymbol: '€',
};

interface LocaleContextValue {
  locale: LocaleSettings;
  setLocale: (settings: LocaleSettings) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

interface LocaleProviderProps {
  children: ReactNode;
  initialLocale?: LocaleSettings; // Story 1.4 will pass loaded preferences here
}

export function LocaleProvider({ children, initialLocale }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<LocaleSettings>(
    initialLocale ?? DEFAULT_LOCALE_SETTINGS
  );

  const setLocale = useCallback((settings: LocaleSettings) => {
    setLocaleState(settings);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

/** Returns the current LocaleSettings. Re-renders when locale changes. */
export function useLocale(): LocaleSettings {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within <LocaleProvider>');
  return ctx.locale;
}

/** Returns the locale setter. Used by Story 1.5 Preferences Popover to apply live changes. */
export function useSetLocale(): (settings: LocaleSettings) => void {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useSetLocale must be used within <LocaleProvider>');
  return ctx.setLocale;
}
