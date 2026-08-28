export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("PNGの生成に失敗しました。"));
        return;
      }
      triggerDownload(blob, filename);
      resolve();
    }, "image/png");
  });
}

export function downloadSvg(svgString: string, filename: string): void {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // ダウンロード起動後、少し待ってから解放（一部ブラウザでの早期revoke対策）
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
