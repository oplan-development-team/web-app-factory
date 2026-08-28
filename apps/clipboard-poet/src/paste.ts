export type PasteResult =
  | { kind: 'text'; text: string }
  | { kind: 'empty' }
  | { kind: 'unsupported' };

/** Reads a ClipboardEvent and classifies it. Anything that isn't a non-empty
 * plain-text payload is treated as unsupported/empty and never touches the
 * DOM as markup — callers must only ever assign the resulting text via
 * textContent, never innerHTML, since it is fully untrusted input. */
export function readClipboardEvent(e: ClipboardEvent): PasteResult {
  const dt = e.clipboardData;
  if (!dt) return { kind: 'unsupported' };
  if (dt.files && dt.files.length > 0) return { kind: 'unsupported' };
  const types = Array.from(dt.types ?? []);
  if (!types.includes('text/plain')) return { kind: 'unsupported' };
  const text = dt.getData('text/plain');
  if (!text || !text.trim()) return { kind: 'empty' };
  return { kind: 'text', text };
}

/** Registers a page-wide Ctrl+V / Cmd+V listener. There are no text inputs
 * in this app (by design — see outOfScope), so capturing paste at the
 * window level everywhere is safe and doesn't fight any editable field. */
export function registerGlobalPaste(handler: (result: PasteResult) => void): () => void {
  const listener = (e: ClipboardEvent) => {
    const result = readClipboardEvent(e);
    e.preventDefault();
    handler(result);
  };
  window.addEventListener('paste', listener);
  return () => window.removeEventListener('paste', listener);
}
