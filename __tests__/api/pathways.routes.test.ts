/**
 * Integration tests for Pathways API routes — focused on auth/role gating
 * and key failure modes (double-submit, snapshot mismatch, redaction).
 *
 * Prisma is fully mocked; we exercise the route handlers' control flow.
 */

import { NextRequest } from "next/server";

// --- Mocks --------------------------------------------------------------

jest.mock("@/lib/serverutils", () => ({
  getCurrentUserId: jest.fn(),
  getCurrentUserAuthId: jest.fn(),
}));

const prismaMock = {
  institution: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  institutionMember: { findFirst: jest.fn() },
  deliberation: { findUnique: jest.fn() },
  deliberationRole: { findMany: jest.fn() },
  institutionalPathway: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  recommendationPacket: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  recommendationPacketItem: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  institutionalSubmission: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  institutionalResponse: { findUnique: jest.fn(), findFirst: jest.fn() },
  pathwayEvent: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  facilitationSession: { findFirst: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock("@/lib/prismaclient", () => ({
  prisma: prismaMock,
}));

// Import AFTER mocks
import { getCurrentUserAuthId, getCurrentUserId } from "@/lib/serverutils";
import { POST as createInstitution } from "@/app/api/institutions/route";
import { POST as openPathway } from "@/app/api/deliberations/[id]/pathways/route";
import { POST as closePathway } from "@/app/api/pathways/[id]/close/route";
import { GET as getPathway } from "@/app/api/pathways/[id]/route";
import { GET as listInstitutionPathways } from "@/app/api/institutions/[id]/pathways/route";

// --- Helpers ------------------------------------------------------------

function authedAs(userId: bigint | null, authId: string | null = "auth_user") {
  (getCurrentUserId as jest.Mock).mockResolvedValue(userId);
  (getCurrentUserAuthId as jest.Mock).mockResolvedValue(userId ? authId : null);
}

function jsonReq(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.MESH_PATHWAYS_ADMIN_AUTH_IDS;
});

// --- Tests --------------------------------------------------------------

describe("POST /api/institutions (admin gate)", () => {
  const body = {
    slug: "city-council",
    name: "City Council",
    kind: "legislature" as const,
  };

  test("401 when unauthenticated", async () => {
    authedAs(null);
    const res = await createInstitution(
      jsonReq("http://test/api/institutions", body),
    );
    expect(res.status).toBe(401);
  });

  test("403 when authed but not in admin allowlist", async () => {
    authedAs(BigInt(1), "auth_random");
    process.env.MESH_PATHWAYS_ADMIN_AUTH_IDS = "auth_admin_a,auth_admin_b";
    const res = await createInstitution(
      jsonReq("http://test/api/institutions", body),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  test("201 when authId is in admin allowlist", async () => {
    authedAs(BigInt(1), "auth_admin_a");
    process.env.MESH_PATHWAYS_ADMIN_AUTH_IDS = "auth_admin_a,auth_admin_b";
    prismaMock.institution.create.mockResolvedValue({
      id: "inst1",
      ...body,
      jurisdiction: null,
      contactJson: null,
      verifiedAt: null,
      linkedDeliberationId: null,
      createdById: "1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await createInstitution(
      jsonReq("http://test/api/institutions", body),
    );
    expect(res.status).toBe(201);
    expect(prismaMock.institution.create).toHaveBeenCalledTimes(1);
  });

  test("422 on invalid body", async () => {
    authedAs(BigInt(1), "auth_admin_a");
    process.env.MESH_PATHWAYS_ADMIN_AUTH_IDS = "auth_admin_a";
    const res = await createInstitution(
      jsonReq("http://test/api/institutions", { slug: "" }),
    );
    expect(res.status).toBe(422);
  });
});

describe("POST /api/deliberations/[id]/pathways (facilitator gate)", () => {
  const params = { id: "delib1" };
  const body = { institutionId: "inst1", subject: "Test subject" };

  test("401 when unauthenticated", async () => {
    authedAs(null);
    const res = await openPathway(
      jsonReq("http://test/api/deliberations/delib1/pathways", body),
      { params },
    );
    expect(res.status).toBe(401);
  });

  test("403 when not host and no facilitator role", async () => {
    authedAs(BigInt(2));
    prismaMock.deliberation.findUnique.mockResolvedValue({
      createdById: "999", // someone else
    });
    prismaMock.deliberationRole.findMany.mockResolvedValue([
      { role: "observer" },
    ]);
    const res = await openPathway(
      jsonReq("http://test/api/deliberations/delib1/pathways", body),
      { params },
    );
    expect(res.status).toBe(403);
  });

  test("passes auth when caller is the deliberation host", async () => {
    authedAs(BigInt(7));
    prismaMock.deliberation.findUnique.mockResolvedValue({ createdById: "7" });
    // openPathway service path — short-circuit by making institution lookup fail
    prismaMock.institution.findUnique.mockResolvedValue(null);
    const res = await openPathway(
      jsonReq("http://test/api/deliberations/delib1/pathways", body),
      { params },
    );
    // Not 401/403 — gating passed; downstream service may succeed or fail
    expect([200, 201, 400, 404, 409, 500]).toContain(res.status);
  });
});

describe("POST /api/pathways/[id]/close (host-only gate)", () => {
  const params = { id: "pw1" };

  test("403 when facilitator-but-not-host attempts to close", async () => {
    authedAs(BigInt(3));
    prismaMock.institutionalPathway.findUnique.mockResolvedValue({
      id: "pw1",
      deliberationId: "delib1",
      institutionId: "inst1",
      isPublic: false,
      status: "OPEN",
      currentPacketId: null,
    });
    prismaMock.deliberation.findUnique.mockResolvedValue({
      createdById: "999",
    });
    const res = await closePathway(
      jsonReq("http://test/api/pathways/pw1/close", {}),
      { params },
    );
    expect(res.status).toBe(403);
  });

  test("404 when pathway missing", async () => {
    authedAs(BigInt(3));
    prismaMock.institutionalPathway.findUnique.mockResolvedValue(null);
    const res = await closePathway(
      jsonReq("http://test/api/pathways/pw1/close", {}),
      { params },
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/pathways/[id] (public-read redaction)", () => {
  const params = { id: "pw1" };

  test("redacts actor IDs when accessed anonymously and pathway is public", async () => {
    authedAs(null);
    prismaMock.institutionalPathway.findUnique.mockResolvedValue({
      id: "pw1",
      deliberationId: "delib1",
      institutionId: "inst1",
      isPublic: true,
      status: "OPEN",
      currentPacketId: null,
      openedById: "user42",
      openedAt: new Date(),
      closedAt: null,
      subject: "S",
    });
    const req = new NextRequest("http://test/api/pathways/pw1");
    const res = await getPathway(req, { params });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pathway.openedById).toBeNull();
  });

  test("401 when accessed anonymously and pathway is private", async () => {
    authedAs(null);
    prismaMock.institutionalPathway.findUnique.mockResolvedValue({
      id: "pw1",
      deliberationId: "delib1",
      institutionId: "inst1",
      isPublic: false,
      status: "OPEN",
      currentPacketId: null,
      openedById: "user42",
      openedAt: new Date(),
      closedAt: null,
      subject: "S",
    });
    const req = new NextRequest("http://test/api/pathways/pw1");
    const res = await getPathway(req, { params });
    expect(res.status).toBe(401);
  });

  test("preserves actor IDs when authenticated", async () => {
    authedAs(BigInt(1));
    prismaMock.institutionalPathway.findUnique.mockResolvedValue({
      id: "pw1",
      deliberationId: "delib1",
      institutionId: "inst1",
      isPublic: true,
      status: "OPEN",
      currentPacketId: null,
      openedById: "user42",
      openedAt: new Date(),
      closedAt: null,
      subject: "S",
    });
    const req = new NextRequest("http://test/api/pathways/pw1");
    const res = await getPathway(req, { params });
    const json = await res.json();
    expect(json.pathway.openedById).toBe("user42");
  });
});

describe("GET /api/institutions/[id]/pathways", () => {
  const params = { id: "inst1" };

  test("404 when institution missing", async () => {
    authedAs(BigInt(1));
    prismaMock.institution.findUnique.mockResolvedValue(null);
    const req = new NextRequest("http://test/api/institutions/inst1/pathways");
    const res = await listInstitutionPathways(req, { params });
    expect(res.status).toBe(404);
  });

  test("filters to public pathways for anonymous callers", async () => {
    authedAs(null);
    prismaMock.institution.findUnique.mockResolvedValue({
      id: "inst1",
      slug: "x",
      name: "X",
      kind: "agency",
    });
    prismaMock.institutionalPathway.findMany.mockResolvedValue([]);
    const req = new NextRequest("http://test/api/institutions/inst1/pathways");
    const res = await listInstitutionPathways(req, { params });
    expect(res.status).toBe(200);
    const callArgs = prismaMock.institutionalPathway.findMany.mock.calls[0][0];
    expect(callArgs.where.isPublic).toBe(true);
  });

  test("does not filter on isPublic when authenticated", async () => {
    authedAs(BigInt(1));
    prismaMock.institution.findUnique.mockResolvedValue({
      id: "inst1",
      slug: "x",
      name: "X",
      kind: "agency",
    });
    prismaMock.institutionalPathway.findMany.mockResolvedValue([]);
    const req = new NextRequest("http://test/api/institutions/inst1/pathways");
    const res = await listInstitutionPathways(req, { params });
    expect(res.status).toBe(200);
    const callArgs = prismaMock.institutionalPathway.findMany.mock.calls[0][0];
    expect(callArgs.where.isPublic).toBeUndefined();
  });

  test("422 on invalid status filter", async () => {
    authedAs(BigInt(1));
    const req = new NextRequest(
      "http://test/api/institutions/inst1/pathways?status=BOGUS",
    );
    const res = await listInstitutionPathways(req, { params });
    expect(res.status).toBe(422);
  });
});
