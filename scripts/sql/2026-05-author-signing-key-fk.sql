-- Track AI-EPI Pt. 5 §2 — match Prisma's expected FK shape so the next
-- `prisma migrate diff` is empty for this constraint.
ALTER TABLE "AuthorSigningKey"
  DROP CONSTRAINT IF EXISTS "AuthorSigningKey_userId_fkey";
ALTER TABLE "AuthorSigningKey"
  ADD CONSTRAINT "AuthorSigningKey_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
