/**
 * Per-host token bucket for outbound HTTP from the citation resolver.
 *
 * Phase 2 of docs/AUTO_CITATION_ENGINE_ROADMAP.md.
 *
 * Crossref's polite pool publishes "be considerate" guidance: ≤50 req/s
 * spread across all clients sharing your `mailto=` identity. OpenAlex
 * publishes 10 req/s for polite-pool users. Most publisher hosts have no
 * stated limit but disliked behaviour is "burst > 1 req/s sustained".
 *
 * Defaults err on the slow side (1 req/s with a 5-token burst). Override
 * per-host where we have published numbers.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
  /** Tokens added per millisecond. */
  ratePerMs: number;
  /** Maximum tokens the bucket can hold (controls burst). */
  capacity: number;
}

const DEFAULT_RATE_PER_S = 1;
const DEFAULT_BURST = 5;

/** Per-host overrides. Keys are bare hostnames (lowercase). */
const HOST_LIMITS: Record<string, { ratePerS: number; burst: number }> = {
  "api.crossref.org": { ratePerS: 25, burst: 50 },
  "api.openalex.org": { ratePerS: 8, burst: 10 },
  "export.arxiv.org": { ratePerS: 1, burst: 3 },
  "doi.org": { ratePerS: 5, burst: 10 },
  "dx.doi.org": { ratePerS: 5, burst: 10 },
};

const buckets = new Map<string, Bucket>();

// ──────────────────────────────────────────────────────────
// Circuit breakers (Phase 8)
// ──────────────────────────────────────────────────────────
//
// When a host returns 5 consecutive failures we open the circuit for
// `BREAKER_COOLDOWN_MS` and `acquireHostToken` short-circuits to
// `false` — the resolver records a warning and the waterfall moves on.
// One probe is allowed through after the cooldown; a success closes the
// circuit, a failure re-opens it.

interface Breaker {
  consecutiveFailures: number;
  /** When the circuit was opened (0 = closed). */
  openedAt: number;
}

const BREAKER_THRESHOLD = 5;
const BREAKER_COOLDOWN_MS = 60_000; // 1 min
const breakers = new Map<string, Breaker>();

function breakerFor(host: string): Breaker {
  const key = host.toLowerCase();
  let b = breakers.get(key);
  if (!b) {
    b = { consecutiveFailures: 0, openedAt: 0 };
    breakers.set(key, b);
  }
  return b;
}

/** Returns true when the breaker is open AND still in cooldown. */
function breakerTripped(host: string): boolean {
  const b = breakers.get(host.toLowerCase());
  if (!b || b.openedAt === 0) return false;
  if (Date.now() - b.openedAt < BREAKER_COOLDOWN_MS) return true;
  // Cooldown elapsed — half-open: allow one probe by clearing openedAt
  // but keeping consecutiveFailures, so the next failure trips again
  // immediately rather than requiring 5 more.
  b.openedAt = 0;
  return false;
}

/** Caller hook: report success/failure of an outbound request. */
export function reportHostOutcome(hostOrUrl: string, ok: boolean): void {
  const host = parseHost(hostOrUrl);
  if (!host) return;
  const b = breakerFor(host);
  if (ok) {
    b.consecutiveFailures = 0;
    b.openedAt = 0;
    return;
  }
  b.consecutiveFailures += 1;
  if (b.consecutiveFailures >= BREAKER_THRESHOLD) {
    b.openedAt = Date.now();
  }
}

/** Snapshot for /metrics. */
export function getBreakerStates(): Record<string, { state: "closed" | "open" | "half-open"; failures: number; openedAt: number }> {
  const out: Record<string, { state: "closed" | "open" | "half-open"; failures: number; openedAt: number }> = {};
  for (const [host, b] of breakers.entries()) {
    let state: "closed" | "open" | "half-open" = "closed";
    if (b.openedAt > 0) {
      state = Date.now() - b.openedAt < BREAKER_COOLDOWN_MS ? "open" : "half-open";
    } else if (b.consecutiveFailures > 0) {
      state = "half-open";
    }
    out[host] = { state, failures: b.consecutiveFailures, openedAt: b.openedAt };
  }
  return out;
}

function bucketFor(host: string): Bucket {
  const key = host.toLowerCase();
  let b = buckets.get(key);
  if (b) return b;
  const limit = HOST_LIMITS[key] ?? { ratePerS: DEFAULT_RATE_PER_S, burst: DEFAULT_BURST };
  b = {
    tokens: limit.burst,
    lastRefill: Date.now(),
    ratePerMs: limit.ratePerS / 1000,
    capacity: limit.burst,
  };
  buckets.set(key, b);
  return b;
}

function refill(b: Bucket): void {
  const now = Date.now();
  const elapsed = now - b.lastRefill;
  if (elapsed <= 0) return;
  b.tokens = Math.min(b.capacity, b.tokens + elapsed * b.ratePerMs);
  b.lastRefill = now;
}

/**
 * Acquire one token from the bucket for `host`, sleeping until one is
 * available. Hard cap of 30s wall-clock — past that we fail closed and
 * the resolver records a warning.
 *
 * Returns `true` when a token was acquired, `false` on timeout.
 */
export async function acquireHostToken(
  hostOrUrl: string,
  opts: { maxWaitMs?: number } = {},
): Promise<boolean> {
  const host = parseHost(hostOrUrl);
  if (!host) return true; // Unknown host — don't block; resolver will fail elsewhere.
  if (breakerTripped(host)) return false;
  const maxWait = opts.maxWaitMs ?? 30_000;
  const startedAt = Date.now();

  // Loop because multiple callers may race on the same bucket.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const b = bucketFor(host);
    refill(b);
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return true;
    }
    const needed = 1 - b.tokens;
    const waitMs = Math.ceil(needed / b.ratePerMs);
    if (Date.now() + waitMs - startedAt > maxWait) return false;
    await sleep(Math.min(waitMs, 250));
  }
}

function parseHost(hostOrUrl: string): string | null {
  if (!hostOrUrl) return null;
  if (!hostOrUrl.includes("://")) return hostOrUrl.toLowerCase();
  try {
    return new URL(hostOrUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Test/admin hook. */
export function _resetCitationRateLimiter(): void {
  buckets.clear();
  breakers.clear();
}
