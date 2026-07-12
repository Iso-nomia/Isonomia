// scripts/plexus-topology-probe.ts
//
// Direction 4 (distributed semantics) — phase 0b seed+measure harness.
// See RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/07-distributed-semantics-sheaf-cohomology-2026-06-07.md
//
// WHY: the sheaf-cohomology sub-program is vacuous if the live Plexus
// transport graph is a forest (β1 = 0 ⇒ H¹ trivial). The Plexus features
// have barely been exercised, so the live `RoomFunctor` /
// `RoomTransportSnapshot` tables are likely empty. This harness:
//
//   1. SEED   — builds a 3-room functor cycle (A→B→C→A) with *supported*
//               mapped claims, so the transport snapshots are non-empty and
//               the cycle actually carries evidence (necessary for a
//               non-trivial H¹, not just a graph cycle).
//   2. MEASURE— read-only topology report over the WHOLE Plexus: connectivity,
//               cyclomatic number β1 (= candidate graph-level H¹ rank),
//               directed 3-cycle count, per-functor claim-overlap density,
//               snapshot payload sizes, and a five-table meta-edge census.
//   3. CLEAN  — removes all probe data (probe deliberations cascade; the
//               loose `RoomFunctor` / `RoomTransportSnapshot` rows, which have
//               no FK cascade, are deleted explicitly).
//
// Snapshots are written via the PURE aggregator lib (computeTransportPayload /
// computeTransportHash), NOT `workers/transport-aggregator.ts`, to avoid that
// module's import-time setInterval keeping the process alive.
//
// Usage:
//   tsx --env-file=.env scripts/plexus-topology-probe.ts seed
//   tsx --env-file=.env scripts/plexus-topology-probe.ts measure
//   tsx --env-file=.env scripts/plexus-topology-probe.ts holonomy
//   tsx --env-file=.env scripts/plexus-topology-probe.ts clean
//   tsx --env-file=.env scripts/plexus-topology-probe.ts          # seed → measure → holonomy

import "dotenv/config";
import { prisma } from "../lib/prismaclient";
import { mintClaimMoid } from "../lib/ids/mintMoid";
import {
  computeTransportPayload,
  computeTransportHash,
  type TransportSource,
} from "../lib/argumentation/transportAggregator";
import { weight, prob } from "../lib/argumentation/logodds";

const PROBE_TAG = "plexus-probe";
const PROBE_AUTH = "plexus-probe-user";
const ROOM_KEYS = ["A", "B", "C"] as const;
type RoomKey = (typeof ROOM_KEYS)[number];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// ─────────────────────────────────────────────────────────────────────────
// SEED
// ─────────────────────────────────────────────────────────────────────────

async function ensureProbeUser(): Promise<{ id: string; auth_id: string }> {
  // User.id is a BigInt; every `createdById`/`authorId` FK is a String, so
  // stringify once here.
  const existing = await prisma.user.findUnique({ where: { auth_id: PROBE_AUTH } });
  if (existing) return { id: String(existing.id), auth_id: existing.auth_id };
  const u = await prisma.user.create({
    data: { auth_id: PROBE_AUTH, username: "plexus_probe", name: "Plexus Probe" },
  });
  return { id: String(u.id), auth_id: u.auth_id };
}

interface SeededRoom {
  key: RoomKey;
  deliberationId: string;
  sharedClaimId: string; // participates in the cycle, supported
  localClaimId: string; // also supported (overlap-density numerator)
  danglingClaimId: string; // NO support (demonstrates "mapped but empty")
}

async function seedRoom(key: RoomKey, user: { id: string; auth_id: string }): Promise<SeededRoom> {
  const hostId = `${PROBE_TAG}-${key}`;
  const delib = await prisma.deliberation.create({
    data: {
      hostType: "free",
      hostId,
      createdById: user.id,
      title: `[${PROBE_TAG}] Room ${key}`,
      tags: [PROBE_TAG],
    },
    select: { id: true },
  });

  // Three claims per room. Text is salted with the room key so the global
  // `Claim.moid` unique constraint never collides across rooms — semantic
  // identity is carried by the functor's claimMap, not by text equality
  // (which is exactly how real cross-room alignment works).
  async function mkClaim(label: string, supported: boolean): Promise<string> {
    const text = `${label} (room ${key})`;
    const moid = mintClaimMoid(`${text}::${hostId}`);
    const claim = await prisma.claim.create({
      data: { deliberationId: delib.id, text, createdById: String(user.id), moid },
      select: { id: true },
    });
    const arg = await prisma.argument.create({
      data: {
        deliberationId: delib.id,
        authorId: user.auth_id,
        text: `Argument concluding: ${text}`,
        claimId: claim.id,
        mediaType: "text",
      },
      select: { id: true },
    });
    if (supported) {
      await prisma.argumentSupport.create({
        data: {
          deliberationId: delib.id,
          claimId: claim.id,
          argumentId: arg.id,
          mode: "product",
          base: 0.7,
          strength: 0.7,
        },
      });
    }
    return claim.id;
  }

  const sharedClaimId = await mkClaim("Shared proposition P", true);
  const localClaimId = await mkClaim("Local proposition Q", true);
  const danglingClaimId = await mkClaim("Unsupported proposition R", false);

  return { key, deliberationId: delib.id, sharedClaimId, localClaimId, danglingClaimId };
}

/**
 * Mirror `recomputeSnapshotForFunctor` using the PURE lib, so no worker
 * import (and thus no dangling setInterval). Reduces source-side support
 * per claim with product noisy-OR, exactly like `loadSourceSupport`.
 */
async function writeSnapshot(fromRoomId: string, toRoomId: string): Promise<number> {
  const functor = await prisma.roomFunctor.findFirst({
    where: { fromRoomId, toRoomId },
    select: { claimMapJson: true },
  });
  if (!functor) return 0;
  const claimMap =
    functor.claimMapJson && typeof functor.claimMapJson === "object"
      ? (functor.claimMapJson as Record<string, string>)
      : {};

  const supports = await prisma.argumentSupport.findMany({
    where: { deliberationId: fromRoomId },
    select: { claimId: true, base: true },
  });
  const byClaim = new Map<string, number[]>();
  for (const s of supports) {
    const list = byClaim.get(s.claimId) ?? [];
    list.push(clamp01(s.base ?? 0.6));
    byClaim.set(s.claimId, list);
  }
  const reduced = Array.from(byClaim, ([claimId, xs]) => ({
    claimId,
    score: +(1 - xs.reduce((a, x) => a * (1 - x), 1)).toFixed(4),
  }));

  const source: TransportSource = { fromRoomId, claimMap, supports: reduced };
  const hash = computeTransportHash(source);
  const payload = computeTransportPayload(source);

  await prisma.roomTransportSnapshot.upsert({
    where: { transport_snapshot_pair: { toRoomId, fromRoomId } },
    create: { fromRoomId, toRoomId, claimMapHash: hash, payloadJson: payload as any },
    update: { claimMapHash: hash, payloadJson: payload as any, computedAt: new Date() },
  });
  return Object.keys(payload.byClaim).length;
}

async function seed(): Promise<void> {
  console.log("🌱 SEED — clearing any prior probe data first…");
  await clean(true);

  const user = await ensureProbeUser();
  const rooms: Record<RoomKey, SeededRoom> = {} as any;
  for (const key of ROOM_KEYS) {
    rooms[key] = await seedRoom(key, user);
    console.log(`   ✅ Room ${key}: ${rooms[key].deliberationId}`);
  }

  // The cycle A→B→C→A. Each claimMap aligns:
  //   - shared → shared   (supported on source ⇒ non-empty transport)
  //   - local  → local    (supported ⇒ raises overlap density)
  //   - dangling → dangling (UNsupported on source ⇒ silently dropped;
  //                          makes overlap density < 100%, the realistic case)
  const cycle: Array<[RoomKey, RoomKey]> = [
    ["A", "B"],
    ["B", "C"],
    ["C", "A"],
  ];
  for (const [from, to] of cycle) {
    const f = rooms[from];
    const t = rooms[to];
    const claimMap: Record<string, string> = {
      [f.sharedClaimId]: t.sharedClaimId,
      [f.localClaimId]: t.localClaimId,
      [f.danglingClaimId]: t.danglingClaimId,
    };
    await prisma.roomFunctor.create({
      data: { fromRoomId: f.deliberationId, toRoomId: t.deliberationId, claimMapJson: claimMap, notes: PROBE_TAG },
    });
    const n = await writeSnapshot(f.deliberationId, t.deliberationId);
    console.log(`   ↳ functor ${from}→${to} written; snapshot byClaim targets = ${n}`);
  }
  console.log("🌱 SEED complete — a 3-room supported cycle now exists.\n");
}

// ─────────────────────────────────────────────────────────────────────────
// SEED-DRIFT — a 2-room cycle that drifts a claim to an INTER-DERIVABLE sibling
// (the D3 §7 drift-iso witness, to exercise the refined holonomy classifier).
// ─────────────────────────────────────────────────────────────────────────

async function seedDrift(): Promise<void> {
  console.log("🌱 SEED-DRIFT — clearing prior probe data, then building a drift-iso witness…");
  await clean(true);
  const user = await ensureProbeUser();

  async function mkRoom(key: string): Promise<string> {
    const d = await prisma.deliberation.create({
      data: { hostType: "free", hostId: `${PROBE_TAG}-drift-${key}`, createdById: user.id, title: `[${PROBE_TAG}] Drift ${key}`, tags: [PROBE_TAG] },
      select: { id: true },
    });
    return d.id;
  }
  async function mkClaim(room: string, label: string, supported: boolean): Promise<string> {
    const text = `${label} (${room.slice(0, 6)})`;
    const claim = await prisma.claim.create({
      data: { deliberationId: room, text, createdById: String(user.id), moid: mintClaimMoid(`${text}::${room}`) },
      select: { id: true },
    });
    if (supported) {
      const arg = await prisma.argument.create({
        data: { deliberationId: room, authorId: user.auth_id, text: `Arg: ${text}`, claimId: claim.id, mediaType: "text" },
        select: { id: true },
      });
      await prisma.argumentSupport.create({
        data: { deliberationId: room, claimId: claim.id, argumentId: arg.id, mode: "product", base: 0.7, strength: 0.7 },
      });
    }
    return claim.id;
  }
  // An argument concluding `concl` with `premise` as a premise: the "derives" edge.
  async function mkDerivation(room: string, premise: string, concl: string): Promise<void> {
    const arg = await prisma.argument.create({
      data: { deliberationId: room, authorId: user.auth_id, text: `derive ${concl.slice(0,4)} from ${premise.slice(0,4)}`, conclusionClaimId: concl, claimId: concl, mediaType: "text" },
      select: { id: true },
    });
    await prisma.argumentPremise.create({ data: { argumentId: arg.id, claimId: premise } });
  }

  const A = await mkRoom("A");
  const B = await mkRoom("B");
  console.log(`   ✅ Room A: ${A}`);
  console.log(`   ✅ Room B: ${B}`);

  // Start room A: two inter-derivable claims p, p'.
  const p = await mkClaim(A, "Proposition p", true);
  const pPrime = await mkClaim(A, "Proposition p-prime", true);
  await mkDerivation(A, p, pPrime); // p ⇒ p'
  await mkDerivation(A, pPrime, p); // p' ⇒ p  ⇒ p and p' are inter-derivable (ECC iso)
  // Room B: claim q.
  const q = await mkClaim(B, "Proposition q", true);

  // Cycle A→B→A that drifts p ↦ q ↦ p' (lands on the inter-derivable sibling).
  await prisma.roomFunctor.create({
    data: { fromRoomId: A, toRoomId: B, claimMapJson: { [p]: q }, notes: PROBE_TAG },
  });
  await prisma.roomFunctor.create({
    data: { fromRoomId: B, toRoomId: A, claimMapJson: { [q]: pPrime }, notes: PROBE_TAG },
  });
  await writeSnapshot(A, B);
  await writeSnapshot(B, A);
  console.log(`   ↳ cycle A→B→A drifts p → q → p' (p ≅ p' inter-derivable ⇒ expect DRIFT-ISO)`);
  console.log("🌱 SEED-DRIFT complete.\n");
}


// ─────────────────────────────────────────────────────────────────────────
// MEASURE (read-only, whole-Plexus)
// ─────────────────────────────────────────────────────────────────────────

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let cur = x;
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }
  union(a: string, b: string): void {
    this.parent.set(this.find(a), this.find(b));
  }
}

async function measure(): Promise<void> {
  console.log("📐 MEASURE — whole-Plexus topology report\n");

  const functors = await prisma.roomFunctor.findMany({
    select: { fromRoomId: true, toRoomId: true, claimMapJson: true },
  });

  if (functors.length === 0) {
    console.log("   ⚠️  No RoomFunctor rows exist. The Plexus transport graph is EMPTY.");
    console.log("   → H¹ is trivially 0. Run `seed` first, or exercise the transport features.\n");
    return;
  }

  // --- connectivity / cyclomatic number ---
  const rooms = new Set<string>();
  const directed = new Set<string>();
  const undirected = new Set<string>();
  const uf = new UnionFind();
  for (const f of functors) {
    rooms.add(f.fromRoomId);
    rooms.add(f.toRoomId);
    directed.add(`${f.fromRoomId}→${f.toRoomId}`);
    const [a, b] = [f.fromRoomId, f.toRoomId].sort();
    undirected.add(`${a}|${b}`);
    uf.union(f.fromRoomId, f.toRoomId);
  }
  const V = rooms.size;
  const Eund = undirected.size;
  const components = new Set(Array.from(rooms, (r) => uf.find(r))).size;
  // First Betti number of the undirected 1-complex: β1 = E − V + C.
  const beta1 = Eund - V + components;

  // --- directed 3-cycles A→B→C→A ---
  const adj = new Map<string, Set<string>>();
  for (const key of directed) {
    const [a, b] = key.split("→");
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  }
  let threeCycles = 0;
  const roomList = Array.from(rooms);
  for (const a of roomList) {
    for (const b of adj.get(a) ?? []) {
      if (b === a) continue;
      for (const c of adj.get(b) ?? []) {
        if (c === a || c === b) continue;
        if (adj.get(c)?.has(a)) threeCycles++;
      }
    }
  }
  threeCycles = Math.round(threeCycles / 3); // each cycle counted once per start vertex

  // --- directed 2-cycles A⇄B (mutual functors) ---
  let twoCycles = 0;
  for (const key of directed) {
    const [a, b] = key.split("→");
    if (a < b && directed.has(`${b}→${a}`)) twoCycles++;
  }

  console.log("   ── Functor graph (RoomFunctor) ──");
  console.log(`   rooms (V)                = ${V}`);
  console.log(`   directed functors        = ${directed.size}`);
  console.log(`   undirected edges (E)     = ${Eund}`);
  console.log(`   connected components (C) = ${components}`);
  console.log(`   cyclomatic number β1=E−V+C = ${beta1}   ← candidate graph-level H¹ rank`);
  console.log(`   directed 2-cycles (A⇄B)  = ${twoCycles}`);
  console.log(`   directed 3-cycles (A→B→C→A) = ${threeCycles}`);
  console.log(`   forest?                  = ${beta1 === 0 ? "YES (acyclic)" : "NO (has cycles)"}`);

  // --- per-functor claim-overlap density ---
  // A functor can be "present but empty": claimMap keys whose source claim has
  // no ArgumentSupport are silently dropped by the aggregator, so the cycle
  // carries no evidence even though the graph edge exists.
  console.log("\n   ── Claim-overlap density (per functor) ──");
  let totalKeys = 0;
  let totalSupported = 0;
  for (const f of functors) {
    const map =
      f.claimMapJson && typeof f.claimMapJson === "object" ? (f.claimMapJson as Record<string, string>) : {};
    const keys = Object.keys(map);
    if (keys.length === 0) continue;
    const supportedClaimIds = new Set(
      (
        await prisma.argumentSupport.findMany({
          where: { deliberationId: f.fromRoomId, claimId: { in: keys } },
          select: { claimId: true },
        })
      ).map((s) => s.claimId)
    );
    totalKeys += keys.length;
    totalSupported += supportedClaimIds.size;
    const pct = ((supportedClaimIds.size / keys.length) * 100).toFixed(0);
    console.log(
      `   ${short(f.fromRoomId)}→${short(f.toRoomId)}: ${supportedClaimIds.size}/${keys.length} mapped claims supported (${pct}%)`
    );
  }
  if (totalKeys > 0) {
    console.log(
      `   overall: ${totalSupported}/${totalKeys} (${((totalSupported / totalKeys) * 100).toFixed(0)}%) of mapped claims carry evidence`
    );
  }

  // --- snapshot payload sizes ---
  const snaps = await prisma.roomTransportSnapshot.findMany({
    select: { fromRoomId: true, toRoomId: true, payloadJson: true },
  });
  console.log("\n   ── Materialized transport snapshots ──");
  console.log(`   RoomTransportSnapshot rows = ${snaps.length}`);
  let nonEmptySnaps = 0;
  for (const s of snaps) {
    const byClaim = (s.payloadJson as any)?.byClaim ?? {};
    const n = Object.keys(byClaim).length;
    if (n > 0) nonEmptySnaps++;
  }
  console.log(`   non-empty snapshots        = ${nonEmptySnaps}/${snaps.length}`);

  // --- five-table meta-edge census (the full Plexus topology) ---
  const [xref, stackRef, argImport, sharedAuthor] = await Promise.all([
    prisma.xRef.count().catch(() => -1),
    prisma.stackReference.count().catch(() => -1),
    prisma.argumentImport.count().catch(() => -1),
    prisma.sharedAuthorRoomEdge.count().catch(() => -1),
  ]);
  // overlap edges = canonical claims spanning >1 deliberation
  const canonRows = await prisma.claim.findMany({
    where: { canonicalClaimId: { not: null } },
    select: { canonicalClaimId: true, deliberationId: true },
  });
  const delibsByCanon = new Map<string, Set<string>>();
  for (const r of canonRows) {
    if (!r.canonicalClaimId || !r.deliberationId) continue;
    const set = delibsByCanon.get(r.canonicalClaimId) ?? new Set();
    set.add(r.deliberationId);
    delibsByCanon.set(r.canonicalClaimId, set);
  }
  const overlapCanon = Array.from(delibsByCanon.values()).filter((s) => s.size > 1).length;

  console.log("\n   ── Meta-edge census (five Plexus edge kinds) ──");
  console.log(`   xref           = ${fmtCount(xref)}`);
  console.log(`   overlap        = ${overlapCanon}   (canonical claims spanning >1 room)`);
  console.log(`   stack_ref      = ${fmtCount(stackRef)}`);
  console.log(`   imports        = ${fmtCount(argImport)}`);
  console.log(`   shared_author  = ${fmtCount(sharedAuthor)}`);

  // --- verdict ---
  console.log("\n   ══ VERDICT ══");
  if (beta1 === 0) {
    console.log("   The live functor graph is a FOREST (β1 = 0) ⇒ H¹ is trivial on current data.");
    console.log("   Sub-program B (sheaf-cohomology) is VACUOUS until cycles exist. Seed or use transport.");
  } else if (nonEmptySnaps === 0) {
    console.log(`   Graph has cycles (β1 = ${beta1}) but NO snapshot carries evidence.`);
    console.log("   The cycle is 'present but empty' ⇒ H¹ still trivial in the evidence sheaf. Map SUPPORTED claims.");
  } else {
    console.log(`   Graph has cycles (β1 = ${beta1}, 3-cycles = ${threeCycles}) AND ${nonEmptySnaps} snapshot(s) carry evidence.`);
    console.log("   ⇒ Candidate NON-TRIVIAL H¹. Sub-program B is well-posed on current data; proceed to the");
    console.log("     ℝ-valued discrete-holonomy framing (sum log-odds shifts around each 3-cycle).");
  }
  console.log("");
}

function short(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}
function fmtCount(n: number): string {
  return n < 0 ? "n/a (table missing)" : String(n);
}

// ─────────────────────────────────────────────────────────────────────────
// HOLONOMY (phase B2b) — ℝ-valued log-odds holonomy + claim-map monodromy
// ─────────────────────────────────────────────────────────────────────────
//
// Two layers (see session doc §2, §3.1):
//
//   1. CLAIM-MAP MONODROMY — the schema-supported obstruction. Track a claim
//      through the claimMap composite around a directed cycle. CLOSED (returns
//      to itself) vs DRIFTED (returns to a different claim) vs DROPPED (a
//      partial functor has no image). Drift/drop is a genuine H¹ carrier on
//      current data AND is exactly sub-program A's coherence failure.
//
//      D3 §7 REFINEMENT (2026-06-08): a DRIFTED landing is split by ECC
//      inter-derivability — DRIFT-ISO (start and landing are inter-derivable,
//      a two-way derivation chain exists) is claim-closed UP TO ECC ISO, so it
//      is INSIDE 𝓟° and NOT a coherence obstruction (C014 D3); DRIFT-NONISO
//      (no two-way derivation) is the genuine obstruction. Only drift-noniso +
//      dropped count as non-trivial monodromy. This matches the C014-T
//      definition of 𝓟° as iso-closure, not identity-closure.

//
//   2. ℝ-HOLONOMY — only well-posed for CLAIM-CLOSED loops (you can only sum
//      log-odds for a proposition that survives the round trip). With the only
//      datum the schema carries (per-node local log-odds), the connection is a
//      coboundary δw, so the holonomy telescopes to 0 (EXACT — no global
//      class). The log-odds SPREAD (max−min) is reported instead as the LOCAL
//      disagreement magnitude — which has a locus, so it belongs to Direction
//      2, not to a global cohomology class.
//
// FINDING this makes precise: on current data Direction 4's global obstruction
// collapses onto the claim-map monodromy (= coherence), and a genuinely
// QUANTITATIVE ℝ-class distinct from monodromy would require an independent
// per-edge transport datum (a RoomFunctor confidence weight) the schema does
// not yet carry. This vindicates the "coherence first" sequencing.

interface CycleFunctor {
  fromRoomId: string;
  toRoomId: string;
  claimMap: Record<string, string>;
}

const EDGE = (a: string, b: string) => `${a}\u0000${b}`;

/** Reduce local support per (deliberation, claim) to a probability via the
 *  same product noisy-OR the aggregator uses, for the rooms in play. */
async function loadLocalProbs(delibIds: string[]): Promise<Map<string, number>> {
  const supports = await prisma.argumentSupport.findMany({
    where: { deliberationId: { in: delibIds } },
    select: { deliberationId: true, claimId: true, base: true },
  });
  const byKey = new Map<string, number[]>();
  for (const s of supports) {
    const key = EDGE(s.deliberationId, s.claimId);
    const list = byKey.get(key) ?? [];
    list.push(clamp01(s.base ?? 0.6));
    byKey.set(key, list);
  }
  const out = new Map<string, number>();
  for (const [key, xs] of byKey) {
    out.set(key, 1 - xs.reduce((a, x) => a * (1 - x), 1));
  }
  return out;
}

/**
 * ECC inter-derivability oracle (D3 §7 refinement). Two claims X, Y in the same
 * room are *inter-derivable* (an ECC iso, claim-closed "up to iso") iff there is
 * a derivation chain X ⇒ Y AND a chain Y ⇒ X. We build the one-step "derives"
 * relation `premiseClaim → conclusionClaim` from `ArgumentPremise` +
 * `Argument.(conclusionClaimId ?? claimId)`, then test two-way reachability.
 *
 * Returns `(room, from, to) => boolean` (reachability of `to` from `from` within
 * `room`). Inter-derivability is `reach(r,a,b) && reach(r,b,a)`.
 */
async function loadDerivationReachability(
  delibIds: string[]
): Promise<(room: string, from: string, to: string) => boolean> {
  const args = await prisma.argument.findMany({
    where: { deliberationId: { in: delibIds } },
    select: { id: true, deliberationId: true, claimId: true, conclusionClaimId: true },
  });
  const conclusionOf = new Map<string, { room: string; claim: string }>();
  for (const a of args) {
    const concl = a.conclusionClaimId ?? a.claimId;
    if (concl) conclusionOf.set(a.id, { room: a.deliberationId, claim: concl });
  }
  const premises = await prisma.argumentPremise.findMany({
    where: { argumentId: { in: args.map((a) => a.id) } },
    select: { argumentId: true, claimId: true },
  });
  // adjacency: per room, premiseClaim → Set(conclusionClaim)
  const adj = new Map<string, Map<string, Set<string>>>();
  for (const p of premises) {
    const concl = conclusionOf.get(p.argumentId);
    if (!concl || !p.claimId) continue;
    const roomAdj = adj.get(concl.room) ?? new Map<string, Set<string>>();
    const succ = roomAdj.get(p.claimId) ?? new Set<string>();
    succ.add(concl.claim);
    roomAdj.set(p.claimId, succ);
    adj.set(concl.room, roomAdj);
  }
  return (room, from, to) => {
    if (from === to) return true;
    const roomAdj = adj.get(room);
    if (!roomAdj) return false;
    const seen = new Set<string>([from]);
    const stack = [from];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const nxt of roomAdj.get(cur) ?? []) {
        if (nxt === to) return true;
        if (!seen.has(nxt)) {
          seen.add(nxt);
          stack.push(nxt);
        }
      }
    }
    return false;
  };
}


/** Enumerate canonical simple directed 2- and 3-cycles. */
function enumerateDirectedCycles(functors: CycleFunctor[]): string[][] {
  const edgeSet = new Set(functors.map((f) => EDGE(f.fromRoomId, f.toRoomId)));
  const adj = new Map<string, string[]>();
  const rooms = new Set<string>();
  for (const f of functors) {
    rooms.add(f.fromRoomId);
    rooms.add(f.toRoomId);
    if (!adj.has(f.fromRoomId)) adj.set(f.fromRoomId, []);
    adj.get(f.fromRoomId)!.push(f.toRoomId);
  }
  const cycles: string[][] = [];
  const seen = new Set<string>();
  // 2-cycles A⇄B
  for (const f of functors) {
    if (edgeSet.has(EDGE(f.toRoomId, f.fromRoomId))) {
      const canon = "2:" + [f.fromRoomId, f.toRoomId].sort().join("|");
      if (!seen.has(canon)) {
        seen.add(canon);
        cycles.push([f.fromRoomId, f.toRoomId]);
      }
    }
  }
  // 3-cycles A→B→C→A
  for (const a of rooms) {
    for (const b of adj.get(a) ?? []) {
      if (b === a) continue;
      for (const c of adj.get(b) ?? []) {
        if (c === a || c === b) continue;
        if (edgeSet.has(EDGE(c, a))) {
          const canon = "3:" + [a, b, c].sort().join("|");
          if (!seen.has(canon)) {
            seen.add(canon);
            cycles.push([a, b, c]);
          }
        }
      }
    }
  }
  return cycles;
}

type ClaimFate = "closed" | "drifted" | "dropped";

interface ClaimTrace {
  fate: ClaimFate;
  /** [(room, claim)] visited; last entry is the round-trip landing at start room. */
  steps: Array<{ room: string; claim: string | null }>;
}

/** Follow a start claim through the claimMap composite around the cycle. */
function traceClaim(cycle: string[], mapOf: (a: string, b: string) => Record<string, string>, start: string): ClaimTrace {
  const n = cycle.length;
  const steps: Array<{ room: string; claim: string | null }> = [{ room: cycle[0], claim: start }];
  let cur: string | null = start;
  for (let i = 0; i < n; i++) {
    const from = cycle[i];
    const to = cycle[(i + 1) % n];
    if (cur === null) {
      steps.push({ room: to, claim: null });
      continue;
    }
    const next = mapOf(from, to)[cur] ?? null;
    steps.push({ room: to, claim: next });
    cur = next;
  }
  const landing = steps[steps.length - 1].claim;
  const fate: ClaimFate = landing === null ? "dropped" : landing === start ? "closed" : "drifted";
  return { fate, steps };
}

async function holonomy(): Promise<void> {
  console.log("🌀 HOLONOMY (B2b) — claim-map monodromy + ℝ-valued log-odds holonomy\n");

  const rawFunctors = await prisma.roomFunctor.findMany({
    select: { fromRoomId: true, toRoomId: true, claimMapJson: true },
  });
  const functors: CycleFunctor[] = rawFunctors.map((f) => ({
    fromRoomId: f.fromRoomId,
    toRoomId: f.toRoomId,
    claimMap:
      f.claimMapJson && typeof f.claimMapJson === "object" ? (f.claimMapJson as Record<string, string>) : {},
  }));
  if (functors.length === 0) {
    console.log("   ⚠️  No RoomFunctor rows. Run `seed` first.\n");
    return;
  }
  const mapIndex = new Map<string, Record<string, string>>();
  for (const f of functors) mapIndex.set(EDGE(f.fromRoomId, f.toRoomId), f.claimMap);
  const mapOf = (a: string, b: string) => mapIndex.get(EDGE(a, b)) ?? {};

  const cycles = enumerateDirectedCycles(functors);
  if (cycles.length === 0) {
    console.log("   The functor graph is a FOREST (no directed 2-/3-cycles). H¹ trivial. Nothing to do.\n");
    return;
  }

  const roomsInCycles = new Set<string>();
  cycles.forEach((c) => c.forEach((r) => roomsInCycles.add(r)));
  const localProbs = await loadLocalProbs([...roomsInCycles]);
  const probOf = (room: string, claim: string) => localProbs.get(EDGE(room, claim)); // undefined ⇒ no local support
  // D3 §7: ECC inter-derivability oracle, for splitting drift-iso vs drift-noniso.
  const reach = await loadDerivationReachability([...roomsInCycles]);
  // CAVEAT (T010 cross-check clarification 1, 2026-06-08): this is two-way
  // *premise→conclusion reachability* at the CLAIM level — it IGNORES assumptions.
  // The symbolic 𝓟° predicate is `isIsoVia` (the round trip must compose to an
  // ASSUMPTION-FREE identity in ECC/≈). So `interDerivable` is NECESSARY but NOT
  // SUFFICIENT for a genuine ECC iso: the `drift-iso` bucket can OVER-count 𝓟° when
  // the two-way derivations carry net assumptions. The THEOREM (T010) is defined and
  // tested with strict `isIsoVia` and is unaffected; this is an instrument-fidelity
  // caveat — a future refinement would also check assumption cancellation here.
  const interDerivable = (room: string, a: string, b: string) => reach(room, a, b) && reach(room, b, a);

  // Aggregate tallies.
  let totClosed = 0;
  let totDrifted = 0;
  let totDriftIso = 0;
  let totDropped = 0;
  let nonTrivialMonodromy = 0;
  let nonZeroHolonomy = 0;
  const EPS = 1e-9;

  for (const cycle of cycles) {
    const label = cycle.map(short).join("→") + "→" + short(cycle[0]);
    const startRoom = cycle[0];
    const firstMap = mapOf(cycle[0], cycle[1 % cycle.length]);
    const starts = Object.keys(firstMap);
    console.log(`   ── cycle ${label}  (len ${cycle.length}, ${starts.length} start claims) ──`);
    if (starts.length === 0) {
      console.log("      (first edge has an empty claimMap — nothing tracked)\n");
      continue;
    }

    let closed = 0;
    let drifted = 0;
    let driftIso = 0;
    let dropped = 0;

    for (const start of starts) {
      const trace = traceClaim(cycle, mapOf, start);
      if (trace.fate === "closed") {
        closed++;
        // ℝ-holonomy: sum the coboundary shifts w_{i+1} − w_i around the loop.
        // Telescopes to 0 by construction; we COMPUTE it to confirm exactness,
        // and report the log-odds SPREAD as the local-disagreement magnitude.
        const ws: number[] = [];
        let missing = false;
        for (let i = 0; i < cycle.length; i++) {
          const room = trace.steps[i].room;
          const claim = trace.steps[i].claim!;
          const p = probOf(room, claim);
          if (p === undefined) {
            missing = true;
            break;
          }
          ws.push(weight(p));
        }
        if (missing) {
          // closed in claim-identity but a node lacks local support ⇒ no metric.
          console.log(`      ✓ closed  "${short(start)}"  (no ℝ-metric: a node has no local support for the tracked claim)`);
          continue;
        }
        let holo = 0;
        for (let i = 0; i < ws.length; i++) holo += ws[(i + 1) % ws.length] - ws[i];
        const spread = Math.max(...ws) - Math.min(...ws);
        if (Math.abs(holo) > EPS) nonZeroHolonomy++;
        const probs = ws.map((w) => prob(w).toFixed(2)).join(", ");
        console.log(
          `      ✓ closed  "${short(start)}"  holonomy=${holo.toFixed(6)} (exact≈0)  spread(log-odds)=${spread.toFixed(3)}  local p=[${probs}]`
        );
      } else if (trace.fate === "drifted") {
        const land = trace.steps[trace.steps.length - 1].claim!;
        // D3 §7: split by ECC inter-derivability within the start room.
        if (interDerivable(startRoom, start, land)) {
          driftIso++;
          console.log(`      ≅ DRIFT-ISO "${short(start)}" → "${short(land)}"  (inter-derivable ⇒ claim-closed up to ECC iso ⇒ IN 𝓟°, not an obstruction)`);
        } else {
          drifted++;
          nonTrivialMonodromy++;
          console.log(`      ✗ DRIFT-NONISO "${short(start)}" → "${short(land)}"  (no two-way derivation ⇒ genuine H¹ carrier / coherence failure)`);
        }
      } else {
        dropped++;
        nonTrivialMonodromy++;
        const at = trace.steps.findIndex((s) => s.claim === null);
        console.log(`      ✗ DROPPED "${short(start)}" at hop ${at} (partial functor ⇒ no image; obstruction)`);
      }
    }
    console.log(`      subtotal: ${closed} closed, ${driftIso} drift-iso, ${drifted} drift-noniso, ${dropped} dropped\n`);
    totClosed += closed;
    totDrifted += drifted;
    totDriftIso += driftIso;
    totDropped += dropped;
  }

  console.log("   ══ HOLONOMY VERDICT ══");
  console.log(`   cycles examined            = ${cycles.length}`);
  console.log(`   claims: closed=${totClosed}  drift-iso=${totDriftIso}  drift-noniso=${totDrifted}  dropped=${totDropped}`);
  console.log(`   in 𝓟° (closed + drift-iso) = ${totClosed + totDriftIso}   ← claim-closed up to ECC iso (D3 𝓟°)`);
  console.log(`   non-trivial monodromy (drift-noniso + dropped) = ${nonTrivialMonodromy}   ← genuine H¹ carriers (outside 𝓟°)`);
  console.log(`   non-zero ℝ-holonomy (closed loops) = ${nonZeroHolonomy}   ← expected 0: coboundary is exact`);
  console.log("");
  if (nonTrivialMonodromy > 0) {
    console.log("   ⇒ The live Plexus carries NON-TRIVIAL obstructions OUTSIDE 𝓟° (drift-noniso / dropped):");
    console.log("     the 'same' proposition is not tracked consistently around the loop, even up to ECC iso.");
    console.log("     This is exactly a sub-program A (coherence) failure — vindicating 'coherence first'.");
  } else if (totClosed + totDriftIso > 0) {
    console.log("   ⇒ All tracked claims are in 𝓟° (closed OR drift-iso). On current data transport is a");
    console.log("     pseudofunctor here (C014 D3) and the ℝ-holonomy is exact (≈0): the only disagreement is");
    console.log("     LOCAL (log-odds spread, which has a locus ⇒ Direction 2), not a global class.");
  }
  if (totDriftIso > 0) {
    console.log(`   NOTE (D3 §7): ${totDriftIso} claim(s) DRIFT-ISO — strict claim-id closure would have mis-flagged`);
    console.log("   these as obstructions; ECC inter-derivability correctly places them inside 𝓟°.");
    console.log("   CAVEAT: the oracle is claim-level two-way reachability (ignores assumptions) ⇒ a");
    console.log("   NECESSARY-not-sufficient proxy for the symbolic `isIsoVia`; drift-iso may over-count 𝓟°.");
  }
  console.log("   NOTE: a QUANTITATIVE ℝ-class distinct from monodromy needs an independent per-edge datum");
  console.log("   (a RoomFunctor transport weight). The schema carries none today — that is the concrete B2c/schema ask.");
  console.log("");
}

// ─────────────────────────────────────────────────────────────────────────
// CONTEXTUALITY (sub-program B, phase B-exp) — partition out-of-𝓟° cycles into
// LOCALLY obstructed (has a locus ⇒ Direction 2) vs GLOBALLY obstructed
// (genuine Abramsky contextuality ⇒ candidate non-trivial possibilistic H¹).
// See RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/08-distributed-semantics-quantitative-cohomology-2026-06-08.md §5.
//
// Decision rule (mirrors B2b):
//   • DROPPED hop                       ⇒ LOCALLY obstructed (drop locus).
//   • DRIFT-NONISO round trip, but some
//     consecutive pair lacks a faithful
//     back-edge 2-cycle (no back-edge,
//     or its 2-cycle is itself drift-
//     noniso)                           ⇒ LOCALLY obstructed (that pair = locus).
//   • DRIFT-NONISO round trip, EVERY
//     consecutive pair has a faithful
//     back-edge 2-cycle (closed/iso)    ⇒ GLOBALLY obstructed (genuine
//                                          contextuality: pairwise consistent,
//                                          globally not — non-trivial H¹ witness).
//
// VERDICT semantics: if NO cycle is globally obstructed on current data, the
// possibilistic class is *vacuous on current data* (every disagreement is local
// ⇒ Direction 2 owns it). The `seed-contextuality` witness validates the
// construction regardless, by building a synthetic genuine contextuality cell.

type ContextFate = "in-Pcirc" | "local-drop" | "local-pair" | "global";

async function contextuality(): Promise<void> {
  console.log("🔺 CONTEXTUALITY (B-exp) — locally vs globally obstructed out-of-𝓟° cycles\n");

  const rawFunctors = await prisma.roomFunctor.findMany({
    select: { fromRoomId: true, toRoomId: true, claimMapJson: true },
  });
  const functors: CycleFunctor[] = rawFunctors.map((f) => ({
    fromRoomId: f.fromRoomId,
    toRoomId: f.toRoomId,
    claimMap:
      f.claimMapJson && typeof f.claimMapJson === "object" ? (f.claimMapJson as Record<string, string>) : {},
  }));
  if (functors.length === 0) {
    console.log("   ⚠️  No RoomFunctor rows. Run `seed` / `seed-contextuality` first.\n");
    return;
  }
  const mapIndex = new Map<string, Record<string, string>>();
  for (const f of functors) mapIndex.set(EDGE(f.fromRoomId, f.toRoomId), f.claimMap);
  const hasEdge = (a: string, b: string) => mapIndex.has(EDGE(a, b));
  const mapOf = (a: string, b: string) => mapIndex.get(EDGE(a, b)) ?? {};

  const cycles = enumerateDirectedCycles(functors);
  if (cycles.length === 0) {
    console.log("   The functor graph is a FOREST (no directed 2-/3-cycles). No cycles to classify.\n");
    return;
  }

  const roomsInCycles = new Set<string>();
  cycles.forEach((c) => c.forEach((r) => roomsInCycles.add(r)));
  const reach = await loadDerivationReachability([...roomsInCycles]);
  const interDerivable = (room: string, a: string, b: string) => reach(room, a, b) && reach(room, b, a);

  // A consecutive pair (rᵢ → rᵢ₊₁) is "pairwise faithful" for the tracked claim
  // xᵢ iff the back-edge exists and the 2-cycle rᵢ→rᵢ₊₁→rᵢ returns to a claim
  // inter-derivable with xᵢ (closed up to ECC iso). Returns null when the pair
  // is NOT faithful (the local-pair locus).
  const pairFaithful = (rFrom: string, rTo: string, x: string): boolean => {
    const fwd = mapOf(rFrom, rTo)[x];
    if (fwd == null) return false; // forward drops ⇒ not faithful (a drop locus)
    if (!hasEdge(rTo, rFrom)) return false; // no back-edge ⇒ cannot confirm pairwise compat
    const back = mapOf(rTo, rFrom)[fwd];
    if (back == null) return false; // back drops
    return interDerivable(rFrom, x, back); // closed up to ECC iso
  };

  let totGlobal = 0;
  let totLocalDrop = 0;
  let totLocalPair = 0;
  let totInPcirc = 0;

  for (const cycle of cycles) {
    const label = cycle.map(short).join("→") + "→" + short(cycle[0]);
    const firstMap = mapOf(cycle[0], cycle[1 % cycle.length]);
    const starts = Object.keys(firstMap);
    if (starts.length === 0) continue;
    console.log(`   ── cycle ${label}  (len ${cycle.length}, ${starts.length} start claims) ──`);

    for (const start of starts) {
      const trace = traceClaim(cycle, mapOf, start);
      // Reuse the round-trip fate, then refine non-iso into local/global.
      let fate: ContextFate;
      let detail = "";
      if (trace.fate === "dropped") {
        const at = trace.steps.findIndex((s) => s.claim === null);
        fate = "local-drop";
        detail = `drop at hop ${at}`;
      } else if (trace.fate === "closed") {
        fate = "in-Pcirc";
      } else {
        // drifted: split iso (in 𝓟°) vs noniso, then noniso into local/global.
        const land = trace.steps[trace.steps.length - 1].claim!;
        if (interDerivable(cycle[0], start, land)) {
          fate = "in-Pcirc"; // drift-iso
        } else {
          // drift-noniso: is every consecutive pair pairwise faithful?
          let firstBadPair = -1;
          for (let i = 0; i < cycle.length; i++) {
            const rFrom = cycle[i];
            const rTo = cycle[(i + 1) % cycle.length];
            const xi = trace.steps[i].claim;
            if (xi == null || !pairFaithful(rFrom, rTo, xi)) {
              firstBadPair = i;
              break;
            }
          }
          if (firstBadPair === -1) {
            fate = "global";
            detail = `lands "${short(land)}" ≇ "${short(start)}"; every pair faithful`;
          } else {
            fate = "local-pair";
            const rFrom = cycle[firstBadPair];
            const rTo = cycle[(firstBadPair + 1) % cycle.length];
            detail = `pair ${short(rFrom)}→${short(rTo)} not faithful (locus)`;
          }
        }
      }

      if (fate === "in-Pcirc") {
        totInPcirc++;
      } else if (fate === "local-drop") {
        totLocalDrop++;
        console.log(`      · LOCAL (drop)   "${short(start)}"  ${detail}`);
      } else if (fate === "local-pair") {
        totLocalPair++;
        console.log(`      · LOCAL (pair)   "${short(start)}"  ${detail}`);
      } else {
        totGlobal++;
        console.log(`      ★ GLOBAL         "${short(start)}"  ${detail}  ⇒ genuine contextuality (non-trivial possibilistic H¹)`);
      }
    }
    console.log("");
  }

  const totLocal = totLocalDrop + totLocalPair;
  console.log("   ══ CONTEXTUALITY VERDICT ══");
  console.log(`   in 𝓟° (closed + drift-iso)        = ${totInPcirc}`);
  console.log(`   LOCALLY obstructed (has a locus)  = ${totLocal}   (drop=${totLocalDrop}, pair=${totLocalPair})  ⇒ Direction 2 owns these`);
  console.log(`   GLOBALLY obstructed (contextual)  = ${totGlobal}   ⇒ candidate non-trivial possibilistic H¹`);
  console.log("");
  if (totGlobal > 0) {
    console.log("   ⇒ B1 HAS A LIVE WITNESS. Some cycle is pairwise-consistent but globally not —");
    console.log("     a genuine Abramsky contextuality class. Proceed to B-poss-0 (the Čech construction).");
  } else if (totLocal > 0) {
    console.log("   ⇒ B-possibilistic is VACUOUS on current data: every out-of-𝓟° obstruction is LOCAL");
    console.log("     (has a locus ⇒ Direction 2). No genuine global class yet — seed a synthetic witness");
    console.log("     (`seed-contextuality`) to validate the construction, or wait for richer real data.");
  } else {
    console.log("   ⇒ Every tracked cycle is in 𝓟° (coherent). No obstruction of either kind on current data.");
  }
  console.log("");
}

// ─────────────────────────────────────────────────────────────────────────
// SEED-CONTEXTUALITY — a 3-room cycle that is PAIRWISE consistent but GLOBALLY
// inconsistent (the genuine Abramsky witness). Forward edges A→B, B→C faithful,
// C→A a "twist"; back-edges B→A, C→B faithful, A→C the matching inverse twist —
// so every 2-cycle closes (pair in 𝓟°) but the triangle A→B→C→A drift-nonisos.
// ─────────────────────────────────────────────────────────────────────────

async function seedContextuality(): Promise<void> {
  console.log("🌱 SEED-CONTEXTUALITY — clearing prior probe data, then building a genuine contextuality cell…");
  await clean(true);
  const user = await ensureProbeUser();

  async function mkRoom(key: string): Promise<string> {
    const d = await prisma.deliberation.create({
      data: { hostType: "free", hostId: `${PROBE_TAG}-ctx-${key}`, createdById: user.id, title: `[${PROBE_TAG}] Ctx ${key}`, tags: [PROBE_TAG] },
      select: { id: true },
    });
    return d.id;
  }
  // Two DISTINCT, NOT inter-derivable claims per room (p, q): a binary with no
  // cross-derivation, so a non-iso landing on the "other" claim is a genuine
  // drift-noniso.
  async function mkClaim(room: string, label: string): Promise<string> {
    const text = `${label} (${room.slice(0, 6)})`;
    const claim = await prisma.claim.create({
      data: { deliberationId: room, text, createdById: String(user.id), moid: mintClaimMoid(`${text}::${room}`) },
      select: { id: true },
    });
    const arg = await prisma.argument.create({
      data: { deliberationId: room, authorId: user.auth_id, text: `Arg: ${text}`, claimId: claim.id, mediaType: "text" },
      select: { id: true },
    });
    await prisma.argumentSupport.create({
      data: { deliberationId: room, claimId: claim.id, argumentId: arg.id, mode: "product", base: 0.7, strength: 0.7 },
    });
    return claim.id;
  }

  const A = await mkRoom("A");
  const B = await mkRoom("B");
  const C = await mkRoom("C");
  const pA = await mkClaim(A, "p"), qA = await mkClaim(A, "q");
  const pB = await mkClaim(B, "p"), qB = await mkClaim(B, "q");
  const pC = await mkClaim(C, "p"), qC = await mkClaim(C, "q");
  console.log(`   ✅ Rooms A=${A.slice(0,8)} B=${B.slice(0,8)} C=${C.slice(0,8)} (p,q each, p≇q)`);

  // Forward: A→B faithful, B→C faithful, C→A TWIST (p↔q).
  // Back:    B→A faithful, C→B faithful, A→C matching inverse TWIST (p↔q).
  // ⇒ every 2-cycle closes; triangle A→B→C→A: pA↦pB↦pC↦qA (drift-noniso).
  const edges: Array<[string, string, Record<string, string>]> = [
    [A, B, { [pA]: pB, [qA]: qB }],          // faithful
    [B, A, { [pB]: pA, [qB]: qA }],          // faithful back
    [B, C, { [pB]: pC, [qB]: qC }],          // faithful
    [C, B, { [pC]: pB, [qC]: qB }],          // faithful back
    [C, A, { [pC]: qA, [qC]: pA }],          // TWIST forward
    [A, C, { [pA]: qC, [qA]: pC }],          // matching inverse twist back
  ];
  for (const [from, to, claimMap] of edges) {
    await prisma.roomFunctor.create({ data: { fromRoomId: from, toRoomId: to, claimMapJson: claimMap, notes: PROBE_TAG } });
    await writeSnapshot(from, to);
  }
  console.log("   ↳ A→B, B→C faithful; C→A twist (p↔q); matched back-edges ⇒ pairs closed, triangle non-iso");
  console.log("🌱 SEED-CONTEXTUALITY complete — expect 1 GLOBAL witness for start claim p_A.\n");
}

// ─────────────────────────────────────────────────────────────────────────
// SEED-REAL — a REALISTIC-but-real contextuality witness (Q-043(iii) candidate).
// A Condorcet cycle of *evaluation framings*: three deliberation rooms each
// evaluating two genuine rival options (a Carbon Tax vs Cap-and-Trade) under a
// different, legitimate criterion. Every PAIRWISE translation between framings is
// individually defensible (the rooms that share evidence agree on the ranking of
// the two options), but the COMPOSITE around the loop reverses the ranking — the
// canonical "no consistent global preference" disagreement (Arrow/discursive
// dilemma). Unlike `seed-contextuality`, the claims are substantive propositions
// and each functor map is a translation an analyst would actually author; the
// twist arises from a *defensible* equity-vs-efficiency reversal, not a forced
// p↔q swap. Within each room the two options are NOT inter-derivable (genuine
// rivals), so a composite landing on "the other option" is a true drift-noniso.
//
// Topic: "Which instrument better reduces emissions — a Carbon Tax (p) or
//         Cap-and-Trade (q)?" evaluated by three rooms:
//   A = Cost-efficiency frame   (abatement $ per ton)
//   B = Political-durability frame (resistance to repeal / revenue stability)
//   C = Distributional-equity frame (burden on the worst-off)
// Pairwise rankings: A and B agree (the more cost-efficient instrument is also the
// more durable here); B and C agree (the more durable is the more equitable here);
// but C reverses A (the equity-preferred instrument is the cost-dispreferred one).
// No instrument is preferred under all three ⇒ a genuine global obstruction.

async function seedReal(): Promise<void> {
  console.log("🌱 SEED-REAL — a realistic Condorcet-cycle-of-framings contextuality witness…");
  await clean(true);
  const user = await ensureProbeUser();

  async function mkRoom(key: string, title: string): Promise<string> {
    const d = await prisma.deliberation.create({
      data: { hostType: "free", hostId: `${PROBE_TAG}-real-${key}`, createdById: user.id, title: `[${PROBE_TAG}] ${title}`, tags: [PROBE_TAG] },
      select: { id: true },
    });
    return d.id;
  }
  async function mkClaim(room: string, text: string): Promise<string> {
    const claim = await prisma.claim.create({
      data: { deliberationId: room, text, createdById: String(user.id), moid: mintClaimMoid(`${text}::${room}`) },
      select: { id: true },
    });
    const arg = await prisma.argument.create({
      data: { deliberationId: room, authorId: user.auth_id, text: `Grounds: ${text}`, claimId: claim.id, mediaType: "text" },
      select: { id: true },
    });
    await prisma.argumentSupport.create({
      data: { deliberationId: room, claimId: claim.id, argumentId: arg.id, mode: "product", base: 0.7, strength: 0.7 },
    });
    return claim.id;
  }

  const A = await mkRoom("A", "Carbon policy — Cost-efficiency frame");
  const B = await mkRoom("B", "Carbon policy — Political-durability frame");
  const C = await mkRoom("C", "Carbon policy — Distributional-equity frame");
  // p = "Carbon Tax is the better instrument"; q = "Cap-and-Trade is the better instrument"
  const pA = await mkClaim(A, "Under cost-efficiency, a Carbon Tax is the better instrument (lower $/ton abated).");
  const qA = await mkClaim(A, "Under cost-efficiency, Cap-and-Trade is the better instrument (lower $/ton abated).");
  const pB = await mkClaim(B, "Under political durability, a Carbon Tax is the better instrument (stable revenue, harder to repeal).");
  const qB = await mkClaim(B, "Under political durability, Cap-and-Trade is the better instrument (stable revenue, harder to repeal).");
  const pC = await mkClaim(C, "Under distributional equity, a Carbon Tax is the better instrument (least burden on the worst-off).");
  const qC = await mkClaim(C, "Under distributional equity, Cap-and-Trade is the better instrument (least burden on the worst-off).");
  console.log(`   ✅ Rooms: A(cost-efficiency)=${A.slice(0,8)} B(durability)=${B.slice(0,8)} C(equity)=${C.slice(0,8)}`);
  console.log("      p = 'Carbon Tax better', q = 'Cap-and-Trade better' (genuine rivals, p≇q within a room)");

  // Defensible pairwise translations:
  //   A↔B: cost-efficiency ranking ≡ durability ranking (faithful: tax↦tax, c&t↦c&t)
  //   B↔C: durability ranking ≡ equity ranking          (faithful: tax↦tax, c&t↦c&t)
  //   C↔A: equity ranking REVERSES cost-efficiency       (twist: tax↦c&t, c&t↦tax)
  // ⇒ each pair is internally consistent (a faithful 2-cycle ⇒ in 𝓟°), but the
  //   loop A→B→C→A sends "Tax-better" to "Cap&Trade-better": no global ranking.
  const edges: Array<[string, string, Record<string, string>, string]> = [
    [A, B, { [pA]: pB, [qA]: qB }, "cost-efficiency ranking ≡ durability ranking"],
    [B, A, { [pB]: pA, [qB]: qA }, "durability ranking ≡ cost-efficiency ranking"],
    [B, C, { [pB]: pC, [qB]: qC }, "durability ranking ≡ equity ranking"],
    [C, B, { [pC]: pB, [qC]: qB }, "equity ranking ≡ durability ranking"],
    [C, A, { [pC]: qA, [qC]: pA }, "equity ranking REVERSES cost-efficiency (worst-off favour the cost-dispreferred instrument)"],
    [A, C, { [pA]: qC, [qA]: pC }, "cost-efficiency ranking REVERSES equity"],
  ];
  for (const [from, to, claimMap, notes] of edges) {
    await prisma.roomFunctor.create({ data: { fromRoomId: from, toRoomId: to, claimMapJson: claimMap, notes: `${PROBE_TAG}: ${notes}` } });
    await writeSnapshot(from, to);
  }
  console.log("   ↳ A↔B, B↔C faithful (rankings agree); C↔A reverses (equity vs efficiency)");
  console.log("   ↳ each pair internally consistent, but the loop has NO consistent global ranking");
  console.log("🌱 SEED-REAL complete — expect a GLOBAL contextuality witness (a genuine Condorcet cycle).\n");
}

// ─────────────────────────────────────────────────────────────────────────
// CECH (sub-program B, phase B-poss-0) — the possibilistic Čech H¹ over the
// nerve of the room cover. See session 08 §7 (B-poss-0).
//
// CONSTRUCTION.
//   • 0-cells = rooms; 1-cells of the NERVE = unordered room pairs {r,s} that are
//     PAIRWISE COMPATIBLE for the tracked claim (a faithful back-edge 2-cycle,
//     i.e. the pair is in 𝓟° as a 2-cycle). The bad edge of a LOCAL obstruction
//     (a drop, or a non-faithful pair) is NOT a 1-cell of the nerve.
//   • A "section" tracks a claim's identity; transport along a 1-cell is the
//     claim-map (an ECC iso on the nerve, by construction of the 1-cells).
//   • The MONODROMY of a cycle in the nerve is the round-trip claim-map composite.
//     The local sections glue (a global section exists) along that cycle iff the
//     monodromy is TRIVIAL (claim returns up to ECC iso). A non-trivial monodromy
//     is a non-trivial possibilistic H¹ class.
//
// THE COHOMOLOGICAL PAYOFF (why local ≠ global is a degree statement, not a label):
//   • A LOCAL obstruction's bad edge is NOT in the nerve, so the obstructed loop is
//     not even a cycle of the nerve ⇒ it carries NO H¹ class (it is "gauge-trivial":
//     re-choosing the local section at the bad vertex removes it — a coboundary).
//   • A GLOBAL obstruction is a genuine NERVE cycle (every edge a 1-cell) with
//     non-trivial monodromy ⇒ a non-trivial H¹ generator.
//   H¹ is therefore SUPPORTED EXACTLY on the global cells — the B-exp partition is a
//   degree-1 cohomology statement.
//
// REPORT: β1 of the compatible nerve (candidate rank), and the number of cycle-basis
// generators with non-trivial monodromy (the actual boolean H¹ rank).

class UF2 {
  parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let r = x;
    while (this.parent.get(r) !== r) r = this.parent.get(r)!;
    let c = x;
    while (this.parent.get(c) !== r) { const n = this.parent.get(c)!; this.parent.set(c, r); c = n; }
    return r;
  }
  union(a: string, b: string) { this.parent.set(this.find(a), this.find(b)); }
}

/**
 * The HONEST H¹ rank (B-poss-1 rank argument): a real spanning-tree fundamental
 * cycle basis with the HOLONOMY GROUP evaluated on it, replacing the earlier
 * "distinct-room-set proxy capped at β1".
 *
 * Construction (per connected component of the both-directions nerve):
 *   1. spanning tree (BFS) rooted at r₀; propagate each root claim's section
 *      along tree edges via the forward claim-map (a claim that drops exits the
 *      section);
 *   2. each NON-tree edge {u,v} (β1 of them) gives a fundamental cycle; its
 *      holonomy is the permutation σ on r₀'s surviving claims: σ(c₀) = the root
 *      claim whose v-assignment is ECC-inter-derivable with transport(u→v) of
 *      c₀'s u-assignment;
 *   3. the holonomy group G = ⟨σ_e⟩ (closure under composition); the boolean H¹
 *      rank = log₂|G| **exactly when G is an elementary abelian 2-group** (all
 *      holonomies involutions — the binary p/q case), else log₂ is a LOWER bound
 *      and the report flags the non-involution.
 *
 * This is the genuine cycle-basis computation: rank = β1 − dim(ker of the
 * holonomy homomorphism Z₁(N) → Perm(claims)), exact for e.a.2 holonomy.
 */
interface H1RankResult {
  rank: number;
  beta1: number;
  groupOrder: number;
  elementaryAbelian2: boolean;
  components: number;
}

function permKey(p: Map<string, string>): string {
  return [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join(",");
}
function composePerm(g: Map<string, string>, f: Map<string, string>): Map<string, string> {
  // (g∘f)(x) = g(f(x)); domain = x where both defined.
  const out = new Map<string, string>();
  for (const [x, fx] of f) { const gfx = g.get(fx); if (gfx !== undefined) out.set(x, gfx); }
  return out;
}
function isInvolution(p: Map<string, string>): boolean {
  for (const [x, px] of p) { if (p.get(px) !== x) return false; }
  return true;
}

function computeH1RankBasis(
  rooms: string[],
  bothDirEdge: (a: string, b: string) => boolean, // undirected nerve edge: both functor directions exist
  fwd: (from: string, to: string, claim: string) => string | null, // directed claim-map
  iso: (room: string, a: string, b: string) => boolean, // ECC inter-derivability in `room`
  claimsOf: (room: string) => string[], // candidate tracked claims per room
): H1RankResult {
  // Build the undirected nerve adjacency (both-direction pairs).
  const adj = new Map<string, Set<string>>();
  const undirEdges = new Set<string>();
  for (const r of rooms) adj.set(r, new Set());
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i], b = rooms[j];
      if (bothDirEdge(a, b)) {
        adj.get(a)!.add(b); adj.get(b)!.add(a);
        undirEdges.add([a, b].sort().join("|"));
      }
    }
  }
  const V = rooms.filter((r) => (adj.get(r)?.size ?? 0) > 0);
  const E = undirEdges.size;
  // Components over the nerve.
  const uf = new UF2();
  for (const e of undirEdges) { const [a, b] = e.split("|"); uf.union(a, b); }
  const compRoots = new Set(V.map((r) => uf.find(r)));
  const C = compRoots.size;
  const beta1 = E - V.length + C;

  // Per component: spanning tree + fundamental cycles + holonomy group.
  const allHolonomies: Array<Map<string, string>> = [];
  for (const root of compRoots) {
    const compRooms = V.filter((r) => uf.find(r) === root);
    if (compRooms.length === 0) continue;
    const r0 = compRooms[0];
    // BFS spanning tree; record parent edge.
    const parent = new Map<string, string>();
    const treeEdge = new Set<string>();
    const seen = new Set<string>([r0]);
    const queue = [r0];
    while (queue.length) {
      const u = queue.shift()!;
      for (const v of adj.get(u) ?? []) {
        if (!seen.has(v)) { seen.add(v); parent.set(v, u); treeEdge.add([u, v].sort().join("|")); queue.push(v); }
      }
    }
    // Propagate each root claim's section along the tree: assignment[room] = claim.
    const rootClaims = claimsOf(r0);
    const assign = new Map<string, Map<string, string>>(); // room → (rootClaim → claimInRoom)
    for (const rm of compRooms) assign.set(rm, new Map());
    for (const c0 of rootClaims) {
      // BFS again, transporting c0 down the tree.
      const am = new Map<string, string>([[r0, c0]]);
      const q2 = [r0];
      while (q2.length) {
        const u = q2.shift()!;
        for (const v of adj.get(u) ?? []) {
          if (parent.get(v) === u && !am.has(v)) {
            const cu = am.get(u);
            if (cu != null) { const cv = fwd(u, v, cu); if (cv != null) am.set(v, cv); }
            q2.push(v);
          }
        }
      }
      for (const [rm, cl] of am) assign.get(rm)!.set(c0, cl);
    }
    // Each non-tree edge ⇒ a fundamental cycle ⇒ a holonomy permutation on r0's claims.
    for (const e of undirEdges) {
      if (treeEdge.has(e)) continue;
      const [a, b] = e.split("|");
      if (uf.find(a) !== root) continue;
      // holonomy via this non-tree edge, oriented a→b then back through the tree.
      const sigma = new Map<string, string>();
      for (const c0 of rootClaims) {
        const ca = assign.get(a)?.get(c0);
        if (ca == null) continue;
        const landed = fwd(a, b, ca); // transport c0's a-image across the non-tree edge
        if (landed == null) continue;
        // which root claim c0' has b-assignment ECC-inter-derivable with `landed`?
        let target: string | null = null;
        for (const c0p of rootClaims) {
          const cb = assign.get(b)?.get(c0p);
          if (cb != null && iso(b, landed, cb)) { target = c0p; break; }
        }
        if (target != null) sigma.set(c0, target);
      }
      if (sigma.size > 0) allHolonomies.push(sigma);
    }
  }

  // Holonomy group = closure of the holonomies under composition (+ inverses;
  // for involutions each is its own inverse). Identity is the empty-shift perm.
  const elems = new Map<string, Map<string, string>>();
  const idPerm = new Map<string, string>();
  // seed identity over the union of holonomy domains
  for (const h of allHolonomies) for (const k of h.keys()) idPerm.set(k, k);
  elems.set(permKey(idPerm), idPerm);
  let frontier = [...allHolonomies];
  for (const h of allHolonomies) if (!elems.has(permKey(h))) elems.set(permKey(h), h);
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 1000) {
    changed = false;
    const current = [...elems.values()];
    for (const g of current) {
      for (const h of allHolonomies) {
        const gh = composePerm(g, h);
        const k = permKey(gh);
        if (gh.size > 0 && !elems.has(k)) { elems.set(k, gh); changed = true; }
      }
    }
  }
  const groupOrder = elems.size;
  const elementaryAbelian2 = [...elems.values()].every((p) => isInvolution(p));
  // rank = log₂|G| (exact for e.a.2). For non-e.a.2, floor(log₂) is a lower bound.
  const rank = groupOrder > 0 ? Math.floor(Math.log2(groupOrder)) : 0;
  return { rank, beta1, groupOrder, elementaryAbelian2, components: C };
}

async function cech(): Promise<void> {
  console.log("🧮 ČECH (B-poss-0) — possibilistic H¹ over the nerve of the room cover\n");

  const rawFunctors = await prisma.roomFunctor.findMany({
    select: { fromRoomId: true, toRoomId: true, claimMapJson: true },
  });
  const functors: CycleFunctor[] = rawFunctors.map((f) => ({
    fromRoomId: f.fromRoomId,
    toRoomId: f.toRoomId,
    claimMap:
      f.claimMapJson && typeof f.claimMapJson === "object" ? (f.claimMapJson as Record<string, string>) : {},
  }));
  if (functors.length === 0) {
    console.log("   ⚠️  No RoomFunctor rows. Run `seed-contextuality` first.\n");
    return;
  }
  const mapIndex = new Map<string, Record<string, string>>();
  for (const f of functors) mapIndex.set(EDGE(f.fromRoomId, f.toRoomId), f.claimMap);
  const hasEdge = (a: string, b: string) => mapIndex.has(EDGE(a, b));
  const mapOf = (a: string, b: string) => mapIndex.get(EDGE(a, b)) ?? {};

  const cycles = enumerateDirectedCycles(functors);
  const roomsInCycles = new Set<string>();
  cycles.forEach((c) => c.forEach((r) => roomsInCycles.add(r)));
  if (roomsInCycles.size === 0) {
    console.log("   No cycles ⇒ the nerve is a forest ⇒ H¹ = 0.\n");
    return;
  }
  const reach = await loadDerivationReachability([...roomsInCycles]);
  const interDerivable = (room: string, a: string, b: string) => reach(room, a, b) && reach(room, b, a);

  // Pairwise faithfulness for a tracked claim x at room rFrom over edge rFrom→rTo:
  // forward + back exist and the 2-cycle returns to a claim inter-derivable with x.
  const pairFaithful = (rFrom: string, rTo: string, x: string): boolean => {
    const fwd = mapOf(rFrom, rTo)[x];
    if (fwd == null || !hasEdge(rTo, rFrom)) return false;
    const back = mapOf(rTo, rFrom)[fwd];
    if (back == null) return false;
    return interDerivable(rFrom, x, back);
  };

  // We compute H¹ over the directed cycles enumerated (each a candidate loop),
  // per tracked start claim — the section being glued is that claim's identity.
  // For each directed cycle + start claim, classify the loop's role in the nerve:
  //   • some edge NOT a nerve 1-cell (a pair not faithful, or a drop) ⇒ the loop is
  //     OFF the nerve ⇒ contributes NO H¹ class (local / coboundary-trivial);
  //   • every edge a nerve 1-cell ⇒ the loop IS a nerve cycle; its monodromy is the
  //     round-trip; non-trivial monodromy ⇒ a non-trivial H¹ generator.
  const nerveEdges = new Set<string>(); // unordered "a|b" pairs that are 1-cells
  const undirNerve = (a: string, b: string) => [a, b].sort().join("|");

  let h1Generators = 0;
  let offNerveLoops = 0;
  let trivialNerveLoops = 0;
  const genWitnesses: string[] = [];
  const nonTrivialCycleKeys = new Set<string>(); // distinct nerve 1-cycles (by room-set) with non-trivial monodromy

  for (const cycle of cycles) {
    const firstMap = mapOf(cycle[0], cycle[1 % cycle.length]);
    for (const start of Object.keys(firstMap)) {
      const trace = traceClaim(cycle, mapOf, start);
      // Walk edges; is every edge a nerve 1-cell (pairwise faithful) for the
      // tracked claim at that step?
      let everyEdgeInNerve = true;
      for (let i = 0; i < cycle.length; i++) {
        const rFrom = cycle[i], rTo = cycle[(i + 1) % cycle.length];
        const xi = trace.steps[i].claim;
        if (xi == null || !pairFaithful(rFrom, rTo, xi)) { everyEdgeInNerve = false; break; }
        nerveEdges.add(undirNerve(rFrom, rTo));
      }
      if (!everyEdgeInNerve) { offNerveLoops++; continue; }
      // Nerve cycle: monodromy = does the start claim return up to ECC iso?
      const landing = trace.steps[trace.steps.length - 1].claim;
      const trivial = landing != null && interDerivable(cycle[0], start, landing);
      if (trivial) {
        trivialNerveLoops++;
      } else {
        h1Generators++; // per-(cycle, claim) witness multiplicity
        nonTrivialCycleKeys.add([...cycle].sort().join("|")); // distinct nerve 1-cycle
        genWitnesses.push(`${cycle.map(short).join("→")}→${short(cycle[0])} @ "${short(start)}"→"${short(landing ?? "∅")}"`);
      }
    }
  }

  // β1 of the compatible nerve (1-skeleton): E − V + C over the rooms it touches.
  const nerveVerts = new Set<string>();
  for (const e of nerveEdges) { const [a, b] = e.split("|"); nerveVerts.add(a); nerveVerts.add(b); }
  const uf = new UF2();
  for (const e of nerveEdges) { const [a, b] = e.split("|"); uf.union(a, b); }
  const comps = new Set([...nerveVerts].map((v) => uf.find(v))).size;
  const beta1 = nerveEdges.size - nerveVerts.size + comps;
  // Boolean H¹ rank = number of INDEPENDENT nerve 1-cycles with non-trivial
  // monodromy, bounded above by β1. Distinct-room-set count is a sound proxy for
  // these small graphs; cap at β1 so the reported rank never exceeds the cycle space.
  const h1RankProxy = Math.min(nonTrivialCycleKeys.size, beta1);

  // ── B-poss-1 rank argument: the REAL cycle-basis / holonomy-group rank ──────
  // Gather candidate tracked claims per room (keys of outgoing maps + values of
  // incoming maps), build the both-directions pairwise-compatible nerve, and run
  // the spanning-tree fundamental-cycle holonomy-group computation.
  const claimsByRoom = new Map<string, Set<string>>();
  for (const f of functors) {
    const m = f.claimMap;
    for (const [k, v] of Object.entries(m)) {
      (claimsByRoom.get(f.fromRoomId) ?? claimsByRoom.set(f.fromRoomId, new Set()).get(f.fromRoomId)!).add(k);
      (claimsByRoom.get(f.toRoomId) ?? claimsByRoom.set(f.toRoomId, new Set()).get(f.toRoomId)!).add(v);
    }
  }
  const claimsOf = (room: string) => [...(claimsByRoom.get(room) ?? [])];
  const bothDirEdge = (a: string, b: string) =>
    claimsOf(a).some((x) => pairFaithful(a, b, x)) || claimsOf(b).some((x) => pairFaithful(b, a, x));
  const fwd = (from: string, to: string, claim: string) => mapOf(from, to)[claim] ?? null;
  const basis = computeH1RankBasis([...roomsInCycles], bothDirEdge, fwd, interDerivable, claimsOf);
  const h1Rank = basis.rank;

  console.log("   ── Compatible nerve (1-skeleton) ──");
  console.log(`   nerve 1-cells (faithful pairs) = ${nerveEdges.size}`);
  console.log(`   nerve 0-cells (rooms)          = ${nerveVerts.size}`);
  console.log(`   components                     = ${comps}`);
  console.log(`   β1(nerve) = E−V+C              = ${beta1}   ← candidate H¹ rank (independent 1-cycles)`);
  console.log("");
  console.log("   ── Section gluing (monodromy on nerve cycles) ──");
  console.log(`   off-nerve loops (LOCAL: bad edge ∉ nerve ⇒ coboundary-trivial, no H¹) = ${offNerveLoops}`);
  console.log(`   nerve cycles, trivial monodromy (glue ⇒ in 𝓟°)                        = ${trivialNerveLoops}`);
  console.log(`   non-trivial monodromy — per-(cycle,claim) witnesses                   = ${h1Generators}`);
  console.log(`   distinct nerve 1-cycles with non-trivial monodromy                    = ${nonTrivialCycleKeys.size}`);
  for (const w of genWitnesses) console.log(`      ★ witness: ${w}`);
  console.log("");
  console.log("   ── H¹ rank (cycle-basis / holonomy group) ──");
  console.log(`   holonomy group order |G|         = ${basis.groupOrder}`);
  console.log(`   elementary abelian 2-group?      = ${basis.elementaryAbelian2 ? "YES (rank exact)" : "NO (rank is a lower bound)"}`);
  console.log(`   H¹ rank = log₂|G| (≤ β1=${basis.beta1})       = ${h1Rank}   ← real cycle-basis rank (replaces room-set proxy ${h1RankProxy})`);
  console.log("");
  console.log("   ══ ČECH VERDICT ══");
  console.log(`   possibilistic H¹ rank = ${h1Rank}   (holonomy group ℤ/2^${h1Rank} on the compatible nerve)`);
  if (h1Rank > 0) {
    console.log("   ⇒ H¹ ≠ 0: a NON-TRIVIAL possibilistic class exists. The disagreement is GLOBAL —");
    console.log("     pairwise-consistent local sections that DO NOT glue. This is the Abramsky");
    console.log("     contextuality obstruction, realized on the Plexus claim-sheaf (B1 witnessed).");
    console.log(`   (Per-claim witness multiplicity ${h1Generators} ≥ rank ${h1Rank}: several claims may be`);
    console.log("    non-trivially tracked around the same 1-cycle; the rank counts the holonomy group.)");
    console.log("   NOTE: local obstructions contributed 0 to H¹ (their bad edge is not a nerve 1-cell —");
    console.log("   they are coboundary-trivial), so H¹ is supported EXACTLY on the global cells (B1).");
  } else {
    console.log("   ⇒ H¹ = 0 on current data: every loop either glues (in 𝓟°) or is off-nerve (LOCAL,");
    console.log("     coboundary-trivial). No genuine global class. Seed `seed-cech` to validate.");
  }
  console.log("");
}

// ─────────────────────────────────────────────────────────────────────────
// CLEAN
// ─────────────────────────────────────────────────────────────────────────

async function clean(quiet = false): Promise<void> {
  const probes = await prisma.deliberation.findMany({
    where: { tags: { has: PROBE_TAG } },
    select: { id: true },
  });
  const ids = probes.map((p) => p.id);
  if (ids.length === 0) {
    if (!quiet) console.log("🧹 CLEAN — no probe deliberations found.\n");
    return;
  }
  // RoomFunctor / RoomTransportSnapshot have no FK cascade — delete by room id.
  await prisma.roomTransportSnapshot.deleteMany({
    where: { OR: [{ fromRoomId: { in: ids } }, { toRoomId: { in: ids } }] },
  });
  await prisma.roomFunctor.deleteMany({
    where: { OR: [{ fromRoomId: { in: ids } }, { toRoomId: { in: ids } }] },
  });
  // Deliberation delete cascades claims, arguments, supports.
  await prisma.deliberation.deleteMany({ where: { id: { in: ids } } });
  if (!quiet) console.log(`🧹 CLEAN — removed ${ids.length} probe deliberation(s) and their functors/snapshots.\n`);
}

// ─────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const cmd = (process.argv[2] ?? "all").toLowerCase();
  switch (cmd) {
    case "seed":
      await seed();
      break;
    case "measure":
      await measure();
      break;
    case "holonomy":
      await holonomy();
      break;
    case "drift":
      await seedDrift();
      await holonomy();
      break;
    case "contextuality":
      await contextuality();
      break;
    case "seed-contextuality":
      await seedContextuality();
      await contextuality();
      break;
    case "seed-real":
      await seedReal();
      await contextuality();
      await cech();
      break;
    case "cech":
      await cech();
      break;
    case "seed-cech":
      await seedContextuality();
      await cech();
      break;
    case "clean":
      await clean();
      break;
    case "all":
      await seed();
      await measure();
      await holonomy();
      break;
    default:
      console.error(`Unknown command "${cmd}". Use: seed | measure | holonomy | drift | contextuality | seed-contextuality | cech | seed-cech | seed-real | clean | (none = seed+measure+holonomy).`);
      process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("❌ plexus-topology-probe failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
