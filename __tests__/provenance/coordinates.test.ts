/**
 * Unit coverage for the decorrelated-gating capture helpers (N-1/N-3).
 *
 * These are the pure transforms that sit on every write path — normalisation of
 * a loosely-typed request body into independence coordinates, and the field
 * builder the transactional seams write. The DB-touching writers
 * (writeActProvenance / writeCheckExposure) are exercised by the route smoke
 * tests; here we pin the pure logic that decides what gets recorded.
 */
import { describe, test, expect } from "@jest/globals";
import {
  normalizeCoordinates,
  actProvenanceFields,
} from "@/lib/provenance/coordinates";

describe("normalizeCoordinates", () => {
  test("returns undefined for non-objects", () => {
    expect(normalizeCoordinates(undefined)).toBeUndefined();
    expect(normalizeCoordinates(null)).toBeUndefined();
    expect(normalizeCoordinates("claude")).toBeUndefined();
  });

  test("passes through the five coordinate columns", () => {
    const out = normalizeCoordinates({
      modelFamily: "claude",
      modelVersion: "claude-opus-4-8",
      harnessId: "harness-7",
      sessionId: "sess-1",
      contextLineageId: "lineage-abc",
    });
    expect(out).toMatchObject({
      modelFamily: "claude",
      modelVersion: "claude-opus-4-8",
      harnessId: "harness-7",
      sessionId: "sess-1",
      contextLineageId: "lineage-abc",
    });
  });

  test("coerces an unknown authorKind to undefined (column default applies)", () => {
    expect(normalizeCoordinates({ authorKind: "ROBOT" }).authorKind).toBeUndefined();
    expect(normalizeCoordinates({ authorKind: "AI" }).authorKind).toBe("AI");
    expect(normalizeCoordinates({ authorKind: "HYBRID" }).authorKind).toBe("HYBRID");
  });

  test("keeps a structured extra bag, drops a non-object one", () => {
    expect(normalizeCoordinates({ extra: { probe: true } }).extra).toEqual({
      probe: true,
    });
    expect(normalizeCoordinates({ extra: "nope" }).extra).toBeUndefined();
  });
});

describe("actProvenanceFields", () => {
  test("defaults authorKind to HUMAN and coordinates to null when absent", () => {
    const f = actProvenanceFields(undefined);
    expect(f.authorKind).toBe("HUMAN");
    expect(f.modelFamily).toBeNull();
    expect(f.contextLineageId).toBeNull();
    // Absent capturedVia falls back to the supplied default.
    expect(f.capturedVia).toBe("mcp");
  });

  test("honours an explicit capturedVia over the default", () => {
    expect(actProvenanceFields({ capturedVia: "ui" }, "internal").capturedVia).toBe(
      "ui",
    );
    expect(actProvenanceFields({}, "internal").capturedVia).toBe("internal");
  });

  test("carries the load-bearing contextLineageId through unchanged", () => {
    const f = actProvenanceFields({ contextLineageId: "lineage-xyz" });
    expect(f.contextLineageId).toBe("lineage-xyz");
  });
});
