import {
  validateEvidenceAnchor,
  intentContradictsSupport,
  isExecutableEvidence,
  CITATION_ANCHOR_TYPES,
  CITATION_INTENTS,
} from "@/lib/argument-chains/chainEvidence";

describe("chainEvidence — vocabularies", () => {
  it("exposes the five Citation anchor types", () => {
    expect([...CITATION_ANCHOR_TYPES]).toEqual([
      "annotation",
      "text_range",
      "timestamp",
      "page",
      "coordinates",
    ]);
  });

  it("exposes the eight Citation intents", () => {
    expect([...CITATION_INTENTS]).toEqual([
      "supports",
      "refutes",
      "context",
      "defines",
      "method",
      "background",
      "acknowledges",
      "example",
    ]);
  });
});

describe("validateEvidenceAnchor — well-formedness (§4.6)", () => {
  it("accepts plain PART-3 evidence with no anchorType", () => {
    expect(validateEvidenceAnchor({})).toEqual({ ok: true });
    expect(validateEvidenceAnchor({ intent: "supports" })).toEqual({ ok: true });
  });

  it("accepts a page anchor with no anchorData (locator carries the page)", () => {
    expect(validateEvidenceAnchor({ anchorType: "page" })).toEqual({ ok: true });
  });

  it("accepts a well-formed text_range anchor", () => {
    expect(
      validateEvidenceAnchor({
        anchorType: "text_range",
        anchorData: { start: 10, end: 42 },
      }),
    ).toEqual({ ok: true });
  });

  it("rejects a text_range anchor missing numeric start/end", () => {
    const r = validateEvidenceAnchor({
      anchorType: "text_range",
      anchorData: { start: 10 },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("EVIDENCE_ANCHOR_MALFORMED");
  });

  it("accepts a text_range passage anchor with a quote in anchorData (no offsets)", () => {
    expect(
      validateEvidenceAnchor({
        anchorType: "text_range",
        anchorData: { quote: "rewetting cuts CO2 emissions sharply" },
      }),
    ).toEqual({ ok: true });
  });

  it("accepts a text_range passage anchor with a top-level quote (no anchorData)", () => {
    expect(
      validateEvidenceAnchor({
        anchorType: "text_range",
        quote: "rewetting cuts CO2 emissions sharply",
      }),
    ).toEqual({ ok: true });
  });

  it("rejects a text_range anchor with neither offsets nor a non-empty quote", () => {
    const r = validateEvidenceAnchor({
      anchorType: "text_range",
      quote: "   ",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("EVIDENCE_ANCHOR_MALFORMED");
  });

  it("accepts a timestamp anchor with start only and with start+end", () => {
    expect(
      validateEvidenceAnchor({ anchorType: "timestamp", anchorData: { start: 494 } }),
    ).toEqual({ ok: true });
    expect(
      validateEvidenceAnchor({
        anchorType: "timestamp",
        anchorData: { start: 494, end: 530 },
      }),
    ).toEqual({ ok: true });
  });

  it("rejects a timestamp anchor without a numeric start", () => {
    const r = validateEvidenceAnchor({
      anchorType: "timestamp",
      anchorData: { end: 530 },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("EVIDENCE_ANCHOR_MALFORMED");
  });

  it("accepts a well-formed coordinates anchor", () => {
    expect(
      validateEvidenceAnchor({
        anchorType: "coordinates",
        anchorData: { x: 1, y: 2, width: 3, height: 4 },
      }),
    ).toEqual({ ok: true });
  });

  it("rejects a coordinates anchor carrying timestamp-shaped data (the headline malformed case)", () => {
    const r = validateEvidenceAnchor({
      anchorType: "coordinates",
      anchorData: { start: 1 },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("EVIDENCE_ANCHOR_MALFORMED");
  });

  it("accepts an annotation anchor with a non-empty anchorId", () => {
    expect(
      validateEvidenceAnchor({ anchorType: "annotation", anchorId: "ann-1" }),
    ).toEqual({ ok: true });
  });

  it("rejects an annotation anchor with no anchorId", () => {
    const r = validateEvidenceAnchor({ anchorType: "annotation" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("EVIDENCE_ANCHOR_MALFORMED");
  });
});

describe("intentContradictsSupport — advisory (§4.5)", () => {
  it("flags a refutes intent as contrary on a support link", () => {
    expect(intentContradictsSupport("refutes")).toBe(true);
  });

  it("does not flag supportive or neutral intents", () => {
    expect(intentContradictsSupport("supports")).toBe(false);
    expect(intentContradictsSupport("context")).toBe(false);
    expect(intentContradictsSupport("acknowledges")).toBe(false);
    expect(intentContradictsSupport(undefined)).toBe(false);
  });
});

describe("isExecutableEvidence — backward-compat gate (§9)", () => {
  it("treats plain { url, quote } evidence as non-executable", () => {
    expect(isExecutableEvidence({})).toBe(false);
  });

  it("treats evidence carrying any of locator/anchorType/anchorData/intent as executable", () => {
    expect(isExecutableEvidence({ locator: "p. 13" })).toBe(true);
    expect(isExecutableEvidence({ anchorType: "page" })).toBe(true);
    expect(isExecutableEvidence({ anchorData: { start: 1, end: 2 } })).toBe(true);
    expect(isExecutableEvidence({ intent: "supports" })).toBe(true);
  });
});
