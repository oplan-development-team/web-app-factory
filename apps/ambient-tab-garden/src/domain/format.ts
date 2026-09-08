/** Display formatting. Nothing here feeds back into the simulation. */

/** きらめき is only ever shown as a whole number, grouped for legibility. */
export function formatGlimmer(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Math.max(0, Math.floor(value)).toLocaleString('en-US');
}

/** The income readout keeps one decimal so a 共鳴 purchase visibly changes it. */
export function formatRate(perSecond: number): string {
  if (!Number.isFinite(perSecond) || perSecond <= 0) return '+0 /秒';
  return `+${perSecond.toFixed(1)} /秒`;
}

/**
 * Elapsed time in the coarsest unit that still says something useful:
 * seconds under a minute, minutes under an hour, hours and minutes above that.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0秒';
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}秒`;

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}分`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes === 0 ? `${hours}時間` : `${hours}時間${minutes}分`;

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours === 0 ? `${days}日` : `${days}日${remainingHours}時間`;
}
