export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export function assertRange(data: Uint8Array, offset: number, length: number, label: string): void {
  if (offset < 0 || length < 0 || offset + length > data.length) {
    throw new ParseError(`${label} is outside the input at offset ${offset}`);
  }
}

export function u16(data: Uint8Array, offset: number): number {
  assertRange(data, offset, 2, '16-bit value');
  return (data[offset] << 8) | data[offset + 1];
}

export function u24(data: Uint8Array, offset: number): number {
  assertRange(data, offset, 3, '24-bit value');
  return (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2];
}

export function u32(data: Uint8Array, offset: number): number {
  assertRange(data, offset, 4, '32-bit value');
  return data[offset] * 0x1000000 + (data[offset + 1] << 16) + (data[offset + 2] << 8) + data[offset + 3];
}

export function readBitNibble(data: Uint8Array, nibbleIndex: number): number {
  const byteIndex = Math.floor(nibbleIndex / 2);
  if (byteIndex < 0 || byteIndex >= data.length) return 0;
  const value = data[byteIndex];
  return nibbleIndex % 2 === 0 ? value >> 4 : value & 0x0f;
}

export function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
