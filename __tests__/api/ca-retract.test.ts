/**
 * PR3 of ATTACK_RATIFICATION_DEV_SPEC — author retract → WITHDRAWN (§5.3).
 * Author-only, terminal. Mirrors the ca-ratify handler-test harness.
 */
import { describe, test, expect, beforeEach } from "@jest/globals";

const mockCAFind = jest.fn();
const mockCAUpdate = jest.fn(async () => ({}));

jest.mock("@/lib/serverutils", () => ({ getCurrentUserId: jest.fn() }));
jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    conflictApplication: { findUnique: (a: any) => mockCAFind(a), update: (a: any) => mockCAUpdate(a) },
  },
}));

import { POST } from "@/app/api/ca/[id]/retract/route";
import { getCurrentUserId } from "@/lib/serverutils";

const req = {} as any;
const ctx = (id: string) => ({ params: { id } });
const ca = (over: Record<string, any> = {}) => ({
  id: "ca1",
  createdById: "author",
  ratificationStatus: "EFFECTIVE",
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe("POST /api/ca/[id]/retract", () => {
  test("401 when unauthenticated", async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue(null);
    expect((await POST(req, ctx("ca1"))).status).toBe(401);
  });

  test("404 when the conflict does not exist", async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue("author");
    mockCAFind.mockResolvedValue(null);
    expect((await POST(req, ctx("ca1"))).status).toBe(404);
  });

  test("403 when the caller is not the author", async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue("someoneElse");
    mockCAFind.mockResolvedValue(ca());
    const res = await POST(req, ctx("ca1"));
    expect(res.status).toBe(403);
    expect(mockCAUpdate).not.toHaveBeenCalled();
  });

  test("author retract flips the CA to WITHDRAWN", async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue("author");
    mockCAFind.mockResolvedValue(ca());
    const res = await POST(req, ctx("ca1"));
    expect((await res.json()).ratificationStatus).toBe("WITHDRAWN");
    expect(mockCAUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ratificationStatus: "WITHDRAWN", ratifiedAt: null }) }),
    );
  });

  test("retracting an already-WITHDRAWN CA is idempotent (no update)", async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue("author");
    mockCAFind.mockResolvedValue(ca({ ratificationStatus: "WITHDRAWN" }));
    const res = await POST(req, ctx("ca1"));
    expect((await res.json()).ratificationStatus).toBe("WITHDRAWN");
    expect(mockCAUpdate).not.toHaveBeenCalled();
  });
});
