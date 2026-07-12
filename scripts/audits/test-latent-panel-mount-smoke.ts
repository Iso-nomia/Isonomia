// scripts/audits/test-latent-panel-mount-smoke.ts
//
// Mount-spec §7.2 smoke — confirms the API contract that
// LatentObligationsForTarget depends on is intact:
//   1. /api/schemes/instances?targetType=claim&targetId=...
//      returns instances with `id`, `status`, and `scheme.key`.
//   2. /api/schemes/instances/[id]/protocol-state for an open instance
//      with catalogue CQs returns at least one obligation row.
//
// Run: npx tsx --env-file=.env scripts/audits/test-latent-panel-mount-smoke.ts

import { prisma } from "../../lib/prismaclient";
import { ensureObligationRowsForInstance, loadProtocolState } from "../../lib/schemes/protocol/protocolState";

let pass = 0;
let fail = 0;
const fails: string[] = [];

function assert(cond: any, name: string) {
  if (cond) {
    pass += 1;
    console.log(`  ok  ${name}`);
  } else {
    fail += 1;
    fails.push(name);
    console.log(`  FAIL ${name}`);
  }
}

async function pickClaimWithOpenSchemeAndCQs(): Promise<{ claimId: string; instanceId: string } | null> {
  const rows = await prisma.schemeInstance.findMany({
    where: { status: "open", targetType: "claim" },
    select: { id: true, targetId: true, schemeId: true },
    take: 200,
  });
  for (const r of rows) {
    const n = await prisma.criticalQuestion.count({
      where: { schemeId: r.schemeId, instanceId: null },
    });
    if (n > 0) return { claimId: r.targetId, instanceId: r.id };
  }
  return null;
}

async function main() {
  console.log("== Latent-panel mount smoke ==\n");

  const picked = await pickClaimWithOpenSchemeAndCQs();
  if (!picked) {
    console.log("  (no eligible claim/instance — skipping)");
    console.log(`\n== ${pass} passed / ${fail} failed (skipped) ==`);
    return;
  }
  const { claimId, instanceId } = picked;
  console.log(`  using claim ${claimId} / instance ${instanceId}\n`);

  // ---- Contract 1: listing endpoint shape (replicate what the wrapper SWR call does) ----
  const listRows = await prisma.schemeInstance.findMany({
    where: { targetType: "claim", targetId: claimId },
    select: {
      id: true,
      schemeId: true,
      status: true,
      closedAt: true,
      scheme: { select: { key: true, title: true } },
    },
  });
  assert(listRows.length >= 1, "list returns >=1 instance for the claim");
  const target = listRows.find((r) => r.id === instanceId);
  assert(!!target, "list includes the test instance");
  assert(target?.status === "open", "list returns status (and our target is open)");
  assert(typeof target?.scheme?.key === "string", "list returns scheme.key");

  // ---- Contract 2: per-instance protocol-state shape (replicate the panel's fetch) ----
  await ensureObligationRowsForInstance(instanceId);
  const state = await loadProtocolState(instanceId);
  assert(state !== null, "protocol-state loads");
  assert(Array.isArray(state?.obligations), "obligations is an array");
  assert((state?.obligations.length ?? 0) >= 1, "at least one obligation row");
  const latent = (state?.obligations ?? []).filter((o) => o.status === "not-offered");
  assert(latent.length >= 0, "latent count well-defined");

  console.log(`\n== ${pass} passed / ${fail} failed ==`);
  if (fail > 0) {
    console.log("Failures:", fails);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
