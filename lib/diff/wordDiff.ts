// lib/diff/wordDiff.ts
export function diffWordsHtml(a: string, b: string) {
    const wa = a.split(/\s+/);
    const wb = b.split(/\s+/);
  
    // LCS dynamic programming
    const m = wa.length, n = wb.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        dp[i][j] = wa[i] === wb[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const out: string[] = [];
    let i = 0, j = 0;
    while (i < m && j < n) {
      if (wa[i] === wb[j]) {
        out.push(escape(wa[i]));
        i++; j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        out.push(`<del>${escape(wa[i])}</del>`);
        i++;
      } else {
        out.push(`<ins>${escape(wb[j])}</ins>`);
        j++;
      }
    }
    while (i < m) { out.push(`<del>${escape(wa[i++])}</del>`); }
    while (j < n) { out.push(`<ins>${escape(wb[j++])}</ins>`); }
  
    return out.join(" ");
  }
  function escape(s: string) {
    return s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!));
  }
  