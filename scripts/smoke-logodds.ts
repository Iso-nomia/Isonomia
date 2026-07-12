// scripts/smoke-logodds.ts
//
// Phase 3 live smoke test for the confidence-algebra migration. Pulls real
// deliberation data from the DB the same way
// `app/api/deliberations/[id]/evidential/route.ts` gathers it, then runs the
// actual `evaluateEvidentialTyped` adapter in both `product` and `logodds`
// modes and prints a per-claim comparison. No HTTP server required.
//
// Usage:
//   tsx --env-file=.env scripts/smoke-logodds.ts [deliberationId]
// If no id is given, auto-picks a deliberation whose claims have ≥2 support
// rows (the case where the two algebras actually diverge).

import { prisma } from "../lib/prismaclient";
import { DEFAULT_ARGUMENT_CONFIDENCE, DEFAULT_PREMISE_BASE } from "../lib/config/confidence";
import {
  evaluateEvidentialTyped,
  type EvidentialInputs,
  type Mode,
} from "../lib/argumentation/eccAdapter";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

async function pickDeliberation(): Promise<string | null> {
  // Find a deliberation with a claim that has ≥2 support rows (aggregate in JS
  // to avoid groupBy/having edge cases across Prisma versions).
  const rows = await prisma.argumentSupport.findMany({
    select: { deliberationId: true, claimId: true },
    take: 20000,
  });
  // Count rows per (deliberation, claim), then count divergent claims per delib.
  const perClaim = new Map<string, number>();
  for (const r of rows) {
    if (!r.deliberationId) continue;
    perClaim.set(`${r.deliberationId}\u0000${r.claimId}`, (perClaim.get(`${r.deliberationId}\u0000${r.claimId}`) ?? 0) + 1);
  }
  const byDelib = new Map<string, number>();
  for (const [key, n] of perClaim) {
    if (n < 2) continue;
    const delib = key.split("\u0000")[0];
    byDelib.set(delib, (byDelib.get(delib) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [d, n] of byDelib) if (n > bestN) { best = d; bestN = n; }
  return best;
}

async function gatherInputs(deliberationId: string): Promise<EvidentialInputs> {
  const claims = await prisma.claim.findMany({
    where: { deliberationId },
    select: { id: true, text: true },
  });
  const claimIds = claims.map((c) => c.id);

  const conclusions = await prisma.argument.findMany({
    where: { deliberationId, claimId: { in: claimIds } },
    select: { id: true, claimId: true },
  });
  const concludingArgumentByClaim = new Map<string, string>(
    conclusions.map((a) => [a.claimId!, a.id])
  );

  const base = await prisma.argumentSupport.findMany({
    where: { deliberationId, claimId: { in: claimIds } },
    select: { id: true, claimId: true, argumentId: true, base: true, provenanceJson: true },
  });
  const localSupports = base.map((s) => ({
    id: s.id,
    claimId: s.claimId,
    argumentId: s.argumentId,
    base: clamp01(s.base ?? DEFAULT_ARGUMENT_CONFIDENCE),
    isImported: (s.provenanceJson as any)?.kind === "import",
  }));

  const realArgIds = Array.from(
    new Set(localSupports.map((s) => s.argumentId).filter((id) => !id.startsWith("virt:")))
  );

  const edges = await prisma.argumentEdge.findMany({
    where: { deliberationId, type: "support" as any, toArgumentId: { in: realArgIds } },
    select: { fromArgumentId: true, toArgumentId: true },
  });

  const derivations = await prisma.argumentSupport.findMany({
    where: { argumentId: { in: realArgIds } },
    select: { id: true },
  });
  const derivIds = derivations.map((d) => d.id);
  const derivAssumptions = await prisma.derivationAssumption.findMany({
    where: { derivationId: { in: derivIds } },
  });

  const legacyUses = await prisma.assumptionUse
    .findMany({ where: { argumentId: { in: realArgIds } }, select: { argumentId: true, weight: true } })
    .catch(() => [] as Array<{ argumentId: string; weight: number | null }>);
  const legacyAssumptionsByArg = new Map<string, number[]>();
  for (const u of legacyUses) {
    const list = legacyAssumptionsByArg.get(u.argumentId) ?? [];
    list.push(clamp01(u.weight ?? 0.6));
    legacyAssumptionsByArg.set(u.argumentId, list);
  }

  return {
    claims,
    concludingArgumentByClaim,
    localSupports,
    virtualSupports: [],
    premiseEdges: edges.map((e) => ({ fromArgumentId: e.fromArgumentId, toArgumentId: e.toArgumentId })),
    derivationAssumptions: derivAssumptions.map((da) => ({
      derivationId: da.derivationId,
      assumptionId: da.assumptionId,
      weight: clamp01(da.weight),
    })),
    assumptionStatus: new Map(),
    legacyAssumptionsByArg,
    defaultArgumentConfidence: DEFAULT_ARGUMENT_CONFIDENCE,
    defaultPremiseBase: DEFAULT_PREMISE_BASE,
  };
}

async function main() {
  const arg = process.argv[2];
  const deliberationId = arg ?? (await pickDeliberation());
  if (!deliberationId) {
    console.error("No deliberation with ≥2 support rows on a claim found. Pass an id explicitly.");
    process.exit(1);
  }
  console.log(`\nDeliberation: ${deliberationId}\n`);

  const inputs = await gatherInputs(deliberationId);
  const product = evaluateEvidentialTyped(inputs, "product" as Mode).support;
  const logodds = evaluateEvidentialTyped(inputs, "logodds" as Mode).support;

  // Count support rows per claim so we can flag the divergent (≥2) ones.
  const nByClaim = new Map<string, number>();
  for (const s of inputs.localSupports) nByClaim.set(s.claimId, (nByClaim.get(s.claimId) ?? 0) + 1);

  const claimText = new Map(inputs.claims.map((c) => [c.id, c.text]));
  const ids = inputs.claims.map((c) => c.id).filter((id) => product[id] != null || logodds[id] != null);

  console.log("claim".padEnd(26), "n", "product", "logodds", "delta", "text");
  console.log("-".repeat(90));
  let maxDelta = 0;
  for (const id of ids.sort((a, b) =>
    Math.abs((logodds[b] ?? 0) - (product[b] ?? 0)) - Math.abs((logodds[a] ?? 0) - (product[a] ?? 0))
  )) {
    const p = product[id] ?? 0;
    const l = logodds[id] ?? 0;
    const d = l - p;
    maxDelta = Math.max(maxDelta, Math.abs(d));
    const n = nByClaim.get(id) ?? 0;
    const txt = (claimText.get(id) ?? "").slice(0, 40).replace(/\s+/g, " ");
    console.log(
      id.slice(0, 24).padEnd(26),
      String(n).padStart(1),
      p.toFixed(4).padStart(7),
      l.toFixed(4).padStart(7),
      (d >= 0 ? "+" : "") + d.toFixed(4),
      " ",
      txt
    );
  }
  console.log("-".repeat(90));
  console.log(`claims: ${ids.length}   max |delta|: ${maxDelta.toFixed(4)}`);
  console.log(
    "(single-support claims should show delta 0; divergence only on n≥2 corroboration)\n"
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
