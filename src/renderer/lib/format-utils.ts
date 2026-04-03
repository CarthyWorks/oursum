// src/renderer/lib/format-utils.ts
// Shared formatting utilities for filter components.

/** Replace {key} placeholders in a template string with the given values. */
export function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

function parseFormatSeparators(template: string): { thousands: string; decimal: string } {
  return { thousands: template[1], decimal: template[5] };
}

/**
 * Format a numeric value using the locale's numberFormat template (e.g. '1,234.56').
 * Always renders two decimal places.
 */
export function formatNumberValue(value: number, numberFormat: string): string {
  const { thousands, decimal } = parseFormatSeparators(numberFormat);
  const [intPart, fracPart] = value.toFixed(2).split('.');
  const formattedInteger = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  return `${formattedInteger}${decimal}${fracPart}`;
}

/**
 * Parse a formatted numeric string (using the provided number format template)
 * and return a Number value or null when parsing fails.
 */
export function parseFormattedNumber(formatted: string, numberFormat: string): number | null {
  if (!formatted) return null;
  const { thousands, decimal } = parseFormatSeparators(numberFormat);
  // Strip currency symbols, spaces and any characters except digits, minus and separators
  const allowed = new RegExp(`[^0-9\\-\\${thousands}\\${decimal}]`, 'g');
  const cleaned = formatted.replace(allowed, '');
  if (cleaned === '' || cleaned === '-' || cleaned === `-${decimal}`) return null;
  // Remove thousands separators then replace decimal separator with '.' before parse
  const removedThousands = thousands ? cleaned.split(thousands).join('') : cleaned;
  const normalized = decimal === '.' ? removedThousands : removedThousands.split(decimal).join('.');
  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}
