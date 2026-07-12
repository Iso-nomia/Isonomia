/**
 * Tests for Argument Net Helper Functions (Phase 1.1)
 */

import { describe, it, expect } from "@jest/globals";
import {
  getPrimaryScheme,
  getSupportingSchemes,
  getPresupposedSchemes,
  getImplicitSchemes,
  organizeSchemesByRole,
  getSchemeByRole,
  isMultiSchemeArgument,
  hasSchemeRole,
  hasExplicitSchemes,
  hasImplicitSchemes,
  getExplicitnessStyle,
  getRoleStyle,
  formatDependencyType,
  validateArgumentNet,
  getArgumentSchemeStatistics,
  getSchemeCountLabel,
  getSchemeSummary,
  sortSchemeInstances,
} from "@/lib/utils/argument-net-helpers";
import type { ArgumentWithSchemes } from "@/lib/types/argument-net";

// Mock data
const mockScheme1 = {
  id: "scheme1",
  name: "Practical Reasoning",
  description: "Reasoning from goals to actions",
  key: "practical-reasoning",
  premises: [],
  conclusion: null,
  criticalQuestions: [],
  tags: [],
  examples: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  usageCount: 10,
  category: null,
  difficulty: null,
  epistemicMode: null,
  identificationConditions: [],
  whenToUse: null,
};

const mockScheme2 = {
  ...mockScheme1,
  id: "scheme2",
  name: "Expert Opinion",
  key: "expert-opinion",
};

const mockScheme3 = {
  ...mockScheme1,
  id: "scheme3",
  name: "Argument from Values",
  key: "values",
};

const mockArgument: ArgumentWithSchemes = {
  id: "arg1",
  deliberationId: "delib1",
  authorId: "user1",
  text: "We should implement the carbon tax because experts recommend it.",
  sources: null,
  confidence: 0.9,
  isImplicit: false,
  schemeId: "scheme1",
  conclusionClaimId: null,
  implicitWarrant: null,
  quantifier: null,
  modality: null,
  mediaType: "text",
  mediaUrl: null,
  createdAt: new Date(),
  lastUpdatedAt: new Date(),
  claimId: "claim1",
  createdByMoveId: null,
  argumentSchemes: [
    {
      id: "inst1",
      argumentId: "arg1",
      schemeId: "scheme1",
      confidence: 1.0,
      isPrimary: true,
      role: "primary",
      explicitness: "explicit",
      order: 0,
      textEvidence: "We should implement the carbon tax",
      justification: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      scheme: mockScheme1,
    },
    {
      id: "inst2",
      argumentId: "arg1",
      schemeId: "scheme2",
      confidence: 0.9,
      isPrimary: false,
      role: "supporting",
      explicitness: "explicit",
      order: 0,
      textEvidence: "experts recommend it",
      justification: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      scheme: mockScheme2,
    },
    {
      id: "inst3",
      argumentId: "arg1",
      schemeId: "scheme3",
      confidence: 0.8,
      isPrimary: false,
      role: "presupposed",
      explicitness: "presupposed",
      order: 0,
      textEvidence: null,
      justification: "Assumes we value environmental sustainability",
      createdAt: new Date(),
      updatedAt: new Date(),
      scheme: mockScheme3,
    },
  ],
};

const mockSingleSchemeArgument: ArgumentWithSchemes = {
  ...mockArgument,
  id: "arg2",
  argumentSchemes: [
    {
      id: "inst4",
      argumentId: "arg2",
      schemeId: "scheme1",
      confidence: 1.0,
      isPrimary: true,
      role: "primary",
      explicitness: "explicit",
      order: 0,
      textEvidence: "Single scheme argument",
      justification: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      scheme: mockScheme1,
    },
  ],
};

describe("Argument Net Helpers", () => {
  describe("Scheme Accessors", () => {
    it("getPrimaryScheme should return the primary scheme", () => {
      const primary = getPrimaryScheme(mockArgument);
      expect(primary).toBeDefined();
      expect(primary?.role).toBe("primary");
      expect(primary?.scheme.name).toBe("Practical Reasoning");
    });

    it("getSupportingSchemes should return supporting schemes", () => {
      const supporting = getSupportingSchemes(mockArgument);
      expect(supporting).toHaveLength(1);
      expect(supporting[0].role).toBe("supporting");
      expect(supporting[0].scheme.name).toBe("Expert Opinion");
    });

    it("getPresupposedSchemes should return presupposed schemes", () => {
      const presupposed = getPresupposedSchemes(mockArgument);
      expect(presupposed).toHaveLength(1);
      expect(presupposed[0].role).toBe("presupposed");
      expect(presupposed[0].scheme.name).toBe("Argument from Values");
    });

    it("getImplicitSchemes should return empty array for this argument", () => {
      const implicit = getImplicitSchemes(mockArgument);
      expect(implicit).toHaveLength(0);
    });

    it("organizeSchemesByRole should group schemes correctly", () => {
      const organized = organizeSchemesByRole(mockArgument);
      expect(organized.primary).toBeDefined();
      expect(organized.primary?.scheme.name).toBe("Practical Reasoning");
      expect(organized.supporting).toHaveLength(1);
      expect(organized.presupposed).toHaveLength(1);
      expect(organized.implicit).toHaveLength(0);
      expect(organized.all).toHaveLength(3);
    });

    it("getSchemeByRole should find scheme by role and order", () => {
      const scheme = getSchemeByRole(mockArgument, "supporting", 0);
      expect(scheme).toBeDefined();
      expect(scheme?.scheme.name).toBe("Expert Opinion");
    });
  });

  describe("Scheme Checks", () => {
    it("isMultiSchemeArgument should detect multi-scheme arguments", () => {
      expect(isMultiSchemeArgument(mockArgument)).toBe(true);
      expect(isMultiSchemeArgument(mockSingleSchemeArgument)).toBe(false);
    });

    it("hasSchemeRole should check for role presence", () => {
      expect(hasSchemeRole(mockArgument, "primary")).toBe(true);
      expect(hasSchemeRole(mockArgument, "supporting")).toBe(true);
      expect(hasSchemeRole(mockArgument, "implicit")).toBe(false);
    });

    it("hasExplicitSchemes should detect explicit schemes", () => {
      expect(hasExplicitSchemes(mockArgument)).toBe(true);
    });

    it("hasImplicitSchemes should detect implicit/presupposed schemes", () => {
      expect(hasImplicitSchemes(mockArgument)).toBe(true);
      expect(hasImplicitSchemes(mockSingleSchemeArgument)).toBe(false);
    });
  });

  describe("Styling Helpers", () => {
    it("getExplicitnessStyle should return correct styling", () => {
      const explicitStyle = getExplicitnessStyle("explicit");
      expect(explicitStyle.borderStyle).toBe("solid");
      expect(explicitStyle.label).toBe("Explicit");

      const presupposedStyle = getExplicitnessStyle("presupposed");
      expect(presupposedStyle.borderStyle).toBe("dashed");

      const impliedStyle = getExplicitnessStyle("implied");
      expect(impliedStyle.borderStyle).toBe("dotted");
    });

    it("getRoleStyle should return correct styling", () => {
      const primaryStyle = getRoleStyle("primary");
      expect(primaryStyle.label).toBe("Primary");
      expect(primaryStyle.icon).toBe("⭐");

      const supportingStyle = getRoleStyle("supporting");
      expect(supportingStyle.label).toBe("Supporting");
    });

    it("formatDependencyType should format dependency types", () => {
      const format = formatDependencyType("premise_conclusion");
      expect(format.label).toBe("Premise → Conclusion");
      expect(format.icon).toBeTruthy();
    });
  });

  describe("Validation", () => {
    it("validateArgumentNet should validate correct arguments", () => {
      const result = validateArgumentNet(mockArgument);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should warn about missing text evidence", () => {
      const argWithoutEvidence: ArgumentWithSchemes = {
        ...mockArgument,
        argumentSchemes: [
          {
            ...mockArgument.argumentSchemes[0],
            textEvidence: null,
          },
        ],
      };

      const result = validateArgumentNet(argWithoutEvidence);
      expect(result.warnings.some((w) => w.code === "EXPLICIT_MISSING_EVIDENCE")).toBe(true);
    });

    it("should warn about missing justification for presupposed schemes", () => {
      const argWithoutJustification: ArgumentWithSchemes = {
        ...mockArgument,
        argumentSchemes: [
          mockArgument.argumentSchemes[0],
          {
            ...mockArgument.argumentSchemes[2],
            justification: null,
          },
        ],
      };

      const result = validateArgumentNet(argWithoutJustification);
      expect(
        result.warnings.some((w) => w.code === "IMPLICIT_MISSING_JUSTIFICATION")
      ).toBe(true);
    });

    it("should error on multiple primary schemes", () => {
      const argWithMultiplePrimaries: ArgumentWithSchemes = {
        ...mockArgument,
        argumentSchemes: [
          mockArgument.argumentSchemes[0],
          {
            ...mockArgument.argumentSchemes[1],
            role: "primary",
            isPrimary: true,
          },
        ],
      };

      const result = validateArgumentNet(argWithMultiplePrimaries);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "MULTIPLE_PRIMARY_SCHEMES")).toBe(true);
    });
  });

  describe("Statistics", () => {
    it("getArgumentSchemeStatistics should compute correct stats", () => {
      const stats = getArgumentSchemeStatistics(mockArgument);
      expect(stats.schemeCount).toBe(3);
      expect(stats.roles.primary).toBe(1);
      expect(stats.roles.supporting).toBe(1);
      expect(stats.roles.presupposed).toBe(1);
      expect(stats.explicitness.explicit).toBe(2);
      expect(stats.explicitness.presupposed).toBe(1);
      expect(stats.averageConfidence).toBeCloseTo(0.9);
    });

    it("getSchemeCountLabel should format labels correctly", () => {
      expect(getSchemeCountLabel(0)).toBe("No schemes");
      expect(getSchemeCountLabel(1)).toBe("Single scheme");
      expect(getSchemeCountLabel(3)).toBe("3 schemes");
    });
  });

  describe("Display Helpers", () => {
    it("getSchemeSummary should create readable summary", () => {
      const summary = getSchemeSummary(mockArgument);
      expect(summary).toContain("Practical Reasoning");
      expect(summary).toContain("+1 supporting");
      expect(summary).toContain("+1 presupposed");
    });

    it("sortSchemeInstances should sort by role and order", () => {
      const sorted = sortSchemeInstances(mockArgument.argumentSchemes);
      expect(sorted[0].role).toBe("primary");
      expect(sorted[1].role).toBe("supporting");
      expect(sorted[2].role).toBe("presupposed");
    });
  });
});
