/**
 * 標本番号と質感シードの採番（FR-111）。
 *
 * 同じ写真からは常に同じ紙目・縁のゆらぎが再現されるよう、ファイルの
 * バイト列から決定的に導く。`Math.random` は使わない。プロトタイプは
 * `crypto.subtle` が使えない環境で `Math.random` へ落ちていたが、それだと
 * 同じ写真を読み直すたびに別の標本番号・別の紙目になる。
 */

export interface FileAnalysis {
  specimenNo: string;
  seed: number;
}

const SLICE_SIZE = 65536;

/** FNV-1a 32bit。サロゲートペアも例外なく処理できる。 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function hashBytes(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i] ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** 32bit 値を `YYYY.NNNN.X` 形式の受入番号へ。 */
export function formatSpecimenNo(value: number, year: number): string {
  const v = value >>> 0;
  const num = (v % 9000) + 1000;
  const letter = String.fromCharCode(65 + ((v >>> 16) % 26));
  return `${year}.${num}.${letter}`;
}

/** シードから所蔵標本用の受入番号を作る（再抽選のたびに変わる、FR-125.1）。 */
export function specimenNoForSeed(seed: number, year = new Date().getFullYear()): string {
  return formatSpecimenNo(hashString(`specimen:${seed >>> 0}`), year);
}

/**
 * ファイルから受入番号と質感シードを決定的に導く。
 * `crypto.subtle` が使えれば SHA-1、使えなければファイルの素性
 * （名前・サイズ・更新時刻）からの FNV へ縮退する。どちらの経路でも
 * 「同じ入力からは同じ出力」は保たれる（FR-111.1）。
 */
export async function analyzeFile(file: File, year = new Date().getFullYear()): Promise<FileAnalysis> {
  const digest = await digestOf(file);
  return {
    specimenNo: formatSpecimenNo(digest.accession, year),
    seed: digest.seed,
  };
}

async function digestOf(file: File): Promise<{ accession: number; seed: number }> {
  try {
    const sliceSize = Math.min(file.size, SLICE_SIZE);
    const buffer = await file.slice(0, sliceSize).arrayBuffer();
    const hashed = await crypto.subtle.digest('SHA-1', buffer);
    const bytes = new Uint8Array(hashed);
    const accession = ((bytes[0] ?? 0) << 24) | ((bytes[1] ?? 0) << 16) | ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0);
    const seed = ((bytes[4] ?? 0) << 24) | ((bytes[5] ?? 0) << 16) | ((bytes[6] ?? 0) << 8) | (bytes[7] ?? 0);
    return { accession: accession >>> 0, seed: seed >>> 0 };
  } catch {
    return fallbackDigest(file);
  }
}

/** crypto が使えない環境でも決定性を保つための縮退経路。 */
export function fallbackDigest(file: File): { accession: number; seed: number } {
  const identity = `${file.name}|${file.size}|${file.lastModified ?? 0}`;
  const accession = hashString(identity);
  const seed = hashString(`seed:${identity}`);
  return { accession, seed };
}
