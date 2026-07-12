/**
 * Integration tests for /api/contraries (GET, DELETE) and /api/contraries/create (POST).
 *
 * Covers the security/correctness fixes from the contrary-claims fix plan:
 *   - DELETE auth + ownership/moderator gate (Task 1)
 *   - Direction-aware duplicate guard (Task 4)
 *   - Deliberation-scoped axiom check on both endpoints when symmetric (Task 5)
 *   - status enum validation + safe BigInt cast (Task 6)
 */

import { NextRequest } from "next/server";
import { GET as listContraries, DELETE as deleteContrary } from "@/app/api/contraries/route";
import { POST as createContrary } from "@/app/api/contraries/create/route";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { isRoomModerator } from "@/lib/cqs/permissions";

jest.mock("@/lib/serverutils", () => ({
  getCurrentUserId: jest.fn(),
}));

jest.mock("@/lib/cqs/permissions", () => ({
  isRoomModerator: jest.fn(),
}));

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    claimContrary: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    claim: {
      findFirst: jest.fn(),
    },
    argumentPremise: {
      findMany: jest.fn(),
    },
  },
}));

const mockUserId = (id: bigint | null) =>
  (getCurrentUserId as jest.Mock).mockResolvedValue(id);

beforeEach(() => {
  jest.clearAllMocks();
});

// --------------------------- GET ---------------------------

describe("GET /api/contraries", () => {
  test("400 when deliberationId is missing", async () => {
    const req = new NextRequest("http://localhost/api/contraries");
    const res = await listContraries(req);
    expect(res.status).toBe(400);
  });

  test("400 when status is not in enum", async () => {
    const req = new NextRequest(
      "http://localhost/api/contraries?deliberationId=d1&status=BOGUS"
    );
    const res = await listContraries(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Invalid status/);
  });

  test("returns serialized contraries with default ACTIVE filter", async () => {
    (prisma.claimContrary.findMany as jest.Mock).mockResolvedValue([
      {
        id: "cc1",
        claimId: "c1",
        contraryId: "c2",
        isSymmetric: true,
        status: "ACTIVE",
        reason: null,
        createdAt: new Date("2025-01-01"),
        createdById: 42n,
        deliberationId: "d1",
        claim: { id: "c1", text: "P" },
        contrary: { id: "c2", text: "not P" },
        createdBy: { id: 42n, username: "alice", name: null, image: null },
      },
    ]);

    const req = new NextRequest("http://localhost/api/contraries?deliberationId=d1");
    const res = await listContraries(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(1);
    expect(data.contraries[0].createdById).toBe("42"); // BigInt -> string
    expect(data.contraries[0].createdBy.id).toBe("42");

    const callArgs = (prisma.claimContrary.findMany as jest.Mock).mock.calls[0][0];
    expect(callArgs.where).toMatchObject({ deliberationId: "d1", status: "ACTIVE" });
  });

  test("when claimId is provided, includes ALL incoming relations regardless of isSymmetric", async () => {
    (prisma.claimContrary.findMany as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest(
      "http://localhost/api/contraries?deliberationId=d1&claimId=cX"
    );
    await listContraries(req);

    const where = (prisma.claimContrary.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.OR).toEqual([{ claimId: "cX" }, { contraryId: "cX" }]);
    // Must NOT gate the reverse direction by isSymmetric anymore (Task 8 fix).
    expect(
      where.OR.some(
        (clause: any) => "isSymmetric" in clause
      )
    ).toBe(false);
  });
});

// --------------------------- DELETE ---------------------------

describe("DELETE /api/contraries", () => {
  test("401 when unauthenticated", async () => {
    mockUserId(null);
    const req = new NextRequest(
      "http://localhost/api/contraries?contraryId=cc1&deliberationId=d1",
      { method: "DELETE" }
    );
    const res = await deleteContrary(req);
    expect(res.status).toBe(401);
  });

  test("400 when contraryId or deliberationId missing", async () => {
    mockUserId(1n);
    const r1 = await deleteContrary(
      new NextRequest("http://localhost/api/contraries?deliberationId=d1", { method: "DELETE" })
    );
    expect(r1.status).toBe(400);

    const r2 = await deleteContrary(
      new NextRequest("http://localhost/api/contraries?contraryId=cc1", { method: "DELETE" })
    );
    expect(r2.status).toBe(400);
  });

  test("404 when row does not exist", async () => {
    mockUserId(1n);
    (prisma.claimContrary.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await deleteContrary(
      new NextRequest(
        "http://localhost/api/contraries?contraryId=cc1&deliberationId=d1",
        { method: "DELETE" }
      )
    );
    expect(res.status).toBe(404);
  });

  test("404 when row exists in a different deliberation (no existence leak)", async () => {
    mockUserId(1n);
    (prisma.claimContrary.findUnique as jest.Mock).mockResolvedValue({
      id: "cc1",
      createdById: 1n,
      deliberationId: "OTHER",
      status: "ACTIVE",
    });
    const res = await deleteContrary(
      new NextRequest(
        "http://localhost/api/contraries?contraryId=cc1&deliberationId=d1",
        { method: "DELETE" }
      )
    );
    expect(res.status).toBe(404);
  });

  test("403 when caller is neither owner nor moderator", async () => {
    mockUserId(99n);
    (prisma.claimContrary.findUnique as jest.Mock).mockResolvedValue({
      id: "cc1",
      createdById: 1n,
      deliberationId: "d1",
      status: "ACTIVE",
    });
    (isRoomModerator as jest.Mock).mockResolvedValue(false);

    const res = await deleteContrary(
      new NextRequest(
        "http://localhost/api/contraries?contraryId=cc1&deliberationId=d1",
        { method: "DELETE" }
      )
    );
    expect(res.status).toBe(403);
    expect(prisma.claimContrary.update).not.toHaveBeenCalled();
  });

  test("200 owner soft-deletes (status -> RETRACTED)", async () => {
    mockUserId(1n);
    (prisma.claimContrary.findUnique as jest.Mock).mockResolvedValue({
      id: "cc1",
      createdById: 1n,
      deliberationId: "d1",
      status: "ACTIVE",
    });
    (prisma.claimContrary.update as jest.Mock).mockResolvedValue({ id: "cc1" });

    const res = await deleteContrary(
      new NextRequest(
        "http://localhost/api/contraries?contraryId=cc1&deliberationId=d1",
        { method: "DELETE" }
      )
    );
    expect(res.status).toBe(200);
    expect(prisma.claimContrary.update).toHaveBeenCalledWith({
      where: { id: "cc1" },
      data: { status: "RETRACTED" },
    });
  });

  test("200 moderator can delete other users' contraries", async () => {
    mockUserId(99n);
    (prisma.claimContrary.findUnique as jest.Mock).mockResolvedValue({
      id: "cc1",
      createdById: 1n,
      deliberationId: "d1",
      status: "ACTIVE",
    });
    (isRoomModerator as jest.Mock).mockResolvedValue(true);
    (prisma.claimContrary.update as jest.Mock).mockResolvedValue({ id: "cc1" });

    const res = await deleteContrary(
      new NextRequest(
        "http://localhost/api/contraries?contraryId=cc1&deliberationId=d1",
        { method: "DELETE" }
      )
    );
    expect(res.status).toBe(200);
  });

  test("idempotent on already-RETRACTED rows (no extra update)", async () => {
    mockUserId(1n);
    (prisma.claimContrary.findUnique as jest.Mock).mockResolvedValue({
      id: "cc1",
      createdById: 1n,
      deliberationId: "d1",
      status: "RETRACTED",
    });

    const res = await deleteContrary(
      new NextRequest(
        "http://localhost/api/contraries?contraryId=cc1&deliberationId=d1",
        { method: "DELETE" }
      )
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.alreadyRetracted).toBe(true);
    expect(prisma.claimContrary.update).not.toHaveBeenCalled();
  });
});

// --------------------------- POST /create ---------------------------

function postReq(body: any) {
  return new NextRequest("http://localhost/api/contraries/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/contraries/create", () => {
  const baseBody = {
    deliberationId: "d1",
    claimId: "c1",
    contraryId: "c2",
    isSymmetric: true,
  };

  test("401 when unauthenticated", async () => {
    mockUserId(null);
    const res = await createContrary(postReq(baseBody));
    expect(res.status).toBe(401);
  });

  test("400 on self-contrary", async () => {
    mockUserId(1n);
    const res = await createContrary(postReq({ ...baseBody, contraryId: "c1" }));
    expect(res.status).toBe(400);
  });

  test("404 when one of the claims is not in the deliberation", async () => {
    mockUserId(1n);
    (prisma.claim.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: "c1" })
      .mockResolvedValueOnce(null);
    const res = await createContrary(postReq(baseBody));
    expect(res.status).toBe(404);
  });

  test("409 when an ACTIVE row already exists in the same direction", async () => {
    mockUserId(1n);
    (prisma.claim.findFirst as jest.Mock).mockResolvedValue({ id: "x" });
    (prisma.claimContrary.findFirst as jest.Mock).mockResolvedValue({ id: "cc-existing" });
    const res = await createContrary(postReq(baseBody));
    expect(res.status).toBe(409);
  });

  test("asymmetric A->B does NOT collide with asymmetric B->A", async () => {
    mockUserId(1n);
    (prisma.claim.findFirst as jest.Mock).mockResolvedValue({ id: "x" });
    (prisma.claimContrary.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.argumentPremise.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.claimContrary.create as jest.Mock).mockResolvedValue({
      id: "cc-new",
      createdById: 1n,
      claim: { id: "c1", text: "A" },
      contrary: { id: "c2", text: "B" },
      createdBy: { id: 1n, username: "u", name: null },
    });

    const res = await createContrary(postReq({ ...baseBody, isSymmetric: false }));
    expect(res.status).toBe(200);

    const dupCall = (prisma.claimContrary.findFirst as jest.Mock).mock.calls[0][0];
    // For asymmetric the duplicate guard's reverse clause must require isSymmetric:true
    const reverseClause = dupCall.where.OR.find(
      (o: any) => o.claimId === "c2" && o.contraryId === "c1"
    );
    expect(reverseClause).toBeDefined();
    expect(reverseClause.isSymmetric).toBe(true);
  });

  test("axiom check is scoped by deliberationId", async () => {
    mockUserId(1n);
    (prisma.claim.findFirst as jest.Mock).mockResolvedValue({ id: "x" });
    (prisma.claimContrary.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.argumentPremise.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.claimContrary.create as jest.Mock).mockResolvedValue({
      id: "cc-new",
      createdById: 1n,
      claim: { id: "c1", text: "A" },
      contrary: { id: "c2", text: "B" },
      createdBy: { id: 1n, username: "u", name: null },
    });

    await createContrary(postReq(baseBody));
    const where = (prisma.argumentPremise.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.argument?.deliberationId).toBe("d1");
    expect(where.isAxiom).toBe(true);
    // Symmetric request checks BOTH endpoints
    expect(where.claimId.in).toEqual(expect.arrayContaining(["c1", "c2"]));
  });

  test("axiom check rejects when target is an axiom in this deliberation", async () => {
    mockUserId(1n);
    (prisma.claim.findFirst as jest.Mock).mockResolvedValue({ id: "x" });
    (prisma.claimContrary.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.argumentPremise.findMany as jest.Mock).mockResolvedValue([
      { claimId: "c2" },
    ]);

    const res = await createContrary(postReq(baseBody));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.axiomClaimIds).toEqual(["c2"]);
    expect(prisma.claimContrary.create).not.toHaveBeenCalled();
  });

  test("happy path returns serialized row", async () => {
    mockUserId(1n);
    (prisma.claim.findFirst as jest.Mock).mockResolvedValue({ id: "x" });
    (prisma.claimContrary.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.argumentPremise.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.claimContrary.create as jest.Mock).mockResolvedValue({
      id: "cc-new",
      createdById: 1n,
      claim: { id: "c1", text: "A" },
      contrary: { id: "c2", text: "B" },
      createdBy: { id: 1n, username: "alice", name: null },
    });

    const res = await createContrary(postReq(baseBody));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.contrary.createdById).toBe("1");
    expect(data.contrary.createdBy.id).toBe("1");
  });
});
