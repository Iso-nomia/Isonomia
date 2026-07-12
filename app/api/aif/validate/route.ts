export const dynamic = "force-dynamic";

// app/api/aif/validate/route.ts
type NodeRef = { type: 'I'|'RA'|'CA'|'PA'; id: string };
type Edge = { from: NodeRef; to: NodeRef; role: 'premise'|'conclusion'|'conflictingElement'|'conflictedElement'|'preferredElement'|'dispreferredElement' };

function validateAIF(nodes: NodeRef[], edges: Edge[]) {
  const typeOf = new Map(nodes.map(n => [n.id, n.type]));
  const outByRole = new Map<string, Map<string, number>>();

  function inc(id: string, role: string) {
    const r = outByRole.get(id) ?? (outByRole.set(id, new Map()).get(id)!);
    r.set(role, (r.get(role) ?? 0) + 1);
  }

  for (const e of edges) {
    const tFrom = typeOf.get(e.from.id);
    const tTo   = typeOf.get(e.to.id);
    if (!tFrom || !tTo) throw new Error('EDGE_NODE_MISSING');
    // Def 2.1(2): E ⊆ V×V \ I×I (no I→I)
    if (tFrom === 'I' && tTo === 'I') throw new Error('NO_I_TO_I');
    inc(e.from.id, e.role);
  }

  // Def 2.1(4): RA has >=1 premise and exactly 1 conclusion
  for (const n of nodes.filter(n => n.type === 'RA')) {
    const r = outByRole.get(n.id) || new Map();
    if ((r.get('premise') ?? 0) < 1) throw new Error(`RA_${n.id}_NO_PREMISE`);
    if ((r.get('conclusion') ?? 0) !== 1) throw new Error(`RA_${n.id}_BAD_CONCLUSION`);
  }

  // Def 2.1(6): CA has exactly one conflicting and one conflicted
  for (const n of nodes.filter(n => n.type === 'CA')) {
    const r = outByRole.get(n.id) || new Map();
    if ((r.get('conflictingElement') ?? 0) !== 1) throw new Error(`CA_${n.id}_BAD_CONFLICTING`);
    if ((r.get('conflictedElement') ?? 0) !== 1) throw new Error(`CA_${n.id}_BAD_CONFLICTED`);
  }

  // Def 2.1(5): PA has exactly one preferred and one dispreferred
  for (const n of nodes.filter(n => n.type === 'PA')) {
    const r = outByRole.get(n.id) || new Map();
    if ((r.get('preferredElement') ?? 0) !== 1) throw new Error(`PA_${n.id}_BAD_PREFERRED`);
    if ((r.get('dispreferredElement') ?? 0) !== 1) throw new Error(`PA_${n.id}_BAD_DISPREFERRED`);
  }
  return { ok: true };
}

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { nodes, edges } = await req.json();
    const result = validateAIF(nodes, edges);
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
