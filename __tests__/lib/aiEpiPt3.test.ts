/**
 * Unit tests for the pure helpers added in Track AI-EPI Pt. 3:
 *   - computeFitnessBreakdown (\u00a71)
 *   - classifyStandingConfidence (\u00a73)
 *   - toCitationBlock (\u00a77)
 *
 * These don't touch Prisma; the breakdown / depth functions are pure
 * functions over counters, and toCitationBlock is a pure projection.
 */

import {
  computeFitnessBreakdown,
  FITNESS_WEIGHTS,
} from "@/lib/citations/argumentAttestation";
import { classifyStandingConfidence } from "@/config/standingThresholds";
import { toCitationBlock } from "@/lib/citation/serialize";

describe("computeFitnessBreakdown", () => {
  it("decomposes the score into weighted contributions that sum to total", () => {
    const breakdown = computeFitnessBreakdown({
      cqAnswered: 3,
      supportEdges: 2,
      attackEdges: 1,
      attackCAs: 0,
      evidenceWithProvenance: 4,
    });

    const sum =
      breakdown.components.cqAnswered.contribution +
      breakdown.components.supportEdges.contribution +
      breakdown.components.attackEdges.contribution +
      breakdown.components.attackCAs.contribution +
      breakdown.components.evidenceWithProvenance.contribution;

    // Total is rounded to 3 decimal places \u2014 allow that tolerance when
    // comparing against the raw sum.
    expect(Math.abs(breakdown.total - sum)).toBeLessThan(1e-3);
  });

  it("exposes the formula weights so the score is auditable", () => {
    const breakdown = computeFitnessBreakdown({
      cqAnswered: 0,
      supportEdges: 0,
      attackEdges: 0,
      attackCAs: 0,
      evidenceWithProvenance: 0,
    });
    expect(breakdown.weights).toBe(FITNESS_WEIGHTS);
    expect(breakdown.total).toBe(0);
  });

  it("handles negative-net scores (an argument under unanswered attack)", () => {
    const breakdown = computeFitnessBreakdown({
      cqAnswered: 0,
      supportEdges: 0,
      attackEdges: 3,
      attackCAs: 1,
      evidenceWithProvenance: 0,
    });
    expect(breakdown.total).toBeLessThan(0);
  });
});

describe("classifyStandingConfidence", () => {
  it("returns 'thin' when no participation has been recorded", () => {
    expect(
      classifyStandingConfidence({
        challengers: 0,
        independentReviewers: 0,
      }),
    ).toBe("thin");
  });

  it("returns 'thin' for a single challenger \u2014 deliberately conservative", () => {
    expect(
      classifyStandingConfidence({
        challengers: 1,
        independentReviewers: 0,
      }),
    ).toBe("thin");
  });

  it("upgrades to 'moderate' once two distinct authors have engaged", () => {
    expect(
      classifyStandingConfidence({
        challengers: 2,
        independentReviewers: 0,
      }),
    ).toBe("moderate");
    expect(
      classifyStandingConfidence({
        challengers: 0,
        independentReviewers: 2,
      }),
    ).toBe("moderate");
  });

  it("only reaches 'dense' when both challengers AND reviewers cross threshold", () => {
    expect(
      classifyStandingConfidence({
        challengers: 5,
        independentReviewers: 5,
      }),
    ).toBe("dense");
    // Lots of challengers but no reviewers stays at moderate.
    expect(
      classifyStandingConfidence({
        challengers: 10,
        independentReviewers: 0,
      }),
    ).toBe("moderate");
  });
});

describe("toCitationBlock", () => {
  it("projects a ClaimEvidence row into the canonical citation shape", () => {
    const block = toCitationBlock({
      id: "ev_1",
      title: "Adolescent screen-time and mental health",
      uri: "https://www.cdc.gov/yrbs/2023/report.pdf",
      citation: "Suicidal ideation rose 50% from 2011 to 2021.",
      contentSha256: "sha256:abc",
      archivedUrl: "https://web.archive.org/...",
      archivedAt: new Date("2024-01-01T00:00:00Z"),
      fetchedAt: new Date("2024-02-01T00:00:00Z"),
    });

    expect(block.id).toBe("ev_1");
    expect(block.url).toBe("https://www.cdc.gov/yrbs/2023/report.pdf");
    expect(block.publisher).toBe("cdc.gov");
    expect(block.contentSha256).toBe("sha256:abc");
    expect(block.archivedAt).toBe("2024-01-01T00:00:00.000Z");
    expect(block.accessedAt).toBe("2024-02-01T00:00:00.000Z");
    expect(block.quote).toBe("Suicidal ideation rose 50% from 2011 to 2021.");
    expect(block.quoteAnchor).toEqual({
      selector: "Suicidal ideation rose 50% from 2011 to 2021.",
      type: "text-quote",
    });
  });

  it("extracts a DOI when one is embedded in the URL", () => {
    const block = toCitationBlock({
      id: "ev_2",
      uri: "https://doi.org/10.1037/abn0000410",
    });
    expect(block.doi).toBe("10.1037/abn0000410");
    expect(block.publisher).toBe("doi.org");
  });

  it("returns nulls for missing fields rather than throwing", () => {
    const block = toCitationBlock({ id: "ev_3" });
    expect(block.url).toBeNull();
    expect(block.publisher).toBeNull();
    expect(block.quote).toBeNull();
    expect(block.quoteAnchor).toBeNull();
    expect(block.archivedAt).toBeNull();
  });
});
