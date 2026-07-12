// __tests__/lib/schemes/protocol/soundnessGate.test.ts
//
// Phase 4 / Spec 3 §3.3 — gate decision-rule tests. Pure module, no
// DB; runs under jest's global @/lib/prismaclient mock.

import {
  autoWaiveAssumptions,
  checkSoundnessOnClose,
  summariseFailure,
  SoundnessViolationError,
} from "@/lib/schemes/protocol/soundnessGate";
import type {
  CqObligationRecord,
  SchemeInstanceProtocolState,
} from "@/lib/schemes/protocol/protocolState";

function ob(partial: Partial<CqObligationRecord>): CqObligationRecord {
  return {
    cqKey: "CQ1",
    status: "not-offered",
    burdenOfProof: "PROPONENT",
    requiresEvidence: false,
    premiseType: null,
    subLocusId: null,
    closingMoveId: null,
    evidenceRefs: [],
    ...partial,
  };
}

function state(obligations: CqObligationRecord[]): SchemeInstanceProtocolState {
  return { instanceId: "inst1", schemeId: "scheme1", obligations };
}

describe("checkSoundnessOnClose", () => {
  it("returns ok for an empty bundle (no CQs)", () => {
    expect(checkSoundnessOnClose(state([]))).toEqual({ ok: true, waived: [] });
  });

  it("returns ok when every obligation is in a closing status", () => {
    const v = checkSoundnessOnClose(
      state([
        ob({ cqKey: "a", status: "discharged" }),
        ob({ cqKey: "b", status: "waived" }),
        ob({ cqKey: "c", status: "failed" }),
      ])
    );
    expect(v.ok).toBe(true);
  });

  it("flags every not-offered / offered-* obligation as undischarged", () => {
    const v = checkSoundnessOnClose(
      state([
        ob({ cqKey: "a", status: "not-offered" }),
        ob({ cqKey: "b", status: "offered-open" }),
        ob({ cqKey: "c", status: "offered-engaged" }),
        ob({ cqKey: "d", status: "discharged" }),
      ])
    );
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.reasons).toHaveLength(3);
    expect(v.reasons.map((r) => r.kind)).toEqual([
      "undischarged-obligation",
      "undischarged-obligation",
      "undischarged-obligation",
    ]);
  });

  it("auto-waives ASSUMPTION premises and reports them as waived", () => {
    const v = checkSoundnessOnClose(
      state([
        ob({ cqKey: "a", status: "not-offered", premiseType: "ASSUMPTION" }),
        ob({ cqKey: "b", status: "discharged" }),
      ])
    );
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.waived).toEqual(["a"]);
  });

  it("does NOT auto-waive ORDINARY or EXCEPTION premises", () => {
    const v = checkSoundnessOnClose(
      state([
        ob({ cqKey: "a", status: "not-offered", premiseType: "ORDINARY" }),
        ob({ cqKey: "b", status: "not-offered", premiseType: "EXCEPTION" }),
      ])
    );
    expect(v.ok).toBe(false);
    if (v.ok) return;
    // EXCEPTION not-offered registers as undischarged (status check
    // runs before the exception-not-established check)
    expect(v.reasons.map((r) => r.cqKey).sort()).toEqual(["a", "b"]);
  });

  it("flags EXCEPTION premises that ended up `waived`", () => {
    // Inject a manually-waived EXCEPTION (bypassing auto-waive, which
    // only fires for ASSUMPTION). Carneades requires exceptions to be
    // adjudicated, not waived.
    const v = checkSoundnessOnClose(
      state([ob({ cqKey: "x", status: "waived", premiseType: "EXCEPTION" })])
    );
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.reasons[0]).toEqual({
      kind: "exception-not-established",
      cqKey: "x",
    });
  });

  it("accepts EXCEPTION premises when `failed` (= exception not established)", () => {
    const v = checkSoundnessOnClose(
      state([ob({ cqKey: "x", status: "failed", premiseType: "EXCEPTION" })])
    );
    expect(v.ok).toBe(true);
  });

  it("flags missing-evidence on discharge when requiresEvidence=true", () => {
    const v = checkSoundnessOnClose(
      state([
        ob({
          cqKey: "evidence-cq",
          status: "discharged",
          requiresEvidence: true,
          evidenceRefs: [],
        }),
      ])
    );
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.reasons[0]).toEqual({
      kind: "missing-evidence",
      cqKey: "evidence-cq",
    });
  });

  it("passes when requiresEvidence is satisfied", () => {
    const v = checkSoundnessOnClose(
      state([
        ob({
          cqKey: "evidence-cq",
          status: "discharged",
          requiresEvidence: true,
          evidenceRefs: ["src://doi/10.1000/foo"],
        }),
      ])
    );
    expect(v.ok).toBe(true);
  });

  it("aggregates multiple failures and preserves order", () => {
    const v = checkSoundnessOnClose(
      state([
        ob({ cqKey: "a", status: "not-offered" }),
        ob({
          cqKey: "b",
          status: "discharged",
          requiresEvidence: true,
          evidenceRefs: [],
        }),
      ])
    );
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.reasons.map((r) => r.kind)).toEqual([
      "undischarged-obligation",
      "missing-evidence",
    ]);
  });
});

describe("autoWaiveAssumptions", () => {
  it("only touches not-offered + ASSUMPTION rows", () => {
    const out = autoWaiveAssumptions([
      ob({ cqKey: "a", status: "not-offered", premiseType: "ASSUMPTION" }),
      ob({ cqKey: "b", status: "not-offered", premiseType: "ORDINARY" }),
      ob({ cqKey: "c", status: "offered-open", premiseType: "ASSUMPTION" }),
      ob({ cqKey: "d", status: "discharged", premiseType: "ASSUMPTION" }),
    ]);
    expect(out.map((o) => o.status)).toEqual([
      "waived",
      "not-offered",
      "offered-open",
      "discharged",
    ]);
  });
});

describe("SoundnessViolationError + summariseFailure", () => {
  it("renders a human-readable message including each reason", () => {
    const err = new SoundnessViolationError([
      { kind: "undischarged-obligation", cqKey: "alpha", status: "offered-open" },
      { kind: "missing-evidence", cqKey: "beta" },
    ]);
    expect(err.message).toContain("alpha");
    expect(err.message).toContain("beta");
    expect(err.reasons).toHaveLength(2);
  });

  it("summariseFailure covers all kinds", () => {
    expect(
      summariseFailure({
        kind: "design-outside-behaviour",
        details: "x",
      })
    ).toContain("outside the scheme's behaviour");
  });
});
