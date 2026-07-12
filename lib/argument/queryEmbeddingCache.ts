/**
 * AI-EPI C.1 Step 6 — query-embedding cache.
 *
 * Wraps `embedQueryString` with a two-tier cache:
 *
 *   L1: in-process LRU (256 entries, soft cap). Absorbs burst-y same-query
 *       traffic without any network round-trip.
 *   L2: Upstash Redis @ key `qemb:v1:<model>:<sha256(normalizedQuery)>`,
 *       1h TTL. JSON.stringify of the float[1536] (~14 KB compressed by
 *       Upstash; well under the 1MB limit).
 *
 * Cache miss → calls OpenAI, populates both tiers.
 *
 * Graceful degradation: if `UPSTASH_REDIS_REST_URL`/`_TOKEN` are unset
 * (e.g. local scripts, tests), L2 is skipped silently — L1 still works.
 *
 * Returns `{ vec, source }` where source ∈ {"l1","l2","openai"} so the
 * caller can log hit rate without instrumenting the cache itself.
 */
import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import {
  ARGUMENT_EMBEDDING_DIM,
  ARGUMENT_EMBEDDING_MODEL,
  embedQueryString,
} from "@/lib/argument/embedding";

export type QueryEmbeddingSource = "l1" | "l2" | "openai";
export interface QueryEmbeddingResult {
  vec: number[];
  source: QueryEmbeddingSource;
}

const KEY_PREFIX = `qemb:v1:${ARGUMENT_EMBEDDING_MODEL}:`;
const TTL_SECONDS = 60 * 60; // 1h
const L1_MAX = 256;

/** Normalise a query so trivial whitespace / case differences hit the same key. */
function normalize(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function keyFor(normalized: string): string {
  const h = createHash("sha256").update(normalized, "utf8").digest("hex");
  return KEY_PREFIX + h;
}

// ---- L1 (in-process) ---------------------------------------------------
const l1 = new Map<string, number[]>();
function l1Get(key: string): number[] | null {
  const v = l1.get(key);
  if (!v) return null;
  // LRU touch: re-insert moves to end of Map iteration order.
  l1.delete(key);
  l1.set(key, v);
  return v;
}
function l1Set(key: string, vec: number[]): void {
  if (l1.has(key)) l1.delete(key);
  l1.set(key, vec);
  // Evict oldest entries past the soft cap.
  while (l1.size > L1_MAX) {
    const oldest = l1.keys().next().value;
    if (oldest === undefined) break;
    l1.delete(oldest);
  }
}

// ---- L2 (Upstash) ------------------------------------------------------
let _redis: Redis | null = null;
function redis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

async function l2Get(key: string): Promise<number[] | null> {
  const r = redis();
  if (!r) return null;
  try {
    // Upstash auto-decodes JSON values stored via the REST API. Be
    // defensive: accept either array or JSON-encoded string.
    const raw = await r.get<unknown>(key);
    if (raw == null) return null;
    let arr: unknown = raw;
    if (typeof raw === "string") {
      try {
        arr = JSON.parse(raw);
      } catch {
        return null;
      }
    }
    if (!Array.isArray(arr) || arr.length !== ARGUMENT_EMBEDDING_DIM) return null;
    // Trust but verify — make sure entries are finite numbers.
    if (!arr.every((x) => typeof x === "number" && Number.isFinite(x))) {
      return null;
    }
    return arr as number[];
  } catch {
    // Cache should never break a request.
    return null;
  }
}

async function l2Set(key: string, vec: number[]): Promise<void> {
  const r = redis();
  if (!r) return;
  try {
    // Store as JSON string; Upstash @upstash/redis accepts the raw value
    // and round-trips correctly in either form.
    await r.set(key, JSON.stringify(vec), { ex: TTL_SECONDS });
  } catch {
    // Swallow — the OpenAI call already succeeded; skipping cache write
    // is harmless beyond losing the next hit.
  }
}

/**
 * Get-or-compute a query embedding with L1 → L2 → OpenAI lookup chain.
 *
 * Idempotent and safe to call concurrently (L1 has no read/write race
 * because Map operations are atomic w.r.t. JS event loop; concurrent L2
 * misses may double-call OpenAI for the same key, which is acceptable
 * given how rare that race is).
 */
export async function getOrComputeQueryEmbedding(
  query: string,
): Promise<QueryEmbeddingResult> {
  const normalized = normalize(query);
  if (!normalized) {
    throw new Error("getOrComputeQueryEmbedding: empty query");
  }
  const key = keyFor(normalized);

  const hit1 = l1Get(key);
  if (hit1) return { vec: hit1, source: "l1" };

  const hit2 = await l2Get(key);
  if (hit2) {
    l1Set(key, hit2);
    return { vec: hit2, source: "l2" };
  }

  const vec = await embedQueryString(query);
  l1Set(key, vec);
  // Fire-and-forget L2 write — don't make the caller wait for it.
  void l2Set(key, vec);
  return { vec, source: "openai" };
}

/** Test/diagnostic helpers. Not exported from the index. */
export const __cacheTestUtils = {
  clearL1: () => l1.clear(),
  l1Size: () => l1.size,
  keyFor,
  normalize,
};
