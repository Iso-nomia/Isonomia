/**
 * Phase 10a (10.6a) — HTTP contract for the external-citation moderation
 * surface. Asserts admin-gating and the trustState transitions; prisma + auth
 * are mocked.
 */

import { NextRequest } from "next/server";

const prismaMock: any = { externalCitation: { findMany: jest.fn(), update: jest.fn() } };
const requireAuth = jest.fn();
const isPlatformAdmin = jest.fn();

jest.mock("@/lib/prismaclient", () => ({ prisma: prismaMock }));
jest.mock("@/lib/pathways/apiHelpers", () => ({
  requireAuth,
  apiError: (code: string, message: string) =>
    // Mirror the real helper's shape closely enough for status assertions.
    require("next/server").NextResponse.json(
      { error: { code, message } },
      { status: code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" ? 404 : 400 },
    ),
}));
jest.mock("@/lib/pathways/auth", () => ({ isPlatformAdmin }));

import { GET } from "@/app/api/admin/external-citations/route";
import { PATCH } from "@/app/api/admin/external-citations/[id]/route";

beforeEach(() => {
  prismaMock.externalCitation.findMany.mockReset();
  prismaMock.externalCitation.update.mockReset();
  requireAuth.mockReset();
  isPlatformAdmin.mockReset();
});

function authedAdmin() {
  requireAuth.mockResolvedValue({ ok: true, userId: "1", authId: "admin-auth" });
  isPlatformAdmin.mockReturnValue(true);
}

describe("GET /api/admin/external-citations", () => {
  it("403s a non-admin", async () => {
    requireAuth.mockResolvedValue({ ok: true, userId: "1", authId: "nope" });
    isPlatformAdmin.mockReturnValue(false);
    const res = await GET(new NextRequest("http://localhost/api/admin/external-citations"));
    expect(res.status).toBe(403);
    expect(prismaMock.externalCitation.findMany).not.toHaveBeenCalled();
  });

  it("defaults to the unreviewed queue", async () => {
    authedAdmin();
    prismaMock.externalCitation.findMany.mockResolvedValue([{ id: "x1" }]);
    const res = await GET(new NextRequest("http://localhost/api/admin/external-citations"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state).toBe("unreviewed");
    expect(prismaMock.externalCitation.findMany.mock.calls[0][0].where).toEqual({
      trustState: "unreviewed",
    });
  });

  it("state=all removes the where filter", async () => {
    authedAdmin();
    prismaMock.externalCitation.findMany.mockResolvedValue([]);
    await GET(new NextRequest("http://localhost/api/admin/external-citations?state=all"));
    expect(prismaMock.externalCitation.findMany.mock.calls[0][0].where).toEqual({});
  });
});

describe("PATCH /api/admin/external-citations/[id]", () => {
  function patch(id: string, body: unknown) {
    return PATCH(
      new NextRequest(`http://localhost/api/admin/external-citations/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) },
    );
  }

  it("400s an invalid trustState", async () => {
    authedAdmin();
    const res = await patch("x1", { trustState: "bogus" });
    expect(res.status).toBe(400);
    expect(prismaMock.externalCitation.update).not.toHaveBeenCalled();
  });

  it("promotes a citation to trusted", async () => {
    authedAdmin();
    prismaMock.externalCitation.update.mockResolvedValue({ id: "x1", trustState: "trusted" });
    const res = await patch("x1", { trustState: "trusted" });
    expect(res.status).toBe(200);
    expect((await res.json()).item.trustState).toBe("trusted");
    expect(prismaMock.externalCitation.update.mock.calls[0][0]).toMatchObject({
      where: { id: "x1" },
      data: { trustState: "trusted" },
    });
  });

  it("404s when the row does not exist", async () => {
    authedAdmin();
    prismaMock.externalCitation.update.mockRejectedValue(new Error("not found"));
    const res = await patch("ghost", { trustState: "hidden" });
    expect(res.status).toBe(404);
  });
});
