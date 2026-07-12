/**
 * Track AI-EPI Pt. 5 §2 (D.2) — keyService tests.
 *
 * The Prisma client is globally mocked in jest.setup.ts; we override that
 * mock here with an in-memory store so the service can be exercised
 * end-to-end without touching the database. Wrapping uses the
 * `MESH_EXPORT_SECRET_KEY` AES-GCM dev fallback (NODE_ENV !== "production").
 */

const mem = {
  rows: [] as any[],
};

jest.mock("@/lib/prismaclient", () => {
  const matches = (where: any, row: any): boolean => {
    if (!where) return true;
    for (const k of Object.keys(where)) {
      const v = where[k];
      if (k === "OR" && Array.isArray(v)) {
        if (!v.some((sub: any) => matches(sub, row))) return false;
        continue;
      }
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if ("startsWith" in v) {
          if (typeof row[k] !== "string" || !row[k].startsWith(v.startsWith)) return false;
          continue;
        }
        if ("gte" in v) {
          if (!(row[k] instanceof Date) || row[k].getTime() < v.gte.getTime()) return false;
          continue;
        }
      }
      if (row[k] !== v) {
        // Date equality fallback
        if (row[k] instanceof Date && v instanceof Date && row[k].getTime() === v.getTime()) continue;
        // Schema-default fallback: treat undefined and null as equivalent.
        if ((row[k] === undefined && v === null) || (row[k] === null && v === undefined)) continue;
        return false;
      }
    }
    return true;
  };
  return {
    prisma: {
      authorSigningKey: {
        findFirst: jest.fn(async ({ where, orderBy }: any) => {
          let rows = mem.rows.filter((r) => matches(where, r));
          if (orderBy?.createdAt === "desc") {
            rows = rows.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          }
          return rows[0] ?? null;
        }),
        findMany: jest.fn(async ({ where }: any) => mem.rows.filter((r) => matches(where, r))),
        create: jest.fn(async ({ data }: any) => {
          const row = { ...data };
          mem.rows.push(row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const row = mem.rows.find((r) => r.keyId === where.keyId);
          if (!row) throw new Error("not found");
          Object.assign(row, data);
          return row;
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const rows = mem.rows.filter((r) => matches(where, r));
          rows.forEach((r) => Object.assign(r, data));
          return { count: rows.length };
        }),
      },
    },
  };
});

import {
  provisionUserKey,
  rotateUserKey,
  revokeKey,
  loadActiveSigningKey,
  loadPlatformWitnessKey,
  buildPublicJwks,
} from "@/lib/keys/keyService";
import { signAttestation, verifyAttestation } from "@/server/trust/attestationSigner";

beforeEach(() => {
  mem.rows.length = 0;
  process.env.MESH_EXPORT_SECRET_KEY = "test-symmetric-secret-do-not-use";
  delete process.env.MESH_KMS_SIGNING_KEY_ARN;
  delete process.env.MESH_KMS_KEY_ARN;
});

describe("keyService", () => {
  test("provisionUserKey creates exactly one active key", async () => {
    const r = await provisionUserKey(BigInt(42));
    expect(r.keyId).toMatch(/^usr-42-/);
    expect(r.custody).toBe("server-local");
    expect(mem.rows).toHaveLength(1);
    // Note: the in-memory mock doesn't apply Prisma defaults, so unset
    // optional columns are undefined rather than null. Production schema
    // defaults `revokedAt` to NULL.
    expect(mem.rows[0].notAfter).toBeNull();
    expect(mem.rows[0].revokedAt ?? null).toBeNull();
  });

  test("provisionUserKey refuses to double-provision", async () => {
    await provisionUserKey(BigInt(7));
    await expect(provisionUserKey(BigInt(7))).rejects.toThrow(/already has active key/);
  });

  test("loadActiveSigningKey + signAttestation + verifyAttestation round-trip", async () => {
    await provisionUserKey(BigInt(1));
    const handle = await loadActiveSigningKey(BigInt(1));
    expect(handle).not.toBeNull();
    const envelope = { hello: "world", n: 3 };
    const signed = signAttestation(envelope, handle!);
    const jwks = await buildPublicJwks();
    const result = verifyAttestation(signed, jwks);
    expect(result.ok).toBe(true);
  });

  test("rotateUserKey ages out prior key but keeps it in JWKS", async () => {
    const a = await provisionUserKey(BigInt(2));
    const b = await rotateUserKey(BigInt(2));
    expect(a.keyId).not.toBe(b.keyId);
    const active = await loadActiveSigningKey(BigInt(2));
    expect(active!.keyId).toBe(b.keyId);
    const jwks = await buildPublicJwks();
    const kids = jwks.keys.map((k) => k.kid).sort();
    expect(kids).toContain(a.keyId);
    expect(kids).toContain(b.keyId);
  });

  test("signatures from old key still verify after rotation", async () => {
    await provisionUserKey(BigInt(3));
    const oldKey = (await loadActiveSigningKey(BigInt(3)))!;
    const signed = signAttestation({ msg: "before-rotation" }, oldKey);
    await rotateUserKey(BigInt(3));
    const jwks = await buildPublicJwks();
    expect(verifyAttestation(signed, jwks).ok).toBe(true);
  });

  test("revokeKey excludes the key from JWKS", async () => {
    const r = await provisionUserKey(BigInt(4));
    await revokeKey(r.keyId, "test");
    const jwks = await buildPublicJwks();
    expect(jwks.keys.find((k) => k.kid === r.keyId)).toBeUndefined();
  });

  test("verify fails when issuing key is revoked-and-removed from JWKS", async () => {
    await provisionUserKey(BigInt(5));
    const handle = (await loadActiveSigningKey(BigInt(5)))!;
    const signed = signAttestation({ x: 1 }, handle);
    await revokeKey(handle.keyId, "compromise");
    const jwks = await buildPublicJwks();
    const result = verifyAttestation(signed, jwks);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/unknown keyId/);
  });

  test("loadPlatformWitnessKey provisions on first call and is idempotent", async () => {
    const a = await loadPlatformWitnessKey();
    const b = await loadPlatformWitnessKey();
    expect(a.keyId).toBe(b.keyId);
    expect(a.keyId.startsWith("pw-") || a.keyId === "platform-witness-v1").toBe(true);
    const jwks = await buildPublicJwks();
    const witness = jwks.keys.find((k) => k.kid === a.keyId);
    expect(witness?.["iso:role"]).toBe("platform-witness");
  });
});
