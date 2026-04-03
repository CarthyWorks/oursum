function stripNonNumericDecorators(raw: string): string {
  return raw
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/[^\d.,-]+/g, '');
}

function normalizeWithDecimalSeparator(value: string, decimalSeparator: '.' | ','): string {
  const lastDecimalIndex = value.lastIndexOf(decimalSeparator);
  const integerPart = value.slice(0, lastDecimalIndex).replace(/[.,]/g, '');
  const fractionalPart = value.slice(lastDecimalIndex + 1).replace(/[.,]/g, '');
  return `${integerPart}.${fractionalPart}`;
}

export function parseAmountString(raw: string): number | null {
  const cleaned = stripNonNumericDecorators(raw);
  if (cleaned === '' || !/\d/.test(cleaned)) {
    return null;
  }

  const isNegative = cleaned.includes('-');
  const unsigned = cleaned.replace(/-/g, '');
  if (unsigned === '') {
    return null;
  }

  const hasDot = unsigned.includes('.');
  const hasComma = unsigned.includes(',');
  let normalized = unsigned;

  if (hasDot && hasComma) {
    normalized = normalizeWithDecimalSeparator(
      unsigned,
      unsigned.lastIndexOf('.') > unsigned.lastIndexOf(',') ? '.' : ',',
    );
  } else if (hasComma) {
    normalized =
      unsigned.indexOf(',') === unsigned.lastIndexOf(',')
        ? unsigned.replace(',', '.')
        : normalizeWithDecimalSeparator(unsigned, ',');
  } else if (hasDot && unsigned.indexOf('.') !== unsigned.lastIndexOf('.')) {
    normalized = normalizeWithDecimalSeparator(unsigned, '.');
  }

  const parsed = Number.parseFloat(isNegative ? `-${normalized}` : normalized);
  return Number.isNaN(parsed) ? null : parsed;
}