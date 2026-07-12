export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// --- helpers (light AF machinery) ---
type Edge = [string, string];

function grounded(A: string[], R: Edge[]): Set<string> {
  // Naive grounded approximation: least fixed point of characteristic function
  const atk = new Map<string, Set<string>>();
  for (const a of A) atk.set(a, new Set());
  for (const [x, y] of R) atk.get(y)?.add(x);

  let IN = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    // Defended w.r.t current IN?
    for (const a of A) {
      if (IN.has(a)) continue;
      const attackers = atk.get(a) || new Set<string>();
      let defended = true;
      for (const b of attackers) {
        // Is b attacked by someone in IN?
        let bIsAttacked = false;
        for (const c of IN) if (R.some(([u, v]) => u === c && v === b)) { bIsAttacked = true; break; }
        if (!bIsAttacked) { defended = false; break; }
      }
      if (defended) { IN.add(a); changed = true; }
    }
  }
  return IN;
}
function labelingFromExtension(A: string[], R: Edge[], E: Set<string>) {
  const IN = new Set(E);
  const OUT = new Set<string>();
  const UNDEC = new Set<string>();
  // OUT = nodes attacked by IN
  for (const [x, y] of R) if (IN.has(x)) OUT.add(y);
  for (const a of A) if (!IN.has(a) && !OUT.has(a)) UNDEC.add(a);
  return { IN, OUT, UNDEC };
}
function computeStableExtension(A: string[], R: Edge[]): Set<string> | null {
  if (A.length > 18) return null;
  const attacks = new Set(R.map(([x,y]) => `${x}→${y}`));
  const n = A.length, total = 1 << n;
  for (let mask=0; mask<total; mask++) {
    const E = new Set<string>();
    for (let i=0;i<n;i++) if (mask & (1<<i)) E.add(A[i]);
    // conflict free?
    let ok = true;
    outer: for (const a of E) for (const b of E) if (a!==b && attacks.has(`${a}→${b}`)) { ok=false; break outer; }
    if (!ok) continue;
    // attacks every outside
    const outside = A.filter(x => !E.has(x));
    for (const y of outside) {
      let attacked = false;
      for (const a of E) if (attacks.has(`${a}→${y}`)) { attacked=true; break; }
      if (!attacked) { ok=false; break; }
    }
    if (ok) return E;
  }
  return null;
}

// --- contract ---
const Body = z.object({
  semantics: z.enum(['grounded','preferred','stable']).default('grounded'),
  nodes: z.array(z.object({ id: z.string().min(1), text: z.string().optional() })).min(1),
  edges: z.array(z.tuple([z.string().min(1), z.string().min(1)])).default([]),
  targetId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { semantics, nodes, edges, targetId } = parsed.data;
  const A = nodes.map(n => n.id);
  const R = edges;

  // (cheap) preferred = union of grounded + (if small) all admissible supersets we skip → you can swap in your afEngine
  let E: Set<string>;
  if (semantics === 'grounded') {
    E = grounded(A, R);
  } else if (semantics === 'stable') {
    E = computeStableExtension(A, R) || grounded(A, R);
  } else {
    // preferred (credulous union approx): union(grounded, “defended nodes”) – small safe approximation
    const g = grounded(A, R);
    const defended = new Set<string>();
    const attackersOf = (y:string) => R.filter(([x,t])=>t===y).map(([x])=>x);
    for (const a of A) {
      const atk = attackersOf(a);
      let allAttackedBack = true;
      for (const b of atk) {
        let bAttacked = false;
        for (const c of A) if (g.has(c) && R.some(([u,v]) => u===c && v===b)) { bAttacked = true; break; }
        if (!bAttacked) { allAttackedBack = false; break; }
      }
      if (allAttackedBack) defended.add(a);
    }
    E = new Set<string>([...g, ...defended]);
  }

  const lab = labelingFromExtension(A, R, E);

  // Build rationale for the target
  const attackers = R.filter(([x,y]) => y === targetId).map(([x]) => x);
  const idToText = new Map(nodes.map(n => [n.id, n.text || n.id]));
  const defendOf = (attacker: string) => R.filter(([x,y]) => y === attacker).map(([x]) => x);

  const explain = attackers.map(a => ({
    attacker: { id: a, text: idToText.get(a), status: lab.IN.has(a) ? 'IN' : lab.OUT.has(a) ? 'OUT' : 'UNDEC' },
    defenders: defendOf(a).map(d => ({
      id: d, text: idToText.get(d), status: lab.IN.has(d) ? 'IN' : lab.OUT.has(d) ? 'OUT' : 'UNDEC'
    })),
  }));

  return NextResponse.json({
    ok: true,
    labeling: {
      IN: [...lab.IN], OUT: [...lab.OUT], UNDEC: [...lab.UNDEC],
    },
    targetId,
    explain, // [{ attacker:{...}, defenders:[...] }]
  });
}
