import type { RgbaImage, SubtitleCue } from '../../model/cue';
import { ParseError, readBitNibble, u16 } from '../binary';

interface IdxEntry {
  readonly startMs: number;
  readonly filePos: number;
}

interface SpuControl {
  readonly colorMap: [number, number, number, number];
  readonly alpha: [number, number, number, number];
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  offset1: number;
  offset2: number;
}

function parseTimestamp(raw: string): number | undefined {
  const match = raw.match(/^(\d{2}):(\d{2}):(\d{2}):(\d{3})$/);
  if (!match) return undefined;
  const [, hours, minutes, seconds, millis] = match;
  return Number(hours) * 3_600_000 + Number(minutes) * 60_000 + Number(seconds) * 1000 + Number(millis);
}

function parseIdx(text: string): {
  palette: number[];
  entries: IdxEntry[];
  languageIndex: number;
} {
  const palette = new Array<number>(16).fill(0);
  const entries: IdxEntry[] = [];
  let languageIndex = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const paletteMatch = line.match(/^palette:\s*(.*)$/i);
    if (paletteMatch) {
      paletteMatch[1]
        .split(',')
        .slice(0, 16)
        .forEach((value, index) => {
          const parsed = Number.parseInt(value.trim(), 16);
          if (!Number.isNaN(parsed)) palette[index] = parsed;
        });
      continue;
    }
    const languageMatch = line.match(/^langidx:\s*(-?\d+)/i);
    if (languageMatch) {
      languageIndex = Math.max(0, Math.min(31, Number(languageMatch[1])));
      continue;
    }
    const entryMatch = line.match(/^timestamp:\s*(\d{2}:\d{2}:\d{2}:\d{3}).*?filepos:\s*([0-9a-f]+)\s*$/i);
    if (!entryMatch) continue;
    const startMs = parseTimestamp(entryMatch[1]);
    if (startMs === undefined) continue;
    entries.push({ startMs, filePos: Number.parseInt(entryMatch[2], 16) });
  }
  entries.sort((left, right) => left.filePos - right.filePos);
  return { palette, entries, languageIndex };
}

function findPesMarker(data: Uint8Array, cursor: number, end: number): number {
  for (let index = Math.max(0, cursor); index + 3 < end; index += 1) {
    if (data[index] === 0 && data[index + 1] === 0 && data[index + 2] === 1 && data[index + 3] === 0xbd) return index;
  }
  return -1;
}

function resolvePayloadStart(data: Uint8Array, payloadStart: number, payloadEnd: number): number {
  if (payloadStart >= payloadEnd) return payloadEnd;
  if ((data[payloadStart] & 0xc0) === 0x80) {
    const start = payloadStart + 3 + data[payloadStart + 2];
    return Math.min(start, payloadEnd);
  }
  let offset = payloadStart;
  while (offset < payloadEnd && data[offset] === 0xff) offset += 1;
  if (offset < payloadEnd && (data[offset] & 0xc0) === 0x40) offset += 2;
  if (offset < payloadEnd && (data[offset] & 0xf0) === 0x20) offset += 5;
  else if (offset < payloadEnd && (data[offset] & 0xf0) === 0x30) offset += 10;
  else if (offset < payloadEnd && data[offset] === 0x0f) offset += 1;
  return Math.min(offset, payloadEnd);
}

function extractSpu(data: Uint8Array, start: number, end: number, streamId: number): Uint8Array {
  const chunks: number[] = [];
  let cursor = start;
  let expectedSize = 0;
  while (cursor + 6 <= end) {
    const marker = findPesMarker(data, cursor, end);
    if (marker < 0) break;
    const pesLength = u16(data, marker + 4);
    const payloadEnd = Math.min(end, pesLength > 0 ? marker + 6 + pesLength : end);
    const payloadStart = resolvePayloadStart(data, marker + 6, payloadEnd);
    if (payloadStart < payloadEnd) {
      const subtitleStream = data[payloadStart];
      if (subtitleStream >= 0x20 && subtitleStream <= 0x3f && (streamId === 0 || subtitleStream === streamId)) {
        for (const value of data.slice(payloadStart + 1, payloadEnd)) chunks.push(value);
        if (expectedSize === 0 && chunks.length >= 2) expectedSize = (chunks[0] << 8) | chunks[1];
        if (expectedSize > 0 && chunks.length >= expectedSize) return new Uint8Array(chunks.slice(0, expectedSize));
      }
    }
    cursor = Math.max(cursor + 4, payloadEnd);
  }
  if (chunks.length < 2) throw new ParseError('no subtitle payload found at IDX file position');
  if (expectedSize > chunks.length) throw new ParseError('incomplete subtitle payload between IDX offsets');
  return new Uint8Array(chunks.slice(0, expectedSize));
}

function applyControlCommand(
  command: number,
  packet: Uint8Array,
  offset: number,
  control: SpuControl,
): { offset: number; handled: boolean } {
  if (command <= 0x02) return { offset, handled: true };
  if (command === 0x03 && offset + 2 <= packet.length) {
    control.colorMap[3] = packet[offset] >> 4;
    control.colorMap[2] = packet[offset] & 0x0f;
    control.colorMap[1] = packet[offset + 1] >> 4;
    control.colorMap[0] = packet[offset + 1] & 0x0f;
    return { offset: offset + 2, handled: true };
  }
  if (command === 0x04 && offset + 2 <= packet.length) {
    control.alpha[3] = packet[offset] >> 4;
    control.alpha[2] = packet[offset] & 0x0f;
    control.alpha[1] = packet[offset + 1] >> 4;
    control.alpha[0] = packet[offset + 1] & 0x0f;
    return { offset: offset + 2, handled: true };
  }
  if (command === 0x05 && offset + 6 <= packet.length) {
    control.x1 = (packet[offset] << 4) | (packet[offset + 1] >> 4);
    control.x2 = ((packet[offset + 1] & 0x0f) << 8) | packet[offset + 2];
    control.y1 = (packet[offset + 3] << 4) | (packet[offset + 4] >> 4);
    control.y2 = ((packet[offset + 4] & 0x0f) << 8) | packet[offset + 5];
    return { offset: offset + 6, handled: true };
  }
  if (command === 0x06 && offset + 4 <= packet.length) {
    control.offset1 = u16(packet, offset);
    control.offset2 = u16(packet, offset + 2);
    return { offset: offset + 4, handled: true };
  }
  return { offset, handled: false };
}

function decodeControl(packet: Uint8Array, controlOffset: number): SpuControl {
  const control: SpuControl = {
    colorMap: [0, 1, 2, 3],
    alpha: [15, 15, 15, 15],
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0,
    offset1: 0,
    offset2: 0,
  };
  let commandOffset = controlOffset;
  while (commandOffset > 0 && commandOffset < packet.length) {
    if (commandOffset + 4 > packet.length) break;
    const nextOffset = u16(packet, commandOffset + 2);
    let offset = commandOffset + 4;
    while (offset < packet.length) {
      const command = packet[offset++];
      if (command === 0xff) break;
      const result = applyControlCommand(command, packet, offset, control);
      offset = result.offset;
      if (!result.handled) break;
    }
    if (nextOffset <= commandOffset || nextOffset >= packet.length) break;
    commandOffset = nextOffset;
  }
  return control;
}

function readRunCode(packet: Uint8Array, nibbleIndex: number): { value: number; next: number } {
  let value = 0;
  for (let threshold = 1; value < threshold && threshold <= 0x40; threshold <<= 2) {
    value = (value << 4) | readBitNibble(packet, nibbleIndex);
    nibbleIndex += 1;
  }
  return { value, next: nibbleIndex };
}

function decodeField(
  packet: Uint8Array,
  image: RgbaImage,
  width: number,
  rows: number,
  offsetBytes: number,
  rowOffset: number,
  rowStride: number,
  colors: Array<[number, number, number, number]>,
): void {
  let nibbleIndex = offsetBytes * 2;
  for (let row = 0; row < rows; row += 1) {
    const rowStart = rowOffset + row * rowStride;
    let x = 0;
    while (x < width) {
      const code = readRunCode(packet, nibbleIndex);
      nibbleIndex = code.next;
      let run = code.value >> 2;
      const color = code.value & 0x03;
      if (code.value < 4) run = width - x;
      if (run > width - x) throw new ParseError(`VobSub RLE run overflow: ${run}`);
      const rgba = colors[color];
      for (let index = 0; index < run; index += 1) image.pixels.set(rgba, rowStart + (x + index) * 4);
      x += run;
    }
    if (nibbleIndex % 2 === 1) nibbleIndex += 1;
  }
}

function decodeSpu(packet: Uint8Array, palette: readonly number[]): RgbaImage {
  if (packet.length < 4) throw new ParseError(`SPU packet too short: ${packet.length}`);
  const packetSize = u16(packet, 0);
  if (packetSize > packet.length) throw new ParseError(`incomplete SPU packet: expected ${packetSize} bytes`);
  const bounded = packet.slice(0, packetSize);
  const control = decodeControl(bounded, u16(bounded, 2));
  const width = control.x2 - control.x1 + 1;
  const height = control.y2 - control.y1 + 1;
  if (width <= 0 || height <= 0) throw new ParseError(`invalid VobSub dimensions: ${width}x${height}`);
  if (
    control.offset1 <= 0 ||
    control.offset2 <= 0 ||
    control.offset1 >= bounded.length ||
    control.offset2 >= bounded.length
  )
    throw new ParseError('invalid VobSub bitmap offsets');
  const colors = control.colorMap.map((paletteIndex, index) => {
    const rgb = palette[paletteIndex] ?? 0xffffff;
    return [(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff, control.alpha[index] * 17] as [
      number,
      number,
      number,
      number,
    ];
  });
  const image: RgbaImage = {
    width,
    height,
    pixels: new Uint8Array(width * height * 4),
  };
  decodeField(bounded, image, width, Math.ceil(height / 2), control.offset1, 0, width * 8, colors);
  decodeField(bounded, image, width, Math.floor(height / 2), control.offset2, width * 4, width * 8, colors);
  return image;
}

export function parseIdxSub(idxText: string, subData: Uint8Array): SubtitleCue[] {
  const { palette, entries, languageIndex } = parseIdx(idxText);
  const streamId = 0x20 + languageIndex;
  return entries.map((entry, index) => {
    const end = index + 1 < entries.length ? entries[index + 1].filePos : subData.length;
    const packet = extractSpu(subData, entry.filePos, end, streamId);
    const nextStart = index + 1 < entries.length ? entries[index + 1].startMs : entry.startMs + 2000;
    return {
      index: index + 1,
      startMs: entry.startMs,
      endMs: Math.max(nextStart, entry.startMs + 500),
      image: decodeSpu(packet, palette),
    };
  });
}
