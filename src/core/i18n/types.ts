// src/core/i18n/types.ts
// RULE: types and enum values only — no Bun APIs, no DOM, no Intl calls at module level.
export enum SupportedLanguage {
  EN = 'en',
  IT = 'it',
  DE = 'de',
  FR = 'fr',
  ES = 'es',
}

export interface LocaleSettings {
  language: SupportedLanguage;
  numberFormat: string;   // '1,234.56' | '1.234,56' | '1 234,56'
  dateFormat: string;     // 'dd/mm/yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd'
  currencySymbol: string; // '€' | '$' | '£' | '' (empty = no symbol appended)
}
