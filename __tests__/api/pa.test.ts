/**
 * Route-handler tests for preference (PA) node creation.
 *
 * Phase 0.3 of PA_NODE_PREFERENCE_INTEGRATION_ROADMAP. The pre-existing
 * `test.skip("POST /api/pa ...")` in phase4-integration.test.ts is an E2E test
 * that fetches http://localhost:3000 and needs a live server. These invoke the
 * handlers directly under the mocked jest harness, covering auth, the
 * exactly-one-preferred/dispreferred rule, the happy path, and the deprecation
 * of /api/aif/preferences (decision Q3 consolidation).
 */
import { POST as createPA } from "@/app/api/pa/route";
import { POST as deprecatedPrefs } from "@/app/api/aif/preferences/route";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

const mockArgCount = jest.fn(async () => 0);
const mockClaimCount = jest.fn(async () => 0);

jest.mock("@/lib/serverutils", () => ({ getCurrentUserId: jest.fn() }));
jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    preferenceApplication: { create: jest.fn(async () => ({ id: "pa-123" })) },
    preferenceScheme: { findUnique: jest.fn(async () => null) },
    argument: { count: (a: any) => mockArgCount(a) },
    claim: { count: (a: any) => mockClaimCount(a) },
  },
}));

const req = (body: any) => ({ json: async () => body } as any);

describe("POST /api/pa", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns 401 when unauthenticated", async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue(null);

    const res = await createPA(
      req({ deliberationId: "delib-123", preferredArgumentId: "a", dispreferredArgumentId: "b" }),
    );

    expect(res.status).toBe(401);
    expect((prisma.preferenceApplication.create as jest.Mock)).not.toHaveBeenCalled();
  });

  test("returns 400 when not exactly one preferred + one dispreferred", async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue("user-1");

    const res = await createPA(
      req({
        deliberationId: "delib-123",
        preferredArgumentId: "a",
        preferredClaimId: "c", // two preferred → invalid
        dispreferredArgumentId: "b",
      }),
    );

    expect(res.status).toBe(400);
    expect((prisma.preferenceApplication.create as jest.Mock)).not.toHaveBeenCalled();
  });

  test("creates a PA with server-derived createdById on the happy path", async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue("user-1");
    mockArgCount.mockResolvedValue(2); // both referenced arguments exist in the deliberation

    const res = await createPA(
      req({ deliberationId: "delib-123", preferredArgumentId: "arg-a", dispreferredArgumentId: "arg-b" }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ ok: true, id: "pa-123" });

    const createArg = (prisma.preferenceApplication.create as jest.Mock).mock.calls[0][0];
    expect(createArg.data).toMatchObject({
      deliberationId: "delib-123",
      createdById: "user-1", // derived from auth, never client-supplied
      preferredArgumentId: "arg-a",
      dispreferredArgumentId: "arg-b",
    });
  });

  test("returns 400 when a referenced argument does not exist in the deliberation (Phase 4.4)", async () => {
    (getCurrentUserId as jest.Mock).mockResolvedValue("user-1");
    mockArgCount.mockResolvedValue(1); // only one of the two referenced args exists

    const res = await createPA(
      req({ deliberationId: "delib-123", preferredArgumentId: "arg-a", dispreferredArgumentId: "ghost" }),
    );

    expect(res.status).toBe(400);
    expect((prisma.preferenceApplication.create as jest.Mock)).not.toHaveBeenCalled();
  });
});

describe("POST /api/aif/preferences (deprecated)", () => {
  test("returns 410 Gone pointing at /api/pa", async () => {
    const res = await deprecatedPrefs();
    expect(res.status).toBe(410);
    const data = await res.json();
    expect(data.replacement).toBe("/api/pa");
  });
});
