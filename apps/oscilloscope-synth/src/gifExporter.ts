import GIF from 'gif.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import gifWorkerUrl from 'gif.js/dist/gif.worker.js?url';

export interface GifCaptureOptions {
  sourceCanvas: HTMLCanvasElement;
  durationMs: number;
  fps: number;
  onProgress: (fraction: number) => void;
  /** Called once per captured frame, right before it is added to the encoder,
   * so the caller can advance the live scope render for that frame. */
  onBeforeFrame: () => void;
}

export function captureGif(opts: GifCaptureOptions): Promise<Blob> {
  const { sourceCanvas, durationMs, fps, onProgress, onBeforeFrame } = opts;
  const frameDelay = 1000 / fps;
  const totalFrames = Math.round(durationMs / frameDelay);

  const gif = new GIF({
    workers: 2,
    quality: 10,
    width: sourceCanvas.width,
    height: sourceCanvas.height,
    workerScript: gifWorkerUrl,
    repeat: 0
  });

  return new Promise((resolve, reject) => {
    let captured = 0;

    function captureNext() {
      if (captured >= totalFrames) {
        onProgress(0.5);
        gif.render();
        return;
      }
      onBeforeFrame();
      gif.addFrame(sourceCanvas, { copy: true, delay: frameDelay });
      captured++;
      onProgress((captured / totalFrames) * 0.5);
      requestAnimationFrame(captureNext);
    }

    gif.on('progress', (fraction: number) => {
      onProgress(0.5 + fraction * 0.5);
    });
    gif.on('finished', (blob: Blob) => {
      resolve(blob);
    });
    // gif.js typings don't declare an 'abort'/'error' event, but the
    // underlying EventEmitter will happily forward one if raised.
    (gif as unknown as { on(evt: string, cb: (err: Error) => void): void }).on(
      'error',
      (err: Error) => reject(err)
    );

    captureNext();
  });
}
