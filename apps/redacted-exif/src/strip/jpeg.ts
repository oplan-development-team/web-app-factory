/**
 * Lossless JPEG metadata stripping.
 *
 * We never decode/re-encode pixel data (no <canvas> round-trip), which would
 * be lossy. Instead we parse the marker-segment structure directly and drop
 * the segments that carry metadata, byte-for-byte preserving everything else
 * (including the compressed scan data).
 *
 * Segments removed:
 *  - APP1 "Exif\0\0"                (EXIF / TIFF tags, incl. GPS)
 *  - APP1 "http://ns.adobe.com/xap" (XMP)
 *  - APP13 "Photoshop 3.0\0"        (IPTC / Photoshop IRB)
 *  - COM (0xFFFE)                   (free-text comment)
 *
 * Segments kept as-is: APP0 (JFIF), APP2 (ICC profile — needed for correct
 * color, not identifying), APP14 (Adobe color-transform marker), all
 * structural markers (SOF/DHT/DQT/DRI/...), and the SOS scan data + EOI.
 *
 * EXIF Orientation is the one tag we intentionally preserve: since we don't
 * re-encode pixels, dropping it outright would silently change how the
 * image displays (browsers rotate JPEGs per this tag). If the source had a
 * non-default orientation we re-insert a *minimal* synthetic APP1 segment
 * containing only that single tag — no camera, date, or GPS data survives.
 */

const EOI = 0xd9;
const SOS = 0xda;
const APP1 = 0xe1;
const APP13 = 0xed;
const COM = 0xfe;

/** Zero-copy view into `buf`, typed for use directly as a Blob constructor part. */
function part(buf: Uint8Array, start: number, end?: number): BlobPart {
  return buf.subarray(start, end) as unknown as BlobPart;
}

function asciiAt(buf: Uint8Array, offset: number, expected: string): boolean {
  if (offset + expected.length > buf.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (buf[offset + i] !== expected.charCodeAt(i)) return false;
  }
  return true;
}

/** Reads the Orientation tag (0x0112) out of the first Exif APP1 segment, if any. Defaults to 1. */
export function readJpegOrientation(buf: Uint8Array): number {
  let i = 2; // skip SOI
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === SOS || marker === EOI) break;
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    const len = (buf[i + 2] << 8) | buf[i + 3];
    if (marker === APP1 && asciiAt(buf, i + 4, 'Exif\0\0')) {
      const tiffStart = i + 4 + 6;
      const orientation = readOrientationFromTiff(buf, tiffStart);
      if (orientation !== undefined) return orientation;
    }
    i += 2 + len;
  }
  return 1;
}

function readOrientationFromTiff(buf: Uint8Array, tiffStart: number): number | undefined {
  if (tiffStart + 8 > buf.length) return undefined;
  const little = buf[tiffStart] === 0x49 && buf[tiffStart + 1] === 0x49;
  const big = buf[tiffStart] === 0x4d && buf[tiffStart + 1] === 0x4d;
  if (!little && !big) return undefined;
  const readU16 = (o: number) => (little ? buf[o] | (buf[o + 1] << 8) : (buf[o] << 8) | buf[o + 1]);
  const readU32 = (o: number) =>
    little
      ? (buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16) | (buf[o + 3] << 24)) >>> 0
      : ((buf[o] << 24) | (buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3]) >>> 0;

  const ifd0Offset = readU32(tiffStart + 4);
  const ifd0Start = tiffStart + ifd0Offset;
  if (ifd0Start + 2 > buf.length) return undefined;
  const entryCount = readU16(ifd0Start);
  for (let e = 0; e < entryCount; e++) {
    const entryOffset = ifd0Start + 2 + e * 12;
    if (entryOffset + 12 > buf.length) break;
    const tag = readU16(entryOffset);
    if (tag === 0x0112) {
      return readU16(entryOffset + 8);
    }
  }
  return undefined;
}

/** Builds a minimal APP1 "Exif" segment that carries only the Orientation tag. */
function buildOrientationSegment(orientation: number): Uint8Array {
  const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
  const tiff = [
    0x49,
    0x49, // "II" little-endian
    0x2a,
    0x00, // magic 42
    0x08,
    0x00,
    0x00,
    0x00, // offset to IFD0 = 8
    0x01,
    0x00, // 1 entry
    0x12,
    0x01, // tag 0x0112 Orientation
    0x03,
    0x00, // type SHORT
    0x01,
    0x00,
    0x00,
    0x00, // count 1
    orientation & 0xff,
    (orientation >> 8) & 0xff,
    0x00,
    0x00, // value (padded to 4 bytes)
    0x00,
    0x00,
    0x00,
    0x00, // next IFD offset = 0
  ];
  const payload = [...exifHeader, ...tiff];
  const segLen = payload.length + 2; // length field includes itself
  return new Uint8Array([0xff, APP1, (segLen >> 8) & 0xff, segLen & 0xff, ...payload]);
}

export function stripJpeg(buf: Uint8Array): Blob {
  const orientation = readJpegOrientation(buf);
  const parts: BlobPart[] = [];
  parts.push(part(buf, 0, 2)); // SOI

  let insertedOrientation = false;
  const maybeInsertOrientation = () => {
    if (!insertedOrientation && orientation !== 1) {
      parts.push(buildOrientationSegment(orientation) as unknown as BlobPart);
      insertedOrientation = true;
    }
  };

  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) {
      // Malformed / unexpected byte outside a scan — copy through defensively.
      parts.push(part(buf, i, i + 1));
      i++;
      continue;
    }
    const marker = buf[i + 1];

    if (marker === EOI) {
      maybeInsertOrientation();
      parts.push(part(buf, i, i + 2));
      i += 2;
      continue;
    }

    if (marker === SOS) {
      maybeInsertOrientation();
      const len = (buf[i + 2] << 8) | buf[i + 3];
      // Copy SOS header, then the rest of the file (entropy-coded scan data,
      // any restart markers, and EOI) verbatim — we do not touch pixels.
      parts.push(part(buf, i, i + 2 + len));
      i += 2 + len;
      parts.push(part(buf, i));
      return new Blob(parts, { type: 'image/jpeg' });
    }

    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      parts.push(part(buf, i, i + 2));
      i += 2;
      continue;
    }

    const len = (buf[i + 2] << 8) | buf[i + 3];
    const dataStart = i + 4;
    let strip = false;
    if (marker === APP1) {
      if (asciiAt(buf, dataStart, 'Exif\0\0') || asciiAt(buf, dataStart, 'http://ns.adobe.com/xap')) {
        strip = true;
      }
    } else if (marker === APP13) {
      if (asciiAt(buf, dataStart, 'Photoshop 3.0\0')) strip = true;
    } else if (marker === COM) {
      strip = true;
    }

    if (!strip) {
      parts.push(part(buf, i, i + 2 + len));
    } else if (marker === APP1) {
      // Right after the (kept or now-stripped) first APP1 slot is a natural,
      // conventional place for our synthetic orientation-only segment.
      maybeInsertOrientation();
    }
    i += 2 + len;
  }

  maybeInsertOrientation();
  return new Blob(parts, { type: 'image/jpeg' });
}
