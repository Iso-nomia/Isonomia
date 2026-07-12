/**
 * Roadmap A.2 — unit tests for the AIF round-trip soundness classifier.
 *
 * Pure function over an attestation's enriched CQ premise-types + the AIF
 * subgraph. No Prisma. We assert the exposed-vs-absent classification and the
 * `lossy` flag that warns a re-importer an obligation has no carrier.
 */

import { computeRoundTripSoundness } from "@/lib/aif/roundTripSoundness";
import type { ArgumentAttestation } from "@/lib/citations/argumentAttestation";

type CqItem = {
  cqKey: string;
  text: string;
  attackKind: string | null;
  premiseType: "ORDINARY" | "ASSUMPTION" | "EXCEPTION" | null;
  isSchemeRequired: boolean;
  inheritedFromParentScheme: boolean;
  status: "open" | "satisfied" | "missing";
};

function att(opts: {
  argumentId?: string;
  schemeKey?: string | null;
  cqs?: CqItem[] | null;
}): ArgumentAttestation {
  const cqs = opts.cqs;
  return {
    argumentId: opts.argumentId ?? "arg_1",
    scheme: opts.schemeKey
      ? ({ key: opts.schemeKey } as any)
      : opts.schemeKey === null
      ? null
      : ({ key: "expert_opinion" } as any),
    criticalQuestions:
      cqs == null
        ? null
        : ({
            schemeKey: opts.schemeKey ?? "expert_opinion",
            total: cqs.length,
            answered: cqs.filter((c) => c.status === "satisfied"),
            partiallyAnswered: [],
            unanswered: cqs.filter((c) => c.status !== "satisfied"),
          } as any),
  } as any;
}

function cq(
  premiseType: CqItem["premiseType"],
  status: CqItem["status"] = "open",
): CqItem {
  return {
    cqKey: `cq_${premiseType}_${status}`,
    text: "t",
    attackKind: "UNDERCUTS",
    premiseType,
    isSchemeRequired: premiseType !== "ASSUMPTION",
    inheritedFromParentScheme: false,
    status,
  };
}

const graph = (nodes: unknown[]) => ({ "@graph": nodes });

describe("computeRoundTripSoundness", () => {
  it("marks ORDINARY exposed when a Premise edge targets the RA node", () => {
    const result = computeRoundTripSoundness(
      att({ cqs: [cq("ORDINARY")] }),
      graph([{ "@type": "aif:Premise", "aif:from": "I:c1", "aif:to": "S:arg_1" }]),
    );
    expect(result.groups.ORDINARY.aifExposure).toBe("exposed");
    expect(result.groups.ORDINARY.cqCount).toBe(1);
    expect(result.lossy).toBe(false);
  });

  it("flags lossy when an EXCEPTION CQ has no HasException carrier", () => {
    const result = computeRoundTripSoundness(
      att({ cqs: [cq("EXCEPTION")] }),
      graph([{ "@type": "aif:Premise", "aif:from": "I:c1", "aif:to": "S:arg_1" }]),
    );
    expect(result.groups.EXCEPTION.cqCount).toBe(1);
    expect(result.groups.EXCEPTION.aifExposure).toBe("absent");
    expect(result.lossy).toBe(true);
  });

  it("marks ASSUMPTION exposed via a HasPresumption edge from the RA node", () => {
    const result = computeRoundTripSoundness(
      att({ cqs: [cq("ASSUMPTION")] }),
      graph([
        { "@type": "as:HasPresumption", "aif:from": "S:arg_1", "aif:to": "I:assm" },
      ]),
    );
    expect(result.groups.ASSUMPTION.aifExposure).toBe("exposed");
    expect(result.lossy).toBe(false);
  });

  it("matches array-valued @type (RA nodes carry multiple types)", () => {
    const result = computeRoundTripSoundness(
      att({ cqs: [cq("EXCEPTION")] }),
      graph([
        {
          "@type": ["as:HasException", "aif:Edge"],
          "aif:from": "S:arg_1",
          "aif:to": "I:exc",
        },
      ]),
    );
    expect(result.groups.EXCEPTION.aifExposure).toBe("exposed");
    expect(result.lossy).toBe(false);
  });

  it("does not credit an edge that targets a different argument's RA node", () => {
    const result = computeRoundTripSoundness(
      att({ argumentId: "arg_1", cqs: [cq("ORDINARY")] }),
      graph([{ "@type": "aif:Premise", "aif:from": "I:c1", "aif:to": "S:arg_2" }]),
    );
    expect(result.groups.ORDINARY.aifExposure).toBe("absent");
    expect(result.lossy).toBe(true);
  });

  it("is not lossy when a group has zero CQs even if absent from the graph", () => {
    const result = computeRoundTripSoundness(
      att({ cqs: [cq("ORDINARY")] }),
      graph([{ "@type": "aif:Premise", "aif:from": "I:c1", "aif:to": "S:arg_1" }]),
    );
    // EXCEPTION + ASSUMPTION have zero CQs and are absent — must not be lossy.
    expect(result.groups.EXCEPTION.cqCount).toBe(0);
    expect(result.groups.ASSUMPTION.cqCount).toBe(0);
    expect(result.lossy).toBe(false);
  });

  it("handles a null CQ aggregate (no scheme) — all groups empty, not lossy", () => {
    const result = computeRoundTripSoundness(
      att({ schemeKey: null, cqs: null }),
      graph([]),
    );
    expect(result.schemeKey).toBeNull();
    expect(result.groups.ORDINARY.cqCount).toBe(0);
    expect(result.lossy).toBe(false);
  });

  it("tolerates a missing @graph", () => {
    const result = computeRoundTripSoundness(att({ cqs: [cq("ORDINARY")] }), null);
    expect(result.groups.ORDINARY.aifExposure).toBe("absent");
    expect(result.lossy).toBe(true);
  });
});
