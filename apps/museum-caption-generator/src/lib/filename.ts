/** タイトル文字列からファイル名として安全な文字列を作る。 */
export function sanitizeFilename(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 40)
    .trim();
  return cleaned.length > 0 ? cleaned : 'exhibit';
}
