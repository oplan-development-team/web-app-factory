/** A single Ctrl+V paste, kept only in memory for the lifetime of the tab. */
export interface Fragment {
  id: number;
  /** Full pasted text, used as material for poem generation. */
  fullText: string;
  /** Text actually printed to the raw log (may be truncated for paper-feed reasons). */
  printedText: string;
  truncated: boolean;
  pastedAt: number;
}

export interface ToggleState {
  lineBreak: boolean;
  trim: boolean;
  shuffle: boolean;
}

/** A generated found-poem: an ordered list of lines, '' marks a stanza break. */
export interface Poem {
  id: number;
  lines: string[];
  toggles: ToggleState;
  createdAt: number;
}

export type LedMessage =
  | { kind: 'idle' }
  | { kind: 'count'; count: number }
  | { kind: 'unsupported' }
  | { kind: 'empty' };
