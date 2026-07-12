/**
 * Key Service — Track AI-EPI Pt. 5 §2 (D.2)
 *
 * Per-author Ed25519 signing keys. Private keys live server-side, wrapped
 * by AWS KMS in production (`custody = "server-kms"`). For local dev we
 * fall back to AES-GCM using a symmetric key from `MESH_EXPORT_SECRET_KEY`
 * (`custody = "server-local"`); this fallback path is rejected when
 * `NODE_ENV === "production"`.
 *
 * Invariants:
 *   - One *active* key per `userId` (notAfter NULL, revokedAt NULL).
 *   - Rotation calls `rotateUserKey`, which sets `notAfter` on the prior
 *     row to "now" and creates a new active row. Old rows remain in JWKS
 *     until their `notAfter` is past + the configured grace period so old
 *     signatures still verify.
 *   - `loadActiveSigningKey` returns the secretKey decrypted in-memory;
 *     callers must not persist or log it.
 *   - The platform witness key (no userId, role = platform-witness) is
 *     created lazily by `loadPlatformWitnessKey()` and used to sign
 *     `?signed=1` envelopes when the resource has no per-author key.
 */

import crypto from "crypto";
import { prisma } from "@/lib/prismaclient";
import {
  generateKeyHandle,
  publicKeyToJwksEntry,
  type KeyHandle,
  type JwksEntry,
} from "@/server/trust/attestationSigner";

const PLATFORM_WITNESS_USER_ID: bigint | null = null;
// Note: must start with "pw-" so `loadPlatformWitnessKey`'s lookup query
// (`keyId: { startsWith: "pw-" }`) finds it.
const PLATFORM_WITNESS_KEY_ID = "pw-platform-witness-v1";

// ---------------------------------------------------------------------------
// Wrapping (KMS or local AES-GCM)
// ---------------------------------------------------------------------------

type Custody = "server-kms" | "server-local";

interface WrappedKey {
  custody: Custody;
  ciphertext: Uint8Array;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

async function getKmsClient(): Promise<{
  client: import("@aws-sdk/client-kms").KMSClient;
  keyId: string;
} | null> {
  const keyId = process.env.MESH_KMS_SIGNING_KEY_ARN ?? process.env.MESH_KMS_KEY_ARN;
  if (!keyId) return null;
  const region = process.env.AWS_REGION ?? "us-east-1";
  const { KMSClient } = await import("@aws-sdk/client-kms");
  return { client: new KMSClient({ region }), keyId };
}

async function wrapSecretKey(seed: Uint8Array): Promise<WrappedKey> {
  if (seed.length !== 32) {
    throw new Error(`wrapSecretKey: expected 32-byte seed, got ${seed.length}`);
  }
  const kms = await getKmsClient();
  if (kms) {
    const { EncryptCommand } = await import("@aws-sdk/client-kms");
    const out = await kms.client.send(
      new EncryptCommand({
        KeyId: kms.keyId,
        Plaintext: seed,
        EncryptionContext: { purpose: "isonomia-author-signing-key" },
      }),
    );
    if (!out.CiphertextBlob) {
      throw new Error("wrapSecretKey: KMS returned no ciphertext");
    }
    return { custody: "server-kms", ciphertext: new Uint8Array(out.CiphertextBlob) };
  }

  if (isProduction()) {
    throw new Error(
      "wrapSecretKey: MESH_KMS_SIGNING_KEY_ARN is required in production (no local fallback)",
    );
  }

  const symKey = process.env.MESH_EXPORT_SECRET_KEY;
  if (!symKey) {
    throw new Error(
      "wrapSecretKey: MESH_EXPORT_SECRET_KEY is required for local dev fallback",
    );
  }
  const key = crypto.createHash("sha256").update(symKey, "utf8").digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(seed), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: [12-byte IV][16-byte tag][N bytes ct]
  return {
    custody: "server-local",
    ciphertext: new Uint8Array(Buffer.concat([iv, tag, ct])),
  };
}

async function unwrapSecretKey(custody: Custody, ciphertext: Uint8Array): Promise<Uint8Array> {
  if (custody === "server-kms") {
    const kms = await getKmsClient();
    if (!kms) throw new Error("unwrapSecretKey: KMS not configured");
    const { DecryptCommand } = await import("@aws-sdk/client-kms");
    const out = await kms.client.send(
      new DecryptCommand({
        CiphertextBlob: ciphertext,
        EncryptionContext: { purpose: "isonomia-author-signing-key" },
      }),
    );
    if (!out.Plaintext) throw new Error("unwrapSecretKey: KMS returned no plaintext");
    return new Uint8Array(out.Plaintext);
  }

  if (isProduction()) {
    throw new Error("unwrapSecretKey: server-local custody not allowed in production");
  }
  const symKey = process.env.MESH_EXPORT_SECRET_KEY;
  if (!symKey) throw new Error("unwrapSecretKey: MESH_EXPORT_SECRET_KEY missing");
  const key = crypto.createHash("sha256").update(symKey, "utf8").digest();
  const buf = Buffer.from(ciphertext);
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return new Uint8Array(Buffer.concat([decipher.update(ct), decipher.final()]));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ProvisionOptions {
  /** Override the keyId (tests / migrations). */
  keyId?: string;
  /** Optional explicit notBefore. Defaults to now. */
  notBefore?: Date;
  /** Optional notAfter. Active keys typically leave this NULL. */
  notAfter?: Date | null;
}

export interface ProvisionResult {
  keyId: string;
  publicKeyJwk: JwksEntry;
  custody: Custody;
}

function newKeyId(role: "author" | "platform-witness", userId: bigint | null): string {
  const rand = crypto.randomBytes(8).toString("hex");
  if (role === "platform-witness") return `pw-${rand}`;
  return `usr-${userId?.toString() ?? "anon"}-${rand}`;
}

/**
 * Provision a fresh signing key for a user. Throws if an active key
 * already exists; use `rotateUserKey` to roll a new one.
 */
export async function provisionUserKey(
  userId: bigint,
  options: ProvisionOptions = {},
): Promise<ProvisionResult> {
  const existing = await prisma.authorSigningKey.findFirst({
    where: { userId, notAfter: null, revokedAt: null },
    select: { keyId: true },
  });
  if (existing) {
    throw new Error(
      `provisionUserKey: user ${userId} already has active key ${existing.keyId}; use rotateUserKey`,
    );
  }
  return insertKeyRow(userId, "author", options);
}

/**
 * Rotate: stamp the active key's notAfter to now and create a replacement.
 * Old key remains in JWKS for verification of historical signatures.
 */
export async function rotateUserKey(
  userId: bigint,
  options: ProvisionOptions = {},
): Promise<ProvisionResult> {
  await prisma.authorSigningKey.updateMany({
    where: { userId, notAfter: null, revokedAt: null },
    data: { notAfter: new Date() },
  });
  return insertKeyRow(userId, "author", options);
}

/**
 * Revoke a specific key. The row stays in the database but is excluded
 * from the public JWKS. Verifiers should additionally consult the
 * revocation list (Sprint 1 §3).
 */
export async function revokeKey(keyId: string, reason: string): Promise<void> {
  await prisma.authorSigningKey.update({
    where: { keyId },
    data: { revokedAt: new Date(), revokedReason: reason, notAfter: new Date() },
  });
}

/**
 * Load the user's currently-active signing key (decrypted in-memory).
 * Returns `null` if the user has no active key. Caller should treat the
 * returned `KeyHandle.secretKey` as ephemeral.
 */
export async function loadActiveSigningKey(userId: bigint): Promise<KeyHandle | null> {
  const row = await prisma.authorSigningKey.findFirst({
    where: { userId, notAfter: null, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  return rowToKeyHandle(row);
}

/**
 * Load the platform witness key, lazily provisioning it on first call.
 * Used to sign `?signed=1` envelopes that have no per-author key.
 */
export async function loadPlatformWitnessKey(): Promise<KeyHandle> {
  const row = await prisma.authorSigningKey.findFirst({
    where: { userId: null, notAfter: null, revokedAt: null, keyId: { startsWith: "pw-" } },
    orderBy: { createdAt: "desc" },
  });
  if (row) return rowToKeyHandle(row);
  await insertKeyRow(PLATFORM_WITNESS_USER_ID, "platform-witness", {
    keyId: PLATFORM_WITNESS_KEY_ID,
  });
  const fresh = await prisma.authorSigningKey.findFirst({
    where: { userId: null, notAfter: null, revokedAt: null, keyId: { startsWith: "pw-" } },
    orderBy: { createdAt: "desc" },
  });
  if (!fresh) throw new Error("loadPlatformWitnessKey: provisioning failed");
  return rowToKeyHandle(fresh);
}

/**
 * Build the public JWK Set served at `/.well-known/issuer-keys`. Includes
 * non-revoked keys whose `notAfter` is either NULL or within the
 * verification grace window (default 30 days).
 */
export async function buildPublicJwks(opts: { graceDays?: number } = {}): Promise<{
  keys: JwksEntry[];
}> {
  const graceDays = opts.graceDays ?? 30;
  const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000);
  const rows = await prisma.authorSigningKey.findMany({
    where: {
      revokedAt: null,
      OR: [{ notAfter: null }, { notAfter: { gte: cutoff } }],
    },
    select: {
      keyId: true,
      userId: true,
      publicKeyJwk: true,
      notBefore: true,
      notAfter: true,
    },
  });
  const keys: JwksEntry[] = rows.map((r) => {
    const entry = r.publicKeyJwk as unknown as JwksEntry;
    return {
      ...entry,
      kid: r.keyId,
      "iso:notBefore": r.notBefore?.toISOString() ?? null,
      "iso:notAfter": r.notAfter ? r.notAfter.toISOString() : null,
      "iso:role": r.userId == null ? "platform-witness" : "author",
    };
  });
  return { keys };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function insertKeyRow(
  userId: bigint | null,
  role: "author" | "platform-witness",
  options: ProvisionOptions,
): Promise<ProvisionResult> {
  const keyId = options.keyId ?? newKeyId(role, userId);
  const handle = generateKeyHandle(keyId);
  const wrapped = await wrapSecretKey(handle.secretKey);
  const publicKeyJwk = publicKeyToJwksEntry(handle.publicKey, {
    kid: keyId,
    role,
    notBefore: options.notBefore ?? new Date(),
    notAfter: options.notAfter ?? null,
  });
  await prisma.authorSigningKey.create({
    data: {
      keyId,
      userId,
      alg: "Ed25519",
      publicKeyJwk: publicKeyJwk as unknown as object,
      wrappedSecret: Buffer.from(wrapped.ciphertext),
      custody: wrapped.custody,
      notBefore: options.notBefore ?? new Date(),
      notAfter: options.notAfter ?? null,
    },
  });
  return { keyId, publicKeyJwk, custody: wrapped.custody };
}

interface DbRow {
  keyId: string;
  alg: string;
  publicKeyJwk: unknown;
  wrappedSecret: Uint8Array | Buffer | null;
  custody: string;
  notBefore: Date;
  notAfter: Date | null;
}

async function rowToKeyHandle(row: DbRow): Promise<KeyHandle> {
  if (!row.wrappedSecret) {
    throw new Error(`rowToKeyHandle: key ${row.keyId} has no wrappedSecret`);
  }
  const ct =
    row.wrappedSecret instanceof Uint8Array
      ? row.wrappedSecret
      : new Uint8Array(row.wrappedSecret);
  const seed = await unwrapSecretKey(row.custody as Custody, ct);
  if (seed.length !== 32) {
    throw new Error(`rowToKeyHandle: decrypted seed has length ${seed.length}, expected 32`);
  }
  const jwk = row.publicKeyJwk as JwksEntry;
  // Recover the 32-byte public key from base64url for the KeyHandle.
  const padded =
    jwk.x.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (jwk.x.length % 4)) % 4);
  const publicKey = new Uint8Array(Buffer.from(padded, "base64"));
  return {
    keyId: row.keyId,
    secretKey: seed,
    publicKey,
    alg: "Ed25519",
    notBefore: row.notBefore,
    notAfter: row.notAfter,
  };
}
