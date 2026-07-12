export type DiffPart = { type: 'same' | 'add' | 'remove'; text: string };

// Simple LCS-based word diff for readability (not perfect, but robust enough for sections)
export function diffWords(a: string, b: string): DiffPart[] {
  const A = a.split(/\s+/);
  const B = b.split(/\s+/);
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  let i = 0, j = 0;
  const push = (type: DiffPart['type'], txt: string) => {
    if (!txt) return;
    if (parts.length && parts[parts.length - 1].type === type) {
      parts[parts.length - 1].text += ' ' + txt;
    } else {
      parts.push({ type, text: txt });
    }
  };
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      push('same', A[i]); i++; j++; continue;
    }
    if (dp[i + 1][j] >= dp[i][j + 1]) { push('remove', A[i]); i++; }
    else { push('add', B[j]); j++; }
  }
  while (i < n) { push('remove', A[i]); i++; }
  while (j < m) { push('add', B[j]); j++; }
  return parts;
}
