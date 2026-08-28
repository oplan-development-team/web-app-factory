import { AudioProcessingError, type Envelope } from '../types';
import { decodeArrayBufferToEnvelope } from './decode';

export const MAX_RECORD_SECONDS = 30;

export interface MicRecorderCallbacks {
  onLevel: (level: number) => void; // 0..1, called on an animation-frame cadence
  onTick: (elapsedSec: number) => void;
  onAutoStop: () => void;
}

export class MicRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private rafId: number | null = null;
  private tickId: number | null = null;
  private chunks: BlobPart[] = [];
  private startedAt = 0;

  async start(callbacks: MicRecorderCallbacks): Promise<void> {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      throw new AudioProcessingError(
        'マイクへのアクセスが許可されませんでした。ブラウザの権限設定を確認してください。',
        'permission',
      );
    }
    this.stream = stream;

    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new Ctor();
    const source = this.audioCtx.createMediaStreamSource(stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 1024;
    source.connect(this.analyser);

    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined;
    this.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
    this.startedAt = performance.now();

    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const pump = () => {
      if (!this.analyser) return;
      this.analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const norm = (data[i] - 128) / 128;
        sumSquares += norm * norm;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      callbacks.onLevel(Math.min(1, rms * 4));
      this.rafId = requestAnimationFrame(pump);
    };
    pump();

    this.tickId = window.setInterval(() => {
      const elapsed = (performance.now() - this.startedAt) / 1000;
      callbacks.onTick(elapsed);
      if (elapsed >= MAX_RECORD_SECONDS) {
        callbacks.onAutoStop();
      }
    }, 200);
  }

  /** Stops recording and returns the decoded envelope from the captured audio. */
  async stop(): Promise<Envelope> {
    const recorder = this.recorder;
    if (!recorder) {
      throw new AudioProcessingError('録音が開始されていません。', 'unknown');
    }

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' }));
      };
      if (recorder.state !== 'inactive') recorder.stop();
      else resolve(new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' }));
    });

    this.cleanup();

    const arrayBuffer = await blob.arrayBuffer();
    return decodeArrayBufferToEnvelope(arrayBuffer, 'マイク録音');
  }

  cancel(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop();
      } catch {
        // already stopped
      }
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.tickId !== null) window.clearInterval(this.tickId);
    this.rafId = null;
    this.tickId = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.analyser = null;
    void this.audioCtx?.close().catch(() => undefined);
    this.audioCtx = null;
    this.recorder = null;
  }
}
