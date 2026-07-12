/**
 * Tests for Phase 0.1: Burden of Proof Helper Functions
 * 
 * Run with: npm run test lib/utils/cq-burden-helpers.test.ts
 */

import {
  getCQBurdenExplanation,
  getCQEvidenceGuidance,
  shouldShowEvidencePrompt,
  getBurdenBadgeText,
  getBurdenBadgeColor,
  getPremiseTypeDisplay,
  getPremiseTypeExplanation,
} from "@/lib/utils/cq-burden-helpers";

describe("Burden of Proof Helpers", () => {
  describe("getCQBurdenExplanation", () => {
    it("explains PROPONENT burden correctly", () => {
      const explanation = getCQBurdenExplanation("PROPONENT", null);
      expect(explanation).toContain("proponent");
      expect(explanation).toContain("justification");
    });

    it("explains CHALLENGER burden correctly", () => {
      const explanation = getCQBurdenExplanation("CHALLENGER", null);
      expect(explanation).toContain("challenger");
      expect(explanation).toContain("evidence");
    });

    it("handles ASSUMPTION premise type", () => {
      const explanation = getCQBurdenExplanation("PROPONENT", "ASSUMPTION");
      expect(explanation).toContain("assumed");
      expect(explanation).toContain("acceptable unless challenged");
    });

    it("handles EXCEPTION premise type", () => {
      const explanation = getCQBurdenExplanation("CHALLENGER", "EXCEPTION");
      expect(explanation).toContain("exception");
      expect(explanation).toContain("applies");
    });
  });

  describe("getCQEvidenceGuidance", () => {
    it("indicates no evidence needed when requiresEvidence is false", () => {
      const guidance = getCQEvidenceGuidance("PROPONENT", null, false);
      expect(guidance).toContain("No evidence required");
      expect(guidance).toContain("asking the question is sufficient");
    });

    it("provides proponent guidance when requiresEvidence is true", () => {
      const guidance = getCQEvidenceGuidance("PROPONENT", "ORDINARY", true);
      expect(guidance).toContain("proponent");
      expect(guidance).toContain("evidence");
    });

    it("provides challenger guidance with EXCEPTION type", () => {
      const guidance = getCQEvidenceGuidance("CHALLENGER", "EXCEPTION", true);
      expect(guidance).toContain("You must provide evidence");
      expect(guidance).toContain("exception applies");
    });

    it("handles ASSUMPTION type correctly", () => {
      const guidance = getCQEvidenceGuidance("PROPONENT", "ASSUMPTION", true);
      expect(guidance).toContain("Once questioned");
      expect(guidance).toContain("assumption");
    });
  });

  describe("shouldShowEvidencePrompt", () => {
    it("returns false when evidence not required", () => {
      expect(shouldShowEvidencePrompt("PROPONENT", false, true)).toBe(false);
      expect(shouldShowEvidencePrompt("CHALLENGER", false, false)).toBe(false);
    });

    it("returns true for proponent when they have burden", () => {
      expect(shouldShowEvidencePrompt("PROPONENT", true, true)).toBe(true);
    });

    it("returns false for proponent when challenger has burden", () => {
      expect(shouldShowEvidencePrompt("CHALLENGER", true, true)).toBe(false);
    });

    it("returns true for challenger when they have burden", () => {
      expect(shouldShowEvidencePrompt("CHALLENGER", true, false)).toBe(true);
    });

    it("returns false for challenger when proponent has burden", () => {
      expect(shouldShowEvidencePrompt("PROPONENT", true, false)).toBe(false);
    });
  });

  describe("getBurdenBadgeText", () => {
    it("returns correct text for PROPONENT", () => {
      expect(getBurdenBadgeText("PROPONENT")).toBe("Proponent burden");
    });

    it("returns correct text for CHALLENGER", () => {
      expect(getBurdenBadgeText("CHALLENGER")).toBe("Challenger burden");
    });

    it("handles unknown burden type", () => {
      expect(getBurdenBadgeText("UNKNOWN" as any)).toBe("Unknown burden");
    });
  });

  describe("getBurdenBadgeColor", () => {
    it("returns blue for PROPONENT", () => {
      const color = getBurdenBadgeColor("PROPONENT");
      expect(color).toContain("blue");
    });

    it("returns amber for CHALLENGER", () => {
      const color = getBurdenBadgeColor("CHALLENGER");
      expect(color).toContain("amber");
    });

    it("returns gray for unknown burden", () => {
      const color = getBurdenBadgeColor("UNKNOWN" as any);
      expect(color).toContain("gray");
    });
  });

  describe("getPremiseTypeDisplay", () => {
    it("returns correct display name for ORDINARY", () => {
      expect(getPremiseTypeDisplay("ORDINARY")).toBe("Ordinary Premise");
    });

    it("returns correct display name for ASSUMPTION", () => {
      expect(getPremiseTypeDisplay("ASSUMPTION")).toBe("Assumption");
    });

    it("returns correct display name for EXCEPTION", () => {
      expect(getPremiseTypeDisplay("EXCEPTION")).toBe("Exception");
    });

    it("returns null for undefined premise type", () => {
      expect(getPremiseTypeDisplay(null)).toBeNull();
      expect(getPremiseTypeDisplay(undefined)).toBeNull();
    });
  });

  describe("getPremiseTypeExplanation", () => {
    it("explains ORDINARY premise type", () => {
      const explanation = getPremiseTypeExplanation("ORDINARY");
      expect(explanation).toContain("Must always be supported");
      expect(explanation).toContain("evidence or reasoning");
    });

    it("explains ASSUMPTION premise type", () => {
      const explanation = getPremiseTypeExplanation("ASSUMPTION");
      expect(explanation).toContain("Accepted as true");
      expect(explanation).toContain("unless explicitly challenged");
      expect(explanation).toContain("Carneades");
    });

    it("explains EXCEPTION premise type", () => {
      const explanation = getPremiseTypeExplanation("EXCEPTION");
      expect(explanation).toContain("Challenger must prove");
      expect(explanation).toContain("exception applies");
    });

    it("returns null for undefined premise type", () => {
      expect(getPremiseTypeExplanation(null)).toBeNull();
      expect(getPremiseTypeExplanation(undefined)).toBeNull();
    });
  });
});
