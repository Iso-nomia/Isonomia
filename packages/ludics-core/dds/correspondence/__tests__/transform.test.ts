/**
 * Tests for Bidirectional Transformations
 * 
 * Based on Faggian & Hyland (2002) - §4.3
 * Tests for Design ↔ Strategy transformations
 */

import {
  designToStrategy,
  strategyToDesign,
  roundTripDesign,
  roundTripStrategy,
  verifyCorrespondence,
  createCorrespondenceFromDesign,
  createCorrespondenceFromStrategy,
  getTransformationSummary,
  isValidTransformation,
} from "../transform";
import type { Strategy, Play } from "../../strategy/types";
import type { DesignForCorrespondence, Correspondence, TransformResult } from "../types";

describe("designToStrategy", () => {
  it("should transform design to strategy via Disp", () => {
    const design: DesignForCorrespondence = {
      id: "design-1",
      deliberationId: "delib-1",
      participantId: "Proponent",
      acts: [
        { id: "a1", designId: "design-1", kind: "INITIAL", polarity: "P", locusPath: "0", ramification: [1] },
        { id: "a2", designId: "design-1", kind: "POSITIVE", polarity: "P", locusPath: "0.1", ramification: [] },
      ],
      loci: [],
    };

    const counterDesigns: DesignForCorrespondence[] = [
      {
        id: "counter-1",
        deliberationId: "delib-1",
        participantId: "Opponent",
        acts: [
          { id: "c1", designId: "counter-1", kind: "INITIAL", polarity: "O", locusPath: "0", ramification: [1] },
          { id: "c2", designId: "counter-1", kind: "NEGATIVE", polarity: "O", locusPath: "0.1", ramification: [] },
        ],
        loci: [],
      },
    ];

    const { strategy, transform } = designToStrategy(design, counterDesigns);

    expect(strategy.designId).toBe("design-1");
    expect(strategy.player).toBe("P");
    expect(transform.source).toBe("design");
    expect(transform.target).toBe("strategy");
    expect(transform.sourceId).toBe("design-1");
  });

  it("should create empty strategy for design without counter-designs", () => {
    const design: DesignForCorrespondence = {
      id: "design-1",
      deliberationId: "delib-1",
      participantId: "Proponent",
      acts: [
        { id: "a1", designId: "design-1", kind: "INITIAL", polarity: "P", locusPath: "0", ramification: [] },
      ],
      loci: [],
    };

    const { strategy, transform } = designToStrategy(design, []);

    expect(strategy.plays.length).toBe(0);
    expect(transform.verified).toBe(false);
  });

  it("should handle opponent design", () => {
    const design: DesignForCorrespondence = {
      id: "design-2",
      deliberationId: "delib-1",
      participantId: "Opponent",
      acts: [
        { id: "a1", designId: "design-2", kind: "INITIAL", polarity: "O", locusPath: "0", ramification: [] },
      ],
      loci: [],
    };

    const { strategy } = designToStrategy(design, []);

    expect(strategy.player).toBe("O");
  });
});

describe("strategyToDesign", () => {
  it("should transform strategy to design via Ch", () => {
    const strategy: Strategy = {
      id: "strategy-1",
      designId: "design-1",
      player: "P",
      plays: [
        {
          id: "play-1",
          strategyId: "strategy-1",
          sequence: [
            { focus: "0", ramification: [1], polarity: "P" },
            { focus: "0.1", ramification: [], polarity: "O" },
          ],
          length: 2,
          isPositive: false,
        },
      ],
      isInnocent: true,
      satisfiesPropagation: true,
    };

    const { design, transform } = strategyToDesign(strategy);

    expect(design.acts.length).toBeGreaterThan(0);
    expect(transform.source).toBe("strategy");
    expect(transform.target).toBe("design");
    expect(transform.sourceId).toBe("strategy-1");
  });

  it("should use originalDesignId when provided", () => {
    const strategy: Strategy = {
      id: "strategy-1",
      designId: "design-1",
      player: "P",
      plays: [],
      isInnocent: true,
      satisfiesPropagation: true,
    };

    const { design } = strategyToDesign(strategy, "original-design-id");

    expect(design.id).toBe("original-design-id");
  });

  it("should handle empty strategy", () => {
    const strategy: Strategy = {
      id: "strategy-1",
      designId: "design-1",
      player: "P",
      plays: [],
      isInnocent: true,
      satisfiesPropagation: true,
    };

    const { design, transform } = strategyToDesign(strategy);

    expect(design.acts.length).toBe(0);
    expect(transform.verified).toBe(false);
  });
});

describe("roundTripDesign", () => {
  it("should perform Design → Strategy → Design round trip", () => {
    const design: DesignForCorrespondence = {
      id: "design-1",
      deliberationId: "delib-1",
      participantId: "Proponent",
      acts: [
        { id: "a1", designId: "design-1", kind: "INITIAL", polarity: "P", locusPath: "0", ramification: [1] },
        { id: "a2", designId: "design-1", kind: "POSITIVE", polarity: "P", locusPath: "0.1", ramification: [] },
      ],
      loci: [],
    };

    const counterDesigns: DesignForCorrespondence[] = [
      {
        id: "counter-1",
        deliberationId: "delib-1",
        participantId: "Opponent",
        acts: [
          { id: "c1", designId: "counter-1", kind: "INITIAL", polarity: "O", locusPath: "0", ramification: [1] },
          { id: "c2", designId: "counter-1", kind: "NEGATIVE", polarity: "O", locusPath: "0.1", ramification: [] },
        ],
        loci: [],
      },
    ];

    const result = roundTripDesign(design, counterDesigns);

    expect(result.originalDesign.id).toBe("design-1");
    expect(result.strategy).toBeDefined();
    expect(result.reconstructedDesign).toBeDefined();
  });
});

describe("roundTripStrategy", () => {
  it("should perform Strategy → Design → Strategy round trip", () => {
    const strategy: Strategy = {
      id: "strategy-1",
      designId: "design-1",
      player: "P",
      plays: [
        {
          id: "play-1",
          strategyId: "strategy-1",
          sequence: [
            { focus: "0", ramification: [1], polarity: "P" },
          ],
          length: 1,
          isPositive: true,
        },
      ],
      isInnocent: true,
      satisfiesPropagation: true,
    };

    const counterDesigns: DesignForCorrespondence[] = [];

    const result = roundTripStrategy(strategy, counterDesigns);

    expect(result.originalStrategy.id).toBe("strategy-1");
    expect(result.design).toBeDefined();
    expect(result.reconstructedStrategy).toBeDefined();
  });
});

describe("verifyCorrespondence", () => {
  it("should verify correspondence between design and strategy", () => {
    const design: DesignForCorrespondence = {
      id: "design-1",
      deliberationId: "delib-1",
      participantId: "Proponent",
      acts: [
        { id: "a1", designId: "design-1", kind: "INITIAL", polarity: "P", locusPath: "0", ramification: [] },
      ],
      loci: [],
    };

    const strategy: Strategy = {
      id: "strategy-1",
      designId: "design-1",
      player: "P",
      plays: [
        {
          id: "play-1",
          strategyId: "strategy-1",
          sequence: [
            { focus: "0", ramification: [], polarity: "P" },
          ],
          length: 1,
          isPositive: true,
        },
      ],
      isInnocent: true,
      satisfiesPropagation: true,
    };

    const correspondence = verifyCorrespondence(design, strategy, []);

    expect(correspondence.designId).toBe("design-1");
    expect(correspondence.strategyId).toBe("strategy-1");
    expect(correspondence.isomorphisms).toBeDefined();
  });
});

describe("createCorrespondenceFromDesign", () => {
  it("should create correspondence starting from design", () => {
    const design: DesignForCorrespondence = {
      id: "design-1",
      deliberationId: "delib-1",
      participantId: "Proponent",
      acts: [
        { id: "a1", designId: "design-1", kind: "INITIAL", polarity: "P", locusPath: "0", ramification: [] },
      ],
      loci: [],
    };

    const { correspondence, strategy } = createCorrespondenceFromDesign(design, []);

    expect(correspondence.designId).toBe("design-1");
    expect(strategy).toBeDefined();
    expect(correspondence.type).toBe("design-to-strategy");
  });
});

describe("createCorrespondenceFromStrategy", () => {
  it("should create correspondence starting from strategy", () => {
    const strategy: Strategy = {
      id: "strategy-1",
      designId: "design-1",
      player: "P",
      plays: [],
      isInnocent: true,
      satisfiesPropagation: true,
    };

    const { correspondence, design } = createCorrespondenceFromStrategy(strategy, []);

    expect(correspondence.strategyId).toBe("strategy-1");
    expect(design).toBeDefined();
  });
});

describe("getTransformationSummary", () => {
  it("should generate summary for design-to-strategy transform", () => {
    const transform: TransformResult = {
      source: "design",
      target: "strategy",
      sourceId: "design-1",
      targetId: "strategy-1",
      verified: true,
      transformedAt: new Date(),
    };

    const summary = getTransformationSummary(transform);

    expect(summary).toContain("Design → Strategy");
    expect(summary).toContain("Disp");
    expect(summary).toContain("✓");
  });

  it("should generate summary for strategy-to-design transform", () => {
    const transform: TransformResult = {
      source: "strategy",
      target: "design",
      sourceId: "strategy-1",
      targetId: "design-1",
      verified: false,
      transformedAt: new Date(),
    };

    const summary = getTransformationSummary(transform);

    expect(summary).toContain("Strategy → Design");
    expect(summary).toContain("Ch");
    expect(summary).not.toContain("✓");
  });
});

describe("isValidTransformation", () => {
  it("should return true for valid verified transformation", () => {
    const transform: TransformResult = {
      source: "design",
      target: "strategy",
      sourceId: "design-1",
      targetId: "strategy-1",
      verified: true,
      transformedAt: new Date(),
    };

    const correspondence: Correspondence = {
      id: "corr-1",
      designId: "design-1",
      strategyId: "strategy-1",
      type: "design-to-strategy",
      isVerified: true,
      isomorphisms: {
        playsViews: { holds: true, checked: true },
        viewsPlays: { holds: true, checked: true },
        dispCh: { holds: true, checked: true },
        chDisp: { holds: true, checked: true },
      },
    };

    expect(isValidTransformation(transform, correspondence)).toBe(true);
  });

  it("should return false for unverified correspondence", () => {
    const transform: TransformResult = {
      source: "design",
      target: "strategy",
      sourceId: "design-1",
      targetId: "strategy-1",
      verified: true,
      transformedAt: new Date(),
    };

    const correspondence: Correspondence = {
      id: "corr-1",
      designId: "design-1",
      strategyId: "strategy-1",
      type: "design-to-strategy",
      isVerified: false,
      isomorphisms: {
        playsViews: { holds: false, checked: true },
        viewsPlays: { holds: true, checked: true },
        dispCh: { holds: true, checked: true },
        chDisp: { holds: true, checked: true },
      },
    };

    expect(isValidTransformation(transform, correspondence)).toBe(false);
  });

  it("should return false for mismatched IDs", () => {
    const transform: TransformResult = {
      source: "design",
      target: "strategy",
      sourceId: "design-2",
      targetId: "strategy-2",
      verified: true,
      transformedAt: new Date(),
    };

    const correspondence: Correspondence = {
      id: "corr-1",
      designId: "design-1",
      strategyId: "strategy-1",
      type: "design-to-strategy",
      isVerified: true,
      isomorphisms: {
        playsViews: { holds: true, checked: true },
        viewsPlays: { holds: true, checked: true },
        dispCh: { holds: true, checked: true },
        chDisp: { holds: true, checked: true },
      },
    };

    expect(isValidTransformation(transform, correspondence)).toBe(false);
  });
});
