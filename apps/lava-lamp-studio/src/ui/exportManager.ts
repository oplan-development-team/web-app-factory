import GIF from 'gif.js';
// eslint-disable-next-line import/no-unresolved
import gifWorkerUrl from 'gif.js/dist/gif.worker.js?url';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke shortly after to be safe across browsers that read it async.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function timestampSlug(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export interface RecordCallbacks {
  onProgress?: (fraction: number) => void;
  onDone: (filename: string) => void;
  onError: (message: string) => void;
}

let webmInFlight = false;
let gifInFlight = false;

export function isWebmRecording(): boolean {
  return webmInFlight;
}

export function isGifEncoding(): boolean {
  return gifInFlight;
}

export function recordWebm(
  canvas: HTMLCanvasElement,
  durationSec: number,
  callbacks: RecordCallbacks,
): void {
  if (webmInFlight) return; // guard against multiple in-flight recordings
  if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
    callbacks.onError('このブラウザは録画(captureStream)に対応していません');
    return;
  }

  webmInFlight = true;
  const stream = canvas.captureStream(30);
  const mimeCandidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType });
  } catch (err) {
    webmInFlight = false;
    callbacks.onError('録画の開始に失敗しました');
    return;
  }

  const chunks: BlobPart[] = [];
  const startedAt = performance.now();
  let progressTimer: number | undefined;

  recorder.ondataavailable = (e: BlobEvent) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = () => {
    webmInFlight = false;
    if (progressTimer) window.clearInterval(progressTimer);
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunks, { type: mimeType });
    const filename = `lava-lamp-studio_${timestampSlug()}.webm`;
    triggerDownload(blob, filename);
    callbacks.onDone(filename);
  };

  recorder.onerror = () => {
    webmInFlight = false;
    if (progressTimer) window.clearInterval(progressTimer);
    callbacks.onError('録画中にエラーが発生しました');
  };

  progressTimer = window.setInterval(() => {
    const elapsed = (performance.now() - startedAt) / 1000;
    callbacks.onProgress?.(Math.min(1, elapsed / durationSec));
  }, 100);

  recorder.start();
  window.setTimeout(() => {
    if (recorder.state !== 'inactive') recorder.stop();
  }, durationSec * 1000);
}

export function recordGif(
  canvas: HTMLCanvasElement,
  durationSec: number,
  callbacks: RecordCallbacks,
): void {
  if (gifInFlight) return; // guard against multiple in-flight encode jobs
  gifInFlight = true;

  const fps = 12;
  const frameDelayMs = 1000 / fps;
  const totalFrames = Math.round(durationSec * fps);

  const gif = new GIF({
    workers: 2,
    quality: 10,
    workerScript: gifWorkerUrl,
    width: canvas.width,
    height: canvas.height,
  });

  let capturedFrames = 0;
  let captureTimer: number | undefined;

  const finish = () => {
    if (captureTimer) window.clearInterval(captureTimer);
  };

  gif.on('progress', (renderFraction: number) => {
    // Capture phase is the first half of the reported progress arc, encode
    // (worker) phase is the second half, so the bar reads continuously.
    callbacks.onProgress?.(0.5 + renderFraction * 0.5);
  });

  gif.on('finished', (blob: Blob) => {
    gifInFlight = false;
    const filename = `lava-lamp-studio_${timestampSlug()}.gif`;
    triggerDownload(blob, filename);
    callbacks.onDone(filename);
  });

  gif.on('abort', () => {
    gifInFlight = false;
    callbacks.onError('GIF書き出しが中断されました');
  });

  try {
    captureTimer = window.setInterval(() => {
      gif.addFrame(canvas, { copy: true, delay: frameDelayMs });
      capturedFrames++;
      callbacks.onProgress?.((capturedFrames / totalFrames) * 0.5);
      if (capturedFrames >= totalFrames) {
        finish();
        try {
          gif.render();
        } catch (err) {
          gifInFlight = false;
          callbacks.onError('GIFエンコードの開始に失敗しました');
        }
      }
    }, frameDelayMs);
  } catch (err) {
    gifInFlight = false;
    finish();
    callbacks.onError('GIF書き出しに失敗しました');
  }
}
