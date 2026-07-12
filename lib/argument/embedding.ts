/**
 * AI-EPI C.1 — pgvector dense retrieval, embedding layer.
 *
 * Responsibilities:
 *   • Build the canonical text we embed for an Argument (claim · premises ·
 *     scheme key). Mirrors the contentHash discipline: same-text → same
 *     embeddingHash → no-op re-embed.
 *   • Call OpenAI text-embedding-3-small (1536d) in batches.
 *   • Persist the vector via raw SQL (Prisma cannot bind ::vector yet).
 *
 * Costs (text-embedding-3-small): $0.02 / 1M tokens.
 *   Avg argument ≈ 400 tokens → 100k arguments ≈ $0.80 one-time.
 *
 * NOTE: This module is dependency-light by design (no Redis, no worker
 * machinery) so it can be called from API routes, the worker, the
 * backfill script, and tests without spinning anything else up.
 */
import OpenAI from "openai";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prismaclient";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;
const OPENAI_MAX_BATCH = 100; // OpenAI hard cap for embeddings; we chunk to 100.

let _openai: OpenAI | null = null;
function openai(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

export type EmbedOutcome =
  | { embedded: true; reason: "new" | "stale" | "forced"; tokens: number }
  | { embedded: false; reason: "no-op" | "missing" | "empty-text" };

/**
 * Build the canonical text we embed for an Argument.
 *
 * Concatenation rule (stable, do not re-order):
 *   "<conclusion.text || argument.text> · <premise[0].text> · ... · scheme:<key>"
 *
 * Premises matter for retrieval recall (a query about a premise should
 * find arguments that use it). Scheme key tags the inference type
 * cheaply and lets the embedding cluster by argument shape.
 */
export async function buildEmbeddingText(argumentId: string): Promise<string | null> {
  const arg = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: {
      text: true,
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
  if (!arg) return null;

  const head = (arg.conclusion?.text || arg.text || "").trim();
  if (!head) return null;

  const premises = arg.premises
    .map((p) => p.claim?.text?.trim())
    .filter((t): t is string => Boolean(t));

  const schemeKey = arg.argumentSchemes[0]?.scheme?.key?.trim() || null;

  const parts = [head, ...premises];
  if (schemeKey) parts.push(`scheme:${schemeKey}`);
  return parts.join(" · ");
}

export function computeEmbeddingHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Format a number[] as the pgvector text literal "[0.1,0.2,...]".
 * pg/Prisma serialise this through a `::vector` cast.
 */
function toVectorLiteral(vec: number[]): string {
  if (vec.length !== EMBEDDING_DIM) {
    throw new Error(
      `embedding dim mismatch: got ${vec.length}, expected ${EMBEDDING_DIM}`,
    );
  }
  return "[" + vec.join(",") + "]";
}

/**
 * Embed one argument. Idempotent: short-circuits when the canonical text
 * hasn't changed since the last embedding.
 */
export async function embedArgument(
  argumentId: string,
  opts: { force?: boolean } = {},
): Promise<EmbedOutcome> {
  const text = await buildEmbeddingText(argumentId);
  if (text === null) return { embedded: false, reason: "missing" };
  if (!text) return { embedded: false, reason: "empty-text" };

  const hash = computeEmbeddingHash(text);

  if (!opts.force) {
    const row = await prisma.argument.findUnique({
      where: { id: argumentId },
      select: { embeddingHash: true, embeddingModel: true },
    });
    const upToDate =
      row?.embeddingHash === hash && row?.embeddingModel === EMBEDDING_MODEL;
    if (upToDate) return { embedded: false, reason: "no-op" };
  }

  const resp = await openai().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    encoding_format: "float",
  });
  const vec = resp.data[0]?.embedding;
  if (!vec) throw new Error("OpenAI returned no embedding");

  await persistEmbedding(argumentId, vec, hash);
  const tokens = resp.usage?.total_tokens ?? 0;
  return {
    embedded: true,
    reason: opts.force ? "forced" : "stale",
    tokens,
  };
}

/**
 * Embed many arguments in a single OpenAI call. Returns a per-id outcome.
 *
 * Batches above 100 are split. Empty / missing rows are reported and
 * skipped (no OpenAI call for them).
 */
export async function embedArgumentsBatch(
  argumentIds: string[],
  opts: { force?: boolean } = {},
): Promise<Record<string, EmbedOutcome>> {
  const out: Record<string, EmbedOutcome> = {};
  const work: Array<{ id: string; text: string; hash: string }> = [];

  for (const id of argumentIds) {
    const text = await buildEmbeddingText(id);
    if (text === null) {
      out[id] = { embedded: false, reason: "missing" };
      continue;
    }
    if (!text) {
      out[id] = { embedded: false, reason: "empty-text" };
      continue;
    }
    const hash = computeEmbeddingHash(text);
    if (!opts.force) {
      const row = await prisma.argument.findUnique({
        where: { id },
        select: { embeddingHash: true, embeddingModel: true },
      });
      if (row?.embeddingHash === hash && row?.embeddingModel === EMBEDDING_MODEL) {
        out[id] = { embedded: false, reason: "no-op" };
        continue;
      }
    }
    work.push({ id, text, hash });
  }

  for (let i = 0; i < work.length; i += OPENAI_MAX_BATCH) {
    const slice = work.slice(i, i + OPENAI_MAX_BATCH);
    const resp = await openai().embeddings.create({
      model: EMBEDDING_MODEL,
      input: slice.map((s) => s.text),
      encoding_format: "float",
    });
    const totalTokens = resp.usage?.total_tokens ?? 0;
    const perItemTokens = Math.floor(totalTokens / Math.max(1, slice.length));
    for (let j = 0; j < slice.length; j++) {
      const item = slice[j];
      const vec = resp.data[j]?.embedding;
      if (!vec) {
        out[item.id] = { embedded: false, reason: "missing" };
        continue;
      }
      await persistEmbedding(item.id, vec, item.hash);
      out[item.id] = {
        embedded: true,
        reason: opts.force ? "forced" : "stale",
        tokens: perItemTokens,
      };
    }
  }

  return out;
}

async function persistEmbedding(
  argumentId: string,
  vec: number[],
  hash: string,
): Promise<void> {
  const literal = toVectorLiteral(vec);
  await prisma.$executeRawUnsafe(
    `UPDATE "Argument"
       SET "embedding" = $1::vector,
           "embeddingHash" = $2,
           "embeddingModel" = $3,
           "embeddedAt" = now()
     WHERE "id" = $4`,
    literal,
    hash,
    EMBEDDING_MODEL,
    argumentId,
  );
}

/**
 * Embed an arbitrary query string. Returns a 1536-dim vector usable in
 * the same pgvector index as Argument embeddings.
 *
 * Callers should cache by sha256(model + query) at the route layer
 * (Step 6) — this function is intentionally cache-free.
 */
export async function embedQueryString(query: string): Promise<number[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("embedQueryString: empty query");
  }
  const resp = await openai().embeddings.create({
    model: EMBEDDING_MODEL,
    input: trimmed,
    encoding_format: "float",
  });
  const vec = resp.data[0]?.embedding;
  if (!vec || vec.length !== EMBEDDING_DIM) {
    throw new Error("OpenAI returned no/short query embedding");
  }
  return vec;
}

export const ARGUMENT_EMBEDDING_MODEL = EMBEDDING_MODEL;
export const ARGUMENT_EMBEDDING_DIM = EMBEDDING_DIM;
export const __test__ = { toVectorLiteral };
