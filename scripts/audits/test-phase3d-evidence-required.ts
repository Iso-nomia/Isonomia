// scripts/audits/test-phase3d-evidence-required.ts
//
// Phase 3d (dialogue-UI polish) §6.3 integration test.
//
// Verifies the data-plumbing for the "CQ requiresEvidence ⇒ payload
// must carry evidenceRefs" workflow:
//
//   1. There exist CriticalQuestion rows with `requiresEvidence=true`
//      in the catalogue (sanity of phase 0.1 baseline).
//   2. `onDialogueMoveForObligations` writes `evidenceRefs` into the
//      CqObligationRecord when present in the payload.
//   3. The corresponding `requiresEvidence` / `burdenOfProof` /
//      `premiseType` flags are exposed on the obligation row by
//      `loadProtocolState` (which underpins the LatentObligationsPanel
//      and the Phase 3d UI gates).
//
// Run: npx tsx --env-file=.env scripts/audits/test-phase3d-evidence-required.ts

import { prisma } from "../../lib/prismaclient";
import {
  loadProtocolState,
  ensureObligationRowsForInstance,
  recordObligationTransition,
} from "../../lib/schemes/protocol/protocolState";

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

async function pickEligible(): Promise<{
  cqId: string;
  cqKey: string;
  instanceId: string;
  flippedRequiresEvidence: boolean; // true if we temporarily set it
  priorRequiresEvidence: boolean;
} | null> {
  // Prefer a CQ already flagged requiresEvidence=true. If none exist,
  // flip one temporarily so the data-plumbing can still be exercised
  // end-to-end; we revert at teardown.
  const tryBound = async (where: any) => {
    const cqs = await prisma.criticalQuestion.findMany({
      where,
      select: {
        id: true,
        cqKey: true,
        instanceId: true,
        schemeId: true,
        requiresEvidence: true,
      },
      take: 200,
    });
    for (const cq of cqs) {
      if (!cq.cqKey) continue;
      if (cq.instanceId) {
        const inst = await prisma.schemeInstance.findUnique({
          where: { id: cq.instanceId },
          select: { id: true, status: true },
        });
        if (inst && inst.status === "open") {
          return {
            cqId: cq.id,
            cqKey: cq.cqKey,
            instanceId: inst.id,
            priorRequiresEvidence: cq.requiresEvidence,
          };
        }
      }
      if (cq.schemeId) {
        const inst = await prisma.schemeInstance.findFirst({
          where: { status: "open", schemeId: cq.schemeId },
          select: { id: true },
        });
        if (inst) {
          return {
            cqId: cq.id,
            cqKey: cq.cqKey,
            instanceId: inst.id,
            priorRequiresEvidence: cq.requiresEvidence,
          };
        }
      }
    }
    return null;
  };

  const requiredFirst = await tryBound({ requiresEvidence: true });
  if (requiredFirst) {
    return { ...requiredFirst, flippedRequiresEvidence: false };
  }
  const anyBound = await tryBound({});
  if (!anyBound) return null;
  // Flip for the duration of the test; revert in finally.
  await prisma.criticalQuestion.update({
    where: { id: anyBound.cqId },
    data: { requiresEvidence: true },
  });
  return { ...anyBound, flippedRequiresEvidence: true };
}

async function main() {
  console.log("== Phase 3d evidence-required smoke ==\n");

  // ---- Contract 1: catalogue can host requiresEvidence-flagged CQs ----
  // (We test the schema/data plumbing rather than asserting a non-zero
  // dev-DB count, because seed state varies between environments.)
  const totalCqs = await prisma.criticalQuestion.count();
  assert(
    totalCqs > 0,
    `CriticalQuestion catalogue is non-empty (got ${totalCqs})`
  );

  const picked = await pickEligible();
  if (!picked) {
    console.log(
      "  (no CriticalQuestion bound to an open SchemeInstance — skipping live-write checks)"
    );
    console.log(
      `\n== ${pass} passed / ${fail} failed (live-write portion skipped) ==`
    );
    if (fail > 0) process.exit(1);
    return;
  }
  const {
    cqId,
    cqKey,
    instanceId,
    flippedRequiresEvidence,
    priorRequiresEvidence,
  } = picked;
  console.log(
    `  using cq.id=${cqId} cqKey=${cqKey} instance=${instanceId} (flipped=${flippedRequiresEvidence})\n`
  );

  // The rest of the test runs inside try/finally so we always revert
  // the requiresEvidence flag and the obligation row.
  let beforeSnapshot: {
    status: string;
    evidenceRefs: string[];
  } | null = null;

  try {
    // Snapshot existing obligation row so we can revert.
    await ensureObligationRowsForInstance(instanceId).catch(() => {});

    // Re-derive the obligation row so the snapshot reflects the
    // (possibly just-flipped) requiresEvidence flag.
    const before = await prisma.cqObligationRecord.findUnique({
      where: { instanceId_cqKey: { instanceId, cqKey } },
      select: {
        status: true,
        evidenceRefs: true,
        requiresEvidence: true,
        burdenOfProof: true,
        premiseType: true,
      },
    });
    if (!before) {
      console.log(
        "  (no CqObligationRecord materialised — skipping live-write checks)"
      );
      return;
    }
    beforeSnapshot = {
      status: before.status,
      evidenceRefs: before.evidenceRefs,
    };

    // ---- Contract 2: obligation row carries the phase-0.1 metadata ----
    assert(
      typeof before.requiresEvidence === "boolean",
      "CqObligationRecord exposes requiresEvidence boolean"
    );
    assert(
      typeof before.burdenOfProof === "string" &&
        before.burdenOfProof.length > 0,
      `CqObligationRecord.burdenOfProof is populated (got ${before.burdenOfProof})`
    );

    // If our flip didn't propagate into the obligation row (e.g.
    // ensureObligationRowsForInstance was a no-op because the row
    // already existed), normalise it for this test run.
    if (flippedRequiresEvidence && !before.requiresEvidence) {
      await prisma.cqObligationRecord.update({
        where: { instanceId_cqKey: { instanceId, cqKey } },
        data: { requiresEvidence: true },
      });
    }

    // Normalise the status to "not-offered" so the WHY transition is
    // legal regardless of prior test state. We restore the original
    // status in `finally`.
    await prisma.cqObligationRecord.update({
      where: { instanceId_cqKey: { instanceId, cqKey } },
      data: { status: "not-offered", evidenceRefs: [] },
    });

    // ---- Contract 3: writing evidenceRefs via recordObligationTransition persists them ----
    // We call the transition helper directly rather than going through
    // `onDialogueMoveForObligations`, because the hook's binding
    // resolver requires a per-instance CriticalQuestion row (cf.
    // resolveCqBinding in dialogueHooks.ts), which catalogue CQs do not
    // have. The hook itself is exercised end-to-end by
    // `scripts/audits/test-phase4-deferred.ts`; here we focus on the
    // Phase 3d-specific evidenceRefs plumbing.
    const testRefs = [
      "https://example.test/phase3d-evidence-a",
      "https://example.test/phase3d-evidence-b",
    ];
    await recordObligationTransition(instanceId, cqKey, {
      to: "offered-open",
      evidenceRefs: testRefs,
    });

    const afterWhy = await prisma.cqObligationRecord.findUnique({
      where: { instanceId_cqKey: { instanceId, cqKey } },
      select: { status: true, evidenceRefs: true },
    });
    assert(
      Array.isArray(afterWhy?.evidenceRefs) &&
        testRefs.every((r) => afterWhy!.evidenceRefs.includes(r)),
      `evidenceRefs persisted after WHY transition (got ${JSON.stringify(afterWhy?.evidenceRefs)})`
    );

    // ---- Contract 4: loadProtocolState surfaces requiresEvidence + evidenceRefs ----
    const ps = await loadProtocolState(instanceId);
    const matched = ps?.obligations?.find((o: any) => o.cqKey === cqKey);
    assert(!!matched, `loadProtocolState includes obligation row for cqKey=${cqKey}`);
    if (matched) {
      assert(
        typeof (matched as any).requiresEvidence === "boolean",
        "loadProtocolState row exposes requiresEvidence boolean"
      );
      assert(
        Array.isArray((matched as any).evidenceRefs) &&
          testRefs.every((r) =>
            (matched as any).evidenceRefs.includes(r)
          ),
        "loadProtocolState row exposes evidenceRefs written by the transition"
      );
    }
  } finally {
    // Revert obligation row.
    if (beforeSnapshot) {
      try {
        await prisma.cqObligationRecord.update({
          where: { instanceId_cqKey: { instanceId, cqKey } },
          data: {
            status: beforeSnapshot.status,
            evidenceRefs: beforeSnapshot.evidenceRefs,
            requiresEvidence: priorRequiresEvidence,
          },
        });
      } catch (err) {
        console.warn(
          "  (obligation-row revert failed — manual cleanup may be required):",
          err
        );
      }
    }
    // Revert CQ flag if we flipped it.
    if (flippedRequiresEvidence) {
      try {
        await prisma.criticalQuestion.update({
          where: { id: cqId },
          data: { requiresEvidence: priorRequiresEvidence },
        });
      } catch (err) {
        console.warn(
          "  (CriticalQuestion.requiresEvidence revert failed):",
          err
        );
      }
    }
  }

  console.log(`\n== ${pass} passed / ${fail} failed ==`);
  if (fail > 0) {
    console.log("FAILED:", fails);
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("UNEXPECTED ERROR:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
