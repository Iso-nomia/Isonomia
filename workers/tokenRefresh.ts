// lib/connections/service.ts (server only)
import { decrypt } from "@/lib/crypto/encryption";
import { db } from "@/lib/db"; // your Prisma instance

export interface Connection {
  provider: string;
  accountLabel?: string;
  accessToken?: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scopes?: string[];
  email?: string; // e.g. for Gmail convenience
}

export async function getConnection(orgId: string, provider: string): Promise<Connection> {
  const row = await db.integrations.findFirst({
    where: { org_id: orgId, provider },
    orderBy: { updated_at: "desc" }
  });
  if (!row) throw new Error(`No connection for provider ${provider}`);

  const accessToken = row.access_token_ciphertext ? await decrypt(row.access_token_ciphertext) : undefined;
  const refreshToken = row.refresh_token_ciphertext ? await decrypt(row.refresh_token_ciphertext) : undefined;
  // Optionally enrich email/accountLabel from provider metadata you store in another column
  return {
    provider: row.provider,
    accessToken,
    refreshToken,
    expiresAt: row.expires_at ?? null,
    scopes: row.scope ?? [],
    // email/accountLabel: derive from metadata JSON if you store it
  };
}
