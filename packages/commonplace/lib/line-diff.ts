/**
 * Line-level diff between two poems, using a classic LCS (longest common
 * subsequence) over whole lines. Chosen over word-level diff because in
 * poetry line breaks and stanza structure carry meaning.
 *
 * The output is an ordered list of ops that reconstructs the transformation
 * from `before` to `after`:
 *   - "equal"  — line present in both (unchanged)
 *   - "remove" — line present only in `before`
 *   - "add"    — line present only in `after`
 *
 * A blank string ("") represents a stanza break (see extractPoemLines).
 */

export type DiffOpType = "equal" | "add" | "remove";

export interface DiffOp {
  type: DiffOpType;
  text: string;
  /** 1-based line number in `before` (for equal/remove). */
  beforeLine?: number;
  /** 1-based line number in `after` (for equal/add). */
  afterLine?: number;
}

export interface DiffSummary {
  ops: DiffOp[];
  added: number;
  removed: number;
  /** True when the two versions are line-for-line identical. */
  identical: boolean;
}

export function diffLines(before: string[], after: string[]): DiffSummary {
  const n = before.length;
  const m = after.length;

  // LCS length table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        before[i] === after[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  let added = 0;
  let removed = 0;

  while (i < n && j < m) {
    if (before[i] === after[j]) {
      ops.push({
        type: "equal",
        text: before[i],
        beforeLine: i + 1,
        afterLine: j + 1,
      });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: "remove", text: before[i], beforeLine: i + 1 });
      removed++;
      i++;
    } else {
      ops.push({ type: "add", text: after[j], afterLine: j + 1 });
      added++;
      j++;
    }
  }
  while (i < n) {
    ops.push({ type: "remove", text: before[i], beforeLine: i + 1 });
    removed++;
    i++;
  }
  while (j < m) {
    ops.push({ type: "add", text: after[j], afterLine: j + 1 });
    added++;
    j++;
  }

  return { ops, added, removed, identical: added === 0 && removed === 0 };
}
