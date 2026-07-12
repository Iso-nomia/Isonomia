import {
  FacilitationCheckKind,
  FacilitationCheckSeverity,
  FacilitationFramingType,
} from "../types";
import { runAllChecks } from "../checks/runner";
import type { CheckContext } from "../checks/types";

const baseCtx = (overrides: Partial<CheckContext> = {}): CheckContext => ({
  framingType: FacilitationFramingType.open,
  language: "en",
  ...overrides,
});

function severitiesByKind(checks: { kind: FacilitationCheckKind; severity: FacilitationCheckSeverity }[]) {
  const out: Partial<Record<FacilitationCheckKind, FacilitationCheckSeverity[]>> = {};
  for (const c of checks) {
    (out[c.kind] ??= []).push(c.severity);
  }
  return out;
}

describe("runAllChecks — language scope", () => {
  it("returns single INFO row for unsupported language", () => {
    const r = runAllChecks("Cualquier cosa que quieras preguntar?", baseCtx({ language: "es" }));
    expect(r.checks).toHaveLength(1);
    expect(r.checks[0].kind).toBe(FacilitationCheckKind.CLARITY);
    expect(r.checks[0].severity).toBe(FacilitationCheckSeverity.INFO);
    expect(r.summary).toEqual(
      expect.objectContaining({ info: 1, warn: 0, block: 0 }),
    );
  });

  it("is deterministic — identical inputs produce identical evidence", () => {
    const text =
      "Should the city restore weekend bus service or keep the current schedule, given the obvious budget constraints?";
    const ctx = baseCtx({ framingType: FacilitationFramingType.choice });
    const a = runAllChecks(text, ctx);
    const b = runAllChecks(text, ctx);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });
});

describe("CLARITY check", () => {
  it("BLOCKs questions with fewer than 4 tokens", () => {
    const r = runAllChecks("Why this?", baseCtx());
    const sev = severitiesByKind(r.checks);
    expect(sev[FacilitationCheckKind.CLARITY]).toEqual(
      expect.arrayContaining([FacilitationCheckSeverity.BLOCK]),
    );
  });

  it("WARNs on >60 tokens", () => {
    const text = ("question " + "filler ".repeat(70)).trim() + "?";
    const r = runAllChecks(text, baseCtx());
    const sev = severitiesByKind(r.checks);
    expect(sev[FacilitationCheckKind.CLARITY]).toEqual(
      expect.arrayContaining([FacilitationCheckSeverity.WARN]),
    );
  });

  it("BLOCKs on jargon density > 0.20", () => {
    const text = "Should we leverage synergies and operationalize the deliverables for stakeholdership?";
    const r = runAllChecks(text, baseCtx());
    const clarity = r.checks.filter((c) => c.kind === FacilitationCheckKind.CLARITY);
    expect(clarity.some((c) => c.severity === FacilitationCheckSeverity.BLOCK)).toBe(true);
  });

  it("respects lexicon override (legal removes default jargon hits)", () => {
    const text = "Should we leverage synergies and operationalize the deliverables for stakeholdership?";
    const def = runAllChecks(text, baseCtx());
    const overridden = runAllChecks(text, baseCtx({ lexiconOverrideKey: "legal" }));
    const defJargon = def.checks.find((c) => c.kind === FacilitationCheckKind.CLARITY && c.severity === FacilitationCheckSeverity.BLOCK);
    const ovJargon = overridden.checks.find((c) => c.kind === FacilitationCheckKind.CLARITY && c.severity === FacilitationCheckSeverity.BLOCK);
    expect(defJargon).toBeDefined();
    // Legal lexicon is much smaller; same text should drop below the BLOCK threshold.
    expect(ovJargon).toBeUndefined();
  });
});

describe("LEADING check", () => {
  it("BLOCKs 'don't you think'", () => {
    const r = runAllChecks("Don't you think the proposal is a good idea?", baseCtx());
    const leading = r.checks.filter((c) => c.kind === FacilitationCheckKind.LEADING);
    expect(leading.some((c) => c.severity === FacilitationCheckSeverity.BLOCK)).toBe(true);
  });

  it("WARNs on 'obviously'", () => {
    const r = runAllChecks("How should we obviously approach the problem here?", baseCtx());
    const leading = r.checks.filter((c) => c.kind === FacilitationCheckKind.LEADING);
    expect(leading.some((c) => c.severity === FacilitationCheckSeverity.WARN)).toBe(true);
  });

  it("does not WARN on 'clearly state'", () => {
    const r = runAllChecks("Could the policy clearly state the funding source for the program?", baseCtx());
    const leading = r.checks.filter((c) => c.kind === FacilitationCheckKind.LEADING);
    expect(leading.find((c) => c.evidence && (c.evidence as Record<string, unknown>).pattern === "clearly")).toBeUndefined();
  });
});

describe("BALANCE check", () => {
  it("BLOCKs single-clause choice framing", () => {
    const r = runAllChecks("Should we restore weekend bus service?", baseCtx({ framingType: FacilitationFramingType.choice }));
    const balance = r.checks.filter((c) => c.kind === FacilitationCheckKind.BALANCE);
    expect(balance.some((c) => c.severity === FacilitationCheckSeverity.BLOCK)).toBe(true);
  });

  it("does not fire on open framing", () => {
    const r = runAllChecks("Should we restore weekend bus service?", baseCtx({ framingType: FacilitationFramingType.open }));
    expect(r.checks.filter((c) => c.kind === FacilitationCheckKind.BALANCE)).toHaveLength(0);
  });

  it("WARNs on evaluative framing without negative option", () => {
    const r = runAllChecks("Do you support the proposal as written?", baseCtx({ framingType: FacilitationFramingType.evaluative }));
    const balance = r.checks.filter((c) => c.kind === FacilitationCheckKind.BALANCE);
    expect(balance.some((c) => c.severity === FacilitationCheckSeverity.WARN)).toBe(true);
  });

  it("does NOT WARN evaluative framing with explicit oppose", () => {
    const r = runAllChecks("Do you support or oppose the proposal as written?", baseCtx({ framingType: FacilitationFramingType.evaluative }));
    const balance = r.checks.filter((c) => c.kind === FacilitationCheckKind.BALANCE);
    expect(balance.some((c) => c.severity === FacilitationCheckSeverity.WARN)).toBe(false);
  });
});

describe("SCOPE check", () => {
  it("BLOCKs multiple question marks", () => {
    const r = runAllChecks("What should we do? Why now?", baseCtx());
    const scope = r.checks.filter((c) => c.kind === FacilitationCheckKind.SCOPE);
    expect(scope.some((c) => c.severity === FacilitationCheckSeverity.BLOCK)).toBe(true);
  });

  it("WARNs on embedded sub-question via 'and'", () => {
    const r = runAllChecks("What policy should we adopt and how should it be funded?", baseCtx());
    const scope = r.checks.filter((c) => c.kind === FacilitationCheckKind.SCOPE);
    expect(scope.some((c) => c.severity === FacilitationCheckSeverity.WARN)).toBe(true);
  });
});

describe("READABILITY check", () => {
  it("INFO for grade ≤ 12", () => {
    const r = runAllChecks("Should the city restore weekend bus service?", baseCtx());
    const read = r.checks.find((c) => c.kind === FacilitationCheckKind.READABILITY);
    expect(read?.severity).toBe(FacilitationCheckSeverity.INFO);
  });

  it("BLOCK above grade 16", () => {
    const text = "Notwithstanding the aforementioned considerations, should the municipal jurisdiction prospectively reinstitute the bicameral legislative subcommittee responsible for transportation infrastructure capitalization adjudication?";
    const r = runAllChecks(text, baseCtx());
    const read = r.checks.find((c) => c.kind === FacilitationCheckKind.READABILITY);
    expect(read?.severity).toBe(FacilitationCheckSeverity.BLOCK);
  });

  it("custom blockGrade demotes BLOCK to WARN", () => {
    const text = "Notwithstanding the aforementioned considerations, should the municipal jurisdiction prospectively reinstitute the bicameral legislative subcommittee responsible for transportation infrastructure capitalization adjudication?";
    const r = runAllChecks(text, baseCtx({ readabilityBlockGrade: 100 }));
    const read = r.checks.find((c) => c.kind === FacilitationCheckKind.READABILITY);
    expect(read?.severity).toBe(FacilitationCheckSeverity.WARN);
  });
});

describe("BIAS check (v1 stub)", () => {
  it("returns no rows", () => {
    const r = runAllChecks("Don't you think the obviously irresponsible proposal should be rejected?", baseCtx());
    expect(r.checks.filter((c) => c.kind === FacilitationCheckKind.BIAS)).toHaveLength(0);
  });
});

describe("severityCeilings", () => {
  it("demotes BLOCK→WARN per kind", () => {
    const text = "Should we leverage synergies and operationalize the deliverables for stakeholdership?";
    const r = runAllChecks(text, baseCtx({
      severityCeilings: {
        [FacilitationCheckKind.CLARITY]: FacilitationCheckSeverity.WARN,
      },
    }));
    const clarity = r.checks.filter((c) => c.kind === FacilitationCheckKind.CLARITY);
    expect(clarity.some((c) => c.severity === FacilitationCheckSeverity.BLOCK)).toBe(false);
    expect(clarity.some((c) => c.severity === FacilitationCheckSeverity.WARN)).toBe(true);
  });
});
