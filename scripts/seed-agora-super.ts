// scripts/seed-agora-super.ts
import 'dotenv/config';
import { prisma } from '@/lib/prismaclient';
import { maybeUpsertClaimEdgeFromArgumentEdge } from '@/lib/deepdive/claimEdgeHelpers';
import { mintClaimMoid } from '@/lib/ids/mintMoid';
import { mintUrn } from '@/lib/ids/urn';
// Optional – if present, we'll call it; otherwise we skip:
let recomputeGroundedForDelib: undefined | ((d: string) => Promise<void>);
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  recomputeGroundedForDelib = require('@/lib/ceg/grounded').recomputeGroundedForDelib;
} catch { /* ok */ }

type MoveKind =
  | 'assertion'
  | 'grounds'
  | 'warrant'
  | 'backing'
  | 'qualifier'
  | 'rebuttal'
  | 'counter_rebuttal';

type ModelFlavor = 'dialogical' | 'monological' | 'rhetorical';

type EdgeKind = 'support'|'rebut'|'rebut_premise'|'undercut_inference';

// ---------- utilities ----------

async function ensureUser(authId: string, username: string, name: string) {
  const u = await prisma.user.findUnique({ where: { auth_id: authId } });
  if (u) return u;
  return prisma.user.create({ data: { auth_id: authId, username, name } });
}

const prismaAny = prisma as any;
const hasModel = (lowerCamel: string) => Boolean(prismaAny?.[lowerCamel]);

async function tryCreateClaimCitation(claimId: string, uri: string, extra?: Record<string, any>) {
  if (!hasModel('claimCitation')) return;
  try {
    await prismaAny.claimCitation.create({
      data: { claimId, uri, ...(extra ?? {}) },
    });
  } catch (e) {
    // try minimal shape
    try {
      await prismaAny.claimCitation.create({ data: { claimId, uri } });
    } catch { /* swallow – schema variance */ }
  }
}

async function tryCreateEvidenceLink(argId: string, url: string, title?: string) {
  if (!hasModel('evidenceLink')) return;
  try {
    await prismaAny.evidenceLink.create({
      data: { argumentId: argId, url, title: title ?? 'citation' },
    });
  } catch { /* optional model */ }
}

async function addApproval(deliberationId: string, argumentId: string, userId: string) {
  try {
    await prisma.argumentApproval.create({ data: { deliberationId, argumentId, userId } });
  } catch { /* maybe unique or foreign shape; ignore */ }
}

function mapEdge(kind: EdgeKind) {
  if (kind === 'support') return { type: 'support' as const, targetScope: undefined };
  if (kind === 'rebut') return { type: 'rebut' as const, targetScope: 'conclusion' as const };
  if (kind === 'rebut_premise') return { type: 'rebut' as const, targetScope: 'premise' as const };
  return { type: 'undercut' as const, targetScope: 'inference' as const }; // undercut_inference
}

async function promoteArgumentToClaim(deliberationId: string, argumentId: string, createdById: string) {
  const arg = await prisma.argument.findUnique({ where: { id: argumentId }, select: { text: true, claimId: true } });
  if (!arg) return null;
  if (arg.claimId) return prisma.claim.findUnique({ where: { id: arg.claimId } });

  const moid = mintClaimMoid(arg.text);
  const urn  = mintUrn('claim', moid);
  const claim = await prisma.claim.create({
    data: {
      deliberationId,
      text: arg.text,
      createdById,
      moid,
      urns: { create: { entityType: 'claim', urn } },
    },
  });

  await prisma.argument.update({ where: { id: argumentId }, data: { claimId: claim.id } });

  // refresh claim-edges for any incident argument-edges
  const incident = await prisma.argumentEdge.findMany({
    where: { OR: [{ fromArgumentId: argumentId }, { toArgumentId: argumentId }] },
    select: { id: true },
  });
  for (const e of incident) await maybeUpsertClaimEdgeFromArgumentEdge(e.id);

  return claim;
}

// ---------- Dung AF + topology analysis (local, in-memory) ----------

type ArgNode = { id: string };
type AttackEdge = { from: string; to: string };

function computeDungBasics(nodes: ArgNode[], attacks: AttackEdge[]) {
  const N = nodes.map(n => n.id);
  const atkMap = new Map<string, Set<string>>(); // from -> {to}
  const revMap = new Map<string, Set<string>>(); // to -> {from}
  for (const id of N) { atkMap.set(id, new Set()); revMap.set(id, new Set()); }
  for (const e of attacks) {
    atkMap.get(e.from)?.add(e.to);
    revMap.get(e.to)?.add(e.from);
  }

  // conflict-free
  function isConflictFree(set: Set<string>) {
    for (const a of set) for (const b of set) {
      if (a === b) continue;
      if (atkMap.get(a)?.has(b) || atkMap.get(b)?.has(a)) return false;
    }
    return true;
  }

  // defend X w.r.t set S
  function isDefended(x: string, S: Set<string>) {
    const attackers = Array.from(revMap.get(x) ?? []);
    return attackers.every(attacker =>
      Array.from(S).some(s => atkMap.get(s)?.has(attacker)));
  }

  // characteristic function F(S)
  function F(S: Set<string>) {
    const out = new Set<string>();
    for (const a of N) if (isDefended(a, S)) out.add(a);
    return out;
  }

  // grounded: least fixed point via iteration from empty
  function grounded() {
    let S = new Set<string>();
    while (true) {
      const next = F(S);
      const eq = next.size === S.size && Array.from(next).every(x => S.has(x));
      if (eq) return next;
      S = next;
    }
  }

  // enumerate admissible sets (small N fallback)
  function enumerateSubsets(): Set<string>[] {
    const arr: Set<string>[] = [];
    const ids = N;
    const total = 1 << ids.length;
    for (let mask = 0; mask < total; mask++) {
      const S = new Set<string>();
      for (let i = 0; i < ids.length; i++) if (mask & (1 << i)) S.add(ids[i]);
      arr.push(S);
    }
    return arr;
  }

  function admissibleSets(): Set<string>[] {
    const subs = enumerateSubsets();
    return subs.filter(S => isConflictFree(S) && Array.from(S).every(a => isDefended(a, S)));
  }

  function preferredSets(): Set<string>[] {
    const adm = admissibleSets();
    let max = 0;
    for (const S of adm) if (S.size > max) max = S.size;
    return adm.filter(S => S.size === max);
  }

  function stableSets(): Set<string>[] {
    // S is stable if conflict-free and it attacks all outside
    const subs = enumerateSubsets();
    const out: Set<string>[] = [];
    for (const S of subs) {
      if (!isConflictFree(S)) continue;
      let ok = true;
      for (const a of N) if (!S.has(a)) {
        // exists s in S s.t. s attacks a
        const hits = Array.from(S).some(s => atkMap.get(s)?.has(a));
        if (!hits) { ok = false; break; }
      }
      if (ok) out.push(S);
    }
    return out;
  }

  return { grounded: grounded(), preferred: preferredSets(), stable: stableSets() };
}

type SuppEdge = { from: string; to: string };
function sccAndTopo(nodes: string[], supports: SuppEdge[]) {
  // Tarjan SCC
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Map<string, boolean>();
  const stack: string[] = [];
  let idx = 0;
  const sccs: string[][] = [];
  const outEdges = new Map<string, string[]>();
  nodes.forEach(n => outEdges.set(n, []));
  supports.forEach(e => outEdges.get(e.from)?.push(e.to));

  function strongconnect(v: string) {
    index.set(v, idx); low.set(v, idx); idx++;
    stack.push(v); onStack.set(v, true);

    for (const w of outEdges.get(v) ?? []) {
      if (!index.has(w)) { strongconnect(w); low.set(v, Math.min(low.get(v)!, low.get(w)!)); }
      else if (onStack.get(w)) { low.set(v, Math.min(low.get(v)!, index.get(w)!)); }
    }
    if (low.get(v) === index.get(v)) {
      const comp: string[] = [];
      while (true) {
        const w = stack.pop()!;
        onStack.set(w, false);
        comp.push(w);
        if (w === v) break;
      }
      sccs.push(comp);
    }
  }
  for (const v of nodes) if (!index.has(v)) strongconnect(v);

  // Condense SCCs to DAG and topo-sort
  const compId = new Map<string, number>();
  sccs.forEach((c, i) => c.forEach(v => compId.set(v, i)));
  const dagAdj = new Map<number, Set<number>>();
  sccs.forEach((_c, i) => dagAdj.set(i, new Set()));
  for (const e of supports) {
    const a = compId.get(e.from)!; const b = compId.get(e.to)!;
    if (a !== b) dagAdj.get(a)!.add(b);
  }
  // Kahn
  const indeg = new Map<number, number>();
  sccs.forEach((_c, i) => indeg.set(i, 0));
  sccs.forEach((_c, i) => dagAdj.get(i)!.forEach(j => indeg.set(j, (indeg.get(j) ?? 0) + 1)));
  const Q: number[] = [];
  indeg.forEach((d, i) => { if (d === 0) Q.push(i); });
  const topo: number[] = [];
  while (Q.length) {
    const v = Q.shift()!;
    topo.push(v);
    dagAdj.get(v)!.forEach(w => {
      indeg.set(w, (indeg.get(w) ?? 0) - 1);
      if (indeg.get(w) === 0) Q.push(w);
    });
  }
  return { sccs, topoOrder: topo.map(i => sccs[i]) };
}

// ---------- seeding scenario ----------

type Actor = { userId: string; authId: string; name: string; stance: string };
type ArgRef = { id: string; key: string; actor: Actor; move: MoveKind; model: ModelFlavor };

async function seedScenario(deliberationId: string, actors: Actor[]) {
  const createdById = actors[0].userId;

  const A: Record<string, ArgRef> = {};
  let turn = 0;

  async function addArg(
    key: string,
    actor: Actor,
    text: string,
    move: MoveKind,
    model: ModelFlavor,
    opts?: { quantifier?: string; modality?: string; citeUrl?: string; sources?: any }
  ) {
    const arg = await prisma.argument.create({
      data: {
        deliberationId,
        authorId: actor.authId,   // you’ve used auth_id as String FK on Argument
        text,
        quantifier: opts?.quantifier,
        modality: opts?.modality,
        mediaType: 'text',
        sources: {
          model,
          move,
          stance: actor.stance,
          turn,
          ...(opts?.sources ?? {}),
        } as any,
      },
    });
    if (opts?.citeUrl) await tryCreateEvidenceLink(arg.id, opts.citeUrl);
    A[key] = { id: arg.id, key, actor, move, model };
    turn += 1;
    return arg.id;
  }

  async function link(fromKey: string, toKey: string, kind: EdgeKind) {
    const { type, targetScope } = mapEdge(kind);
    const edge = await prisma.argumentEdge.create({
      data: {
        deliberationId,
        fromArgumentId: A[fromKey].id,
        toArgumentId: A[toKey].id,
        type,
        targetScope,
        createdById: actors[0].authId,
      },
    });
    await maybeUpsertClaimEdgeFromArgumentEdge(edge.id);
  }

  async function promote(key: string, who: Actor = actors[0]) {
    const claim = await promoteArgumentToClaim(deliberationId, A[key].id, who.userId);
    return claim;
  }

  // --- MONOLOGICAL core (single-actor Toulmin layout) ---
  const P = actors[0];
  await addArg('C', P, 'We should adopt Policy P for the next quarter.', 'assertion', 'monological', { modality: 'should' });
  await addArg('G', P, 'Meta-analysis indicates ~30% reduction in absenteeism with P.', 'grounds', 'monological',
    { citeUrl: 'https://doi.org/10.0000/example' });
  await addArg('W', P, 'If a measure meaningfully reduces absenteeism at low cost, it is justified.', 'warrant', 'monological',
    { quantifier: 'generally', modality: 'is justified' });
  await addArg('B', P, 'Comparable organizations succeeded with P during Q1 in 2024.', 'backing', 'monological');
  await addArg('Q', P, 'Assuming operational cost remains under $15k/month.', 'qualifier', 'monological');

  await link('G', 'C', 'support');
  await link('W', 'C', 'support');
  await link('B', 'W', 'support');
  await link('Q', 'W', 'support');

  // --- DIALOGICAL exchange (multi-actor attacks & counters) ---
  const D = actors[1], E = actors[2], F = actors[3];

  await addArg('R1', D, 'Your meta-analysis likely suffers publication bias, so grounds are weak.', 'rebuttal', 'dialogical');
  await link('R1', 'G', 'rebut_premise');

  await addArg('U1', E, 'Low-cost assumption is false once compliance burden is included.', 'rebuttal', 'dialogical');
  await link('U1', 'W', 'undercut_inference');

  await addArg('AL1', F, 'Alternative Q achieves similar benefits at lower cost.', 'rebuttal', 'dialogical');
  await link('AL1', 'C', 'rebut');

  // counter-rebuttals (dialogical)
  await addArg('CR1', P, 'Bias was addressed via trim-and-fill and leave-one-out diagnostics.', 'counter_rebuttal', 'dialogical',
    { citeUrl: 'https://osf.io/example-preprint' });
  await link('CR1', 'R1', 'rebut');

  await addArg('CR2', P, 'Compliance burden is < 2 minutes per shift; cost impact is negligible.', 'counter_rebuttal', 'dialogical');
  await link('CR2', 'U1', 'rebut');

  await addArg('CR3', P, 'Q’s trial used mismatched populations; effect sizes aren’t comparable.', 'counter_rebuttal', 'dialogical');
  await link('CR3', 'AL1', 'rebut');

  // --- RHETORICAL (pathos/ethos/logos annotations) ---
  await addArg('RHP', F, 'We owe our team predictability—P reduces chaos and restores trust.', 'assertion', 'rhetorical',
    { sources: { appeal: 'pathos' } });
  await link('RHP', 'C', 'support');

  await addArg('RHL', P, 'Given the data and cost modeling, P is the dominantly rational choice.', 'assertion', 'rhetorical',
    { sources: { appeal: 'logos' } });
  await link('RHL', 'C', 'support');

  await addArg('RHE', D, 'Veteran managers strongly endorse Q; their practical wisdom matters.', 'assertion', 'rhetorical',
    { sources: { appeal: 'ethos' } });
  await link('RHE', 'AL1', 'support');

  // --- Promote some arguments to claims and cite them ---
  const claimC  = await promote('C', P);
  const claimAL = await promote('AL1', F);
  const claimWL = await promote('W', P);

  if (claimC)  await tryCreateClaimCitation(claimC.id, '/argument/C');
  if (claimAL) await tryCreateClaimCitation(claimAL.id, '/argument/AL1');
  if (claimWL) await tryCreateClaimCitation(claimWL.id, '/argument/W');

  // --- Approvals (light simulation of audience reaction) ---
  for (const k of ['C','G','W','B','Q','R1','U1','AL1','CR1','CR2','CR3','RHP','RHL','RHE']) {
    for (const a of actors) {
      // simple stance‑weighted approvals: pro‑P actors approve supports of C; anti‑P actors approve attacks
      const isPro = ['Ada','Chen'].includes(a.name);
      const isAttack = ['R1','U1','AL1'].includes(k);
      if ((isPro && !isAttack) || (!isPro && isAttack)) {
        if (Math.random() < 0.7) await addApproval(deliberationId, A[k].id, a.userId);
      } else if (Math.random() < 0.25) {
        await addApproval(deliberationId, A[k].id, a.userId);
      }
    }
  }

  // --- Build Dung AF (rebut + undercut as attacks) and topology (support as structure) ---
  const nodes: ArgNode[] = Object.values(A).map(a => ({ id: a.id }));
  const allEdges = await prisma.argumentEdge.findMany({
    where: { deliberationId },
    select: { fromArgumentId: true, toArgumentId: true, type: true },
  });

  const attacks: AttackEdge[] = allEdges
    .filter(e => e.type === 'rebut' || e.type === 'undercut')
    .map(e => ({ from: e.fromArgumentId, to: e.toArgumentId }));

  const supports: SuppEdge[] = allEdges
    .filter(e => e.type === 'support')
    .map(e => ({ from: e.fromArgumentId, to: e.toArgumentId }));

  const dung = computeDungBasics(nodes, attacks);
  const topo = sccAndTopo(nodes.map(n => n.id), supports);

  // Persist analysis snapshot if you have a place; otherwise just log.
  if (hasModel('analysisSnapshot')) {
    await prismaAny.analysisSnapshot.create({
      data: {
        deliberationId,
        kind: 'SEED_SCENARIO_ANALYSIS',
        payload: {
          dung: {
            grounded: Array.from(dung.grounded),
            preferred: dung.preferred.map(s => Array.from(s)),
            stable: dung.stable.map(s => Array.from(s)),
          },
          topology: { sccs: topo.sccs, topoOrder: topo.topoOrder },
        },
      },
    });
  }

  return {
    roster: actors.map(a => ({ name: a.name, stance: a.stance, userId: a.userId, authId: a.authId })),
    arguments: Object.values(A).map(a => ({ key: a.key, id: a.id, actor: a.actor.name, move: a.move, model: a.model })),
    dung,
    topo,
  };
}

// ---------- Orchestrator / CLI ----------

async function main() {
  const deliberationId = process.argv[2];
  if (!deliberationId) {
    console.error('Usage: pnpm tsx scripts/seed-agora-super.ts <DELIBERATION_ID> [--actors=4] [--rounds=3] [--with-works]');
    process.exit(1);
  }
  const withWorks = process.argv.includes('--with-works');

  // 1) demo actors
  const users = await Promise.all([
    ensureUser('demo-auth-1', 'demo1', 'Ada'),
    ensureUser('demo-auth-2', 'demo2', 'Bo'),
    ensureUser('demo-auth-3', 'demo3', 'Chen'),
    ensureUser('demo-auth-4', 'demo4', 'Dee'),
  ]);
  const actors: Actor[] = [
    { userId: String(users[0].id), authId: users[0].auth_id, name: 'Ada',  stance: 'pro-P (data-forward)' },
    { userId: String(users[1].id), authId: users[1].auth_id, name: 'Bo',   stance: 'skeptical (cost-first)' },
    { userId: String(users[2].id), authId: users[2].auth_id, name: 'Chen', stance: 'pro-P (operations)' },
    { userId: String(users[3].id), authId: users[3].auth_id, name: 'Dee',  stance: 'comparativist (Q>' },
  ];

  // 2) seed the scenario
  const out = await seedScenario(deliberationId, actors);

  // 3) (optional) call your grounded semantics recompute
  try {
    await recomputeGroundedForDelib?.(deliberationId);
  } catch (e) {
    console.warn('[seed] grounded recompute skipped/failed:', (e as any)?.message ?? e);
  }

  console.log('\n=== Seeded Multi‑Actor Deliberation Scenario ===');
  console.table(out.roster);
  console.log('\nArguments (key → id):');
  console.table(out.arguments.map(a => ({ key: a.key, id: a.id.slice(0,8)+'…', actor: a.actor, move: a.move, model: a.model })));

  const g = Array.from(out.dung.grounded);
  const pref = out.dung.preferred.map(s => s.size);
  console.log('\nDung AF results:');
  console.log('  Grounded extension size:', g.length);
  console.log('  Preferred extensions count/sizes:', out.dung.preferred.length, pref);
  console.log('  Stable extensions count:', out.dung.stable.length);

  console.log('\nSupport topology:');
  console.log('  SCCs:', out.topo.sccs.map(c => c.length));
  console.log('  Topo layers:', out.topo.topoOrder.map(layer => layer.length));

  // 4) optionally seed the Works bundle you used before
  if (withWorks) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const seedWorks = require('./seed-demo-deliberation-v2').seedWorksBundle;
      const seeded = await seedWorks(deliberationId, actors[0].userId);
      console.log('\n[Works] Seeded:', { dn: seeded.dn.id, ih: seeded.ih.id, tc: seeded.tc.id, op: seeded.op.id });
    } catch {
      console.warn('[works] Skipped: seed-demo-deliberation-v2.ts not found or no seedWorksBundle export.');
    }
  }

  console.log('\nDone.');
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
