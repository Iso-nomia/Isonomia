import {
  validateSchemePresentation,
  type DraftCq,
  type ParentSchemeShape,
  type SchemeDraft,
} from "@/lib/schemes/validation/validatePresentation";

function cq(over: Partial<DraftCq> = {}): DraftCq {
  return {
    cqKey: "cq_1",
    text: "Is the premise true?",
    attackType: "UNDERCUTS",
    targetScope: "inference",
    ...over,
  };
}

function draft(over: Partial<SchemeDraft> = {}): SchemeDraft {
  return {
    key: "child_scheme",
    parentSchemeId: null,
    cqs: [cq()],
    ...over,
  };
}

function parent(over: Partial<ParentSchemeShape> = {}): ParentSchemeShape {
  return {
    id: "parent-id",
    key: "parent_scheme",
    cqs: [],
    ...over,
  };
}

describe("validateSchemePresentation — WF2 (non-vacuity)", () => {
  it("rejects empty CQ bundle", () => {
    const result = validateSchemePresentation(draft({ cqs: [] }), { parentScheme: null });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.rule)).toContain("WF2-empty");
  });

  it("rejects bundle where every CQ has no targetScope", () => {
    const result = validateSchemePresentation(
      draft({ cqs: [cq({ targetScope: null }), cq({ cqKey: "cq_2", targetScope: null })] }),
      { parentScheme: null },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.rule === "WF2-vacuous")).toBe(true);
  });

  it("rejects bundle with no proper attackType", () => {
    const result = validateSchemePresentation(
      draft({ cqs: [cq({ attackType: "FOO" })] }),
      { parentScheme: null },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.message.includes("REBUTS"))).toBe(true);
  });

  it("rejects CQ with near-empty text", () => {
    const result = validateSchemePresentation(
      draft({ cqs: [cq({ text: "  " })] }),
      { parentScheme: null },
    );
    expect(result.ok).toBe(false);
  });

  it("accepts a non-vacuous bundle", () => {
    const result = validateSchemePresentation(draft(), { parentScheme: null });
    expect(result.ok).toBe(true);
  });
});

describe("validateSchemePresentation — WF1 (CQ-bundle consistency)", () => {
  it("rejects duplicate cqKey with mismatched attackType", () => {
    const result = validateSchemePresentation(
      draft({
        cqs: [cq({ cqKey: "x", attackType: "UNDERCUTS" }), cq({ cqKey: "x", attackType: "REBUTS" })],
      }),
      { parentScheme: null },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.rule === "WF1")).toBe(true);
  });

  it("rejects child CQ overriding parent's targetScope", () => {
    const p = parent({ cqs: [cq({ cqKey: "shared", targetScope: "conclusion" })] });
    const d = draft({
      parentSchemeId: p.id,
      cqs: [cq({ cqKey: "shared", targetScope: "premise" })],
    });
    const result = validateSchemePresentation(d, { parentScheme: p });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.rule === "WF1" && e.parentCqKey === "shared")).toBe(true);
  });

  it("warns but does not fail on text-only divergence within bundle", () => {
    const result = validateSchemePresentation(
      draft({
        cqs: [
          cq({ cqKey: "x", text: "Is the witness reliable?" }),
          cq({ cqKey: "x", text: "Can we trust the witness?" }),
        ],
      }),
      { parentScheme: null },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.some((w) => w.rule === "WF1")).toBe(true);
  });
});

describe("validateSchemePresentation — WF3 (inheritance monotonicity)", () => {
  it("rejects child missing a parent CQ key", () => {
    const p = parent({
      cqs: [cq({ cqKey: "a" }), cq({ cqKey: "b" })],
    });
    const d = draft({
      parentSchemeId: p.id,
      cqs: [cq({ cqKey: "a" })], // missing "b"
    });
    const result = validateSchemePresentation(d, { parentScheme: p });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.rule === "WF3" && e.parentCqKey === "b")).toBe(true);
  });

  it("accepts child that includes all parent CQs plus its own", () => {
    const p = parent({ cqs: [cq({ cqKey: "a" })] });
    const d = draft({
      parentSchemeId: p.id,
      cqs: [cq({ cqKey: "a" }), cq({ cqKey: "b" })],
    });
    const result = validateSchemePresentation(d, { parentScheme: p });
    expect(result.ok).toBe(true);
  });

  it("skips WF3 when no parent", () => {
    const result = validateSchemePresentation(draft(), { parentScheme: null });
    expect(result.ok).toBe(true);
  });
});
