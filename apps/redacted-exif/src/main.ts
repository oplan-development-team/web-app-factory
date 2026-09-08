import './style.css';
import { clear } from './dom';
import { renderUploadScreen, renderErrorScreen, renderAnalyzingScreen } from './upload-view';
import { renderDocumentScreen } from './document-view';
import { analyzeFile } from './meta';
import { detectKind } from './strip';

const app = document.getElementById('app');
if (!app) throw new Error('#app root missing');

function mount(node: HTMLElement) {
  clear(app!);
  app!.appendChild(node);
}

function showUpload() {
  mount(renderUploadScreen({ onFile: handleFile }));
}

async function handleFile(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer().catch(() => new ArrayBuffer(0)));
  const kind = detectKind(bytes);
  if (!kind) {
    mount(
      renderErrorScreen(
        `「${file.name}」はJPEG/PNG形式として認識できませんでした。拡張子ではなくファイルの内容で判定しています。対応形式のファイルを選び直してください。`,
        showUpload,
      ),
    );
    return;
  }

  mount(renderAnalyzingScreen());
  const start = performance.now();
  const meta = await analyzeFile(file);
  // Keep the "審査中" beat readable even when parsing is near-instant —
  // an instant flash-to-result reads as broken, not fast.
  const elapsed = performance.now() - start;
  const minDelay = 420;
  if (elapsed < minDelay) {
    await new Promise((r) => setTimeout(r, minDelay - elapsed));
  }

  mount(renderDocumentScreen(file, meta, { onReset: showUpload }));
}

showUpload();
