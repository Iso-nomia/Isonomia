//app/api/deliberations/[id]/evidential/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { DEFAULT_ARGUMENT_CONFIDENCE, DEFAULT_PREMISE_BASE } from "@/lib/config/confidence";
import { batchLazyRecompute } from "@/lib/evidential/lazy-recompute";
import {
  evaluateEvidentialTyped,
  type EvidentialInputs,
  type Mode as TypedMode,
} from "@/lib/argumentation/eccAdapter";
import {
  reduceImportedScores,
  combineLocalAndImported,
  type TransportSnapshotPayload,
} from "@/lib/argumentation/transportAggregator";
import { corroborateProbs } from "@/lib/argumentation/logodds";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Sprint B2: feature flag — when set, route the math through the typed
// `lib/argumentation/eccAdapter.ts` pipeline instead of the inline scalar
// reducers below. The two paths are byte-identical for the same Prisma
// inputs (asserted by `tests/eccAdapter.test.ts` parity suite).
const ECC_TYPED_PIPELINE = process.env.ECC_TYPED_PIPELINE === "1";

type Mode = 'product'|'min'|'ds'|'logodds';

// Phase 5b step 1 (confidence-algebra migration): the lawful log-odds semiring
// is now the *default* confidence algebra. Explicit `?mode=` requests are always
// honoured, so this only changes the no-mode default. Revert by setting
// `CONFIDENCE_DEFAULT_MODE=product` (env-only, no schema or data change) during
// the real-world bake; `product` is deleted entirely in Phase 5b step 2.
const DEFAULT_CONFIDENCE_MODE: Mode =
  process.env.CONFIDENCE_DEFAULT_MODE === 'product' ? 'product' : 'logodds';
const clamp01 = (x:number) => Math.max(0, Math.min(1, x));
// compose = conjunction within an argument (base × premises × assumptions).
// `logodds` shares product-style conjunction; it differs only in `join`.
const compose = (xs:number[], mode:Mode)=> !xs.length ? 0 : (mode==='min' ? Math.min(...xs) : xs.reduce((a,b)=>a*b,1));
// join = corroboration across independent arguments for a claim. `logodds`
// uses the lawful weight-of-evidence sum (stacks, no noisy-OR ceiling).
const join    = (xs:number[], mode:Mode)=> !xs.length ? 0 : (mode==='min' ? Math.max(...xs) : mode==='logodds' ? corroborateProbs(xs) : 1 - xs.reduce((a,s)=>a*(1-s),1));


// const join = (xs: number[], mode: Mode) =>
//   !xs.length ? 0 : (mode === 'min' ? Math.max(...xs) : 1 - xs.reduce((a, s) => a * (1 - s), 1));

// const join = (xs:number[], mode:Mode) => {
//   if (!xs.length) return 0;
//   if (mode==='min') return Math.max(...xs);
//   // 'product' and 'ds' both use noisy-or for now; 'ds' can be returned as pair if you prefer.
//   return 1 - xs.reduce((a,s)=> a*(1-s), 1);
// };


export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const deliberationId = params.id;

  const qMode = (url.searchParams.get('mode') ?? '').toLowerCase();
  const mode: Mode =
    (qMode === 'min' || qMode === 'logodds' || qMode === 'product')
      ? (qMode as Mode)
      : DEFAULT_CONFIDENCE_MODE;
  const imports = (url.searchParams.get('imports') ?? 'off').toLowerCase() as 'off'|'materialized'|'virtual'|'all';

  // 1) claims and concluding args
  const claims = await prisma.claim.findMany({ where: { deliberationId }, select: { id:true, text:true } });
  const claimIds = claims.map(c => c.id);
  const conclusions = await prisma.argument.findMany({
    where: { deliberationId, claimId: { in: claimIds } },
    select: { id:true, claimId:true },
  });
  const conclByClaim = new Map<string,string>(conclusions.map(a => [a.claimId!, a.id]));

  // 2) base supports in this room (materialized)
  const base = await prisma.argumentSupport.findMany({
    where: { deliberationId, claimId: { in: claimIds } },
    select: { id:true, claimId:true, argumentId:true, base:true, provenanceJson:true }
  });

  // Phase 3: Lazy recomputation - recompute stale composed arguments
  const allArgumentIds = base.map(s => s.argumentId);
  await batchLazyRecompute(allArgumentIds).catch(err => {
    console.error("Lazy recomputation failed:", err);
    // Continue even if recomputation fails
  });

  // include/exclude materialized imports
  const includeMat = imports === 'materialized' || imports === 'all';
  const localSupports = includeMat
    ? base
    : base.filter(s => (s.provenanceJson as any)?.kind !== 'import');

  // 3) virtual imports (read-only) → mapped into this room’s claims
  let virtualAdds: Array<{ claimId: string; argumentId: string; base: number }> = [];
  if (imports === 'virtual' || imports === 'all') {
    const imps = await prisma.argumentImport.findMany({
      where: { toDeliberationId: deliberationId, toClaimId: { in: claimIds } },
      select: { fingerprint:true, toClaimId:true, toArgumentId:true, baseAtImport:true }
    });
    virtualAdds = imps
      .filter(i => !i.toArgumentId) // not materialized
      .map(i => ({
        claimId: i.toClaimId!,
        argumentId: `virt:${i.fingerprint}`,
        base: clamp01(i.baseAtImport ?? DEFAULT_ARGUMENT_CONFIDENCE),
      }));
  }

  const allSupports = [
    ...localSupports.map(s => ({ claimId: s.claimId, argumentId: s.argumentId, base: clamp01(s.base ?? DEFAULT_ARGUMENT_CONFIDENCE) })),
    ...virtualAdds,
  ];

  if (!allSupports.length) {
    return NextResponse.json({
      ok:true, deliberationId, mode, support:{}, hom:{}, arguments:[],
      meta: { claims: claims.length, supports: 0, edges: 0, conclusions: conclusions.length }
    }, { headers: { 'Cache-Control':'no-store' } });
  }

  // 4) premises+assumptions only apply to *real* argument ids
  const realArgIds = Array.from(new Set(allSupports.map(s => s.argumentId).filter(id => !id.startsWith('virt:'))));
  const edges = await prisma.argumentEdge.findMany({
    where: { deliberationId, type:'support' as any, toArgumentId: { in: realArgIds } },
    select: { fromArgumentId:true, toArgumentId:true },
  });
  const parents = new Map<string,string[]>();
  for (const e of edges) (parents.get(e.toArgumentId) ?? parents.set(e.toArgumentId,[]).get(e.toArgumentId)!).push(e.fromArgumentId);

  // Gap 4: Per-derivation assumption tracking
  // Fetch all derivations (ArgumentSupport) for these arguments
  const derivations = await prisma.argumentSupport.findMany({
    where: { argumentId: { in: realArgIds } },
    select: { id: true, argumentId: true }
  });
  
  const derivationIds = derivations.map(d => d.id);
  const derivByArg = new Map<string, string[]>();
  for (const d of derivations) {
    (derivByArg.get(d.argumentId) ?? derivByArg.set(d.argumentId, []).get(d.argumentId)!).push(d.id);
  }

  // Fetch per-derivation assumptions
  const derivAssumptions = await prisma.derivationAssumption.findMany({
    where: { derivationId: { in: derivationIds } }
  });

  // Map: derivationId -> assumption weights
  const assumpByDeriv = new Map<string, number[]>();
  for (const da of derivAssumptions) {
    (assumpByDeriv.get(da.derivationId) ?? assumpByDeriv.set(da.derivationId, []).get(da.derivationId)!)
      .push(clamp01(da.weight));
  }

  // Legacy fallback: argument-level assumptions (for backward compatibility)
  const legacyUses = await prisma.assumptionUse.findMany({
    where: { argumentId: { in: realArgIds } },
    select: { argumentId:true, weight:true },
  }).catch(()=>[] as any[]);
  const legacyAssump = new Map<string, number[]>();
  for (const u of legacyUses) {
    (legacyAssump.get(u.argumentId) ?? legacyAssump.set(u.argumentId,[]).get(u.argumentId)!)
      .push(clamp01(u.weight ?? 0.6));
  }

  const baseByArg = new Map<string, number>();
  for (const s of allSupports) if (!s.argumentId.startsWith('virt:')) baseByArg.set(s.argumentId, s.base);

  // 5) contributions (per-derivation assumption tracking)
  type Contribution = { argumentId:string; score:number; parts:{base:number; premises:number[]; assumptions:number[]} };
  const contributionsByClaim = new Map<string, Contribution[]>();
  const argsByClaim = new Map<string, string[]>();

  for (const s of allSupports) {
    const real = !s.argumentId.startsWith("virt:");
    const b = real ? (baseByArg.get(s.argumentId) ?? s.base) : s.base;
    const premIds = real ? (parents.get(s.argumentId) ?? []) : [];
    const premBases = real ? premIds.map(pid => baseByArg.get(pid) ?? DEFAULT_PREMISE_BASE) : [];
    const premFactor = premBases.length ? compose(premBases, mode) : 1;

    // Per-derivation assumption tracking:
    let aBases: number[] = [];
    if (real) {
      const derivIds = derivByArg.get(s.argumentId) ?? [];
      const derivAssumps: number[] = [];
      for (const dId of derivIds) {
        const weights = assumpByDeriv.get(dId) ?? [];
        if (weights.length) derivAssumps.push(...weights);
      }
      // Fallback to legacy argument-level if no per-derivation data
      aBases = derivAssumps.length ? derivAssumps : (legacyAssump.get(s.argumentId) ?? []);
    }

    const assumpFactor = aBases.length ? compose(aBases, mode) : 1;
    const score = clamp01(compose([b, premFactor], mode) * assumpFactor);

    (contributionsByClaim.get(s.claimId) ?? contributionsByClaim.set(s.claimId, []).get(s.claimId)!)
      .push({ argumentId: s.argumentId, score, parts:{ base:b, premises: premBases, assumptions: aBases } });

    (argsByClaim.get(s.claimId) ?? argsByClaim.set(s.claimId, []).get(s.claimId)!)
      .push(s.argumentId);
  }

  // 6) support + nodes + hom + DS conflict mass computation
  const support: Record<string, number> = {};
  const dsSupport: Record<string,{ bel:number; pl:number }> = {};

  // For DS mode, fetch negation mappings to compute conflict mass
  let negationMappings: Map<string, string[]> = new Map(); // claimId -> [negatedClaimIds]
  if (mode === "ds") {
    const negMaps = await prisma.negationMap.findMany({
      where: { deliberationId },
      select: { claimId: true, negatedClaimId: true, confidence: true },
    });
    
    for (const nm of negMaps) {
      const list = negationMappings.get(nm.claimId) ?? [];
      list.push(nm.negatedClaimId);
      negationMappings.set(nm.claimId, list);
    }
  }

  // ── Sprint B2: typed pipeline branch ──────────────────────────────────
  if (ECC_TYPED_PIPELINE) {
    // Collect AssumptionUse status for the strict `logical` predicate.
    const usesForStatus = await prisma.assumptionUse.findMany({
      where: { argumentId: { in: realArgIds } },
      select: { id: true, status: true },
    }).catch(() => [] as Array<{ id: string; status: string }>);
    const assumptionStatus = new Map<string, "PROPOSED" | "ACCEPTED" | "CHALLENGED" | "RETRACTED">();
    for (const u of usesForStatus) {
      assumptionStatus.set(u.id, (u.status as any) ?? "PROPOSED");
    }

    const inputs: EvidentialInputs = {
      claims,
      concludingArgumentByClaim: conclByClaim,
      localSupports: localSupports.map((s) => ({
        id: s.id,
        claimId: s.claimId,
        argumentId: s.argumentId,
        base: clamp01(s.base ?? DEFAULT_ARGUMENT_CONFIDENCE),
        isImported: (s.provenanceJson as any)?.kind === "import",
      })),
      virtualSupports: virtualAdds,
      premiseEdges: edges.map((e) => ({
        fromArgumentId: e.fromArgumentId,
        toArgumentId: e.toArgumentId,
      })),
      derivationAssumptions: derivAssumptions.map((da) => ({
        derivationId: da.derivationId,
        assumptionId: da.assumptionId,
        weight: clamp01(da.weight),
      })),
      assumptionStatus,
      legacyAssumptionsByArg: legacyAssump,
      defaultArgumentConfidence: DEFAULT_ARGUMENT_CONFIDENCE,
      defaultPremiseBase: DEFAULT_PREMISE_BASE,
    };

    const typed = evaluateEvidentialTyped(inputs, mode as TypedMode);
    const argumentsMeta = await prisma.argument.findMany({
      where: { id: { in: Array.from(realArgIds) } },
      select: { id: true, text: true, quantifier: true, modality: true },
    });

    // ── Sprint C3: cross-room transport band ─────────────────────────────
    // When `imports=materialized|all` (the default for the UI's "show
    // imports" mode), fold cached `RoomTransportSnapshot` rows whose
    // `toRoomId === deliberationId` into a `{ local, imported, total }`
    // band. The flat `support` map keeps the **total** so existing readers
    // that ignore the band stay correct (band-aware UIs read `supportBand`).
    const supportBand: Record<string, { local: number; imported: number; total: number }> = {};
    if (includeMat && (mode === "min" || mode === "product" || mode === "logodds")) {
      const snapshots = await prisma.roomTransportSnapshot.findMany({
        where: { toRoomId: deliberationId },
        select: { payloadJson: true },
      }).catch(() => [] as Array<{ payloadJson: any }>);
      const importedByClaim = new Map<string, number[]>();
      for (const snap of snapshots) {
        const payload = snap.payloadJson as TransportSnapshotPayload | null;
        if (!payload || typeof payload !== "object" || !payload.byClaim) continue;
        for (const [toClaimId, slot] of Object.entries(payload.byClaim)) {
          const list = importedByClaim.get(toClaimId) ?? [];
          for (const src of slot.sources) list.push(src.score);
          importedByClaim.set(toClaimId, list);
        }
      }
      for (const c of claims) {
        const local = typed.support[c.id] ?? 0;
        const imp = reduceImportedScores(importedByClaim.get(c.id) ?? [], mode as "min" | "product" | "logodds");
        const total = combineLocalAndImported(local, imp, mode as "min" | "product" | "logodds");
        supportBand[c.id] = { local: +local.toFixed(4), imported: +imp.toFixed(4), total: +total.toFixed(4) };
        typed.support[c.id] = +total.toFixed(4);
      }
    }

    return NextResponse.json({
      ok: true,
      deliberationId,
      mode,
      pipeline: "typed",
      support: typed.support,
      ...(Object.keys(supportBand).length ? { supportBand } : {}),
      hom: typed.hom,
      nodes: typed.nodes,
      arguments: argumentsMeta,
      meta: {
        claims: claims.length,
        supports: allSupports.length,
        edges: edges.length,
        conclusions: conclusions.length,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const nodes = claims.map(c => {
    const contribs = (contributionsByClaim.get(c.id) ?? []).sort((a,b)=>b.score - a.score);
    const s = join(contribs.map(x=>x.score), mode);
    support[c.id] = +s.toFixed(4);

    const top = contribs.slice(0,5).map(x => ({ argumentId: x.argumentId, score: +x.score.toFixed(4) }));
    return { id:c.id, diagramId: conclByClaim.get(c.id) ?? null, type:"claim" as const, text:c.text, score: support[c.id], top };
  });

  const argIds = Array.from(new Set(allSupports.map(s => s.argumentId).filter(id => !id.startsWith('virt:'))));
  const argumentsMeta = await prisma.argument.findMany({
    where: { id: { in: argIds } },
    select: { id:true, text:true, quantifier:true, modality:true },
  });

  const hom: Record<string,{ args:string[] }> = {};
  for (const [claimId, list] of argsByClaim) hom[`I|${claimId}`] = { args: Array.from(new Set(list)) };

  // Sprint C3 (legacy branch parity): apply transport snapshots so the
  // band is available regardless of `ECC_TYPED_PIPELINE`.
  const supportBand: Record<string, { local: number; imported: number; total: number }> = {};
  if (includeMat && (mode === "min" || mode === "product" || mode === "logodds")) {
    const snapshots = await prisma.roomTransportSnapshot.findMany({
      where: { toRoomId: deliberationId },
      select: { payloadJson: true },
    }).catch(() => [] as Array<{ payloadJson: any }>);
    const importedByClaim = new Map<string, number[]>();
    for (const snap of snapshots) {
      const payload = snap.payloadJson as TransportSnapshotPayload | null;
      if (!payload || typeof payload !== "object" || !payload.byClaim) continue;
      for (const [toClaimId, slot] of Object.entries(payload.byClaim)) {
        const list = importedByClaim.get(toClaimId) ?? [];
        for (const src of slot.sources) list.push(src.score);
        importedByClaim.set(toClaimId, list);
      }
    }
    for (const c of claims) {
      const local = support[c.id] ?? 0;
      const imp = reduceImportedScores(importedByClaim.get(c.id) ?? [], mode as "min" | "product" | "logodds");
      const total = combineLocalAndImported(local, imp, mode as "min" | "product" | "logodds");
      supportBand[c.id] = { local: +local.toFixed(4), imported: +imp.toFixed(4), total: +total.toFixed(4) };
      support[c.id] = +total.toFixed(4);
    }
  }

  return NextResponse.json({
    ok:true, deliberationId, mode, support, ...(Object.keys(supportBand).length ? { supportBand } : {}),
    hom, nodes, arguments: argumentsMeta,
    meta: { claims: claims.length, supports: allSupports.length, edges: edges.length, conclusions: conclusions.length }
  }, { headers: { 'Cache-Control':'no-store' } });
}