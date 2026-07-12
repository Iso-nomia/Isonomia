// tests/ecc-culprits-roundtrip.test.ts
//
// Sprint E2 — MCP contract test.
//
// Done-when (verbatim from
//   `Development and Ideation Documents/ARCHITECTURE/ECC_REFINEMENT_AND_MCP_INTEGRATION_PLAN.md` §E):
//   "an MCP client can ask 'what would I have to retract to reject claim
//   X in this deliberation?' and get a deterministic, graph-derived
//   answer with no LLM in the loop."
//
// We exercise the full route → loader → algebra → hydrated-response path
// of `GET /api/v3/deliberations/[id]/ecc/culprits` against a mocked
// Prisma fixture, then assert:
//   1. the response is structurally well-formed (Ambler §4 culprit shape);
//   2. running the route twice on the same fixture produces *identical*
//      JSON (bit-for-bit) — i.e. no hidden randomness or wall-clock
//      leakage in the pipeline. This is the deterministic-graph-derived
//      guarantee the MCP surface promises;
//   3. the canonical ranking matches Ambler §4 (more-bad-conclusions-
//      explained first, then lower retraction cost, then lexicographic).

import { NextRequest } from "next/server";

// ── Prisma mock ────────────────────────────────────────────────
// Fixture: claim C is supported by three derivations:
//   d1 (arg a1, AI)     uses {asm-1, asm-2}
//   d2 (arg a2, HUMAN)  uses {asm-2}
//   d3 (arg a3, HUMAN)  uses {asm-3}
// Expectation:
//   • {asm-2} explains {d1, d2} (cost 1)        ← canonical winner
//   • {asm-3} explains {d3}      (cost 1)
//   • {asm-1, asm-2} explains {d1, d2} (cost 2) — dominated by {asm-2}
// (culpritSets returns minimal hitting sets per derivation; the route
// hydrates each with text + status from AssumptionUse.)

const fakeSupports = [
  { id: "d1", argumentId: "a1", base: 0.7 },
  { id: "d2", argumentId: "a2", base: 0.6 },
  { id: "d3", argumentId: "a3", base: 0.55 },
];

const fakeDerivAssumps = [
  { derivationId: "d1", assumptionId: "asm-1", weight: 1 },
  { derivationId: "d1", assumptionId: "asm-2", weight: 1 },
  { derivationId: "d2", assumptionId: "asm-2", weight: 1 },
  { derivationId: "d3", assumptionId: "asm-3", weight: 1 },
];

const fakeUses = [
  { id: "asm-1", status: "ACCEPTED", argumentId: "a1", weight: 1 },
  { id: "asm-2", status: "ACCEPTED", argumentId: "a1", weight: 1 },
  { id: "asm-2-on-a2", status: "ACCEPTED", argumentId: "a2", weight: 1 },
  { id: "asm-3", status: "PROPOSED", argumentId: "a3", weight: 1 },
];

const fakeArgs = [
  { id: "a1", text: "Argument 1", authorKind: "AI" },
  { id: "a2", text: "Argument 2", authorKind: "HUMAN" },
  { id: "a3", text: "Argument 3", authorKind: "HUMAN" },
];

const fakeAssumptionUseRows = [
  { id: "asm-1", status: "ACCEPTED", assumptionText: "Source X is reliable", assumptionClaimId: "c-asm-1" },
  { id: "asm-2", status: "ACCEPTED", assumptionText: "The reading is current", assumptionClaimId: "c-asm-2" },
  { id: "asm-3", status: "PROPOSED", assumptionText: "No counter-evidence exists", assumptionClaimId: "c-asm-3" },
];

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    argumentSupport: {
      findMany: jest.fn(async () => fakeSupports),
    },
    derivationAssumption: {
      findMany: jest.fn(async () => fakeDerivAssumps),
    },
    assumptionUse: {
      findMany: jest.fn(async ({ where }: any) => {
        // Two call sites in the loader/route:
        //   1. loader: where: { argumentId: { in: argIds } }
        //   2. hydrateCulpritSets: where: { id: { in: assumptionIds } }
        if (where?.id?.in) {
          const ids: string[] = where.id.in;
          return fakeAssumptionUseRows.filter((r) => ids.includes(r.id));
        }
        if (where?.argumentId?.in) {
          const ids: string[] = where.argumentId.in;
          return fakeUses.filter((u) => ids.includes(u.argumentId));
        }
        return [];
      }),
    },
    argument: {
      findMany: jest.fn(async () => fakeArgs),
    },
  },
}));

import { GET } from "@/app/api/v3/deliberations/[id]/ecc/culprits/route";

function makeReq(claimId: string): NextRequest {
  return new NextRequest(
    new URL(`https://test.local/api/v3/deliberations/delib-1/ecc/culprits?claimId=${claimId}`),
  );
}

async function runRoute(claimId: string) {
  const res = await GET(makeReq(claimId), { params: Promise.resolve({ id: "delib-1" }) });
  return await res.json();
}

describe("Sprint E2 — culprits route round-trip determinism", () => {
  test("400 when claimId is missing", async () => {
    const res = await GET(
      new NextRequest(new URL("https://test.local/api/v3/deliberations/delib-1/ecc/culprits")),
      { params: Promise.resolve({ id: "delib-1" }) },
    );
    expect(res.status).toBe(400);
  });

  test("honest-empty: no support rows ⇒ culprits: []", async () => {
    const { prisma } = await import("@/lib/prismaclient");
    (prisma.argumentSupport.findMany as jest.Mock).mockResolvedValueOnce([]);
    const body = await runRoute("claim-empty");
    expect(body).toEqual({
      ok: true,
      deliberationId: "delib-1",
      claimId: "claim-empty",
      culprits: [],
      reason: "no ArgumentSupport rows for this (deliberation, claim) pair",
    });
  });

  test("returns hydrated culprits with stable shape", async () => {
    const body = await runRoute("claim-X");
    expect(body.ok).toBe(true);
    expect(body.deliberationId).toBe("delib-1");
    expect(body.claimId).toBe("claim-X");
    expect(body.derivationCount).toBe(3);
    expect(Array.isArray(body.culprits)).toBe(true);
    expect(body.culprits.length).toBeGreaterThan(0);
    for (const c of body.culprits) {
      expect(typeof c.badConclusionsExplained).toBe("number");
      expect(typeof c.retractionCost).toBe("number");
      expect(Array.isArray(c.assumptions)).toBe(true);
      for (const a of c.assumptions) {
        expect(typeof a.id).toBe("string");
        expect(["ACCEPTED", "PROPOSED", "REJECTED", "RETRACTED"]).toContain(a.status);
      }
    }
  });

  test("Ambler §4 ranking: {asm-2} (multi-deriv, cost 1) ranks ahead of {asm-3} (single-deriv, cost 1)", async () => {
    const body = await runRoute("claim-X");
    const top = body.culprits[0];
    const ids = top.assumptions.map((a: any) => a.id).sort();
    // Top culprit should be the one explaining the most bad conclusions.
    expect(top.badConclusionsExplained).toBeGreaterThanOrEqual(
      body.culprits[body.culprits.length - 1].badConclusionsExplained,
    );
    // And on ties, the one with lower retraction cost wins.
    for (let i = 1; i < body.culprits.length; i++) {
      const prev = body.culprits[i - 1];
      const cur = body.culprits[i];
      if (prev.badConclusionsExplained === cur.badConclusionsExplained) {
        expect(prev.retractionCost).toBeLessThanOrEqual(cur.retractionCost);
      } else {
        expect(prev.badConclusionsExplained).toBeGreaterThan(cur.badConclusionsExplained);
      }
    }
    // The single-assumption culprit covering the most derivations is asm-2.
    const singletons = body.culprits.filter((c: any) => c.retractionCost === 1);
    const singletonIds = singletons.map((c: any) => c.assumptions[0].id);
    expect(singletonIds).toContain("asm-2");
    // And asm-2's row should rank at-or-above asm-3's row.
    const idx2 = body.culprits.findIndex(
      (c: any) => c.retractionCost === 1 && c.assumptions[0].id === "asm-2",
    );
    const idx3 = body.culprits.findIndex(
      (c: any) => c.retractionCost === 1 && c.assumptions[0].id === "asm-3",
    );
    expect(idx2).toBeLessThan(idx3);
    void ids; // silence unused
  });

  test("DETERMINISM: two back-to-back invocations on identical fixture produce bit-identical JSON", async () => {
    const a = await runRoute("claim-X");
    const b = await runRoute("claim-X");
    // Stringified comparison to catch any nondeterministic ordering.
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  test("DETERMINISM: hydration text + claimId are stable across runs (no LLM, no wall-clock)", async () => {
    const a = await runRoute("claim-X");
    const b = await runRoute("claim-X");
    const flatten = (body: any) =>
      body.culprits.map((c: any) => ({
        cost: c.retractionCost,
        bad: c.badConclusionsExplained,
        ids: c.assumptions.map((x: any) => x.id),
        texts: c.assumptions.map((x: any) => x.text),
        statuses: c.assumptions.map((x: any) => x.status),
        claimIds: c.assumptions.map((x: any) => x.claimId),
      }));
    expect(flatten(a)).toEqual(flatten(b));
  });
});
