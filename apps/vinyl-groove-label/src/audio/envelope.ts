import { AudioProcessingError, ENVELOPE_SEGMENT_COUNT, type Envelope } from '../types';

const SILENCE_THRESHOLD = 0.0015;

/**
 * Mixes a (possibly multi-channel) AudioBuffer down to mono and extracts a
 * fixed-length RMS amplitude envelope, normalized to 0..1.
 */
export function extractEnvelope(buffer: AudioBuffer, sourceLabel: string): Envelope {
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }
  const length = buffer.length;
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let c = 0; c < channels.length; c++) sum += channels[c][i];
    mono[i] = sum / channels.length;
  }

  const segmentCount = ENVELOPE_SEGMENT_COUNT;
  const raw = new Float32Array(segmentCount);
  const samplesPerSegment = Math.max(1, Math.floor(length / segmentCount));

  for (let s = 0; s < segmentCount; s++) {
    const start = s * samplesPerSegment;
    const end = s === segmentCount - 1 ? length : Math.min(length, start + samplesPerSegment);
    let sumSquares = 0;
    let count = 0;
    for (let i = start; i < end; i++) {
      const v = mono[i];
      sumSquares += v * v;
      count++;
    }
    raw[s] = count > 0 ? Math.sqrt(sumSquares / count) : 0;
  }

  // Light 3-tap smoothing so segment boundaries don't read as noise.
  const smoothed = new Float32Array(segmentCount);
  for (let s = 0; s < segmentCount; s++) {
    const prev = raw[Math.max(0, s - 1)];
    const next = raw[Math.min(segmentCount - 1, s + 1)];
    smoothed[s] = (prev + raw[s] * 2 + next) / 4;
  }

  const max = smoothed.reduce((m, v) => Math.max(m, v), 0);
  if (max < SILENCE_THRESHOLD) {
    throw new AudioProcessingError(
      '音声がほぼ無音のようです。別のファイルを選ぶか、マイクの入力音量を確認してください。',
      'silence',
    );
  }

  const normalized = new Float32Array(segmentCount);
  for (let s = 0; s < segmentCount; s++) {
    normalized[s] = Math.min(1, smoothed[s] / max);
  }

  return {
    values: normalized,
    durationSec: buffer.duration,
    sourceLabel,
  };
}

/** Generates a flat, evenly-modulated envelope used for the empty-state placeholder disc. */
export function placeholderEnvelope(): Envelope {
  const values = new Float32Array(ENVELOPE_SEGMENT_COUNT).fill(0.32);
  return { values, durationSec: 0, sourceLabel: 'placeholder' };
}
