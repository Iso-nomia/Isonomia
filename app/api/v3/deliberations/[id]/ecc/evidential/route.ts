/**
 * GET /api/v3/deliberations/[id]/ecc/evidential?mode=min|product|ds&imports=off|materialized|virtual|all
 *
 * Sprint E1 — typed evidential evaluation for the entire deliberation.
 *
 * Server-side proxy that runs `evaluateEvidentialTyped()` directly
 * (bypassing the legacy branch in `app/api/deliberations/[id]/evidential/route.ts`)
 * so MCP clients always see the typed-pipeline output regardless of the
 * `ECC_TYPED_PIPELINE` env flag. Returns the same `{ support, dsSupport,
 * hom, nodes }` shape the legacy route produces, plus a `supportBand`
 * map when imports are included so the band UI from Sprint C4 lands
 * here too.
 *
 * Closed-enum mode (ECC plan §4 row 5).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { DEFAULT_ARGUMENT_CONFIDENCE, DEFAULT_PREMISE_BASE } from "@/lib/config/confidence";
import {
  evaluateEvidentialTyped,
  type EvidentialInputs,
  type Mode,
} from "@/lib/argumentation/eccAdapter";
import {
  combineLocalAndImported,
  reduceImportedScores,
  type TransportSnapshotPayload,
} from "@/lib/argumentation/transportAggregator";

export const dynamic = "force-dynamic";

/** Route-facing mode (closed-enum ECC plan §4 row 5). `ds` maps to the
 *  adapter's `logodds` (weight-of-evidence / Dempster-Shafer-style) semiring. */
type RouteMode = "min" | "product" | "ds";
const ALLOWED = new Set<RouteMode>(["min", "product", "ds"]);
const toAdapterMode = (m: RouteMode): Mode => (m === "ds" ? "logodds" : m);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: deliberationId } = await ctx.params;
  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "product").toLowerCase() as RouteMode;
  const imports = (url.searchParams.get("imports") ?? "off").toLowerCase() as
    | "off" | "materialized" | "virtual" | "all";
  if (!ALLOWED.has(mode)) {
    return NextResponse.json(
      { ok: false, error: "mode must be one of: min, product, ds" },
      { status: 400 },
    );
  }

  const claims = await prisma.claim.findMany({
    where: { deliberationId },
    select: { id: true, text: true },
  });
  const claimIds = claims.map((c) => c.id);
  if (claimIds.length === 0) {
    return NextResponse.json({
      ok: true,
      deliberationId,
      mode,
      support: {},
      dsSupport: {},
      hom: {},
      nodes: [],
    });
  }

  const conclusions = await prisma.argument.findMany({
    where: { deliberationId, claimId: { in: claimIds } },
    select: { id: true, claimId: true },
  });
  const concludingArgumentByClaim = new Map<string, string>(
    conclusions.map((a) => [a.claimId!, a.id]),
  );

  const base = await prisma.argumentSupport.findMany({
    where: { deliberationId, claimId: { in: claimIds } },
    select: { id: true, claimId: true, argumentId: true, base: true, provenanceJson: true },
  });
  const includeMat = imports === "materialized" || imports === "all";
  const localSupports = includeMat
    ? base
    : base.filter((s) => (s.provenanceJson as any)?.kind !== "import");

  let virtualSupports: Array<{ claimId: string; argumentId: string; base: number }> = [];
  if (imports === "virtual" || imports === "all") {
    const imps = await prisma.argumentImport.findMany({
      where: { toDeliberationId: deliberationId, toClaimId: { in: claimIds } },
      select: { fingerprint: true, toClaimId: true, toArgumentId: true, baseAtImport: true },
    });
    virtualSupports = imps
      .filter((i) => !i.toArgumentId)
      .map((i) => ({
        claimId: i.toClaimId!,
        argumentId: `virt:${i.fingerprint}`,
        base: clamp01(i.baseAtImport ?? DEFAULT_ARGUMENT_CONFIDENCE),
      }));
  }

  const realArgIds = Array.from(
    new Set(localSupports.map((s) => s.argumentId).filter((id) => !id.startsWith("virt:"))),
  );

  const [edges, derivAssumptions, uses, _negMaps] = await Promise.all([
    prisma.argumentEdge.findMany({
      where: { deliberationId, type: "support" as any, toArgumentId: { in: realArgIds } },
      select: { fromArgumentId: true, toArgumentId: true },
    }),
    prisma.derivationAssumption.findMany({
      where: { derivationId: { in: localSupports.map((s) => s.id) } },
      select: { derivationId: true, assumptionId: true, weight: true },
    }),
    prisma.assumptionUse.findMany({
      where: { argumentId: { in: realArgIds } },
      select: { id: true, argumentId: true, status: true, weight: true },
    }),
    mode === "ds"
      ? prisma.negationMap.findMany({
          where: { deliberationId },
          select: { claimId: true, negatedClaimId: true },
        })
      : Promise.resolve([] as Array<{ claimId: string; negatedClaimId: string }>),
  ]);

  const assumptionStatus = new Map<string, "PROPOSED" | "ACCEPTED" | "CHALLENGED" | "RETRACTED">();
  for (const u of uses) assumptionStatus.set(u.id, (u.status as any) ?? "PROPOSED");

  const legacyAssumptionsByArg = new Map<string, number[]>();
  for (const u of uses) {
    if (!u.argumentId) continue;
    const list = legacyAssumptionsByArg.get(u.argumentId) ?? [];
    list.push(clamp01(u.weight ?? 0.6));
    legacyAssumptionsByArg.set(u.argumentId, list);
  }

  const inputs: EvidentialInputs = {
    claims,
    concludingArgumentByClaim,
    localSupports: localSupports.map((s) => ({
      id: s.id,
      claimId: s.claimId,
      argumentId: s.argumentId,
      base: clamp01(s.base ?? DEFAULT_ARGUMENT_CONFIDENCE),
      isImported: (s.provenanceJson as any)?.kind === "import",
    })),
    virtualSupports,
    premiseEdges: edges,
    derivationAssumptions: derivAssumptions.map((da) => ({
      derivationId: da.derivationId,
      assumptionId: da.assumptionId,
      weight: clamp01(da.weight),
    })),
    assumptionStatus,
    legacyAssumptionsByArg,
    // NOTE: `negMaps` (DS negation pairs) is fetched for the `ds` branch but the
    // current `EvidentialInputs`/`evaluateEvidentialTyped` adapter folds DS
    // semantics into its `logodds` semiring and does not accept a negation map.
    defaultArgumentConfidence: DEFAULT_ARGUMENT_CONFIDENCE,
    defaultPremiseBase: DEFAULT_PREMISE_BASE,
  };

  const typed = evaluateEvidentialTyped(inputs, toAdapterMode(mode));

  // Cross-room band (Sprint C3/C4 parity).
  const supportBand: Record<string, { local: number; imported: number; total: number }> = {};
  if (includeMat && (mode === "min" || mode === "product")) {
    const snaps = await prisma.roomTransportSnapshot.findMany({
      where: { toRoomId: deliberationId },
      select: { payloadJson: true },
    });
    const importedByClaim = new Map<string, number[]>();
    for (const snap of snaps) {
      const payload = snap.payloadJson as TransportSnapshotPayload | null;
      if (!payload?.byClaim) continue;
      for (const [toClaimId, slot] of Object.entries(payload.byClaim)) {
        if (!slot?.sources?.length) continue;
        const list = importedByClaim.get(toClaimId) ?? [];
        for (const src of slot.sources) list.push(src.score);
        importedByClaim.set(toClaimId, list);
      }
    }
    for (const cId of claimIds) {
      const local = typed.support[cId] ?? 0;
      const importedScores = importedByClaim.get(cId) ?? [];
      const imported = reduceImportedScores(importedScores, mode);
      const total = combineLocalAndImported(local, imported, mode);
      supportBand[cId] = { local, imported, total };
    }
  }

  return NextResponse.json({
    ok: true,
    deliberationId,
    mode,
    imports,
    ...typed,
    ...(Object.keys(supportBand).length ? { supportBand } : {}),
  });
}
