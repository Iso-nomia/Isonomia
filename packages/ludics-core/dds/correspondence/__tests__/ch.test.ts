/**
 * Tests for Ch(S) operation
 * 
 * Based on Faggian & Hyland (2002) - Proposition 4.27
 */

import {
  computeCh,
  computeChOptimized,
  chroniclesToActs,
  getTerminalActions,
  groupChroniclesByTerminal,
  computeChronicleDepth,
  countUniqueLoci,
} from "../ch";
import type { Strategy, Play } from "../../strategy/types";
import type { Action, Chronicle } from "../../types";

describe("computeCh", () => {
  it("should extract chronicles from strategy", () => {
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
      isInnocent: false,
      satisfiesPropagation: false,
    };

    const result = computeCh(strategy);

    expect(result.strategyId).toBe("strategy-1");
    expect(result.chronicles.length).toBeGreaterThan(0);
  });

  it("should extract unique chronicles", () => {
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
        {
          id: "play-2",
          strategyId: "strategy-1",
          sequence: [
            { focus: "0", ramification: [1], polarity: "P" },
            { focus: "0.1", ramification: [], polarity: "O" },
          ],
          length: 2,
          isPositive: false,
        },
      ],
      isInnocent: false,
      satisfiesPropagation: false,
    };

    const result = computeCh(strategy);

    // Should deduplicate identical chronicles
    const uniqueKeys = new Set(
      result.chronicles.map(c => 
        c.actions.map(a => `${a.focus}:${a.polarity}`).join("|")
      )
    );
    expect(uniqueKeys.size).toBe(result.chronicles.length);
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

    const result = computeCh(strategy);

    expect(result.chronicles.length).toBe(0);
  });
});

describe("computeChOptimized", () => {
  it("should use branch optimization for innocent strategies", () => {
    const strategy: Strategy = {
      id: "strategy-1",
      designId: "design-1",
      player: "P",
      plays: [
        {
          id: "play-1",
          strategyId: "strategy-1",
          sequence: [
            { focus: "0", ramification: [1, 2], polarity: "P" },
            { focus: "0.1", ramification: [], polarity: "O" },
          ],
          length: 2,
          isPositive: false,
        },
      ],
      isInnocent: true,
      satisfiesPropagation: true,
    };

    const result = computeChOptimized(strategy);

    expect(result.strategyId).toBe("strategy-1");
    expect(result.chronicles.length).toBeGreaterThan(0);
  });

  it("should fall back to general algorithm for non-innocent strategies", () => {
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
      isInnocent: false,
      satisfiesPropagation: false,
    };

    const result = computeChOptimized(strategy);

    expect(result.strategyId).toBe("strategy-1");
  });
});

describe("chroniclesToActs", () => {
  it("should convert chronicles to design acts", () => {
    const chronicles: Chronicle[] = [
      {
        id: "c1",
        designId: "design-1",
        actions: [
          { focus: "0", ramification: [1, 2], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
        polarity: "P",
        isPositive: false,
      },
    ];

    const acts = chroniclesToActs(chronicles, "design-1");

    expect(acts.length).toBe(2);
    expect(acts.find(a => a.locusPath === "0")).toBeDefined();
    expect(acts.find(a => a.locusPath === "0.1")).toBeDefined();
  });

  it("should merge ramifications from multiple chronicles", () => {
    const chronicles: Chronicle[] = [
      {
        id: "c1",
        designId: "design-1",
        actions: [
          { focus: "0", ramification: [1], polarity: "P" },
        ],
        polarity: "P",
        isPositive: true,
      },
      {
        id: "c2",
        designId: "design-1",
        actions: [
          { focus: "0", ramification: [2], polarity: "P" },
        ],
        polarity: "P",
        isPositive: true,
      },
    ];

    const acts = chroniclesToActs(chronicles, "design-1");

    const rootAct = acts.find(a => a.locusPath === "0");
    expect(rootAct).toBeDefined();
    expect(rootAct!.ramification).toContain(1);
    expect(rootAct!.ramification).toContain(2);
  });
});

describe("getTerminalActions", () => {
  it("should get all terminal actions from chronicles", () => {
    const chronicles: Chronicle[] = [
      {
        id: "c1",
        designId: "design-1",
        actions: [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
        polarity: "P",
        isPositive: false,
      },
      {
        id: "c2",
        designId: "design-1",
        actions: [
          { focus: "0", ramification: [2], polarity: "P" },
          { focus: "0.2", ramification: [], polarity: "O" },
        ],
        polarity: "P",
        isPositive: false,
      },
    ];

    const terminals = getTerminalActions(chronicles);

    expect(terminals.length).toBe(2);
    expect(terminals.map(t => t.focus)).toContain("0.1");
    expect(terminals.map(t => t.focus)).toContain("0.2");
  });

  it("should deduplicate terminal actions", () => {
    const chronicles: Chronicle[] = [
      {
        id: "c1",
        designId: "design-1",
        actions: [
          { focus: "0", ramification: [], polarity: "P" },
        ],
        polarity: "P",
        isPositive: true,
      },
      {
        id: "c2",
        designId: "design-1",
        actions: [
          { focus: "0", ramification: [], polarity: "P" },
        ],
        polarity: "P",
        isPositive: true,
      },
    ];

    const terminals = getTerminalActions(chronicles);

    expect(terminals.length).toBe(1);
  });
});

describe("groupChroniclesByTerminal", () => {
  it("should group chronicles by terminal focus", () => {
    const chronicles: Chronicle[] = [
      {
        id: "c1",
        designId: "design-1",
        actions: [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
        polarity: "P",
        isPositive: false,
      },
      {
        id: "c2",
        designId: "design-1",
        actions: [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
        polarity: "P",
        isPositive: false,
      },
      {
        id: "c3",
        designId: "design-1",
        actions: [
          { focus: "0", ramification: [2], polarity: "P" },
          { focus: "0.2", ramification: [], polarity: "O" },
        ],
        polarity: "P",
        isPositive: false,
      },
    ];

    const groups = groupChroniclesByTerminal(chronicles);

    expect(groups.size).toBe(2);
    expect(groups.get("0.1")?.length).toBe(2);
    expect(groups.get("0.2")?.length).toBe(1);
  });
});

describe("computeChronicleDepth", () => {
  it("should compute depth of chronicle", () => {
    const chronicle: Chronicle = {
      id: "c1",
      designId: "design-1",
      actions: [
        { focus: "0", ramification: [1], polarity: "P" },
        { focus: "0.1", ramification: [2], polarity: "O" },
        { focus: "0.1.2", ramification: [], polarity: "P" },
      ],
      polarity: "P",
      isPositive: true,
    };

    const depth = computeChronicleDepth(chronicle);

    expect(depth).toBe(3);
  });

  it("should return 1 for root-only chronicle", () => {
    const chronicle: Chronicle = {
      id: "c1",
      designId: "design-1",
      actions: [
        { focus: "0", ramification: [], polarity: "P" },
      ],
      polarity: "P",
      isPositive: true,
    };

    const depth = computeChronicleDepth(chronicle);

    expect(depth).toBe(1);
  });
});

describe("countUniqueLoci", () => {
  it("should count unique loci across chronicles", () => {
    const chronicles: Chronicle[] = [
      {
        id: "c1",
        designId: "design-1",
        actions: [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
        polarity: "P",
        isPositive: false,
      },
      {
        id: "c2",
        designId: "design-1",
        actions: [
          { focus: "0", ramification: [2], polarity: "P" },
          { focus: "0.2", ramification: [], polarity: "O" },
        ],
        polarity: "P",
        isPositive: false,
      },
    ];

    const count = countUniqueLoci(chronicles);

    expect(count).toBe(3); // 0, 0.1, 0.2
  });
});
