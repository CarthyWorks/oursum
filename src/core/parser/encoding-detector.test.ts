// src/core/parser/encoding-detector.test.ts
import { describe, it, expect } from 'bun:test';
import { detectEncoding } from './encoding-detector';

describe('detectEncoding', () => {
  it('pure ASCII buffer → iso-8859-1', () => {
    const buf = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
    expect(detectEncoding(buf)).toBe('iso-8859-1');
  });

  it('buffer with UTF-8 BOM → utf-8', () => {
    const buf = new Uint8Array([0xef, 0xbb, 0xbf, 0x48, 0x65, 0x6c, 0x6c, 0x6f]); // BOM + "Hello"
    expect(detectEncoding(buf)).toBe('utf-8');
  });

  it('buffer with UTF-8 encoded é (0xC3 0xA9) and no 0x80–0x9F bytes → utf-8', () => {
    // "café" in UTF-8: 0x63 0x61 0x66 0xC3 0xA9
    const buf = new Uint8Array([0x63, 0x61, 0x66, 0xc3, 0xa9]);
    expect(detectEncoding(buf)).toBe('utf-8');
  });

  it('buffer with Windows-1252 byte 0x93 (left double quotation mark) → windows-1252', () => {
    const buf = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x93]); // "Hello" + 0x93
    expect(detectEncoding(buf)).toBe('windows-1252');
  });

  it('buffer with ISO-8859-1 byte 0xE9 (é in Latin-1) and no valid UTF-8 multi-byte → iso-8859-1', () => {
    // 0xE9 alone is not a valid UTF-8 start byte without two valid continuation bytes
    const buf = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0xe9]); // "Hello" + 0xE9 standalone
    expect(detectEncoding(buf)).toBe('iso-8859-1');
  });

  it('empty buffer → iso-8859-1', () => {
    expect(detectEncoding(new Uint8Array([]))).toBe('iso-8859-1');
  });

  it('Windows-1252 byte at position 0 → windows-1252', () => {
    const buf = new Uint8Array([0x80, 0x41]); // 0x80 is in 0x80–0x9F range
    expect(detectEncoding(buf)).toBe('windows-1252');
  });

  it('UTF-8 German ß (C3 9F) → utf-8 (not false windows-1252)', () => {
    // "Straße" in UTF-8: 0x53 0x74 0x72 0x61 0xC3 0x9F 0x65
    // 0x9F is a valid continuation byte but falls in 0x80–0x9F range
    const buf = new TextEncoder().encode('Straße');
    expect(detectEncoding(buf)).toBe('utf-8');
  });

  it('4-byte UTF-8 emoji (F0 9F 98 80) → utf-8', () => {
    // 😀 = U+1F600 = F0 9F 98 80 in UTF-8
    const buf = new TextEncoder().encode('Hello 😀');
    expect(detectEncoding(buf)).toBe('utf-8');
  });
});
