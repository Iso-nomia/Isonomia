/**
 * Phase 4.3 — Snapshot/contract test for buildArgumentJsonLd.
 *
 * The single most-important contract: ClaimReview is emitted ONLY when
 * the argument is dialectically tested. This is the gating rule the
 * roadmap calls out (Phase 5.6) and the activation rule we ship to
 * Google's Rich Results Test in Phase 3.
 */

import { buildArgumentJsonLd } from "@/lib/citations/argumentJsonLd";
import type { ArgumentAttestation } from "@/lib/citations/argumentAttestation";

function fixture(overrides: Partial<ArgumentAttestation> = {}): ArgumentAttestation {
  const base: ArgumentAttestation = {
    identifier: "Bx7kQ2mN",
    argumentId: "arg_1",
    permalink: "https://isonomia.app/a/Bx7kQ2mN",
    version: 1,
    contentHash: "sha256:abc",
    immutablePermalink: "https://isonomia.app/a/Bx7kQ2mN@sha256:abc",
    isoId: "iso:argument:Bx7kQ2mN",
    isoUrl: "https://isonomia.app/iso/argument/Bx7kQ2mN",
    doi: null,
    retrievedAt: "2026-05-09T00:00:00Z",
    createdAt: "2026-05-01T00:00:00Z",
    updatedAt: "2026-05-08T00:00:00Z",
    conclusion: { claimId: "c_1", moid: "moid_xyz", text: "Smartphones harm adolescents." },
    premises: [],
    scheme: { id: "s1", key: "expert_opinion", name: "Expert Opinion", title: "Expert Opinion" },
    evidence: [],
    structuredCitations: [],
    criticalQuestions: null,
    confidence: 0.7,
    dialecticalStatus: {
      incomingAttacks: 0,
      incomingAttackEdges: 0,
      incomingSupports: 0,
      criticalQuestionsRequired: 0,
      criticalQuestionsAnswered: 0,
      criticalQuestionsOpen: 0,
      standingScore: 0,
      isTested: false,
      testedness: "untested",
    } as any,
    deliberation: null,
    author: null,
    canonicalPayload: "{}",
  } as any;
  return { ...base, ...overrides } as ArgumentAttestation;
}

describe("buildArgumentJsonLd — ClaimReview gating (Phase 5.6 / 3.4)", () => {
  it("OMITS ClaimReview when the argument is not yet tested", () => {
    const ld = buildArgumentJsonLd(fixture()) as any;
    // Untested → flat node, no @graph wrapper, no ClaimReview anywhere.
    expect(ld["@graph"]).toBeUndefined();
    expect(JSON.stringify(ld)).not.toContain("ClaimReview");
  });

  it("EMITS ClaimReview when isTested === true", () => {
    const att = fixture({
      dialecticalStatus: {
        incomingAttacks: 1,
        incomingAttackEdges: 0,
        incomingSupports: 1,
        criticalQuestionsRequired: 5,
        criticalQuestionsAnswered: 3,
        criticalQuestionsOpen: 2,
        standingScore: 0.78,
        isTested: true,
        testedness: "well_tested",
      } as any,
    });
    const ld = buildArgumentJsonLd(att) as any;
    expect(Array.isArray(ld["@graph"])).toBe(true);
    const review = ld["@graph"].find((n: any) => n["@type"] === "ClaimReview");
    expect(review).toBeDefined();
    expect(review.claimReviewed).toBe("Smartphones harm adolescents.");
    expect(review.reviewRating).toMatchObject({
      "@type": "Rating",
      ratingValue: 0.78,
      bestRating: 1,
      worstRating: 0,
    });
    expect(review.author).toMatchObject({ "@type": "Organization", name: "Isonomia" });
  });

  it("does NOT emit ClaimReview when conclusion is missing even if isTested", () => {
    const att = fixture({
      conclusion: null,
      dialecticalStatus: {
        incomingAttacks: 1,
        incomingAttackEdges: 0,
        incomingSupports: 1,
        criticalQuestionsRequired: 0,
        criticalQuestionsAnswered: 0,
        criticalQuestionsOpen: 0,
        standingScore: 0.5,
        isTested: true,
        testedness: "well_tested",
      } as any,
    });
    const ld = buildArgumentJsonLd(att) as any;
    expect(JSON.stringify(ld)).not.toContain("ClaimReview");
  });
});
