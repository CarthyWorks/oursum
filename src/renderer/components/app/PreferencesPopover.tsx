// src/renderer/components/app/PreferencesPopover.tsx
// RULE: No Bun imports, no node:fs — renderer isolation boundary.
// RULE: All colors via Tailwind token classes — no raw hex, no inline HSL.
// RULE: IPC persist is non-fatal / optimistic — UI never blocks on save.
import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { useLocale, useSetLocale } from '../../context/locale-context';
import { useTheme, useSetTheme } from '../../context/theme-context';
import { useI18n } from '../../hooks/useI18n';
import { webviewRPC } from '../../ipc/bridge';
import { SupportedLanguage, type LocaleSettings } from '../../../core/i18n/types';
import type { Preferences } from '../../../shared/types';

// Language display names (keyed by SupportedLanguage value)
const LANGUAGE_NAMES: Record<string, string> = {
  [SupportedLanguage.EN]: 'English',
  [SupportedLanguage.IT]: 'Italiano',
  [SupportedLanguage.DE]: 'Deutsch',
  [SupportedLanguage.FR]: 'Français',
  [SupportedLanguage.ES]: 'Español',
};

const NUMBER_FORMAT_OPTIONS = ['1,234.56', '1.234,56', '1 234,56'] as const;
const DATE_FORMAT_OPTIONS = ['dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd'] as const;
const CURRENCY_OPTIONS = ['€', '$', '£', '¥'] as const;

export function PreferencesPopover({
  platform,
  dataFolderPath,
  onDataFolderRelocated,
}: {
  platform?: string;
  dataFolderPath?: string;
  onDataFolderRelocated?: (newPath: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [isRelocating, setIsRelocating] = useState(false);
  const locale = useLocale();
  const setLocale = useSetLocale();
  const theme = useTheme();
  const setTheme = useSetTheme();
  const t = useI18n();

  /** Apply a locale change optimistically then persist asynchronously. */
  function applyLocale(updated: LocaleSettings) {
    setLocale(updated);
    persistPreferences(updated, theme);
  }

  /** Apply a theme change optimistically then persist asynchronously. */
  function applyTheme(newTheme: 'mountain' | 'seaside') {
    setTheme(newTheme);
    persistPreferences(locale, newTheme);
  }

  function persistPreferences(currentLocale: LocaleSettings, currentTheme: 'mountain' | 'seaside') {
    const preferences: Preferences = {
      language: currentLocale.language,
      numberFormat: currentLocale.numberFormat,
      dateFormat: currentLocale.dateFormat,
      currencySymbol: currentLocale.currencySymbol,
      theme: currentTheme,
    };
    // Fire-and-forget — never block the UI on the IPC call
    void Promise.resolve(webviewRPC.request.UPDATE_PREFERENCES({ preferences })).catch(
      (err: unknown) => {
        console.warn('[PreferencesPopover] persist failed:', err);
      },
    );
  }

  async function handleChangeDataFolder() {
    setIsRelocating(true);
    try {
      const pickerResult = await webviewRPC.request.OPEN_FOLDER_PICKER();
      if (!pickerResult.path) return; // user cancelled (AC #5 no-op if same path handled by core)
      const relocResult = await webviewRPC.request.RELOCATE_DATA_FOLDER({ newPath: pickerResult.path });
      if (relocResult.ok) {
        onDataFolderRelocated?.(relocResult.newPath);
      } else {
        console.warn('[PreferencesPopover] RELOCATE_DATA_FOLDER failed:', relocResult.error);
      }
    } catch (err) {
      console.warn('[PreferencesPopover] data folder change failed:', err);
    } finally {
      setIsRelocating(false);
    }
  }

  async function handleOpenDataFolder() {
    if (!dataFolderPath) return;
    try {
      const result = await webviewRPC.request.OPEN_DATA_FOLDER({ path: dataFolderPath });
      if (!result.ok) {
        console.warn('[PreferencesPopover] OPEN_DATA_FOLDER failed:', result.error);
      }
    } catch (err) {
      console.warn('[PreferencesPopover] open data folder failed:', err);
    }
  }

  const openFolderLabel =
    platform === 'darwin'
      ? t('prefs.dataFolder.open.finder')
      : platform === 'win32'
        ? t('prefs.dataFolder.open.explorer')
        : t('prefs.dataFolder.open');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Preferences"
          className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          ⚙
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">{t('prefs.title')}</h2>
        </div>

        <div className="px-4 py-3 space-y-4">
          {/* Section: Language & formats */}
          <div className="space-y-3">
            {/* Language */}
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-medium text-muted-foreground w-28 shrink-0">
                {t('prefs.language')}
              </label>
              <select
                value={locale.language}
                onChange={(e) =>
                  applyLocale({ ...locale, language: e.target.value as SupportedLanguage })
                }
                className="flex-1 text-xs rounded-md border border-input bg-background text-foreground px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {Object.values(SupportedLanguage).map((lang) => (
                  <option key={lang} value={lang}>
                    {LANGUAGE_NAMES[lang]}
                  </option>
                ))}
              </select>
            </div>

            {/* Number format */}
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-medium text-muted-foreground w-28 shrink-0">
                {t('prefs.numberFormat')}
              </label>
              <select
                value={locale.numberFormat}
                onChange={(e) => applyLocale({ ...locale, numberFormat: e.target.value })}
                className="flex-1 text-xs rounded-md border border-input bg-background text-foreground px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {NUMBER_FORMAT_OPTIONS.map((fmt) => (
                  <option key={fmt} value={fmt}>
                    {fmt}
                  </option>
                ))}
              </select>
            </div>

            {/* Date format */}
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-medium text-muted-foreground w-28 shrink-0">
                {t('prefs.dateFormat')}
              </label>
              <select
                value={locale.dateFormat}
                onChange={(e) => applyLocale({ ...locale, dateFormat: e.target.value })}
                className="flex-1 text-xs rounded-md border border-input bg-background text-foreground px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {DATE_FORMAT_OPTIONS.map((fmt) => (
                  <option key={fmt} value={fmt}>
                    {fmt}
                  </option>
                ))}
              </select>
            </div>

            {/* Currency symbol */}
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-medium text-muted-foreground w-28 shrink-0">
                {t('prefs.currency')}
              </label>
              <select
                value={locale.currencySymbol}
                onChange={(e) => applyLocale({ ...locale, currencySymbol: e.target.value })}
                className="flex-1 text-xs rounded-md border border-input bg-background text-foreground px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {CURRENCY_OPTIONS.map((sym) => (
                  <option key={sym} value={sym}>
                    {sym}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section: Theme */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground block">
              {t('prefs.theme')}
            </span>
            <div className="flex gap-2">
              <button
                aria-label="Mountain dark"
                onClick={() => applyTheme('mountain')}
                className={`flex-1 text-xs py-1.5 px-2 rounded-md border transition-colors ${
                  theme === 'mountain'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary text-secondary-foreground border-border hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                🌑 Mountain
              </button>
              <button
                aria-label="Seaside light"
                onClick={() => applyTheme('seaside')}
                className={`flex-1 text-xs py-1.5 px-2 rounded-md border transition-colors ${
                  theme === 'seaside'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary text-secondary-foreground border-border hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                ☀️ Seaside
              </button>
            </div>
          </div>

          {/* Section: Data folder */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground block">
              {t('prefs.dataFolder')}
            </span>
            {dataFolderPath && (
              <p
                className="text-xs text-muted-foreground font-mono truncate"
                title={dataFolderPath}
              >
                {dataFolderPath}
              </p>
            )}
            <div className="flex gap-2">
              <button
                disabled={!dataFolderPath}
                onClick={handleOpenDataFolder}
                className="text-xs px-3 py-1.5 rounded-md border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {openFolderLabel}
              </button>
              <button
                disabled={isRelocating}
                onClick={handleChangeDataFolder}
                className="text-xs px-3 py-1.5 rounded-md border border-border bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRelocating ? '…' : t('prefs.dataFolder.change')}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-2 border-t border-border flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{t('prefs.hint')}</p>
          <PopoverPrimitive.Close asChild>
            <button className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity shrink-0">
              {t('prefs.done')}
            </button>
          </PopoverPrimitive.Close>
        </div>
      </PopoverContent>
    </Popover>
  );
}
