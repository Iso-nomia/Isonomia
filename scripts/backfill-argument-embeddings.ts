/**
 * AI-EPI C.1 — backfill embeddings for all arguments missing one.
 *
 * Usage:
 *   npx tsx scripts/backfill-argument-embeddings.ts [--limit=1000] [--force]
 *
 * Iterates arguments where embedding IS NULL (or all of them with --force),
 * batches into OpenAI calls of 100 at a time, writes vectors via raw SQL.
 *
 * Idempotent. Safe to interrupt and re-run.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import { createHash } from "node:crypto";

// Use DIRECT_URL for long-running script work; bypass the extended
// Prisma client in lib/prismaclient.ts which carries dev hooks not
// needed for the embedding pipeline.
const directUrl = process.env.DIRECT_URL;
if (!directUrl) throw new Error("DIRECT_URL is required");
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });
const openai = new OpenAI();

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;
const OPENAI_BATCH = 100;

function hashText(s: string) {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
function vecLiteral(v: number[]) {
  if (v.length !== EMBEDDING_DIM) throw new Error("dim mismatch");
  return "[" + v.join(",") + "]";
}

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const LIMIT = (() => {
  const a = args.find((x) => x.startsWith("--limit="));
  if (!a) return Infinity;
  const n = Number(a.split("=")[1]);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
})();
const PAGE = 100;

async function fetchPage(after: string | null): Promise<{ id: string }[]> {
  // Raw SQL because Prisma has no operator for `embedding IS NULL` on
  // Unsupported columns. Stable cursor on id.
  if (FORCE) {
    return prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "Argument"
       WHERE ($1::text IS NULL OR id > $1)
       ORDER BY id ASC
       LIMIT $2`,
      after,
      PAGE,
    );
  }
  return prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Argument"
     WHERE "embedding" IS NULL
       AND ($1::text IS NULL OR id > $1)
     ORDER BY id ASC
     LIMIT $2`,
    after,
    PAGE,
  );
}

async function main() {
  let cursor: string | null = null;
  let processed = 0;
  let embedded = 0;
  let skipped = 0;
  let failed = 0;
  let tokens = 0;

  console.log(
    `[backfill] mode=${FORCE ? "force" : "missing-only"} limit=${LIMIT === Infinity ? "all" : LIMIT}`,
  );

  while (processed < LIMIT) {
    const rows = await fetchPage(cursor);
    if (rows.length === 0) break;

    const slice = rows.slice(0, Math.min(rows.length, LIMIT - processed));
    const ids = slice.map((r) => r.id);

    // Build texts for the slice in parallel (capped concurrency) so we
    // amortise WAN round-trips. Single combined select pulls the
    // existing embeddingHash/Model in the same query for skip-check.
    const CONCURRENCY = 16;
    type Item = { id: string; text: string; hash: string };
    const work: Item[] = [];
    let cursorIdx = 0;
    async function worker() {
      while (cursorIdx < ids.length) {
        const myIdx = cursorIdx++;
        const id = ids[myIdx];
        const arg = await prisma.argument.findUnique({
          where: { id },
          select: {
            text: true,
            embeddingHash: true,
            embeddingModel: true,
            conclusion: { select: { text: true } },
            premises: {
              select: { claim: { select: { text: true } } },
              orderBy: { claimId: "asc" },
              take: 12,
            },
            argumentSchemes: {
              where: { isPrimary: true },
              select: { scheme: { select: { key: true } } },
              take: 1,
            },
          },
        });
        if (!arg) {
          skipped++;
          continue;
        }
        const head = (arg.conclusion?.text || arg.text || "").trim();
        if (!head) {
          skipped++;
          continue;
        }
        const premises = arg.premises
          .map((p) => p.claim?.text?.trim())
          .filter((t): t is string => Boolean(t));
        const sk = arg.argumentSchemes[0]?.scheme?.key?.trim() || null;
        const parts = [head, ...premises];
        if (sk) parts.push(`scheme:${sk}`);
        const text = parts.join(" · ");
        const hash = hashText(text);
        if (
          !FORCE &&
          arg.embeddingHash === hash &&
          arg.embeddingModel === EMBEDDING_MODEL
        ) {
          skipped++;
          continue;
        }
        work.push({ id, text, hash });
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, ids.length) }, () =>
        worker(),
      ),
    );

    // Batch into OpenAI calls of OPENAI_BATCH.
    for (let i = 0; i < work.length; i += OPENAI_BATCH) {
      const batch = work.slice(i, i + OPENAI_BATCH);
      try {
        const resp = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: batch.map((b) => b.text),
          encoding_format: "float",
        });
        tokens += resp.usage?.total_tokens ?? 0;
        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          const vec = resp.data[j]?.embedding;
          if (!vec) {
            failed++;
            continue;
          }
          await prisma.$executeRawUnsafe(
            `UPDATE "Argument" SET "embedding" = $1::vector,
                                   "embeddingHash" = $2,
                                   "embeddingModel" = $3,
                                   "embeddedAt" = now()
             WHERE "id" = $4`,
            vecLiteral(vec),
            item.hash,
            EMBEDDING_MODEL,
            item.id,
          );
          embedded++;
        }
      } catch (err: any) {
        failed += batch.length;
        console.error(`[backfill] batch failed:`, err?.message || err);
      }
    }

    processed += slice.length;
    cursor = slice[slice.length - 1].id;
    console.log(
      `[backfill] processed=${processed} embedded=${embedded} skipped=${skipped} failed=${failed} tokens=${tokens}`,
    );
  }

  console.log(
    `\n✓ done. processed=${processed} embedded=${embedded} skipped=${skipped} failed=${failed}`,
  );
  console.log(
    `  est. cost (text-embedding-3-small @ $0.02/1M tok): $${(
      (tokens / 1_000_000) *
      0.02
    ).toFixed(4)}`,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
