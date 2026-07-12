/**
 * Phase 4.5 (issue K / decision Q5): lib/aif/import.ts now consumes the
 * canonical JSON-LD `@graph` form produced by lib/aif/jsonld.ts (array `@type`,
 * `aif:text`, role-typed edge nodes with `aif:from`/`aif:to`, `S:`/`I:`/`PA:`
 * node-id prefixes). This is what `/api/batch/aif` posts.
 */
import { describe, test, expect } from "@jest/globals";

const mockClaimCreate = jest.fn(async ({ data }: any) => ({
  id: data.text === "Claim one" ? "cid1" : "cid2",
}));
const mockArgCreate = jest.fn(async (_a: any) => ({ id: `arg-${mockArgCreate.mock.calls.length}` }));
const mockSchemeFind = jest.fn(async ({ where }: any) =>
  where.key === "expert" ? { id: "scheme-expert" } : null,
);
const mockPACreate = jest.fn(async (_a: any) => ({ id: "pa-1" }));

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    claim: { create: (a: any) => mockClaimCreate(a) },
    argument: { create: (a: any) => mockArgCreate(a), findFirst: jest.fn(async () => null) },
    argumentPremise: { create: jest.fn(), createMany: jest.fn() },
    argumentScheme: { findFirst: (a: any) => mockSchemeFind(a) },
    argumentEdge: { create: jest.fn() },
    preferenceApplication: { create: (a: any) => mockPACreate(a) },
    preferenceScheme: { findUnique: jest.fn(async () => null) },
  },
}));

import { importAifJSONLD } from "@/lib/aif/import";

// Minimal canonical @graph: two claims, two arguments (argA uses scheme "expert"),
// and a PA preferring argA over argB. Edge directions mirror lib/aif/jsonld.ts.
const doc = {
  "@graph": [
    { "@id": "I:c1", "@type": "aif:InformationNode", "aif:text": "Claim one" },
    { "@id": "I:c2", "@type": "aif:InformationNode", "aif:text": "Claim two" },
    { "@id": "S:argA", "@type": ["aif:RA", "as:expert"], "aif:usesScheme": "expert" },
    { "@id": "S:argB", "@type": ["aif:RA"], "aif:usesScheme": null },
    { "@id": "PA:pa1", "@type": "aif:PA", "aif:usesScheme": null },
    { "@type": "aif:Premise", "aif:from": "I:c2", "aif:to": "S:argA" },
    { "@type": "aif:Conclusion", "aif:from": "S:argA", "aif:to": "I:c1" },
    { "@type": "aif:Conclusion", "aif:from": "S:argB", "aif:to": "I:c2" },
    { "@type": "aif:PreferredElement", "aif:from": "S:argA", "aif:to": "PA:pa1" },
    { "@type": "aif:DispreferredElement", "aif:from": "PA:pa1", "aif:to": "S:argB" },
  ],
};

describe("importAifJSONLD — canonical @graph import", () => {
  test("imports claims, scheme-resolved arguments, and a PA preference", async () => {
    await expect(importAifJSONLD("delib-1", doc)).resolves.toEqual({ ok: true });

    // Two I-nodes → two claims.
    expect(mockClaimCreate).toHaveBeenCalledTimes(2);

    // Two RA-nodes → two arguments; argA carries the resolved scheme, argB null.
    expect(mockArgCreate).toHaveBeenCalledTimes(2);
    expect(mockArgCreate.mock.calls[0][0].data).toMatchObject({
      schemeId: "scheme-expert",
      conclusionClaimId: "cid1",
    });
    expect(mockArgCreate.mock.calls[1][0].data).toMatchObject({
      schemeId: null,
      conclusionClaimId: "cid2",
    });

    // PA preference resolves both sides to the freshly-created argument ids.
    expect(mockPACreate).toHaveBeenCalledTimes(1);
    const paData = mockPACreate.mock.calls[0][0].data;
    expect(paData).toMatchObject({
      preferredArgumentId: "arg-1",
      dispreferredArgumentId: "arg-2",
      preferredClaimId: null,
      dispreferredClaimId: null,
    });
    // Phantom *Kind columns must never be written (Phase 0.1 / issue E guard).
    expect(paData).not.toHaveProperty("preferredKind");
    expect(paData).not.toHaveProperty("dispreferredKind");
  });

  test("rejects a non-@graph payload with a clear error", async () => {
    await expect(importAifJSONLD("delib-1", { nodes: [], edges: [] })).rejects.toThrow(/@graph/);
  });
});
