import type { RawOp, Token } from './types';

/**
 * Classic Myers O(ND) shortest edit script diff, implemented from scratch
 * (no external diff library). Snapshots the V array at every edit distance
 * D so the edit path can be reconstructed by backtracking.
 *
 * Reference algorithm: E. Myers, "An O(ND) Difference Algorithm and Its
 * Variations" (1986). This is a from-scratch reimplementation of the
 * standard technique, not a copy of any specific library's source.
 */
export function myersDiff(a: Token[], b: Token[]): RawOp[] {
  const N = a.length;
  const M = b.length;
  const max = N + M;

  if (max === 0) return [];

  const equalAt = (ai: number, bi: number) => a[ai].text === b[bi].text;

  const v: Record<number, number> = { 1: 0 };
  const trace: Record<number, number>[] = [];
  let finalD = -1;

  outer: for (let d = 0; d <= max; d++) {
    trace.push({ ...v });
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[k - 1] < v[k + 1])) {
        x = v[k + 1];
      } else {
        x = v[k - 1] + 1;
      }
      let y = x - k;
      while (x < N && y < M && equalAt(x, y)) {
        x++;
        y++;
      }
      v[k] = x;
      if (x >= N && y >= M) {
        finalD = d;
        break outer;
      }
    }
  }

  const ops: RawOp[] = [];
  let x = N;
  let y = M;

  for (let d = finalD; d >= 0; d--) {
    const vv = trace[d];
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && vv[k - 1] < vv[k + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = vv[prevK];
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      ops.push({ type: 'equal', token: a[x - 1] });
      x--;
      y--;
    }

    if (d > 0) {
      if (x === prevX) {
        ops.push({ type: 'insert', token: b[y - 1] });
        y--;
      } else {
        ops.push({ type: 'delete', token: a[x - 1] });
        x--;
      }
    }
  }

  ops.reverse();
  return ops;
}
