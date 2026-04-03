// src/renderer/hooks/useFormatDate.ts
// Architecture directive: date DISPLAY uses Intl.DateTimeFormat (renderer only).
// Core formatDate() handles CSV parsing (different purpose — exact format compliance).
import { useCallback } from 'react';
import { useLocale } from '../context/locale-context';
import { SupportedLanguage, type LocaleSettings } from '../../core/i18n/types';

const LOCALE_TAGS: Record<SupportedLanguage, string> = {
  [SupportedLanguage.EN]: 'en-GB',
  [SupportedLanguage.IT]: 'it-IT',
  [SupportedLanguage.DE]: 'de-DE',
  [SupportedLanguage.FR]: 'fr-FR',
  [SupportedLanguage.ES]: 'es-ES',
};

function getDateParts(isoDate: string, language: SupportedLanguage) {
  const formatter = new Intl.DateTimeFormat(LOCALE_TAGS[language], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  });
  const parts = formatter.formatToParts(new Date(`${isoDate}T00:00:00Z`));

  return {
    day: parts.find((part) => part.type === 'day')?.value ?? '',
    month: parts.find((part) => part.type === 'month')?.value ?? '',
    year: parts.find((part) => part.type === 'year')?.value ?? '',
  };
}

export function formatDateForDisplay(isoDate: string, locale: LocaleSettings): string {
  const { day, month, year } = getDateParts(isoDate, locale.language);

  switch (locale.dateFormat) {
    case 'dd/mm/yyyy':
      return `${day}/${month}/${year}`;
    case 'mm/dd/yyyy':
      return `${month}/${day}/${year}`;
    case 'yyyy-mm-dd':
      return `${year}-${month}-${day}`;
    default:
      return isoDate;
  }
}

/**
 * Returns a date formatter using Intl.DateTimeFormat parts with the selected
 * display order from locale.dateFormat.
 */
export function useFormatDate(): (isoDate: string) => string {
  const locale = useLocale();

  return useCallback(
    (isoDate: string) => formatDateForDisplay(isoDate, locale),
    [locale]
  );
}
