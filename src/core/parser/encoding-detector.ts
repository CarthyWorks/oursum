// src/core/parser/encoding-detector.ts
// Detects character encoding from a raw byte buffer.
// RULE: No framework imports — pure Bun/TS logic only.

export type Encoding = 'utf-8' | 'windows-1252' | 'iso-8859-1';

/**
 * Detect the character encoding of a byte buffer.
 *
 * Algorithm (in order):
 * 1. BOM detection: [0xEF, 0xBB, 0xBF] → 'utf-8'
 * 2. Windows-1252 scan: any byte in 0x80–0x9F → 'windows-1252'
 * 3. UTF-8 multi-byte validation: valid continuation sequences found → 'utf-8'
 * 4. Fallback → 'iso-8859-1'
 */
export function detectEncoding(buffer: Uint8Array): Encoding {
  // 1. BOM detection
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return 'utf-8';
  }

  // 2. UTF-8 multi-byte validation (runs BEFORE Windows-1252 scan to avoid
  //    false positives — e.g. German ß = C3 9F where 0x9F is a valid UTF-8
  //    continuation byte but falls in the 0x80–0x9F Windows-1252 range)
  let hasValidMultibyte = false;
  let hasInvalidSequence = false;
  let i = 0;
  while (i < buffer.length) {
    const b = buffer[i];
    if (b <= 0x7f) {
      i++;
      continue;
    }
    if (b >= 0xc2 && b <= 0xdf) {
      // 2-byte sequence
      if (i + 1 < buffer.length && buffer[i + 1] >= 0x80 && buffer[i + 1] <= 0xbf) {
        hasValidMultibyte = true;
        i += 2;
        continue;
      }
      hasInvalidSequence = true;
      break;
    }
    if (b >= 0xe0 && b <= 0xef) {
      // 3-byte sequence
      if (
        i + 2 < buffer.length &&
        buffer[i + 1] >= 0x80 && buffer[i + 1] <= 0xbf &&
        buffer[i + 2] >= 0x80 && buffer[i + 2] <= 0xbf
      ) {
        hasValidMultibyte = true;
        i += 3;
        continue;
      }
      hasInvalidSequence = true;
      break;
    }
    if (b >= 0xf0 && b <= 0xf4) {
      // 4-byte sequence (emoji, supplementary planes)
      if (
        i + 3 < buffer.length &&
        buffer[i + 1] >= 0x80 && buffer[i + 1] <= 0xbf &&
        buffer[i + 2] >= 0x80 && buffer[i + 2] <= 0xbf &&
        buffer[i + 3] >= 0x80 && buffer[i + 3] <= 0xbf
      ) {
        hasValidMultibyte = true;
        i += 4;
        continue;
      }
      hasInvalidSequence = true;
      break;
    }
    // Byte outside valid UTF-8 leading ranges — not valid UTF-8
    hasInvalidSequence = true;
    break;
  }

  if (hasValidMultibyte && !hasInvalidSequence) {
    return 'utf-8';
  }

  // 3. Windows-1252 detection: bytes in 0x80–0x9F are printable in CP1252
  //    but control/undefined in ISO-8859-1 and invalid in UTF-8
  for (let j = 0; j < buffer.length; j++) {
    if (buffer[j] >= 0x80 && buffer[j] <= 0x9f) {
      return 'windows-1252';
    }
  }

  // 4. Fallback: pure ASCII or high ISO-8859-1 bytes (0xA0–0xFF) with no multi-byte sequences
  return 'iso-8859-1';
}
