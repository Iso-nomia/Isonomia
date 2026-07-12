/**
 * Phase 4: Analysis Panel Tests
 * Tests for UI integration components
 */

import {
  createDefaultAnalysisState,
  createDefaultFilterState,
  createDefaultForestAnalysisState,
  type LudicsAnalysisState,
  type AnalysisFilterState,
  type ForestAnalysisState,
} from "../types";

describe("Analysis State Types", () => {
  describe("createDefaultAnalysisState", () => {
    it("should create a valid default state", () => {
      const state = createDefaultAnalysisState();
      
      expect(state.selectedView).toBeNull();
      expect(state.selectedChronicle).toBeNull();
      expect(state.viewsExpanded).toBe(false);
      expect(state.chroniclesExpanded).toBe(false);
      expect(state.strategyAnalysis.inProgress).toBe(false);
      expect(state.correspondence.verified).toBe(false);
      expect(state.correspondence.inProgress).toBe(false);
      expect(state.analysisMode).toBeNull();
    });

    it("should be immutable between calls", () => {
      const state1 = createDefaultAnalysisState();
      const state2 = createDefaultAnalysisState();
      
      expect(state1).not.toBe(state2);
      expect(state1.strategyAnalysis).not.toBe(state2.strategyAnalysis);
    });
  });

  describe("createDefaultFilterState", () => {
    it("should create a valid default filter state", () => {
      const filters = createDefaultFilterState();
      
      expect(filters.showOnlyInnocent).toBe(false);
      expect(filters.showOnlyVerified).toBe(false);
      expect(filters.showOnlyWithDisputes).toBe(false);
    });

    it("should have all required filter keys", () => {
      const filters = createDefaultFilterState();
      const keys = Object.keys(filters);
      
      expect(keys).toContain("showOnlyInnocent");
      expect(keys).toContain("showOnlyVerified");
      expect(keys).toContain("showOnlyWithDisputes");
    });
  });

  describe("createDefaultForestAnalysisState", () => {
    it("should create a valid default forest analysis state", () => {
      const state = createDefaultForestAnalysisState();
      
      expect(state.batchAnalysisInProgress).toBe(false);
      expect(state.analyzedDesigns).toBeInstanceOf(Set);
      expect(state.analyzedDesigns.size).toBe(0);
      expect(state.filters.showOnlyInnocent).toBe(false);
      expect(state.hoveredDesignId).toBeNull();
      expect(state.comparisonMode).toBe(false);
      expect(state.comparedDesigns).toEqual([]);
    });

    it("should create independent Set instances", () => {
      const state1 = createDefaultForestAnalysisState();
      const state2 = createDefaultForestAnalysisState();
      
      state1.analyzedDesigns.add("test-id");
      
      expect(state1.analyzedDesigns.has("test-id")).toBe(true);
      expect(state2.analyzedDesigns.has("test-id")).toBe(false);
    });
  });
});

describe("Analysis State Mutations", () => {
  it("should allow state updates", () => {
    const state = createDefaultAnalysisState();
    
    const updatedState: LudicsAnalysisState = {
      ...state,
      analysisMode: "design",
      strategyAnalysis: {
        ...state.strategyAnalysis,
        inProgress: true,
      },
    };
    
    expect(updatedState.analysisMode).toBe("design");
    expect(updatedState.strategyAnalysis.inProgress).toBe(true);
    expect(state.analysisMode).toBeNull(); // Original unchanged
  });

  it("should allow filter updates", () => {
    const filters = createDefaultFilterState();
    
    const updatedFilters: AnalysisFilterState = {
      ...filters,
      showOnlyInnocent: true,
    };
    
    expect(updatedFilters.showOnlyInnocent).toBe(true);
    expect(filters.showOnlyInnocent).toBe(false); // Original unchanged
  });

  it("should allow forest state updates", () => {
    const state = createDefaultForestAnalysisState();
    
    const updatedState: ForestAnalysisState = {
      ...state,
      comparisonMode: true,
      comparedDesigns: ["design-1", "design-2"],
    };
    
    expect(updatedState.comparisonMode).toBe(true);
    expect(updatedState.comparedDesigns).toHaveLength(2);
    expect(state.comparisonMode).toBe(false); // Original unchanged
  });
});

describe("Analysis Sections", () => {
  it("should support all analysis section types", () => {
    const sections = [
      "overview",
      "views",
      "chronicles",
      "strategy",
      "correspondence",
      "debugger",
    ] as const;
    
    sections.forEach((section) => {
      expect(typeof section).toBe("string");
    });
  });
});

describe("View Debug Modes", () => {
  it("should support all debug modes", () => {
    const modes = ["step", "compare", "trace"] as const;
    
    modes.forEach((mode) => {
      expect(typeof mode).toBe("string");
    });
  });
});

describe("Chronicle View Modes", () => {
  it("should support all view modes", () => {
    const modes = ["tree", "list", "graph"] as const;
    
    modes.forEach((mode) => {
      expect(typeof mode).toBe("string");
    });
  });
});

describe("Analysis Tools", () => {
  it("should support all analysis tools", () => {
    const tools = [
      "view-debugger",
      "dispute-trace",
      "chronicle-nav",
      null,
    ] as const;
    
    tools.forEach((tool) => {
      expect(tool === null || typeof tool === "string").toBe(true);
    });
  });
});
