import type { RawSample, Segment, RecordingStats } from '../types';
import { LITHOLOGY_BINS, classifyPitch } from './lithology';

const JITTER_THRESHOLD_SEMITONES = 0.9;
const MIN_SEGMENT_PX = 6;

interface RawSegment {
  kind: Segment['kind'];
  lithologyId: string | null;
  startT: number;
  endT: number;
  rmsSum: number;
  jitterSum: number;
  count: number;
}

/**
 * Classifies each raw 200ms sample into a lithology bin (or "unconformity"
 * for silence), merges adjacent same-classification samples into visual
 * segments, then normalizes their thickness so the whole column fills a
 * fixed pixel height regardless of total recording length. Thickness is
 * driven mostly by each segment's share of the recording's duration, with
 * a volume-weighted adjustment layered on top (louder passages read as
 * thicker beds; near-silence collapses toward the segment-minimum floor).
 */
export function buildStrata(
  samples: RawSample[],
  totalDurationSec: number,
  columnHeightPx: number
): { segments: Segment[]; stats: RecordingStats } {
  const raw: RawSegment[] = [];

  for (const s of samples) {
    const isSilent = s.silent || s.f0 === null;
    const lithologyId = isSilent ? null : classifyPitch(s.f0 as number).id;
    const kind: Segment['kind'] = isSilent ? 'unconformity' : 'lithology';
    const last = raw[raw.length - 1];

    if (last && last.kind === kind && last.lithologyId === lithologyId) {
      last.endT = s.t;
      last.rmsSum += s.rms;
      last.jitterSum += s.jitterSemitones;
      last.count += 1;
    } else {
      raw.push({
        kind,
        lithologyId,
        startT: last ? last.endT : 0,
        endT: s.t,
        rmsSum: s.rms,
        jitterSum: s.jitterSemitones,
        count: 1,
      });
    }
  }

  if (raw.length === 0) {
    return {
      segments: [],
      stats: { durationSec: totalDurationSec, voicedSegmentCount: 0, silentSegmentCount: 0, loudestLithology: null, highestLithology: null },
    };
  }
  raw[raw.length - 1].endT = totalDurationSec;

  const maxRms = Math.max(...raw.map((r) => r.rmsSum / r.count), 0.0001);

  const weighted = raw.map((r) => {
    const duration = Math.max(0.001, r.endT - r.startT);
    const avgRms = r.rmsSum / r.count;
    const normRms = Math.min(1, avgRms / maxRms);
    const weight = r.kind === 'lithology' ? duration * (0.35 + 0.65 * normRms) : duration * (0.3 + 0.3 * normRms);
    return { ...r, duration, avgRms, weight };
  });

  const totalWeight = weighted.reduce((a, w) => a + w.weight, 0) || 1;
  const availablePx = columnHeightPx - MIN_SEGMENT_PX * weighted.length;

  const segments: Segment[] = [];
  let y = 0;
  for (const w of weighted) {
    const share = w.weight / totalWeight;
    const thicknessPx = MIN_SEGMENT_PX + Math.max(0, availablePx) * share;
    const jittery = w.kind === 'lithology' && w.jitterSum / w.count > JITTER_THRESHOLD_SEMITONES;
    segments.push({
      kind: w.kind,
      startT: w.startT,
      endT: w.endT,
      lithology: w.kind === 'lithology' ? LITHOLOGY_BINS.find((b) => b.id === w.lithologyId) : undefined,
      jittery,
      avgRms: w.avgRms,
      thicknessPx,
      yPx: y,
    });
    y += thicknessPx;
  }

  // Correct rounding drift so the column exactly fills columnHeightPx.
  const drift = columnHeightPx - y;
  if (segments.length > 0) segments[segments.length - 1].thicknessPx += drift;

  const stats = computeStats(segments, totalDurationSec);
  return { segments, stats };
}

function computeStats(segments: Segment[], durationSec: number): RecordingStats {
  const lithoSegs = segments.filter((s) => s.kind === 'lithology');
  const silentSegs = segments.filter((s) => s.kind === 'unconformity');

  let loudest: Segment | null = null;
  for (const s of lithoSegs) {
    if (!loudest || s.avgRms > loudest.avgRms) loudest = s;
  }

  let highestBinIndex = -1;
  let highestLithology = null;
  for (const s of lithoSegs) {
    const idx = LITHOLOGY_BINS.findIndex((b) => b.id === s.lithology?.id);
    if (idx > highestBinIndex) {
      highestBinIndex = idx;
      highestLithology = s.lithology ?? null;
    }
  }

  return {
    durationSec,
    voicedSegmentCount: lithoSegs.length,
    silentSegmentCount: silentSegs.length,
    loudestLithology: loudest?.lithology ?? null,
    highestLithology,
  };
}
