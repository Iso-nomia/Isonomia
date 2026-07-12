
// Minimal JSON canonicalization (JCS-like):
// - Object keys sorted lexicographically
// - Arrays in order
// - No whitespace beyond what JSON.stringify emits
export function canonicalize(input: any): string {
  return JSON.stringify(sortRec(input));
}

function sortRec(v: any): any {
  if (v === null) return null;
  if (Array.isArray(v)) return v.map(sortRec);
  if (typeof v === "object") {
    const out: Record<string, any> = {};
    Object.keys(v).sort().forEach(k => { out[k] = sortRec(v[k]); });
    return out;
  }
  return v;
}
