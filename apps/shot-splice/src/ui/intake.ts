import { averageColor as measureAverageColor } from '../imaging/raster';
import type { Rgb, Shot } from './store';

export interface DecodedImage {
  readonly source: CanvasImageSource;
  readonly width: number;
  readonly height: number;
}

export type Decoder = (file: File) => Promise<DecodedImage>;

export interface IntakeDeps {
  readonly decode?: Decoder;
  readonly averageColor?: (source: CanvasImageSource) => Rgb;
  readonly makeId?: () => string;
}

export interface IntakeResult {
  readonly shots: readonly Shot[];
  /** Names of files that could not be used, with the reason already resolved. */
  readonly skipped: readonly string[];
}

let counter = 0;

function defaultId(): string {
  counter += 1;
  return `shot-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Decodes a file into something drawable.
 *
 * `createImageBitmap` is preferred over an object URL plus `<img>` because the
 * bitmap has no URL lifetime to manage — there is no revoke step to forget,
 * and no risk of a shot going blank because its URL was released early.
 */
export const defaultDecoder: Decoder = async (file) => {
  const bitmap = await createImageBitmap(file);
  return { source: bitmap, width: bitmap.width, height: bitmap.height };
};

function looksLikeImage(file: File): boolean {
  // A dropped file sometimes arrives with an empty type; let the decoder decide.
  return file.type === '' || file.type.startsWith('image/');
}

/** Natural-order sort so `shot-2.png` lands before `shot-10.png`. */
export function sortByName(files: readonly File[]): File[] {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/**
 * Turns dropped or selected files into shots.
 *
 * A single unreadable file must not abort the batch: each failure is collected
 * and reported by name so the user knows exactly what was left out.
 */
export async function createShots(
  files: readonly File[],
  deps: IntakeDeps = {},
): Promise<IntakeResult> {
  const decode = deps.decode ?? defaultDecoder;
  const averageColor = deps.averageColor ?? ((source) => measureAverageColor(source));
  const makeId = deps.makeId ?? defaultId;

  const shots: Shot[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    if (!looksLikeImage(file)) {
      skipped.push(file.name);
      continue;
    }
    try {
      const decoded = await decode(file);
      if (decoded.width <= 0 || decoded.height <= 0) {
        skipped.push(file.name);
        continue;
      }
      shots.push({
        id: makeId(),
        name: file.name,
        source: decoded.source,
        naturalWidth: decoded.width,
        naturalHeight: decoded.height,
        averageColor: averageColor(decoded.source),
      });
    } catch {
      skipped.push(file.name);
    }
  }

  return { shots, skipped };
}

/** Builds the message shown after a batch that was not fully accepted. */
export function intakeMessage(
  added: number,
  skipped: readonly string[],
  rejected: number,
  maxShots: number,
): { tone: 'success' | 'error'; message: string } | null {
  const parts: string[] = [];
  if (added > 0) parts.push(`${added}枚を読み込みました`);
  if (skipped.length > 0) {
    parts.push(`${skipped.length}件は画像として読めずスキップしました（${skipped.join('、')}）`);
  }
  if (rejected > 0) parts.push(`上限${maxShots}枚のため${rejected}件は追加していません`);
  if (parts.length === 0) return null;
  return {
    tone: skipped.length > 0 || rejected > 0 ? 'error' : 'success',
    message: `${parts.join('。')}。`,
  };
}
