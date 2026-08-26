export interface FileAnalysis {
  specimenNo: string;
  seed: number;
}

/**
 * Derives a stable, herbarium-ledger-style accession number and a
 * deterministic texture seed from the uploaded file's bytes, so the
 * same photo always reproduces the same paper grain / edge wobble.
 * Editable afterward by the user (the specimen number, at least).
 */
export async function analyzeFile(file: File): Promise<FileAnalysis> {
  const year = new Date().getFullYear();
  try {
    const sliceSize = Math.min(file.size, 65536);
    const buffer = await file.slice(0, sliceSize).arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-1', buffer);
    const bytes = new Uint8Array(digest);
    const num = (((bytes[0] << 8) | bytes[1]) % 9000) + 1000;
    const letter = String.fromCharCode(65 + (bytes[2] % 26));
    const seed = ((bytes[3] << 24) | (bytes[4] << 16) | (bytes[5] << 8) | bytes[6]) >>> 0;
    return { specimenNo: `${year}.${num}.${letter}`, seed };
  } catch {
    const fallback = Math.floor(1000 + Math.random() * 9000);
    return { specimenNo: `${year}.${fallback}.A`, seed: Math.floor(Math.random() * 4294967295) };
  }
}
