import { format, isValid, parse } from 'date-fns';

function normalizeLocaleFormat(localeFormat: string): string {
  return localeFormat.trim().toLowerCase();
}

function parseDateToISOWithFormat(raw: string, localeFormat: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }

  try {
    const parsed = parse(trimmed, localeFormatToDateFns(localeFormat), new Date());
    return isValid(parsed) ? format(parsed, 'yyyy-MM-dd') : null;
  } catch {
    return null;
  }
}

export function localeFormatToDateFns(localeFormat: string): string {
  switch (normalizeLocaleFormat(localeFormat)) {
    case 'dd/mm/yyyy':
      return 'dd/MM/yyyy';
    case 'mm/dd/yyyy':
      return 'MM/dd/yyyy';
    case 'yyyy-mm-dd':
      return 'yyyy-MM-dd';
    default:
      return localeFormat;
  }
}

export function resolveBestDateFormat(rawDates: string[], preferredFormat: string): string {
  const nonEmptyDates = rawDates.map((value) => value.trim()).filter((value) => value !== '');
  if (nonEmptyDates.length === 0) {
    return preferredFormat;
  }

  const candidates = Array.from(
    new Set([preferredFormat, 'dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd'].map(normalizeLocaleFormat)),
  );

  let bestFormat = normalizeLocaleFormat(preferredFormat);
  let bestScore = -1;

  for (const candidate of candidates) {
    const score = nonEmptyDates.reduce((count, rawDate) => {
      return count + (parseDateToISOWithFormat(rawDate, candidate) !== null ? 1 : 0);
    }, 0);

    if (score > bestScore) {
      bestFormat = candidate;
      bestScore = score;
    }
  }

  return bestFormat;
}

export function parseDateToISO(raw: string, localeFormat: string): string | null {
  return parseDateToISOWithFormat(raw, normalizeLocaleFormat(localeFormat));
}