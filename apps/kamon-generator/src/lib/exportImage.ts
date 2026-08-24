/**
 * 書き出し（SPEC 3.5）。
 *
 * SVG は自己完結ファイル、PNG は Canvas でラスタライズする。
 * 描画する SVG に外部フォント・外部参照を一切含めていないため、
 * canvas が汚染されず toBlob が使える（PLAN 5 のリスク対応）。
 */

export const PNG_SIZE = 1200;

/** ファイル名に使えない文字と制御文字を落とす（FR-400.3） */
export function sanitizeFilenamePart(value: string): string {
  const cleaned = value
    .normalize("NFC")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 24);
  return cleaned.length > 0 ? cleaned : "無銘";
}

export function buildFilename(
  kamonName: string,
  seedText: string,
  variantIndex: number,
  extension: "svg" | "png",
): string {
  const name = sanitizeFilenamePart(kamonName);
  const seed = sanitizeFilenamePart(seedText.slice(0, 16));
  return `kamon-${name}-${seed}-${variantIndex + 1}.${extension}`;
}

/** Blob をダウンロードさせる。生成した Object URL は必ず解放する（FR-400.5）。 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function svgBlob(standaloneSvg: string): Blob {
  return new Blob([standaloneSvg], { type: "image/svg+xml;charset=utf-8" });
}

/**
 * SVG 文字列を PNG の Blob へ変換する（FR-400.2）。
 * 地色を先に塗ってから紋を載せる（透過にしない）。
 */
export function svgToPngBlob(
  standaloneSvg: string,
  backgroundColor: string,
  size = PNG_SIZE,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(svgBlob(standaloneSvg));
    const image = new Image();

    const cleanup = (): void => URL.revokeObjectURL(url);

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) {
          cleanup();
          reject(new Error("Canvas を初期化できませんでした"));
          return;
        }
        context.fillStyle = backgroundColor;
        context.fillRect(0, 0, size, size);
        context.drawImage(image, 0, 0, size, size);
        canvas.toBlob((blob) => {
          cleanup();
          if (blob) resolve(blob);
          else reject(new Error("PNG への変換に失敗しました"));
        }, "image/png");
      } catch (error: unknown) {
        cleanup();
        reject(error instanceof Error ? error : new Error("PNG への変換に失敗しました"));
      }
    };

    image.onerror = () => {
      cleanup();
      reject(new Error("紋の読み込みに失敗しました"));
    };

    image.src = url;
  });
}
