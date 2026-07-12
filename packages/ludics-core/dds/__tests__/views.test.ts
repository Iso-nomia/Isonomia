/**
 * DDS Views Module Tests
 * Tests for view extraction (Definition 3.5 from Faggian & Hyland)
 */

import {
  extractView,
  extractProponentView,
  extractOpponentView,
  isInitial,
  findJustifier,
  viewsEqual,
  isViewPrefix,
  viewToKey,
} from "../views";
import type { Position, Action } from "../types";

describe("View Extraction", () => {
  describe("extractView", () => {
    it("should extract proponent view correctly for simple alternation", () => {
      const position: Position = {
        id: "test",
        sequence: [
          { focus: "0", ramification: [1, 2], polarity: "P" },
          { focus: "0.1", ramification: [3], polarity: "O" },
          { focus: "0.1.3", ramification: [], polarity: "P" },
        ],
        player: "O",
        isLinear: true,
        isLegal: true,
      };

      const view = extractProponentView(position);

      // P sees: initial P action + their response
      // After O's action at 0.1, P's view should be justifier + O action
      // Then P plays at 0.1.3
      expect(view.length).toBeGreaterThan(0);
      expect(view[view.length - 1].focus).toBe("0.1.3");
      expect(view[view.length - 1].polarity).toBe("P");
    });

    it("should extract opponent view correctly", () => {
      const position: Position = {
        id: "test",
        sequence: [
          { focus: "0", ramification: [1, 2], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
        player: "P",
        isLinear: true,
        isLegal: true,
      };

      const view = extractOpponentView(position);

      expect(view.length).toBeGreaterThan(0);
      expect(view[view.length - 1].focus).toBe("0.1");
      expect(view[view.length - 1].polarity).toBe("O");
    });

    it("should handle empty position", () => {
      const position: Position = {
        id: "test",
        sequence: [],
        player: "P",
        isLinear: true,
        isLegal: true,
      };

      const pView = extractProponentView(position);
      const oView = extractOpponentView(position);

      expect(pView.length).toBe(0);
      expect(oView.length).toBe(0);
    });

    it("should handle single initial action", () => {
      const position: Position = {
        id: "test",
        sequence: [{ focus: "0", ramification: [1], polarity: "P" }],
        player: "O",
        isLinear: true,
        isLegal: true,
      };

      const pView = extractProponentView(position);
      const oView = extractOpponentView(position);

      expect(pView.length).toBe(1);
      expect(pView[0].focus).toBe("0");
      expect(oView.length).toBe(1); // O also sees P's initial move
    });
  });

  describe("isInitial", () => {
    it("should identify root locus as initial", () => {
      expect(isInitial({ focus: "0", ramification: [], polarity: "P" })).toBe(
        true
      );
    });

    it("should identify empty focus as initial", () => {
      expect(isInitial({ focus: "", ramification: [], polarity: "P" })).toBe(
        true
      );
    });

    it("should identify <> as initial", () => {
      expect(isInitial({ focus: "<>", ramification: [], polarity: "P" })).toBe(
        true
      );
    });

    it("should not identify nested locus as initial", () => {
      expect(isInitial({ focus: "0.1", ramification: [], polarity: "P" })).toBe(
        false
      );
      expect(
        isInitial({ focus: "0.1.2", ramification: [], polarity: "P" })
      ).toBe(false);
    });
  });

  describe("findJustifier", () => {
    it("should find justifier in view", () => {
      const view: Action[] = [
        { focus: "0", ramification: [1, 2], polarity: "P" },
        { focus: "0.1", ramification: [3], polarity: "O" },
      ];

      const action: Action = { focus: "0.1.3", ramification: [], polarity: "P" };
      const justifier = findJustifier(action, view);

      expect(justifier).not.toBeNull();
      expect(justifier?.focus).toBe("0.1");
    });

    it("should return null if no justifier found", () => {
      const view: Action[] = [
        { focus: "0", ramification: [1], polarity: "P" },
      ];

      const action: Action = { focus: "0.2.3", ramification: [], polarity: "P" };
      const justifier = findJustifier(action, view);

      expect(justifier).toBeNull();
    });

    it("should return null for root actions", () => {
      const view: Action[] = [];
      const action: Action = { focus: "0", ramification: [], polarity: "P" };
      const justifier = findJustifier(action, view);

      expect(justifier).toBeNull();
    });
  });

  describe("viewsEqual", () => {
    it("should return true for identical views", () => {
      const view1: Action[] = [
        { focus: "0", ramification: [1], polarity: "P" },
      ];
      const view2: Action[] = [
        { focus: "0", ramification: [1], polarity: "P" },
      ];

      expect(viewsEqual(view1, view2)).toBe(true);
    });

    it("should return false for different lengths", () => {
      const view1: Action[] = [
        { focus: "0", ramification: [1], polarity: "P" },
      ];
      const view2: Action[] = [
        { focus: "0", ramification: [1], polarity: "P" },
        { focus: "0.1", ramification: [], polarity: "O" },
      ];

      expect(viewsEqual(view1, view2)).toBe(false);
    });

    it("should return false for different foci", () => {
      const view1: Action[] = [
        { focus: "0", ramification: [1], polarity: "P" },
      ];
      const view2: Action[] = [
        { focus: "0.1", ramification: [1], polarity: "P" },
      ];

      expect(viewsEqual(view1, view2)).toBe(false);
    });
  });

  describe("isViewPrefix", () => {
    it("should return true for valid prefix", () => {
      const prefix: Action[] = [
        { focus: "0", ramification: [1], polarity: "P" },
      ];
      const full: Action[] = [
        { focus: "0", ramification: [1], polarity: "P" },
        { focus: "0.1", ramification: [], polarity: "O" },
      ];

      expect(isViewPrefix(prefix, full)).toBe(true);
    });

    it("should return false if prefix is longer", () => {
      const prefix: Action[] = [
        { focus: "0", ramification: [1], polarity: "P" },
        { focus: "0.1", ramification: [], polarity: "O" },
      ];
      const full: Action[] = [
        { focus: "0", ramification: [1], polarity: "P" },
      ];

      expect(isViewPrefix(prefix, full)).toBe(false);
    });

    it("should return true for identical views (prefix = full)", () => {
      const view: Action[] = [
        { focus: "0", ramification: [1], polarity: "P" },
      ];

      expect(isViewPrefix(view, view)).toBe(true);
    });
  });

  describe("viewToKey", () => {
    it("should produce same key for equal views", () => {
      const view1: Action[] = [
        { focus: "0", ramification: [1, 2], polarity: "P" },
      ];
      const view2: Action[] = [
        { focus: "0", ramification: [1, 2], polarity: "P" },
      ];

      expect(viewToKey(view1)).toBe(viewToKey(view2));
    });

    it("should produce different keys for different views", () => {
      const view1: Action[] = [
        { focus: "0", ramification: [1], polarity: "P" },
      ];
      const view2: Action[] = [
        { focus: "0", ramification: [2], polarity: "P" },
      ];

      expect(viewToKey(view1)).not.toBe(viewToKey(view2));
    });
  });
});
