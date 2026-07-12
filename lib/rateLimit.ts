/**
 * lib/rateLimit.ts
 *
 * Thin adapter over `@upstash/ratelimit` providing the v1 API that the
 * LUDICS Session 2 dev-spec §6.1 expects, plus a v2-ready compound-key
 * helper for the B11 follow-up (OQ-5 in LUDICS_SESSIONS_1_2_SPEC_REVIEW.md
 * §7).
 *
 * Single landing point for:
 *   - §6.1 rate-limit on `bind_participant_to_design`, `propose_synthesis`,
 *     `retract-witness`, and any other LUDICS write seam that needs it.
 *   - B12 fingerprint cache (re-exports `getUpstashRedis` for read-through
 *     callers — actual cache code lives at the call site).
 *
 * Test posture:
 *   - In `NODE_ENV === "test"` or when Upstash REST credentials are missing,
 *     all limiters fall back to an in-process token bucket so suites stay
 *     hermetic. Existing tests that `jest.mock("@upstash/ratelimit", ...)`
 *     continue to work unchanged.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { tryGetUpstashRedis } from "./upstash";

export type Duration = `${number} ${"ms" | "s" | "m" | "h" | "d"}`;

export interface RateLimitWindow {
  /** Max requests permitted within `window`. */
  max: number;
  /** Window length, e.g. "1 m", "1 h", "10 s". Defaults to "1 m". */
  window?: Duration;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Unix ms when the bucket refills. */
  reset: number;
  /** Seconds the caller should wait before retrying (`Math.ceil(reset - now)`). */
  retryAfter: number;
}

// ─── In-memory fallback (tests + missing-creds dev) ──────────────────────────
// Fixed-window counter keyed by `${prefix}:${key}`. Not distributed; not for
// production. Mirrors the semantics of `Ratelimit.fixedWindow`.

type Bucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, Bucket>();

function parseWindowMs(window: Duration): number {
  const [nStr, unit] = window.split(" ");
  const n = Number(nStr);
  switch (unit) {
    case "ms": return n;
    case "s":  return n * 1000;
    case "m":  return n * 60_000;
    case "h":  return n * 3_600_000;
    case "d":  return n * 86_400_000;
    default:   throw new Error(`Invalid window unit: ${unit}`);
  }
}

function memoryLimit(prefix: string, key: string, max: number, window: Duration): RateLimitResult {
  const now = Date.now();
  const windowMs = parseWindowMs(window);
  const fullKey = `${prefix}:${key}`;
  const bucket = memoryBuckets.get(fullKey);
  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    memoryBuckets.set(fullKey, { count: 1, resetAt });
    return { success: true, remaining: max - 1, reset: resetAt, retryAfter: 0 };
  }
  if (bucket.count >= max) {
    return {
      success: false,
      remaining: 0,
      reset: bucket.resetAt,
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  bucket.count += 1;
  return {
    success: true,
    remaining: max - bucket.count,
    reset: bucket.resetAt,
    retryAfter: 0,
  };
}

/** Test-only helper: clear all in-memory buckets between specs. */
export function __resetMemoryRateLimits(): void {
  memoryBuckets.clear();
}

// ─── Upstash-backed limiter cache ────────────────────────────────────────────
// Limiters are keyed by `${prefix}:${max}:${window}` so each (prefix, shape)
// pair reuses a single `Ratelimit` instance.

const limiterCache = new Map<string, Ratelimit>();

function getLimiter(prefix: string, max: number, window: Duration): Ratelimit | null {
  const redis = tryGetUpstashRedis();
  if (!redis) return null;
  const cacheKey = `${prefix}:${max}:${window}`;
  let lim = limiterCache.get(cacheKey);
  if (!lim) {
    lim = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(max, window),
      prefix,
      analytics: false,
    });
    limiterCache.set(cacheKey, lim);
  }
  return lim;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Simple boolean rate-limit check matching the dev-spec §6.1 signature:
 *
 *   const allowed = await rateLimit(`ludics:bind:${participantId}`, { max: 10, window: "1 m" });
 *   if (!allowed) return { error: "RATE_LIMITED", retryAfter: 60 };
 *
 * Falls back to an in-memory fixed-window counter in test / no-creds envs.
 */
export async function rateLimit(
  key: string,
  opts: RateLimitWindow,
  prefix = "rl:ludics",
): Promise<boolean> {
  const window = opts.window ?? "1 m";
  const limiter = getLimiter(prefix, opts.max, window);
  if (!limiter) {
    return memoryLimit(prefix, key, opts.max, window).success;
  }
  const { success } = await limiter.limit(key);
  return success;
}

/**
 * Detailed variant returning the full window state. Use this when you need
 * to emit `Retry-After` / `X-RateLimit-*` response headers.
 */
export async function rateLimitDetailed(
  key: string,
  opts: RateLimitWindow,
  prefix = "rl:ludics",
): Promise<RateLimitResult> {
  const window = opts.window ?? "1 m";
  const limiter = getLimiter(prefix, opts.max, window);
  if (!limiter) {
    return memoryLimit(prefix, key, opts.max, window);
  }
  const res = await limiter.limit(key);
  const now = Date.now();
  return {
    success: res.success,
    remaining: res.remaining,
    reset: res.reset,
    retryAfter: res.success ? 0 : Math.max(0, Math.ceil((res.reset - now) / 1000)),
  };
}

// ─── v2-ready compound-key limiter (B11 / OQ-5) ──────────────────────────────

export interface CompoundRateLimitInput {
  /**
   * Scope unit the limiter buckets against. Per the WS-0 tenant-scope audit
   * (2026-05-22) the repo has no tenant axis, so callers pass
   * `scopeId = deliberationId`. If a real `Workspace` model is ever added,
   * the key naturally extends to `(workspaceId, scopeId, …)` — additive.
   *
   * The legacy alias `tenantId` is accepted for backward compatibility with
   * the pre-WS-0 v2 spec drafts; prefer `scopeId` in new call sites.
   */
  scopeId?: string;
  /** @deprecated Use `scopeId`. Kept for back-compat with pre-WS-0 spec. */
  tenantId?: string;
  participantId: string;
  /** Caller IP — typically `req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()`. */
  ip?: string | null;
  /** Logical action name; becomes part of the key prefix. */
  action: string;
}

export interface CompoundRateLimitConfig {
  perParticipant: RateLimitWindow;
  /** Optional IP-scoped bucket. Skipped when caller IP is unavailable. */
  perIp?: RateLimitWindow;
}

/**
 * v2 compound-key rate limit per dev-spec §6.1 v2 TODO (B11) / OQ-5.
 *
 * Enforces TWO independent buckets and denies if EITHER exceeds its limit:
 *   1. `(scope, participant, action)`  — prevents single-participant abuse.
 *   2. `(scope, ip, action)`           — prevents cross-participant abuse
 *                                         from a single source IP within
 *                                         the same scope.
 *
 * `scope` defaults to `deliberationId` per the WS-0 audit (no tenant axis
 * in the current schema). Returns the more-restrictive bucket's state so
 * callers can surface a single `Retry-After` header.
 */
export async function compoundRateLimit(
  input: CompoundRateLimitInput,
  cfg: CompoundRateLimitConfig,
): Promise<RateLimitResult> {
  const { participantId, ip, action } = input;
  const scope = input.scopeId ?? input.tenantId;
  if (!scope) {
    throw new Error(
      "compoundRateLimit: either `scopeId` (preferred) or `tenantId` (deprecated) must be provided",
    );
  }
  const participantKey = `s:${scope}:p:${participantId}:a:${action}`;
  const ipKey = ip ? `s:${scope}:ip:${ip}:a:${action}` : null;

  const checks: Promise<RateLimitResult>[] = [
    rateLimitDetailed(participantKey, cfg.perParticipant, "rl:cmp:participant"),
  ];
  if (ipKey && cfg.perIp) {
    checks.push(rateLimitDetailed(ipKey, cfg.perIp, "rl:cmp:ip"));
  }
  const results = await Promise.all(checks);

  // Most-restrictive wins: any failure → fail; otherwise return the bucket
  // closest to exhaustion.
  const failed = results.find((r) => !r.success);
  if (failed) return failed;
  return results.reduce((a, b) => (a.remaining <= b.remaining ? a : b));
}

// ─── Re-export the shared REST client for B12 fingerprint L2 cache ───────────
export { getUpstashRedis, tryGetUpstashRedis } from "./upstash";
