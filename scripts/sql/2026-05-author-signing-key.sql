-- Track AI-EPI Pt. 5 §2 (D.2) — AuthorSigningKey table.
-- Applied out-of-band because `prisma db push` is blocked on an
-- unrelated DropIndex step (statement timeout on the Supabase host).
CREATE TABLE IF NOT EXISTS "AuthorSigningKey" (
  "keyId"         TEXT PRIMARY KEY,
  "userId"        BIGINT,
  "alg"           TEXT NOT NULL DEFAULT 'Ed25519',
  "publicKeyJwk"  JSONB NOT NULL,
  "wrappedSecret" BYTEA,
  "custody"       TEXT NOT NULL DEFAULT 'server-kms',
  "notBefore"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notAfter"      TIMESTAMP(3),
  "revokedAt"     TIMESTAMP(3),
  "revokedReason" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthorSigningKey_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "AuthorSigningKey_userId_idx"
  ON "AuthorSigningKey"("userId");
CREATE INDEX IF NOT EXISTS "AuthorSigningKey_notAfter_idx"
  ON "AuthorSigningKey"("notAfter");
