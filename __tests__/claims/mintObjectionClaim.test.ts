/**
 * S1 smoke — the extracted scheme-free objection-Claim mint
 * (lib/claims/mintObjectionClaim.ts). Verifies the mint shape both callers
 * (CQ-challenge + attack_argument) depend on: text/author/deliberation passthrough,
 * prefixed random moid, `select: { id: true }`, and NO scheme/CQ fields.
 */
import { describe, test, expect, jest } from "@jest/globals";
import { mintObjectionClaim } from "@/lib/claims/mintObjectionClaim";

function makeDb() {
  const create = jest.fn(async (_args: any) => ({ id: "claim-xyz" }));
  return { db: { claim: { create } } as any, create };
}

describe("mintObjectionClaim", () => {
  test("passes text/author/deliberation through and returns the id", async () => {
    const { db, create } = makeDb();
    const res = await mintObjectionClaim({
      db,
      text: "This premise is unsupported",
      createdById: "mcp-bot",
      deliberationId: "delib-1",
      moidPrefix: "attack-objection",
    });

    expect(res).toEqual({ id: "claim-xyz" });
    const arg = (create.mock.calls[0] as any[])[0];
    expect(arg.data.text).toBe("This premise is unsupported");
    expect(arg.data.createdById).toBe("mcp-bot");
    expect(arg.data.deliberationId).toBe("delib-1");
    expect(arg.select).toEqual({ id: true });
  });

  test("moid is prefixed and high-entropy (16 hex chars)", async () => {
    const { db, create } = makeDb();
    await mintObjectionClaim({
      db,
      text: "x",
      createdById: "u",
      deliberationId: "d",
      moidPrefix: "attack-objection",
    });
    const moid = (create.mock.calls[0] as any[])[0].data.moid as string;
    expect(moid).toMatch(/^attack-objection-[0-9a-f]{16}$/);
  });

  test("defaults the moid prefix to 'objection'", async () => {
    const { db, create } = makeDb();
    await mintObjectionClaim({ db, text: "x", createdById: "u", deliberationId: null });
    const moid = (create.mock.calls[0] as any[])[0].data.moid as string;
    expect(moid).toMatch(/^objection-[0-9a-f]{16}$/);
  });

  test("is scheme-free — sets exactly {text, createdById, moid, deliberationId}", async () => {
    const { db, create } = makeDb();
    await mintObjectionClaim({ db, text: "x", createdById: "u", deliberationId: "d" });
    const data = (create.mock.calls[0] as any[])[0].data;
    expect(Object.keys(data).sort()).toEqual([
      "createdById",
      "deliberationId",
      "moid",
      "text",
    ]);
  });

  test("two mints produce distinct moids", async () => {
    const { db, create } = makeDb();
    await mintObjectionClaim({ db, text: "a", createdById: "u", deliberationId: "d" });
    await mintObjectionClaim({ db, text: "b", createdById: "u", deliberationId: "d" });
    const m1 = (create.mock.calls[0] as any[])[0].data.moid;
    const m2 = (create.mock.calls[1] as any[])[0].data.moid;
    expect(m1).not.toBe(m2);
  });
});
