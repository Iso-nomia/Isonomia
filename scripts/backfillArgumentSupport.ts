// scripts/backfillArgumentSupport.ts
import "dotenv/config";

import { prisma } from "@/lib/prisma-cli";
import { 
  DEFAULT_ARGUMENT_CONFIDENCE, 
  MIN_ARGUMENT_CONFIDENCE, 
  MAX_BACKFILL_CONFIDENCE 
} from "@/lib/config/confidence";

/** Base confidence: start from argument.confidence (0..1) or DEFAULT_ARGUMENT_CONFIDENCE; lift by approvals; cap MAX_BACKFILL_CONFIDENCE. */
function computeBase(conf?: number|null, approvals = 0) {
  const start = conf == null ? DEFAULT_ARGUMENT_CONFIDENCE : Math.max(MIN_ARGUMENT_CONFIDENCE, Math.min(1, conf));
  const lift  = Math.log1p(approvals) * 0.08;   // ~ +0.08..0.20 typical
  return Math.min(MAX_BACKFILL_CONFIDENCE, +(start + lift).toFixed(3));
}

async function main() {
  const args = await prisma.argument.findMany({
    where: { claimId: { not: null } },
    select: { id:true, deliberationId:true, claimId:true, confidence:true }
  });
  if (!args.length) {
    console.log('No arguments with claimId found — nothing to backfill.');
    return;
  }

  const approvals = await prisma.argumentApproval.groupBy({
    by: ['argumentId'],
    _count: { argumentId: true },
    where: { argumentId: { in: args.map(a => a.id) } }
  }).catch(() => [] as any[]);

  const countBy = new Map<string, number>(approvals.map(r => [r.argumentId, r._count.argumentId as number]));

  let created = 0, updated = 0;
  for (const a of args) {
    const base = computeBase(a.confidence as number | undefined, countBy.get(a.id) ?? 0);

    // One logical row per (φ, a, mode). We snapshot to `product` (your default).
const where = {
  arg_support_unique: {
    claimId: a.claimId!,
    argumentId: a.id,
    mode: "product" as const
  }
} as const;

    const res = await prisma.argumentSupport.upsert({
      where,
      update: { base, strength: base, composed: false },
      create: {
        deliberationId: a.deliberationId,
        claimId:        a.claimId!,
        argumentId:     a.id,
        mode:           "product",
        base,
        strength:       base,
        composed:       false,
      },
      select: { id: true }
    });

    // Heuristic count: crude but useful
    if (res) {
      // If the row existed, Prisma returns id; we can’t tell updated vs created without a pre-check,
      // but usually you don’t need exact counts. If you do, swap back to find+branch.
    }
  }

  console.log('ArgumentSupport backfill done.');
}

main().catch(e => { console.error(e); process.exit(1); });


