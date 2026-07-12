// lib/schemes/protocol/closeInstance.ts
//
// Phase 4 / Spec 3 §3.4 — the single place that transitions a
// SchemeInstance to a terminal status. Used by:
//   - POST /api/schemes/instances/[id]/close  (direct/test surface)
//   - deliberation-close iteration              (production surface)
//
// Behaviour is governed by MESH_SCHEME_SOUNDNESS_MODE:
//   off:   no gate; status -> "closed" unconditionally
//   warn:  run gate; on failure log SchemeInstanceSoundnessWarning,
//          proceed with status -> "closed"
//   block: run gate; on failure throw SoundnessViolationError,
//          status untouched

import { prisma } from "@/lib/prismaclient";
import {
  ensureObligationRowsForInstance,
  loadProtocolState,
} from "./protocolState";
import {
  checkSoundnessOnClose,
  SoundnessViolationError,
  type SoundnessVerdict,
} from "./soundnessGate";
import { getSoundnessMode, type SoundnessMode } from "./soundnessMode";

export type CloseSchemeInstanceResult = {
  instanceId: string;
  mode: SoundnessMode;
  verdict: SoundnessVerdict;
  status: "open" | "closed" | "failed";
  warningId: string | null;
};

export type CloseSchemeInstanceOptions = {
  closedById: string;
  /** Override the feature flag for this call (tests / admin force-close). */
  modeOverride?: SoundnessMode;
};

export async function closeSchemeInstance(
  instanceId: string,
  opts: CloseSchemeInstanceOptions
): Promise<CloseSchemeInstanceResult> {
  const mode = opts.modeOverride ?? getSoundnessMode();

  // Make sure the obligation rows exist so the gate sees the full
  // bundle (handles instances created before Phase 4 rollout).
  await ensureObligationRowsForInstance(instanceId);

  const state = await loadProtocolState(instanceId);
  const verdict: SoundnessVerdict =
    mode === "off"
      ? { ok: true, waived: [] }
      : checkSoundnessOnClose(state);

  if (!verdict.ok) {
    if (mode === "block") {
      throw new SoundnessViolationError(verdict.reasons);
    }
    // warn mode: log + proceed
    const warn = await prisma.schemeInstanceSoundnessWarning.create({
      data: {
        instanceId,
        reason: { reasons: verdict.reasons, waived: verdict.waived } as object,
      },
      select: { id: true },
    });
    const updated = await prisma.schemeInstance.update({
      where: { id: instanceId },
      data: {
        status: "closed",
        closedAt: new Date(),
        closedById: opts.closedById,
      },
      select: { status: true },
    });
    return {
      instanceId,
      mode,
      verdict,
      status: updated.status as "closed",
      warningId: warn.id,
    };
  }

  const updated = await prisma.schemeInstance.update({
    where: { id: instanceId },
    data: {
      status: "closed",
      closedAt: new Date(),
      closedById: opts.closedById,
    },
    select: { status: true },
  });
  return {
    instanceId,
    mode,
    verdict,
    status: updated.status as "closed",
    warningId: null,
  };
}
