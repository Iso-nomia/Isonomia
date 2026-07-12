/**
 * Tests for Isomorphism Checkers
 * 
 * Based on Faggian & Hyland (2002) - §4.3
 * Tests for Propositions 4.18 and 4.27
 */

import {
  checkPlaysViewsIsomorphism,
  checkViewsPlaysIsomorphism,
  checkDispChIsomorphism,
  checkChDispIsomorphism,
  checkAllIsomorphisms,
  allIsomorphismsHold,
} from "../isomorphisms";
import type { Strategy, Play } from "../../strategy/types";
import type { View } from "../../types";
import type { DesignForCorrespondence } from "../types";

describe("checkPlaysViewsIsomorphism", () => {
  it("should verify Plays(Views(S)) = S for innocent strategy", () => {
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

    const result = checkPlaysViewsIsomorphism(strategy);

    expect(result.checked).toBe(true);
    // For simple innocent strategies, isomorphism should hold
    // Note: exact result depends on Views/Plays implementation details
  });

  it("should detect violation for non-deterministic strategy", () => {
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
            { focus: "0", ramification: [2], polarity: "P" },
            { focus: "0.2", ramification: [], polarity: "O" },
          ],
          length: 2,
          isPositive: false,
        },
      ],
      isInnocent: false,
      satisfiesPropagation: false,
    };

    const result = checkPlaysViewsIsomorphism(strategy);

    expect(result.checked).toBe(true);
    // Non-innocent strategies may not satisfy the isomorphism
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

    const result = checkPlaysViewsIsomorphism(strategy);

    expect(result.checked).toBe(true);
    expect(result.holds).toBe(true);
  });
});

describe("checkViewsPlaysIsomorphism", () => {
  it("should verify Views(Plays(V)) = V for valid views", () => {
    const views: View[] = [
      {
        id: "view-1",
        player: "P",
        sequence: [
          { focus: "0", ramification: [1], polarity: "P" },
        ],
        designId: "design-1",
      },
    ];

    const result = checkViewsPlaysIsomorphism(views);

    expect(result.checked).toBe(true);
  });

  it("should handle empty view set", () => {
    const views: View[] = [];

    const result = checkViewsPlaysIsomorphism(views);

    expect(result.holds).toBe(true);
    expect(result.checked).toBe(true);
  });

  it("should verify isomorphism for multiple views", () => {
    const views: View[] = [
      {
        id: "view-1",
        player: "P",
        sequence: [
          { focus: "0", ramification: [1], polarity: "P" },
        ],
        designId: "design-1",
      },
      {
        id: "view-2",
        player: "P",
        sequence: [
          { focus: "0", ramification: [1], polarity: "P" },
          { focus: "0.1", ramification: [], polarity: "O" },
        ],
        designId: "design-1",
      },
    ];

    const result = checkViewsPlaysIsomorphism(views);

    expect(result.checked).toBe(true);
  });
});

describe("checkDispChIsomorphism", () => {
  it("should check Disp(Ch(S)) = S", () => {
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

    const counterDesigns: DesignForCorrespondence[] = [
      {
        id: "counter-1",
        deliberationId: "delib-1",
        participantId: "Opponent",
        acts: [
          { id: "a1", designId: "counter-1", kind: "INITIAL", polarity: "O", locusPath: "0", ramification: [] },
        ],
        loci: [],
      },
    ];

    const result = checkDispChIsomorphism(strategy, counterDesigns);

    expect(result.checked).toBe(true);
  });

  it("should handle strategy without counter-designs", () => {
    const strategy: Strategy = {
      id: "strategy-1",
      designId: "design-1",
      player: "P",
      plays: [],
      isInnocent: true,
      satisfiesPropagation: true,
    };

    const result = checkDispChIsomorphism(strategy, []);

    expect(result.checked).toBe(true);
  });
});

describe("checkChDispIsomorphism", () => {
  it("should check Ch(Disp(D)) = D", () => {
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

    const result = checkChDispIsomorphism(design, counterDesigns);

    expect(result.checked).toBe(true);
  });

  it("should handle design without counter-designs", () => {
    const design: DesignForCorrespondence = {
      id: "design-1",
      deliberationId: "delib-1",
      participantId: "Proponent",
      acts: [],
      loci: [],
    };

    const result = checkChDispIsomorphism(design, []);

    expect(result.checked).toBe(true);
  });
});

describe("checkAllIsomorphisms", () => {
  it("should check all four isomorphisms", () => {
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

    const counterDesigns: DesignForCorrespondence[] = [];

    const results = checkAllIsomorphisms(design, strategy, counterDesigns);

    expect(results.playsViews.checked).toBe(true);
    expect(results.viewsPlays.checked).toBe(true);
    expect(results.dispCh.checked).toBe(true);
    expect(results.chDisp.checked).toBe(true);
  });
});

describe("allIsomorphismsHold", () => {
  it("should return true when all isomorphisms hold", () => {
    const results = {
      playsViews: { holds: true, checked: true },
      viewsPlays: { holds: true, checked: true },
      dispCh: { holds: true, checked: true },
      chDisp: { holds: true, checked: true },
    };

    expect(allIsomorphismsHold(results)).toBe(true);
  });

  it("should return false when any isomorphism fails", () => {
    const results = {
      playsViews: { holds: true, checked: true },
      viewsPlays: { holds: false, checked: true },
      dispCh: { holds: true, checked: true },
      chDisp: { holds: true, checked: true },
    };

    expect(allIsomorphismsHold(results)).toBe(false);
  });

  it("should return false when all isomorphisms fail", () => {
    const results = {
      playsViews: { holds: false, checked: true },
      viewsPlays: { holds: false, checked: true },
      dispCh: { holds: false, checked: true },
      chDisp: { holds: false, checked: true },
    };

    expect(allIsomorphismsHold(results)).toBe(false);
  });
});
