export type ArgId = string;
export type Attack = [ArgId, ArgId];

function powerset<T>(arr: T[], limit = 20_000): T[][] {
  const out: T[][] = []; const n = arr.length;
  for (let mask = 0; mask < (1 << n) && out.length < limit; mask++) {
    const s: T[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) s.push(arr[i]);
    out.push(s);
  }
  return out;
}

function conflictFree(set: ArgId[], attacks: Attack[]): boolean {
  const S = new Set(set);
  for (const [a,b] of attacks) if (S.has(a) && S.has(b)) return false;
  return true;
}

function attacksAllOutside(set: ArgId[], universe: ArgId[], attacks: Attack[]): boolean {
  const S = new Set(set); const outside = universe.filter(x => !S.has(x));
  const Afrom = new Map<ArgId, Set<ArgId>>();
  for (const [a,b] of attacks) {
    if (!Afrom.has(a)) Afrom.set(a, new Set());
    Afrom.get(a)!.add(b);
  }
  for (const x of outside) {
    let attacked = false;
    for (const a of set) { if (Afrom.get(a)?.has(x)) { attacked = true; break; } }
    if (!attacked) return false;
  }
  return true;
}

export function stableExtensions(args: ArgId[], attacks: Attack[], limit = 50_000): ArgId[][] {
  const ext: ArgId[][] = [];
  for (const S of powerset(args, limit)) {
    if (conflictFree(S, attacks) && attacksAllOutside(S, args, attacks)) ext.push(S);
  }
  return ext;
}
