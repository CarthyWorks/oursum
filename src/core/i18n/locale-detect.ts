// src/core/i18n/locale-detect.ts
// Bun-side only — uses Intl global (system locale detection).
// RULE: Zero Electrobun imports. Importable by bare `bun test`.
// RULE: NEVER import from src/renderer/ or src/main/.
import { SupportedLanguage, type LocaleSettings } from './types';

const LANGUAGE_MAP: Record<string, SupportedLanguage> = {
  it: SupportedLanguage.IT,
  de: SupportedLanguage.DE,
  fr: SupportedLanguage.FR,
  es: SupportedLanguage.ES,
  en: SupportedLanguage.EN,
};

const NUMBER_FORMAT_MAP: Record<SupportedLanguage, string> = {
  [SupportedLanguage.IT]: '1.234,56',
  [SupportedLanguage.DE]: '1.234,56',
  [SupportedLanguage.FR]: '1 234,56',
  [SupportedLanguage.EN]: '1,234.56',
  [SupportedLanguage.ES]: '1,234.56',
};

function mapLanguage(localeTag: string): SupportedLanguage {
  const primary = localeTag.split('-')[0].toLowerCase();
  return LANGUAGE_MAP[primary] ?? SupportedLanguage.EN;
}

function mapNumberFormat(language: SupportedLanguage): string {
  return NUMBER_FORMAT_MAP[language];
}

function mapDateFormat(localeTag: string): string {
  // US English is the only locale using MM/DD/YYYY
  // Use startsWith to handle BCP 47 extension subtags (e.g. 'en-US-u-ca-gregory')
  if (localeTag.startsWith('en-US')) return 'mm/dd/yyyy';
  return 'dd/mm/yyyy';
}

/**
 * Detects the OS locale via Bun's Intl global and returns a complete LocaleSettings.
 * This function is synchronous and NEVER fails — it always returns a valid result.
 * Must be called from Bun process only (not renderer).
 */
export function detectOSLocale(): LocaleSettings {
  const localeTag = Intl.DateTimeFormat().resolvedOptions().locale;
  const language = mapLanguage(localeTag);
  return {
    language,
    numberFormat: mapNumberFormat(language),
    dateFormat: mapDateFormat(localeTag),
    currencySymbol: '€',
  };
}
