import {
  SCHEME_WRITE_CODES,
  isSchemeWriteCode,
  severityOf,
  type SchemeWriteCode,
} from "@/lib/schemes/schemeWriteCodes";

describe("schemeWriteCodes (E.1 §4.1 code table)", () => {
  it("exposes exactly the six §4.1 codes", () => {
    expect(Object.keys(SCHEME_WRITE_CODES).sort()).toEqual(
      [
        "EPISTEMIC_MODE_CHANGED_FINGERPRINT",
        "PREMISE_TYPE_INCONSISTENT",
        "SCHEME_CANONICALIZED",
        "SCHEME_NOT_ARGUMENT_PATTERN",
        "SCHEME_UNKNOWN",
        "VERIFIER_INCONCLUSIVE",
      ].sort(),
    );
  });

  it("classifies the two refusal codes as errors and the rest as warnings", () => {
    expect(severityOf("SCHEME_UNKNOWN")).toBe("error");
    expect(severityOf("SCHEME_NOT_ARGUMENT_PATTERN")).toBe("error");
    const warnings: SchemeWriteCode[] = [
      "SCHEME_CANONICALIZED",
      "PREMISE_TYPE_INCONSISTENT",
      "EPISTEMIC_MODE_CHANGED_FINGERPRINT",
      "VERIFIER_INCONCLUSIVE",
    ];
    for (const code of warnings) {
      expect(severityOf(code)).toBe("warning");
    }
  });

  it("carries the §4.1 phase metadata for each code", () => {
    expect(SCHEME_WRITE_CODES.SCHEME_UNKNOWN.phase).toBe("A/B");
    expect(SCHEME_WRITE_CODES.VERIFIER_INCONCLUSIVE.phase).toBe("B/C");
  });

  it("is a precise type guard over the table keys", () => {
    expect(isSchemeWriteCode("SCHEME_CANONICALIZED")).toBe(true);
    expect(isSchemeWriteCode("scheme_canonicalized")).toBe(false);
    expect(isSchemeWriteCode("WF1_VIOLATED")).toBe(false);
    expect(isSchemeWriteCode("")).toBe(false);
  });
});
