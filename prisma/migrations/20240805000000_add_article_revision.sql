CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT','PUBLISHED');

CREATE TABLE "articles" (
  "id" TEXT PRIMARY KEY,
  "authorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "heroImageKey" TEXT,
  "template" TEXT NOT NULL DEFAULT 'standard',
  "astJson" JSONB NOT NULL,
  "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
  "analytics" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "article_revisions" (
  "id" TEXT PRIMARY KEY,
  "articleId" TEXT NOT NULL,
  "astJson" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "article_revisions_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE
);
