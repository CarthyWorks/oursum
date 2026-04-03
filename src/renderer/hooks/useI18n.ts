// src/renderer/hooks/useI18n.ts
// Returns a translation function keyed on the current locale language.
// Dictionaries are statically imported so Vite bundles them at build time.
// RULE: No Bun.file() — renderer has no filesystem access.
import { useLocale } from '../context/locale-context';
import { SupportedLanguage } from '../../core/i18n/types';
import enDict from '../../core/i18n/dictionaries/en.json';
import itDict from '../../core/i18n/dictionaries/it.json';
import deDict from '../../core/i18n/dictionaries/de.json';
import frDict from '../../core/i18n/dictionaries/fr.json';
import esDict from '../../core/i18n/dictionaries/es.json';

type Dictionary = Record<string, string>;

const DICTIONARIES: Record<SupportedLanguage, Dictionary> = {
  [SupportedLanguage.EN]: enDict,
  [SupportedLanguage.IT]: itDict,
  [SupportedLanguage.DE]: deDict,
  [SupportedLanguage.FR]: frDict,
  [SupportedLanguage.ES]: esDict,
};

/** Returns a `t(key)` function that resolves to the active language's translation,
 *  falling back to the key itself if not found. */
export function useI18n(): (key: string) => string {
  const locale = useLocale();
  const dict =
    DICTIONARIES[locale.language as SupportedLanguage] ??
    DICTIONARIES[SupportedLanguage.EN];
  return (key: string) => dict[key] ?? key;
}
