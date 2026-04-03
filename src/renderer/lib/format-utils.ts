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
