/**
 * Floyd-Steinberg error-diffusion dithering, reducing a luminance field
 * to a 1-bit ink/paper bitmap. 1 = ink (dark, exposed to the print),
 * 0 = paper (light).
 */
export function floydSteinberg(luminance: Float32Array, width: number, height: number, threshold: number): Uint8Array {
  const buffer = Float32Array.from(luminance);
  const bits = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * width;
    const forward = y % 2 === 0;
    for (let xi = 0; xi < width; xi++) {
      const x = forward ? xi : width - 1 - xi;
      const idx = rowStart + x;
      const old = buffer[idx];
      const isInk = old < threshold;
      bits[idx] = isInk ? 1 : 0;
      const error = old - (isInk ? 0 : 255);

      const dir = forward ? 1 : -1;
      const hasNext = forward ? x + 1 < width : x - 1 >= 0;
      const hasPrev = forward ? x - 1 >= 0 : x + 1 < width;

      if (hasNext) buffer[idx + dir] += (error * 7) / 16;
      if (y + 1 < height) {
        const nextRow = idx + width;
        if (hasPrev) buffer[nextRow - dir] += (error * 3) / 16;
        buffer[nextRow] += (error * 5) / 16;
        if (hasNext) buffer[nextRow + dir] += (error * 1) / 16;
      }
    }
  }
  return bits;
}
