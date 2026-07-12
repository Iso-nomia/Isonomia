/**
 * Deliberation read-visibility enforcement
 * (docs/DELIBERATION_CREATION_DEV_SPEC.md §5/§7).
 *
 *   • listableDeliberationWhere — anonymous sees only public; a signed-in user
 *     additionally sees their own / role-bound deliberations.
 *   • filterVisibleDeliberationIds — batch id gate for feed events.
 *   • canReadDeliberation — public/unlisted readable by anyone; private only by
 *     creator or a role holder.
 */

jest.mock("@/lib/prismaclient", () => {
  const deliberation = { findMany: jest.fn(), findUnique: jest.fn() };
  const deliberationRole = { findFirst: jest.fn() };
  return { prisma: { deliberation, deliberationRole } };
});

import { prisma } from "@/lib/prismaclient";
import {
  listableDeliberationWhere,
  filterVisibleDeliberationIds,
  canReadDeliberation,
  normalizeUserId,
} from "@/lib/deliberations/visibility";

const prismaAny = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe("normalizeUserId", () => {
  it("stringifies a bigint and passes null through", () => {
    expect(normalizeUserId(42n)).toBe("42");
    expect(normalizeUserId(null)).toBeNull();
    expect(normalizeUserId(undefined)).toBeNull();
  });
});

describe("listableDeliberationWhere", () => {
  it("restricts anonymous viewers to public only", () => {
    expect(listableDeliberationWhere(null)).toEqual({ visibility: "public" });
  });

  it("widens to creator + role-bound for a signed-in viewer", () => {
    const where = listableDeliberationWhere("u-7");
    expect(where).toEqual({
      OR: [
        { visibility: "public" },
        { createdById: "u-7" },
        { roles: { some: { userId: "u-7" } } },
      ],
    });
  });
});

describe("filterVisibleDeliberationIds", () => {
  it("returns only the ids the query says are visible, deduped", async () => {
    prismaAny.deliberation.findMany.mockResolvedValue([{ id: "a" }, { id: "c" }]);
    const set = await filterVisibleDeliberationIds(["a", "b", "c", "a", null], "u-1");
    expect([...set].sort()).toEqual(["a", "c"]);
    const arg = prismaAny.deliberation.findMany.mock.calls[0][0];
    expect(arg.where.AND[0]).toEqual({ id: { in: ["a", "b", "c"] } });
  });

  it("short-circuits with no query when ids are empty", async () => {
    const set = await filterVisibleDeliberationIds([null, undefined], "u-1");
    expect(set.size).toBe(0);
    expect(prismaAny.deliberation.findMany).not.toHaveBeenCalled();
  });
});

describe("canReadDeliberation", () => {
  it("returns false for a missing deliberation", async () => {
    prismaAny.deliberation.findUnique.mockResolvedValue(null);
    await expect(canReadDeliberation("missing", "u-1")).resolves.toBe(false);
  });

  it("allows anyone to read public and unlisted", async () => {
    prismaAny.deliberation.findUnique.mockResolvedValue({ visibility: "public", createdById: "owner" });
    await expect(canReadDeliberation("d", null)).resolves.toBe(true);
    prismaAny.deliberation.findUnique.mockResolvedValue({ visibility: "unlisted", createdById: "owner" });
    await expect(canReadDeliberation("d", null)).resolves.toBe(true);
  });

  it("blocks anonymous and non-member readers from private", async () => {
    prismaAny.deliberation.findUnique.mockResolvedValue({ visibility: "private", createdById: "owner" });
    prismaAny.deliberationRole.findFirst.mockResolvedValue(null);
    await expect(canReadDeliberation("d", null)).resolves.toBe(false);
    await expect(canReadDeliberation("d", "stranger")).resolves.toBe(false);
  });

  it("allows the creator and role holders to read private", async () => {
    prismaAny.deliberation.findUnique.mockResolvedValue({ visibility: "private", createdById: "owner" });
    await expect(canReadDeliberation("d", "owner")).resolves.toBe(true);

    prismaAny.deliberationRole.findFirst.mockResolvedValue({ id: "role-1" });
    await expect(canReadDeliberation("d", "moderator-user")).resolves.toBe(true);
  });
});
