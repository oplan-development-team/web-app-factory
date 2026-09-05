/**
 * Lossless PNG metadata stripping.
 *
 * PNG is a chunked format: 8-byte signature, then a sequence of
 * [length(4) | type(4) | data(length) | crc(4)] chunks. We copy every chunk
 * through unmodified except the ancillary chunks known to carry metadata:
 * tEXt / iTXt / zTXt (free-text incl. common EXIF-in-PNG conventions),
 * eXIf (raw Exif block, PNG's native EXIF carrier), and tIME (last-modified
 * timestamp). Pixel data (IDAT) is never touched, so there is no
 * recompression loss.
 */

const STRIP_TYPES = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']);
const PNG_SIGNATURE_LEN = 8;

/** Zero-copy view into `buf`, typed for use directly as a Blob constructor part. */
function part(buf: Uint8Array, start: number, end?: number): BlobPart {
  return buf.subarray(start, end) as unknown as BlobPart;
}

export function stripPng(buf: Uint8Array): Blob {
  const parts: BlobPart[] = [part(buf, 0, PNG_SIGNATURE_LEN)];
  let i = PNG_SIGNATURE_LEN;

  while (i + 8 <= buf.length) {
    const length = ((buf[i] << 24) | (buf[i + 1] << 16) | (buf[i + 2] << 8) | buf[i + 3]) >>> 0;
    const type = String.fromCharCode(buf[i + 4], buf[i + 5], buf[i + 6], buf[i + 7]);
    const chunkTotal = 4 + 4 + length + 4;
    if (i + chunkTotal > buf.length) {
      // Truncated/malformed tail — copy the remainder through defensively.
      parts.push(part(buf, i));
      break;
    }
    if (!STRIP_TYPES.has(type)) {
      parts.push(part(buf, i, i + chunkTotal));
    }
    i += chunkTotal;
  }

  return new Blob(parts, { type: 'image/png' });
}
