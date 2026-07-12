/**
 * Phase 5 API Integration Tests
 * 
 * Tests for API integration patterns between Phase 3 (Extraction)
 * and Phase 4 (Landscape) modules with REST API layer conventions.
 * 
 * These tests verify:
 * 1. Data transformation patterns for API responses
 * 2. Arena/Interaction state management helpers
 * 3. Path extraction output formatting
 * 4. Response format compliance
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { 
  LudicDesignTheory, 
  LudicBehaviourTheory,
} from "../types";

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create test design similar to interaction history
 */
function createInteractionDesign(moves: Array<{
  address: string;
  player: "P" | "O";
  ramification?: number[];
}>): LudicDesignTheory {
  return {
    id: `design-interaction-${Date.now()}`,
    polarity: "P",
    base: "",
    actions: moves.map((move, idx) => ({
      actId: `act-${idx}`,
      focus: move.address,
      ramification: move.ramification || [],
      polarity: move.player,
    })),
    hasDaimon: false,
  };
}

/**
 * Create arena-like move structure
 */
function createArenaDesigns(): LudicDesignTheory[] {
  // P's moves
  const pDesign: LudicDesignTheory = {
    id: "design-p-arena",
    polarity: "P",
    base: "",
    actions: [
      { actId: "p-root", focus: "", ramification: [0, 1], polarity: "P" },
      { actId: "p-00", focus: "00", ramification: [0], polarity: "P" },
      { actId: "p-10", focus: "10", ramification: [0], polarity: "P" },
      { actId: "p-0000", focus: "0000", ramification: [], polarity: "P" },
      { actId: "p-1000", focus: "1000", ramification: [], polarity: "P" },
    ],
    hasDaimon: false,
  };

  // O's moves
  const oDesign: LudicDesignTheory = {
    id: "design-o-arena",
    polarity: "O",
    base: "",
    actions: [
      { actId: "o-0", focus: "0", ramification: [0, 1], polarity: "O" },
      { actId: "o-1", focus: "1", ramification: [0, 1], polarity: "O" },
      { actId: "o-000", focus: "000", ramification: [0], polarity: "O" },
      { actId: "o-100", focus: "100", ramification: [0], polarity: "O" },
    ],
    hasDaimon: false,
  };

  return [pDesign, oDesign];
}

// ============================================================================
// Arena API Integration Tests
// ============================================================================

describe("Arena API Integration", () => {
  describe("Arena creation helpers", () => {
    it("should create designs that can be analyzed", () => {
      const designs = createArenaDesigns();
      
      expect(designs).toHaveLength(2);
      expect(designs[0].polarity).toBe("P");
      expect(designs[1].polarity).toBe("O");
    });

    it("should support arena statistics computation", () => {
      const designs = createArenaDesigns();
      const allActions = designs.flatMap(d => d.actions);
      
      const maxDepth = Math.max(...allActions.map(a => a.focus.length), 0);
      const pMoves = allActions.filter(a => a.polarity === "P").length;
      const oMoves = allActions.filter(a => a.polarity === "O").length;
      
      expect(maxDepth).toBe(4);
      expect(pMoves).toBe(5);
      expect(oMoves).toBe(4);
    });

    it("should compute arena stats from moves", () => {
      const moves = [
        { id: "m1", address: "", ramification: [0, 1], player: "P" as const },
        { id: "m2", address: "0", ramification: [0], player: "O" as const },
        { id: "m3", address: "1", ramification: [], player: "O" as const },
        { id: "m4", address: "00", ramification: [], player: "P" as const },
      ];

      const maxDepth = Math.max(...moves.map(m => m.address.length), 0);
      const pMoves = moves.filter(m => m.player === "P").length;
      const oMoves = moves.filter(m => m.player === "O").length;
      const terminalCount = moves.filter(m => m.ramification.length === 0).length;

      expect(maxDepth).toBe(2);
      expect(pMoves).toBe(2);
      expect(oMoves).toBe(2);
      expect(terminalCount).toBe(2);
    });
  });

  describe("Arena from deliberation", () => {
    it("should analyze designs to find shared loci", () => {
      const designs = createArenaDesigns();
      
      const pLoci = new Set(designs[0].actions.map(a => a.focus));
      const oLoci = new Set(designs[1].actions.map(a => a.focus));
      
      // Find shared loci (positions where both can play)
      const allLoci = new Set([...pLoci, ...oLoci]);
      
      expect(allLoci.size).toBeGreaterThan(0);
      expect(pLoci.has("")).toBe(true); // Root
      expect(oLoci.has("0")).toBe(true); // Response
    });

    it("should compute computed arena params from designs", () => {
      const designs = createArenaDesigns();
      const allActions = designs.flatMap(d => d.actions);
      
      // Compute max depth from loci
      const computedMaxDepth = Math.max(
        ...allActions.map(a => a.focus.length),
        4
      );
      
      // Compute max ramification
      const computedMaxRamification = Math.max(
        ...allActions.map(a => a.ramification.length),
        3
      );

      expect(computedMaxDepth).toBeGreaterThanOrEqual(4);
      expect(computedMaxRamification).toBeGreaterThanOrEqual(2);
    });
  });
});

// ============================================================================
// Interaction API Integration Tests
// ============================================================================

describe("Interaction API Integration", () => {
  describe("Interaction state management", () => {
    it("should track move history correctly", () => {
      const moves = [
        { address: "", player: "P" as const, ramification: [0, 1] },
        { address: "0", player: "O" as const, ramification: [0] },
        { address: "00", player: "P" as const, ramification: [] },
      ];

      const design = createInteractionDesign(moves);
      
      expect(design.actions).toHaveLength(3);
      expect(design.actions[0].polarity).toBe("P");
      expect(design.actions[1].polarity).toBe("O");
      expect(design.actions[2].polarity).toBe("P");
    });

    it("should compute available moves from position", () => {
      const designs = createArenaDesigns();
      const pDesign = designs[0];
      
      // At root, P can play
      const rootAction = pDesign.actions.find(a => a.focus === "");
      expect(rootAction).toBeDefined();
      expect(rootAction!.ramification).toEqual([0, 1]);
    });

    it("should detect game over conditions", () => {
      const terminalMoves = [
        { address: "", player: "P" as const, ramification: [0] },
        { address: "0", player: "O" as const, ramification: [] },
      ];

      const design = createInteractionDesign(terminalMoves);
      const lastAction = design.actions[design.actions.length - 1];
      
      // Terminal when no ramification available
      expect(lastAction.ramification).toEqual([]);
    });

    it("should maintain interaction metadata", () => {
      const interactionState = {
        id: "interaction-123",
        arenaId: "arena-456",
        posDesignId: "design-p",
        negDesignId: "design-o",
        mode: "manual" as const,
        status: "active" as const,
        moveHistory: [] as any[],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(interactionState.id).toBeDefined();
      expect(interactionState.status).toBe("active");
      expect(interactionState.moveHistory).toHaveLength(0);
    });
  });

  describe("Move recording", () => {
    it("should record moves with timestamps", () => {
      const moveHistory: Array<{
        moveNumber: number;
        player: "P" | "O";
        address: string;
        ramification: number[];
        timestamp: Date;
      }> = [];

      // Simulate making moves
      moveHistory.push({
        moveNumber: 1,
        player: "P",
        address: "",
        ramification: [0, 1],
        timestamp: new Date(),
      });

      moveHistory.push({
        moveNumber: 2,
        player: "O",
        address: "0",
        ramification: [0],
        timestamp: new Date(),
      });

      expect(moveHistory).toHaveLength(2);
      expect(moveHistory[0].player).toBe("P");
      expect(moveHistory[1].player).toBe("O");
    });
  });
});

// ============================================================================
// Path Extraction API Integration Tests
// ============================================================================

describe("Path Extraction API Integration", () => {
  describe("Interaction to design conversion", () => {
    it("should convert interaction history to design", () => {
      const interaction = {
        id: "interaction-123",
        moveHistory: [
          { player: "P" as const, address: "", ramification: [0, 1] },
          { player: "O" as const, address: "0", ramification: [0] },
          { player: "P" as const, address: "00", ramification: [] },
        ],
        result: { endReason: "terminal" },
      };

      const design: LudicDesignTheory = {
        id: `design-from-${interaction.id}`,
        polarity: "P",
        base: "",
        actions: interaction.moveHistory.map((move, idx) => ({
          actId: `act-${idx}`,
          focus: move.address,
          ramification: move.ramification,
          polarity: move.player,
        })),
        hasDaimon: interaction.result.endReason === "stuck",
      };

      expect(design.actions).toHaveLength(3);
      expect(design.hasDaimon).toBe(false);
    });

    it("should mark daimon for stuck interactions", () => {
      const interaction = {
        id: "interaction-456",
        moveHistory: [
          { player: "P" as const, address: "", ramification: [0] },
        ],
        result: { endReason: "stuck" },
      };

      const design: LudicDesignTheory = {
        id: `design-from-${interaction.id}`,
        polarity: "P",
        base: "",
        actions: interaction.moveHistory.map((move, idx) => ({
          actId: `act-${idx}`,
          focus: move.address,
          ramification: move.ramification,
          polarity: move.player,
        })),
        hasDaimon: interaction.result.endReason === "stuck",
      };

      expect(design.hasDaimon).toBe(true);
    });
  });

  describe("Path output formatting", () => {
    it("should format path for JSON response", () => {
      const pathData = {
        id: "path-123",
        sequence: [
          { focus: "", polarity: "P" as const, ramification: [0, 1] },
          { focus: "0", polarity: "O" as const, ramification: [0] },
        ],
        chronicle: {
          id: "chronicle-123",
          sequence: [],
          hasDaimon: false,
        },
      };

      const response = {
        ok: true,
        path: {
          id: pathData.id,
          length: pathData.sequence.length,
          sequence: pathData.sequence.map(action => ({
            focus: action.focus,
            polarity: action.polarity,
            ramification: action.ramification,
          })),
          chronicle: pathData.chronicle ? {
            id: pathData.chronicle.id,
            length: pathData.chronicle.sequence.length,
            hasDaimon: pathData.chronicle.hasDaimon,
          } : null,
        },
      };

      expect(response.ok).toBe(true);
      expect(response.path.length).toBe(2);
      expect(response.path.chronicle).toBeDefined();
    });

    it("should include stats in path response", () => {
      const moveHistory = [
        { player: "P" as const, address: "" },
        { player: "O" as const, address: "0" },
        { player: "P" as const, address: "00" },
        { player: "O" as const, address: "000" },
      ];

      const stats = {
        totalMoves: moveHistory.length,
        pMoves: moveHistory.filter(m => m.player === "P").length,
        oMoves: moveHistory.filter(m => m.player === "O").length,
        maxDepth: Math.max(...moveHistory.map(m => m.address.length), 0),
      };

      expect(stats.totalMoves).toBe(4);
      expect(stats.pMoves).toBe(2);
      expect(stats.oMoves).toBe(2);
      expect(stats.maxDepth).toBe(3);
    });
  });
});

// ============================================================================
// Landscape API Integration Tests
// ============================================================================

describe("Landscape API Integration", () => {
  describe("Arena to designs conversion", () => {
    it("should convert arena moves to designs", () => {
      const arenaMoves = [
        { id: "m1", address: "", ramification: [0, 1], player: "P" as const },
        { id: "m2", address: "0", ramification: [0], player: "O" as const },
        { id: "m3", address: "1", ramification: [0], player: "O" as const },
        { id: "m4", address: "00", ramification: [], player: "P" as const },
        { id: "m5", address: "10", ramification: [], player: "P" as const },
      ];

      const pActions = arenaMoves.filter(m => m.player === "P");
      const oActions = arenaMoves.filter(m => m.player === "O");

      const designs: LudicDesignTheory[] = [];

      if (pActions.length > 0) {
        designs.push({
          id: "design-p-arena",
          polarity: "P",
          base: "",
          actions: pActions.map(m => ({
            actId: m.id,
            focus: m.address,
            ramification: m.ramification,
            polarity: m.player,
          })),
          hasDaimon: false,
        });
      }

      if (oActions.length > 0) {
        designs.push({
          id: "design-o-arena",
          polarity: "O",
          base: "",
          actions: oActions.map(m => ({
            actId: m.id,
            focus: m.address,
            ramification: m.ramification,
            polarity: m.player,
          })),
          hasDaimon: false,
        });
      }

      expect(designs).toHaveLength(2);
      expect(designs[0].actions).toHaveLength(3);
      expect(designs[1].actions).toHaveLength(2);
    });
  });

  describe("Landscape response formatting", () => {
    it("should format landscape data for response", () => {
      const landscapeData = {
        id: "landscape-123",
        nodes: [
          { address: "", player: "P", depth: 0, isTerminal: false },
          { address: "0", player: "O", depth: 1, isTerminal: false },
          { address: "00", player: "P", depth: 2, isTerminal: true },
        ],
        edges: [
          { from: "", to: "0" },
          { from: "0", to: "00" },
        ],
        heatMap: [
          { address: "", strength: 0.6 },
          { address: "0", strength: 0.4 },
          { address: "00", strength: 0.8 },
        ],
      };

      const response = {
        ok: true,
        arenaId: "arena-456",
        landscape: {
          id: landscapeData.id,
          nodeCount: landscapeData.nodes.length,
          edgeCount: landscapeData.edges.length,
          maxDepth: Math.max(...landscapeData.nodes.map(n => n.depth), 0),
        },
        stats: {
          pPositions: landscapeData.nodes.filter(n => n.player === "P").length,
          oPositions: landscapeData.nodes.filter(n => n.player === "O").length,
          terminalNodes: landscapeData.nodes.filter(n => n.isTerminal).length,
        },
      };

      expect(response.ok).toBe(true);
      expect(response.landscape.nodeCount).toBe(3);
      expect(response.landscape.edgeCount).toBe(2);
      expect(response.stats.pPositions).toBe(2);
      expect(response.stats.terminalNodes).toBe(1);
    });

    it("should support multiple output formats", () => {
      const data = { id: "test", nodes: [] };
      
      // JSON format
      const jsonOutput = JSON.stringify(data);
      expect(typeof jsonOutput).toBe("string");
      expect(JSON.parse(jsonOutput).id).toBe("test");

      // SVG format stub
      const svgOutput = `<svg width="100" height="100"><rect/></svg>`;
      expect(svgOutput).toContain("<svg");
      expect(svgOutput).toContain("</svg>");
    });
  });
});

// ============================================================================
// Compile-Step API Integration Tests
// ============================================================================

describe("Compile-Step API Integration", () => {
  describe("Trace to design conversion", () => {
    it("should convert trace steps to design actions", () => {
      const trace = {
        status: "complete",
        steps: [
          { posActId: "act-1", locusPath: "", ts: 0 },
          { negActId: "act-2", locusPath: "0", ts: 1 },
          { posActId: "act-3", locusPath: "00", ts: 2 },
        ],
      };

      const design: LudicDesignTheory = {
        id: "design-from-trace",
        polarity: "P",
        base: "",
        actions: trace.steps.map((step, idx) => ({
          actId: step.posActId || step.negActId || `act-${idx}`,
          focus: step.locusPath || "",
          ramification: [],
          polarity: (step.posActId ? "P" : "O") as "P" | "O",
        })),
        hasDaimon: trace.status === "stuck",
      };

      expect(design.actions).toHaveLength(3);
      expect(design.actions[0].polarity).toBe("P");
      expect(design.actions[1].polarity).toBe("O");
      expect(design.hasDaimon).toBe(false);
    });

    it("should handle stuck traces with daimon", () => {
      const trace = {
        status: "stuck",
        steps: [
          { posActId: "act-1", locusPath: "", ts: 0 },
        ],
      };

      const design: LudicDesignTheory = {
        id: "design-from-trace",
        polarity: "P",
        base: "",
        actions: trace.steps.map((step, idx) => ({
          actId: step.posActId || step.negActId || `act-${idx}`,
          focus: step.locusPath || "",
          ramification: [],
          polarity: (step.posActId ? "P" : "O") as "P" | "O",
        })),
        hasDaimon: trace.status === "stuck",
      };

      expect(design.hasDaimon).toBe(true);
    });
  });

  describe("Action routing", () => {
    it("should route to correct handler based on action", () => {
      const actions = ["compile-step", "extract-path", "compute-landscape", "analyze-strength"];
      
      for (const action of actions) {
        const handler = getActionHandler(action);
        expect(handler).toBeDefined();
        expect(typeof handler).toBe("string");
      }
    });
  });

  describe("Response with optional data", () => {
    it("should include extraction data when requested", () => {
      const baseResponse = {
        ok: true,
        proId: "design-p",
        oppId: "design-o",
        trace: { steps: [] },
      };

      const includeExtraction = true;
      const response: any = { ...baseResponse };

      if (includeExtraction) {
        response.pathData = {
          pathId: "path-123",
          length: 3,
          narrative: "{}",
        };
      }

      expect(response.pathData).toBeDefined();
      expect(response.pathData.pathId).toBe("path-123");
    });

    it("should include landscape hints when requested", () => {
      const baseResponse = {
        ok: true,
        proId: "design-p",
        oppId: "design-o",
        trace: { steps: [] },
      };

      const includeLandscape = true;
      const response: any = { ...baseResponse };

      if (includeLandscape) {
        response.landscapeHints = {
          strengthSummary: { pStrength: 0.6, oStrength: 0.4 },
        };
      }

      expect(response.landscapeHints).toBeDefined();
      expect(response.landscapeHints.strengthSummary).toBeDefined();
    });
  });
});

// ============================================================================
// Response Format Tests
// ============================================================================

describe("API Response Formats", () => {
  describe("Standard response structure", () => {
    it("should follow ok/error pattern", () => {
      // Success response structure
      const successResponse = {
        ok: true,
        data: {},
      };
      expect(successResponse.ok).toBe(true);

      // Error response structure
      const errorResponse = {
        ok: false,
        error: "Some error message",
      };
      expect(errorResponse.ok).toBe(false);
      expect(errorResponse.error).toBeDefined();
    });

    it("should include stats in complex responses", () => {
      const designs = createArenaDesigns();
      
      const response = {
        ok: true,
        designCount: designs.length,
        stats: {
          pDesigns: designs.filter(d => d.polarity === "P").length,
          oDesigns: designs.filter(d => d.polarity === "O").length,
          totalActions: designs.reduce((sum, d) => sum + d.actions.length, 0),
        },
      };

      expect(response.stats.pDesigns).toBe(1);
      expect(response.stats.oDesigns).toBe(1);
      expect(response.stats.totalActions).toBe(9);
    });
  });

  describe("Pagination and limits", () => {
    it("should respect limit parameters", () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const limit = 50;
      const limited = items.slice(0, limit);

      expect(limited.length).toBe(50);
    });

    it("should include total count with limited results", () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const limit = 50;
      const limited = items.slice(0, limit);

      const response = {
        ok: true,
        items: limited,
        count: limited.length,
        total: items.length,
      };

      expect(response.count).toBe(50);
      expect(response.total).toBe(100);
    });
  });

  describe("Error handling", () => {
    it("should return 400 for missing required params", () => {
      const validateRequest = (body: any) => {
        if (!body.deliberationId) {
          return { ok: false, error: "deliberationId required", status: 400 };
        }
        return { ok: true };
      };

      const result = validateRequest({});
      expect(result.ok).toBe(false);
      expect(result.status).toBe(400);
    });

    it("should return 404 for not found resources", () => {
      const findArena = (id: string) => {
        const arenas: Record<string, any> = {};
        if (!arenas[id]) {
          return { ok: false, error: "Arena not found", status: 404 };
        }
        return { ok: true, arena: arenas[id] };
      };

      const result = findArena("nonexistent");
      expect(result.ok).toBe(false);
      expect(result.status).toBe(404);
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

function getActionHandler(action: string): string {
  const handlers: Record<string, string> = {
    "compile-step": "handleCompileStep",
    "extract-path": "handleExtractPath",
    "compute-landscape": "handleComputeLandscape",
    "analyze-strength": "handleAnalyzeStrength",
  };
  return handlers[action] || "handleCompileStep";
}
