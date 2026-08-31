import type { RawOp, Segment, Token } from './types';

interface Block {
  type: 'equal' | 'delete' | 'insert';
  tokens: Token[];
}

/** Delete/insert blocks whose joined text matches exactly and whose length
 * (in tokens) is at least this are reclassified as a "move" pair instead of
 * an unrelated delete + insert. */
const MOVE_MIN_TOKENS = 4;

/** Adjacent delete+insert blocks up to this length (in tokens, each side)
 * are treated as a single "replace" (ruby correction) instead of a bare
 * delete followed by a bare insert. */
const REPLACE_MAX_TOKENS = 30;

function groupBlocks(ops: RawOp[]): Block[] {
  const blocks: Block[] = [];
  for (const op of ops) {
    const last = blocks[blocks.length - 1];
    if (last && last.type === op.type) {
      last.tokens.push(op.token);
    } else {
      blocks.push({ type: op.type, tokens: [op.token] });
    }
  }
  return blocks;
}

function joinedText(block: Block): string {
  return block.tokens.map((t) => t.text).join('');
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function buildSegments(ops: RawOp[]): Segment[] {
  const blocks = groupBlocks(ops);

  type MoveMeta = { moveId: string; role: 'move-out' | 'move-in' };
  const moveMeta = new Map<number, MoveMeta>();

  const deleteIndices = blocks
    .map((b, i) => ({ b, i }))
    .filter((x) => x.b.type === 'delete');
  const insertIndices = blocks
    .map((b, i) => ({ b, i }))
    .filter((x) => x.b.type === 'insert');

  const usedInserts = new Set<number>();

  for (const del of deleteIndices) {
    if (del.b.tokens.length < MOVE_MIN_TOKENS) continue;
    const delText = joinedText(del.b);
    const match = insertIndices.find(
      (ins) => !usedInserts.has(ins.i) && ins.b.tokens.length >= MOVE_MIN_TOKENS && joinedText(ins.b) === delText,
    );
    if (match) {
      usedInserts.add(match.i);
      const moveId = nextId('move');
      moveMeta.set(del.i, { moveId, role: 'move-out' });
      moveMeta.set(match.i, { moveId, role: 'move-in' });
    }
  }

  // Second pass: adjacent short delete+insert (either order) not already
  // consumed by move detection become a single "replace" segment.
  type ReplaceMeta = { partnerIndex: number; isPrimary: boolean };
  const replaceMeta = new Map<number, ReplaceMeta>();

  for (let i = 0; i < blocks.length - 1; i++) {
    const cur = blocks[i];
    const next = blocks[i + 1];
    if (moveMeta.has(i) || moveMeta.has(i + 1)) continue;
    if (replaceMeta.has(i) || replaceMeta.has(i + 1)) continue;

    const isDelIns = cur.type === 'delete' && next.type === 'insert';
    const isInsDel = cur.type === 'insert' && next.type === 'delete';
    if (!isDelIns && !isInsDel) continue;

    if (cur.tokens.length > REPLACE_MAX_TOKENS || next.tokens.length > REPLACE_MAX_TOKENS) continue;

    const delIndex = isDelIns ? i : i + 1;
    const insIndex = isDelIns ? i + 1 : i;
    replaceMeta.set(delIndex, { partnerIndex: insIndex, isPrimary: true });
    replaceMeta.set(insIndex, { partnerIndex: delIndex, isPrimary: false });
  }

  const segments: Segment[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const text = joinedText(block);

    if (block.type === 'equal') {
      if (text.length === 0) continue;
      segments.push({ id: nextId('eq'), kind: 'equal', text });
      continue;
    }

    const move = moveMeta.get(i);
    if (move) {
      segments.push({
        id: nextId('mv'),
        kind: move.role,
        text,
        moveId: move.moveId,
      });
      continue;
    }

    const replace = replaceMeta.get(i);
    if (replace) {
      if (!replace.isPrimary) continue; // rendered by the primary (delete) side
      const partner = blocks[replace.partnerIndex];
      segments.push({
        id: nextId('rp'),
        kind: 'replace',
        text,
        correctionText: joinedText(partner),
      });
      continue;
    }

    if (block.type === 'delete') {
      segments.push({ id: nextId('del'), kind: 'delete', text });
    } else {
      segments.push({ id: nextId('ins'), kind: 'insert', text: '', correctionText: text });
    }
  }

  return segments;
}
