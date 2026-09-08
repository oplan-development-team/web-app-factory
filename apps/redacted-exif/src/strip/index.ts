import { stripJpeg } from './jpeg';
import { stripPng } from './png';

export type ImageKind = 'jpeg' | 'png';

export function detectKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }
  return null;
}

export async function stripMetadata(file: File): Promise<{ blob: Blob; kind: ImageKind } | null> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const kind = detectKind(buf);
  if (!kind) return null;
  const blob = kind === 'jpeg' ? stripJpeg(buf) : stripPng(buf);
  return { blob, kind };
}
