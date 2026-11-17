export function decodeRleIndices(data: Uint8Array, width: number, height: number): Uint8Array {
  if (width <= 0 || height <= 0) return new Uint8Array();
  const output = new Uint8Array(width * height);
  let write = 0;
  let x = 0;
  let y = 0;
  let offset = 0;

  while (offset < data.length && y < height) {
    const first = data[offset++];
    if (first !== 0) {
      if (x < width) {
        output[write++] = first;
        x += 1;
      }
      continue;
    }
    if (offset >= data.length) break;
    const second = data[offset++];
    if (second === 0) {
      write += Math.max(0, width - x);
      x = 0;
      y += 1;
      continue;
    }

    let run: number;
    let color = 0;
    if (second < 0x40) {
      run = second;
    } else if (second < 0x80) {
      if (offset >= data.length) break;
      run = ((second - 0x40) << 8) | data[offset++];
    } else if (second < 0xc0) {
      if (offset >= data.length) break;
      run = second - 0x80;
      color = data[offset++];
    } else {
      if (offset + 1 >= data.length) break;
      run = ((second - 0xc0) << 8) | data[offset++];
      color = data[offset++];
    }

    for (let index = 0; index < run; index += 1) {
      if (y >= height) break;
      if (x < width) {
        output[write++] = color;
        x += 1;
      }
    }
  }

  return output;
}
