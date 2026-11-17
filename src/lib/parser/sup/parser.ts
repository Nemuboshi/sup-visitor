import type { RgbaImage, SubtitleCue } from '../../model/cue';
import { ParseError, assertRange, clampByte, u16, u24 } from '../binary';
import { decodeRleIndices } from './rle';

const SEGMENT_PDS = 0x14;
const SEGMENT_ODS = 0x15;
const SEGMENT_PCS = 0x16;
const SEGMENT_END = 0x80;

interface Segment {
  readonly pts90k: number;
  readonly type: number;
  readonly body: Uint8Array;
}

interface PaletteEntry {
  readonly y: number;
  readonly cb: number;
  readonly cr: number;
  readonly alpha: number;
}

interface ObjectDefinition {
  readonly width: number;
  readonly height: number;
  readonly rleData: Uint8Array;
}

interface ObjectAssembly {
  readonly width: number;
  readonly height: number;
  readonly expectedRleLength: number;
  readonly data: Uint8Array;
}

interface CompositionObject {
  readonly objectId: number;
  readonly x: number;
  readonly y: number;
  readonly crop?: { x: number; y: number; width: number; height: number };
}

interface DisplayState {
  readonly pts90k: number;
  readonly paletteId: number;
  readonly objects: readonly CompositionObject[];
}

function parseSegments(data: Uint8Array): Segment[] {
  const segments: Segment[] = [];
  let offset = 0;
  while (offset < data.length) {
    assertRange(data, offset, 13, 'SUP segment header');
    if (data[offset] !== 0x50 || data[offset + 1] !== 0x47) {
      throw new ParseError(`invalid SUP header at offset ${offset}`);
    }
    const pts90k = data[offset + 2] * 0x1000000 + (data[offset + 3] << 16) + (data[offset + 4] << 8) + data[offset + 5];
    const type = data[offset + 10];
    const size = u16(data, offset + 11);
    const bodyStart = offset + 13;
    assertRange(data, bodyStart, size, 'SUP segment body');
    segments.push({
      pts90k,
      type,
      body: data.slice(bodyStart, bodyStart + size),
    });
    offset = bodyStart + size;
  }
  return segments;
}

function parsePcs(body: Uint8Array, pts90k: number): DisplayState {
  if (body.length < 11) throw new ParseError(`PCS body too short: ${body.length}`);
  const paletteId = body[9];
  const objectCount = body[10];
  const objects: CompositionObject[] = [];
  let offset = 11;
  for (let index = 0; index < objectCount; index += 1) {
    if (offset + 8 > body.length) break;
    const flags = body[offset + 3];
    const object: CompositionObject = {
      objectId: u16(body, offset),
      x: u16(body, offset + 4),
      y: u16(body, offset + 6),
    };
    offset += 8;
    if ((flags & 0x40) !== 0) {
      if (offset + 8 > body.length) break;
      objects.push({
        ...object,
        crop: {
          x: u16(body, offset),
          y: u16(body, offset + 2),
          width: u16(body, offset + 4),
          height: u16(body, offset + 6),
        },
      });
      offset += 8;
    } else {
      objects.push(object);
    }
  }
  return { pts90k, paletteId, objects };
}

function parsePds(body: Uint8Array, palettes: Map<number, Map<number, PaletteEntry>>): void {
  if (body.length < 2) throw new ParseError(`PDS body too short: ${body.length}`);
  const entries = new Map<number, PaletteEntry>();
  for (let offset = 2; offset + 5 <= body.length; offset += 5) {
    entries.set(body[offset], {
      y: body[offset + 1],
      cr: body[offset + 2],
      cb: body[offset + 3],
      alpha: body[offset + 4],
    });
  }
  palettes.set(body[0], entries);
}

function parseOds(
  body: Uint8Array,
  objects: Map<number, ObjectDefinition>,
  assemblies: Map<number, ObjectAssembly>,
): void {
  if (body.length < 4) throw new ParseError(`ODS body too short: ${body.length}`);
  const objectId = u16(body, 0);
  const sequence = body[3];
  const first = sequence === 0x80 || sequence === 0xc0;
  const last = sequence === 0x40 || sequence === 0xc0;
  let offset = 4;

  if (first) {
    if (offset + 7 > body.length) throw new ParseError(`ODS first segment body too short: ${body.length}`);
    const objectDataLength = u24(body, offset);
    const width = u16(body, offset + 3);
    const height = u16(body, offset + 5);
    offset += 7;
    const expectedRleLength = objectDataLength >= 4 ? objectDataLength - 4 : objectDataLength;
    const assembly: ObjectAssembly = {
      width,
      height,
      expectedRleLength,
      data: body.slice(offset),
    };
    if (last) {
      objects.set(objectId, materialize(assembly));
    } else {
      assemblies.set(objectId, assembly);
    }
    return;
  }

  const current = assemblies.get(objectId);
  if (!current) return;
  const data = new Uint8Array(current.data.length + body.length - offset);
  data.set(current.data);
  data.set(body.slice(offset), current.data.length);
  const assembly = { ...current, data };
  if (last) {
    objects.set(objectId, materialize(assembly));
    assemblies.delete(objectId);
  } else {
    assemblies.set(objectId, assembly);
  }
}

function materialize(assembly: ObjectAssembly): ObjectDefinition {
  return {
    width: assembly.width,
    height: assembly.height,
    rleData: assembly.data.slice(0, assembly.expectedRleLength),
  };
}

function ycbcrToRgba(entry: PaletteEntry): [number, number, number, number] {
  const c = entry.y - 16;
  const d = entry.cb - 128;
  const e = entry.cr - 128;
  return [
    clampByte((298 * c + 409 * e + 128) >> 8),
    clampByte((298 * c - 100 * d - 208 * e + 128) >> 8),
    clampByte((298 * c + 516 * d + 128) >> 8),
    entry.alpha,
  ];
}

function renderObject(definition: ObjectDefinition, palette: Map<number, PaletteEntry> | undefined): RgbaImage {
  const indexes = decodeRleIndices(definition.rleData, definition.width, definition.height);
  const pixels = new Uint8Array(definition.width * definition.height * 4);
  const lookup = new Array<[number, number, number, number]>(256);
  for (const [index, entry] of palette ?? []) lookup[index] = ycbcrToRgba(entry);
  for (let index = 0; index < indexes.length; index += 1) {
    const color = lookup[indexes[index]] ?? [0, 0, 0, 0];
    pixels.set(color, index * 4);
  }
  return { width: definition.width, height: definition.height, pixels };
}

function cropImage(source: RgbaImage, crop: NonNullable<CompositionObject['crop']>): RgbaImage {
  if (crop.width <= 0 || crop.height <= 0) return { width: 0, height: 0, pixels: new Uint8Array() };
  const pixels = new Uint8Array(crop.width * crop.height * 4);
  for (let y = 0; y < crop.height; y += 1) {
    const sourceY = crop.y + y;
    if (sourceY < 0 || sourceY >= source.height) continue;
    const sourceStart = (sourceY * source.width + crop.x) * 4;
    const targetStart = y * crop.width * 4;
    const copyWidth = Math.max(0, Math.min(crop.width, source.width - crop.x));
    if (copyWidth > 0) pixels.set(source.pixels.slice(sourceStart, sourceStart + copyWidth * 4), targetStart);
  }
  return { width: crop.width, height: crop.height, pixels };
}

function blendImage(target: RgbaImage, source: RgbaImage, x: number, y: number): void {
  for (let sourceY = 0; sourceY < source.height; sourceY += 1) {
    for (let sourceX = 0; sourceX < source.width; sourceX += 1) {
      const targetX = x + sourceX;
      const targetY = y + sourceY;
      if (targetX < 0 || targetY < 0 || targetX >= target.width || targetY >= target.height) continue;
      const sourceOffset = (sourceY * source.width + sourceX) * 4;
      const targetOffset = (targetY * target.width + targetX) * 4;
      const sourceAlpha = source.pixels[sourceOffset + 3] / 255;
      const targetAlpha = target.pixels[targetOffset + 3] / 255;
      const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
      if (outputAlpha === 0) continue;
      for (let channel = 0; channel < 3; channel += 1) {
        target.pixels[targetOffset + channel] = clampByte(
          (source.pixels[sourceOffset + channel] * sourceAlpha +
            target.pixels[targetOffset + channel] * targetAlpha * (1 - sourceAlpha)) /
            outputAlpha,
        );
      }
      target.pixels[targetOffset + 3] = clampByte(outputAlpha * 255);
    }
  }
}

function renderDisplaySet(
  state: DisplayState,
  palettes: Map<number, Map<number, PaletteEntry>>,
  objects: Map<number, ObjectDefinition>,
): RgbaImage | undefined {
  if (state.objects.length === 0) return undefined;
  const rendered: Array<{ x: number; y: number; image: RgbaImage }> = [];
  let minX = state.objects[0].x;
  let minY = state.objects[0].y;
  let maxX = minX;
  let maxY = minY;
  for (const object of state.objects) {
    minX = Math.min(minX, object.x);
    minY = Math.min(minY, object.y);
    const definition = objects.get(object.objectId);
    if (!definition) continue;
    const raw = renderObject(definition, palettes.get(state.paletteId));
    const image = object.crop ? cropImage(raw, object.crop) : raw;
    rendered.push({ x: object.x, y: object.y, image });
    maxX = Math.max(maxX, object.x + image.width);
    maxY = Math.max(maxY, object.y + image.height);
  }
  if (rendered.length === 0) return undefined;
  const canvas: RgbaImage = {
    width: maxX - minX,
    height: maxY - minY,
    pixels: new Uint8Array((maxX - minX) * (maxY - minY) * 4),
  };
  for (const item of rendered) blendImage(canvas, item.image, item.x - minX, item.y - minY);
  return canvas;
}

export function parseSup(data: Uint8Array): SubtitleCue[] {
  const segments = parseSegments(data);
  const palettes = new Map<number, Map<number, PaletteEntry>>();
  const objects = new Map<number, ObjectDefinition>();
  const assemblies = new Map<number, ObjectAssembly>();
  let state: DisplayState | undefined;
  let pending: { pts90k: number; image: RgbaImage } | undefined;
  const cues: SubtitleCue[] = [];

  const emit = (item: { pts90k: number; image: RgbaImage }, endMs: number) => {
    const startMs = Math.round(item.pts90k / 90);
    cues.push({
      index: cues.length + 1,
      startMs,
      endMs: endMs <= startMs ? startMs + 500 : endMs,
      image: item.image,
    });
  };

  for (const segment of segments) {
    if (segment.type === SEGMENT_PCS) state = parsePcs(segment.body, segment.pts90k);
    else if (segment.type === SEGMENT_PDS) parsePds(segment.body, palettes);
    else if (segment.type === SEGMENT_ODS) parseOds(segment.body, objects, assemblies);
    else if (segment.type === SEGMENT_END && state) {
      const image = renderDisplaySet(state, palettes, objects);
      if (image) {
        const current = { pts90k: state.pts90k, image };
        if (pending) emit(pending, Math.round(current.pts90k / 90));
        pending = current;
      }
      state = undefined;
    }
  }
  if (pending) emit(pending, Math.round(pending.pts90k / 90) + 2000);
  return cues;
}
