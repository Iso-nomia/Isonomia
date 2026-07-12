// scripts/audits/test-phase4-close-gate.ts
//
// Phase 4 / Spec 3 §6 — integration smoke for the close-hook in all
// three modes (off | warn | block). Creates an ephemeral
// SchemeInstance against an existing scheme that has CQs, runs the
// close in each mode, asserts the expected outcome, and cleans up.
//
// Run:
//   npx tsx --env-file=.env scripts/audits/test-phase4-close-gate.ts
// Exit code:
//   0 on full pass, 1 on any failure.

import { prisma } from "@/lib/prismaclient";
import { closeSchemeInstance } from "@/lib/schemes/protocol/closeInstance";
import { recordObligationTransition } from "@/lib/schemes/protocol/protocolState";
import { SoundnessViolationError } from "@/lib/schemes/protocol/soundnessGate";

const TEST_USER = "phase4-smoke-user";
let failed = 0;

function ok(label: string) {
  console.log(`  ✓ ${label}`);
}
function fail(label: string, detail?: unknown) {
  failed += 1;
  console.error(`  ✗ ${label}`);
  if (detail !== undefined) console.error(`    ${String(detail)}`);
}

async function pickSchemeWithCqs() {
  const scheme = await prisma.argumentScheme.findFirst({
    where: { kind: "argument-scheme", cqs: { some: { instanceId: null } } },
    select: { id: true, key: true, cqs: { where: { instanceId: null }, select: { cqKey: true } } },
  });
  if (!scheme) throw new Error("no scheme with catalogue CQs found");
  return scheme;
}

async function createEphemeralInstance(schemeId: string) {
  // Pick any existing claim as the target (we don't actually deliberate over it).
  const claim = await prisma.claim.findFirst({ select: { id: true } });
  if (!claim) throw new Error("no claim available for test target");
  const inst = await prisma.schemeInstance.create({
    data: {
      targetType: "claim",
      targetId: claim.id,
      schemeId,
      data: { __phase4_smoke: true },
      createdById: TEST_USER,
    },
  });
  return inst;
}

async function cleanup(instanceId: string) {
  await prisma.schemeInstanceSoundnessWarning
    .deleteMany({ where: { instanceId } })
    .catch(() => {});
  await prisma.cqObligationRecord
    .deleteMany({ where: { instanceId } })
    .catch(() => {});
  await prisma.schemeInstance.delete({ where: { id: instanceId } }).catch(() => {});
}

async function main() {
  const scheme = await pickSchemeWithCqs();
  console.log(`using scheme ${scheme.key} (${scheme.cqs.length} CQs)`);

  // --- Case 1: mode='off' closes unconditionally
  {
    const inst = await createEphemeralInstance(scheme.id);
    try {
      const r = await closeSchemeInstance(inst.id, {
        closedById: TEST_USER,
        modeOverride: "off",
      });
      if (r.status === "closed" && r.warningId === null && r.verdict.ok) ok("mode=off closes without gate");
      else fail("mode=off should close cleanly", JSON.stringify(r));
    } catch (e) {
      fail("mode=off threw unexpectedly", e);
    } finally {
      await cleanup(inst.id);
    }
  }

  // --- Case 2: mode='warn' with undischarged CQs -> closes + logs warning
  {
    const inst = await createEphemeralInstance(scheme.id);
    try {
      const r = await closeSchemeInstance(inst.id, {
        closedById: TEST_USER,
        modeOverride: "warn",
      });
      if (r.status === "closed" && r.warningId && !r.verdict.ok) {
        ok("mode=warn with undischarged CQs closes + logs warning");
      } else {
        fail("mode=warn should close with warning row", JSON.stringify(r));
      }
      const wcount = await prisma.schemeInstanceSoundnessWarning.count({
        where: { instanceId: inst.id },
      });
      if (wcount === 1) ok("warning row persisted");
      else fail(`expected 1 warning row, got ${wcount}`);
    } catch (e) {
      fail("mode=warn threw unexpectedly", e);
    } finally {
      await cleanup(inst.id);
    }
  }

  // --- Case 3: mode='block' with undischarged CQs -> throws, status untouched
  {
    const inst = await createEphemeralInstance(scheme.id);
    try {
      await closeSchemeInstance(inst.id, {
        closedById: TEST_USER,
        modeOverride: "block",
      });
      fail("mode=block should have thrown SoundnessViolationError");
    } catch (e) {
      if (e instanceof SoundnessViolationError && e.reasons.length > 0) {
        ok(`mode=block blocks with ${e.reasons.length} violation(s)`);
      } else {
        fail("wrong error type", e);
      }
      const row = await prisma.schemeInstance.findUnique({ where: { id: inst.id } });
      if (row?.status === "open") ok("instance status stayed 'open' on block");
      else fail(`expected status='open', got '${row?.status}'`);
    } finally {
      await cleanup(inst.id);
    }
  }

  // --- Case 4: discharge every CQ -> block mode passes
  {
    const inst = await createEphemeralInstance(scheme.id);
    try {
      // ensureObligationRowsForInstance fires implicitly via close; do it
      // explicitly here by running a no-op close in off mode... or
      // just transition each. Skip the lazy create + drive via the
      // transition helper directly:
      for (const cq of scheme.cqs) {
        // not-offered -> offered-open -> discharged
        await recordObligationTransition(inst.id, cq.cqKey, { to: "offered-open", moveId: "m1" });
        await recordObligationTransition(inst.id, cq.cqKey, { to: "discharged", moveId: "m2" });
      }
      const r = await closeSchemeInstance(inst.id, {
        closedById: TEST_USER,
        modeOverride: "block",
      });
      if (r.status === "closed" && r.verdict.ok && r.warningId === null) {
        ok(`mode=block passes when all ${scheme.cqs.length} CQs discharged`);
      } else {
        fail("mode=block all-discharged should pass cleanly", JSON.stringify(r));
      }
    } catch (e) {
      fail("mode=block all-discharged threw unexpectedly", e);
    } finally {
      await cleanup(inst.id);
    }
  }

  console.log(`---`);
  if (failed === 0) {
    console.log(`=== PASS — phase 4 close-gate integration green ===`);
  } else {
    console.error(`=== FAIL — ${failed} assertion(s) failed ===`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
