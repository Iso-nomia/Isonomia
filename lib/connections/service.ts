// lib/connections/service.ts
// server-only facade over prisma.Integration with decryption + scope checks
import "server-only";
import { prisma } from "@/lib/prismaclient";
import { decryptBytesToString, decryptBytesToJson, encryptStringToBytes, encryptJsonToBytes } from "@/lib/crypto/encryption";

export type Connection = {
  provider: string;            // e.g. "gmail", "googleSheets"
  accessToken?: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scopes: string[];
  accountLabel?: string | null; // e.g. gmail address, shop domain
  metadata?: Record<string, any> | null;
};

export async function getConnection(userId: bigint | number | string, provider: string): Promise<Connection> {
  const row = await prisma.integration.findFirst({
    where: { user_id: BigInt(userId as any), service: provider, status: "CONNECTED" },
    orderBy: { updated_at: "desc" },
  });
  if (!row) throw new Error(`No connection for provider ${provider}`);

  return {
    provider,
    accessToken: row.access_token_cipher ? decryptBytesToString(Buffer.from(row.access_token_cipher)) : undefined,
    refreshToken: row.refresh_token_cipher ? decryptBytesToString(Buffer.from(row.refresh_token_cipher)) : null,
    expiresAt: row.expires_at ?? null,
    scopes: row.scopes ?? [],
    accountLabel: row.external_account_id ?? null,
    metadata: row.metadata ? decryptBytesToJson(row.metadata as any) ?? {} : {}, // if you store encrypted JSON here
  };
}

// Optional helper: verify required scopes before running an action
export function requireScopes(conn: Connection, required: string[]) {
  const missing = required.filter(s => !conn.scopes?.includes(s));
  if (missing.length) {
    const msg = `Missing scopes for ${conn.provider}: ${missing.join(", ")}`;
    const err: any = new Error(msg);
    err.code = "MISSING_SCOPES";
    err.missingScopes = missing;
    throw err;
  }
}

// Optional helper: persist refreshed tokens back to DB
export async function upsertConnectionTokens(args: {
  userId: bigint | number | string;
  provider: string;
  accessToken?: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scopes?: string[];
  externalAccountId?: string | null;
  metadata?: Record<string, any> | null;
}) {
  const { userId, provider, accessToken, refreshToken, expiresAt, scopes, externalAccountId, metadata } = args;

  const access_token_cipher = accessToken ? encryptStringToBytes(accessToken) : undefined;
  const refresh_token_cipher = typeof refreshToken === "string" ? encryptStringToBytes(refreshToken) : undefined;

  await prisma.integration.upsert({
    where: { user_id_service_external_account_id: { user_id: BigInt(userId as any), service: provider, external_account_id: externalAccountId ?? "" } },
    create: {
      user_id: BigInt(userId as any),
      service: provider,
      external_account_id: externalAccountId ?? null,
      access_token_cipher,
      refresh_token_cipher,
      expires_at: expiresAt ?? null,
      scopes: scopes ?? [],
      status: "CONNECTED",
      metadata: metadata ? (encryptJsonToBytes(metadata) as any) : undefined,
      credential: "", // legacy field—leave empty on new writes
    },
    update: {
      external_account_id: externalAccountId ?? null,
      access_token_cipher,
      refresh_token_cipher,
      expires_at: expiresAt ?? null,
      scopes: scopes ?? undefined,
      status: "CONNECTED",
      metadata: metadata ? (encryptJsonToBytes(metadata) as any) : undefined,
    },
  });
}
