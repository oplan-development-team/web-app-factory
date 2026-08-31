export type TokenizeMode = 'char' | 'word';

export interface Token {
  text: string;
}

export type RawOpType = 'equal' | 'delete' | 'insert';

export interface RawOp {
  type: RawOpType;
  token: Token;
}

export type SegmentKind =
  | 'equal'
  | 'delete'
  | 'insert'
  | 'replace'
  | 'move-out'
  | 'move-in';

export interface Segment {
  /** stable id, unique within a single diff render */
  id: string;
  kind: SegmentKind;
  /** the text that is rendered in the manuscript body flow (ink-colored, possibly struck) */
  text: string;
  /** handwritten vermillion annotation content (insert caret note / replace ruby note) */
  correctionText?: string;
  /** links a move-out segment to its matching move-in segment */
  moveId?: string;
}
