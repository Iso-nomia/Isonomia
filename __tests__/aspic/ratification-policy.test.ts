/**
 * PR1 of ATTACK_RATIFICATION_DEV_SPEC — policy resolution (§3.1, decision D1).
 */
import { describe, test, expect, beforeEach } from "@jest/globals";

const mockPrefFind = jest.fn();
const mockDelibFind = jest.fn();
jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    deliberationPref: { findUnique: (a: any) => mockPrefFind(a) },
    deliberation: { findUnique: (a: any) => mockDelibFind(a) },
  },
}));

import {
  parseRatificationPolicy,
  ratificationThreshold,
  resolveRatificationPolicy,
} from "@/lib/aspic/ratification/policy";

describe("parseRatificationPolicy", () => {
  test("recognises none/single/quorum:N; rejects junk", () => {
    expect(parseRatificationPolicy("none")).toEqual({ kind: "none" });
    expect(parseRatificationPolicy("single")).toEqual({ kind: "single" });
    expect(parseRatificationPolicy("quorum:3")).toEqual({ kind: "quorum", n: 3 });
    expect(parseRatificationPolicy("quorum:0")).toBeNull(); // n must be ≥ 1
    expect(parseRatificationPolicy("bogus")).toBeNull();
    expect(parseRatificationPolicy(null)).toBeNull();
    expect(parseRatificationPolicy(undefined)).toBeNull();
  });
});

describe("ratificationThreshold", () => {
  test("none=0, single=1, quorum=n", () => {
    expect(ratificationThreshold({ kind: "none" })).toBe(0);
    expect(ratificationThreshold({ kind: "single" })).toBe(1);
    expect(ratificationThreshold({ kind: "quorum", n: 4 })).toBe(4);
  });
});

describe("resolveRatificationPolicy", () => {
  beforeEach(() => {
    mockPrefFind.mockReset();
    mockDelibFind.mockReset();
  });

  test("explicit DeliberationPref policy wins (no hostType lookup)", async () => {
    mockPrefFind.mockResolvedValue({ attackRatificationPolicy: "quorum:2" });
    expect(await resolveRatificationPolicy("d1")).toEqual({ kind: "quorum", n: 2 });
    expect(mockDelibFind).not.toHaveBeenCalled();
  });

  test("no explicit policy + free hostType → none (personal on-ramp)", async () => {
    mockPrefFind.mockResolvedValue(null);
    mockDelibFind.mockResolvedValue({ hostType: "free" });
    expect(await resolveRatificationPolicy("d1")).toEqual({ kind: "none" });
  });

  test("null policy + room/other hostType → single", async () => {
    mockPrefFind.mockResolvedValue({ attackRatificationPolicy: null });
    mockDelibFind.mockResolvedValue({ hostType: "room_thread" });
    expect(await resolveRatificationPolicy("d1")).toEqual({ kind: "single" });
  });
});
