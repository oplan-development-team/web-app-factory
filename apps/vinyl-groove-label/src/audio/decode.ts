import { AudioProcessingError, type Envelope } from '../types';
import { extractEnvelope } from './envelope';

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedContext) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      throw new AudioProcessingError('このブラウザはWeb Audio APIに対応していません。', 'unsupported');
    }
    sharedContext = new Ctor();
  }
  return sharedContext;
}

/** Decodes a raw audio ArrayBuffer (from a file or a MediaRecorder blob) into an Envelope. */
export async function decodeArrayBufferToEnvelope(
  arrayBuffer: ArrayBuffer,
  sourceLabel: string,
): Promise<Envelope> {
  const ctx = getAudioContext();
  let buffer: AudioBuffer;
  try {
    // Safari still wants the callback-style overload; the promise form covers everyone else.
    buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  } catch (err) {
    throw new AudioProcessingError(
      '音声を解析できませんでした。対応していないファイル形式か、ファイルが壊れている可能性があります。',
      'decode',
    );
  }
  return extractEnvelope(buffer, sourceLabel);
}

export async function decodeFileToEnvelope(file: File): Promise<Envelope> {
  if (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|aac|ogg|flac|webm)$/i.test(file.name)) {
    throw new AudioProcessingError(
      '音声ファイルを選択してください（mp3 / wav / m4a など）。',
      'unsupported',
    );
  }
  const arrayBuffer = await file.arrayBuffer();
  return decodeArrayBufferToEnvelope(arrayBuffer, file.name);
}
