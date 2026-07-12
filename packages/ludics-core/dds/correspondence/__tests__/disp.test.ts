/**
 * Tests for Disp(D) operation
 * 
 * Based on Faggian & Hyland (2002) - Proposition 4.27
 */

import {
  computeDisp,
  computeDispute,
  disputesToPlays,
  extractDesignPaths,
  canInteract,
} from "../disp";
import type { DesignForCorrespondence, DesignAct } from "../types";

describe("computeDisp", () => {
  it("should compute disputes for simple designs", () => {
    const design: DesignForCorrespondence = {
      id: "design-1",
      deliberationId: "delib-1",
      participantId: "Proponent",
      acts: [
        { id: "act-1", designId: "design-1", kind: "INITIAL", polarity: "P", locusPath: "0", ramification: [1, 2] },
        { id: "act-2", designId: "design-1", kind: "POSITIVE", polarity: "P", locusPath: "0.1", ramification: [] },
      ],
      loci: [],
    };

    const counterDesign: DesignForCorrespondence = {
      id: "design-2",
      deliberationId: "delib-1",
      participantId: "Opponent",
      acts: [
        { id: "act-3", designId: "design-2", kind: "INITIAL", polarity: "O", locusPath: "0", ramification: [1] },
        { id: "act-4", designId: "design-2", kind: "NEGATIVE", polarity: "O", locusPath: "0.1", ramification: [] },
      ],
      loci: [],
    };

    const result = computeDisp(design, [counterDesign]);

    expect(result.designId).toBe("design-1");
    expect(result.disputes.length).toBe(1);
    expect(result.disputes[0].pairs.length).toBe(2);
  });

  it("should return empty for designs without counter-designs", () => {
    const design: DesignForCorrespondence = {
      id: "design-1",
      deliberationId: "delib-1",
      participantId: "Proponent",
      acts: [
        { id: "act-1", designId: "design-1", kind: "INITIAL", polarity: "P", locusPath: "0", ramification: [1] },
      ],
      loci: [],
    };

    const result = computeDisp(design, []);

    expect(result.disputes.length).toBe(0);
  });

  it("should deduplicate identical disputes", () => {
    const design: DesignForCorrespondence = {
      id: "design-1",
      deliberationId: "delib-1",
      participantId: "Proponent",
      acts: [
        { id: "act-1", designId: "design-1", kind: "INITIAL", polarity: "P", locusPath: "0", ramification: [] },
      ],
      loci: [],
    };

    const counter1: DesignForCorrespondence = {
      id: "design-2",
      deliberationId: "delib-1",
      participantId: "Opponent",
      acts: [
        { id: "act-2", designId: "design-2", kind: "INITIAL", polarity: "O", locusPath: "0", ramification: [] },
      ],
      loci: [],
    };

    const counter2: DesignForCorrespondence = {
      id: "design-3",
      deliberationId: "delib-1",
      participantId: "Opponent",
      acts: [
        { id: "act-3", designId: "design-3", kind: "INITIAL", polarity: "O", locusPath: "0", ramification: [] },
      ],
      loci: [],
    };

    const result = computeDisp(design, [counter1, counter2]);

    // Both counter-designs produce same dispute structure, so should deduplicate
    expect(result.disputes.length).toBe(1);
  });
});

describe("computeDispute", () => {
  it("should compute dispute between two designs", () => {
    const posDesign: DesignForCorrespondence = {
      id: "pos-design",
      deliberationId: "delib-1",
      participantId: "Proponent",
      acts: [
        { id: "p1", designId: "pos-design", kind: "INITIAL", polarity: "P", locusPath: "0", ramification: [1] },
        { id: "p2", designId: "pos-design", kind: "POSITIVE", polarity: "P", locusPath: "0.1", ramification: [] },
      ],
      loci: [],
    };

    const negDesign: DesignForCorrespondence = {
      id: "neg-design",
      deliberationId: "delib-1",
      participantId: "Opponent",
      acts: [
        { id: "n1", designId: "neg-design", kind: "INITIAL", polarity: "O", locusPath: "0", ramification: [1] },
        { id: "n2", designId: "neg-design", kind: "NEGATIVE", polarity: "O", locusPath: "0.1", ramification: [] },
      ],
      loci: [],
    };

    const dispute = computeDispute(posDesign, negDesign);

    expect(dispute).not.toBeNull();
    expect(dispute!.posDesignId).toBe("pos-design");
    expect(dispute!.negDesignId).toBe("neg-design");
    expect(dispute!.pairs.length).toBe(2);
    expect(dispute!.pairs[0].locusPath).toBe("0");
    expect(dispute!.pairs[1].locusPath).toBe("0.1");
  });

  it("should return null for non-interacting designs", () => {
    const posDesign: DesignForCorrespondence = {
      id: "pos-design",
      deliberationId: "delib-1",
      participantId: "Proponent",
      acts: [
        { id: "p1", designId: "pos-design", kind: "INITIAL", polarity: "P", locusPath: "1", ramification: [] },
      ],
      loci: [],
    };

    const negDesign: DesignForCorrespondence = {
      id: "neg-design",
      deliberationId: "delib-1",
      participantId: "Opponent",
      acts: [
        { id: "n1", designId: "neg-design", kind: "INITIAL", polarity: "O", locusPath: "2", ramification: [] },
      ],
      loci: [],
    };

    const dispute = computeDispute(posDesign, negDesign);

    expect(dispute).toBeNull();
  });

  it("should set CONVERGENT status when positive design continues alone", () => {
    const posDesign: DesignForCorrespondence = {
      id: "pos-design",
      deliberationId: "delib-1",
      participantId: "Proponent",
      acts: [
        { id: "p1", designId: "pos-design", kind: "INITIAL", polarity: "P", locusPath: "0", ramification: [1] },
        { id: "p2", designId: "pos-design", kind: "POSITIVE", polarity: "P", locusPath: "0.1", ramification: [] },
      ],
      loci: [],
    };

    const negDesign: DesignForCorrespondence = {
      id: "neg-design",
      deliberationId: "delib-1",
      participantId: "Opponent",
      acts: [
        { id: "n1", designId: "neg-design", kind: "INITIAL", polarity: "O", locusPath: "0", ramification: [] },
      ],
      loci: [],
    };

    const dispute = computeDispute(posDesign, negDesign);

    expect(dispute).not.toBeNull();
    expect(dispute!.status).toBe("CONVERGENT");
  });
});

describe("disputesToPlays", () => {
  it("should convert disputes to plays for proponent", () => {
    const disputes = [
      {
        id: "dispute-1",
        dialogueId: "delib-1",
        posDesignId: "pos",
        negDesignId: "neg",
        pairs: [
          { posActId: "p1", negActId: "n1", locusPath: "0", ts: 0 },
          { posActId: "p2", negActId: "n2", locusPath: "0.1", ts: 1 },
        ],
        status: "CONVERGENT" as const,
        length: 2,
      },
    ];

    const plays = disputesToPlays(disputes, "P");

    expect(plays.length).toBe(1);
    expect(plays[0].sequence.length).toBe(2);
    expect(plays[0].sequence[0].polarity).toBe("P");
    expect(plays[0].sequence[0].focus).toBe("0");
  });

  it("should convert disputes to plays for opponent", () => {
    const disputes = [
      {
        id: "dispute-1",
        dialogueId: "delib-1",
        posDesignId: "pos",
        negDesignId: "neg",
        pairs: [
          { posActId: "p1", negActId: "n1", locusPath: "0", ts: 0 },
        ],
        status: "ONGOING" as const,
        length: 1,
      },
    ];

    const plays = disputesToPlays(disputes, "O");

    expect(plays.length).toBe(1);
    expect(plays[0].sequence[0].polarity).toBe("O");
    expect(plays[0].sequence[0].actId).toBe("n1");
  });
});

describe("extractDesignPaths", () => {
  it("should extract all locus paths from design", () => {
    const design: DesignForCorrespondence = {
      id: "design-1",
      deliberationId: "delib-1",
      participantId: "Proponent",
      acts: [
        { id: "a1", designId: "design-1", kind: "INITIAL", polarity: "P", locusPath: "0", ramification: [1, 2] },
        { id: "a2", designId: "design-1", kind: "POSITIVE", polarity: "P", locusPath: "0.1", ramification: [] },
        { id: "a3", designId: "design-1", kind: "POSITIVE", polarity: "P", locusPath: "0.2", ramification: [] },
      ],
      loci: [],
    };

    const paths = extractDesignPaths(design);

    expect(paths).toContain("0");
    expect(paths).toContain("0.1");
    expect(paths).toContain("0.2");
    expect(paths.length).toBe(3);
  });
});

describe("canInteract", () => {
  it("should return true for designs with common root", () => {
    const d1: DesignForCorrespondence = {
      id: "d1",
      deliberationId: "delib",
      participantId: "Proponent",
      acts: [{ id: "a1", designId: "d1", kind: "INITIAL", polarity: "P", locusPath: "0", ramification: [] }],
      loci: [],
    };

    const d2: DesignForCorrespondence = {
      id: "d2",
      deliberationId: "delib",
      participantId: "Opponent",
      acts: [{ id: "a2", designId: "d2", kind: "INITIAL", polarity: "O", locusPath: "0", ramification: [] }],
      loci: [],
    };

    expect(canInteract(d1, d2)).toBe(true);
  });

  it("should return false for designs without common paths", () => {
    const d1: DesignForCorrespondence = {
      id: "d1",
      deliberationId: "delib",
      participantId: "Proponent",
      acts: [{ id: "a1", designId: "d1", kind: "INITIAL", polarity: "P", locusPath: "1", ramification: [] }],
      loci: [],
    };

    const d2: DesignForCorrespondence = {
      id: "d2",
      deliberationId: "delib",
      participantId: "Opponent",
      acts: [{ id: "a2", designId: "d2", kind: "INITIAL", polarity: "O", locusPath: "2", ramification: [] }],
      loci: [],
    };

    expect(canInteract(d1, d2)).toBe(false);
  });

  it("should return true for designs with overlapping paths", () => {
    const d1: DesignForCorrespondence = {
      id: "d1",
      deliberationId: "delib",
      participantId: "Proponent",
      acts: [
        { id: "a1", designId: "d1", kind: "POSITIVE", polarity: "P", locusPath: "0.1.2", ramification: [] },
      ],
      loci: [],
    };

    const d2: DesignForCorrespondence = {
      id: "d2",
      deliberationId: "delib",
      participantId: "Opponent",
      acts: [
        { id: "a2", designId: "d2", kind: "NEGATIVE", polarity: "O", locusPath: "0.1.2", ramification: [] },
      ],
      loci: [],
    };

    expect(canInteract(d1, d2)).toBe(true);
  });
});
