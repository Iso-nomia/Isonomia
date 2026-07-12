/**
 * Briefing-fingerprint service — §5 (Phase 1f) + B12 (LUDICS v2 / WS-1).
 *
 * Computes a content-hash over the *material fields* that the AI-EPI
 * fidelity scorecard grades: hubSet, loadBearingRankingTop10,
 * openExposurePoints, refusal-surface conclusions, and top-15 CQ ids.
 *
 * Five material-change rules (R1–R5) determine whether a previously
 * issued hash is stale:
 *   R1 — hubSet or hubShape changed
 *   R2 — new entry added to cannotConcludeBecause
 *   R3 — top-5 of loadBearingRanking shifted by ≥1 position
 *   R4 — a hub-targeting CQ entered prioritizedOpenCqs[0..14]
 *   R5 — openExposurePoints increased by ≥ R5_THRESHOLD (default 10)
 *
 * Cache topology (v2 / B12 / WS-1):
 *   L1 (hot)   — Upstash Redis REST, keys `fp:hash:<h>` + `fp:latest:<delib>`,
 *                TTL 300 s. Shared across horizontally-scaled instances.
 *   L2 (cold)  — Postgres `BriefingFingerprintHistory` (append-only).
 *                Authoritative; survives restarts and Redis evictions.
 *   L0 (dev)   — Bounded in-process Map. Only used when neither L1 nor L2
 *                is reachable (tests, single-instance dev). NOT relied on
 *                for cross-instance coherence. Resolves OQ-6b for v2.
 *
 * Write order: Postgres first (durable), then Redis (hot). Reads go L1 → L2 → L0.
 */

import crypto from "crypto";
import {
  computeSyntheticReadout,
  type SyntheticReadout,
} from "@/lib/deliberation/syntheticReadout";
import { derivePrioritizedOpenCqs } from "@/lib/deliberation/cqPrioritizer";
import { getDeliberationSchema } from "@/server/ludics/deliberationSchema";
import { prisma } from "@/lib/prismaclient";
import { tryGetUpstashRedis } from "@/lib/upstash";

const R5_THRESHOLD = 10;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MaterialFields {
  hubSet: string[];
  hubShape: string;
  loadBearingRankingTop10: string[];
  openExposurePoints: number;
  refusalCount: number;
  /** Stable CQ ids (`argId::cqKey`) for the top-15 prioritized open CQs. */
  prioritizedCqTop15: string[];
  /** Refusal-surface conclusion claim ids for hash computation. */
  refusalConclusionIds: string[];
}

export interface BriefingFingerprintResult {
  contentHash: string;
  /**
   * B5 component hash vector. Four disjoint per-aspect digests over
   * the same MaterialFields the combined `contentHash` covers:
   *
   *   - `hubs`       — over `{ hubSet (sorted), hubShape }`
   *   - `frontier`   — over `{ loadBearingRankingTop10, prioritizedCqTop15 }`
   *   - `refusal`    — over `{ refusalConclusionIds (sorted) }`
   *   - `witnessing` — over `{ openExposurePoints }`
   *
   * Cheap rule attribution: a component digest changes iff its scope
   * fields changed, so callers can short-circuit the R1–R5 scan by
   * inspecting `diffComponents(prev, curr)` first.
   *
   * Consistency invariant (pinned in tests): whenever `contentHash`
   * changes between two computations, at least one component digest
   * also changes. The four components fully cover every field that
   * flows into `contentHash`.
   */
  components: ComponentHashVector;
  computedAt: string; // ISO-8601
  materialFields: MaterialFields;
  /**
   * ISO-8601 timestamp of the last hash rotation. null when this is the
   * first computation for the deliberation.
   */
  lastMaterialChangeAt: string | null;
  /**
   * Rule that caused the last hash rotation. null when this is the first
   * computation or no rule has fired.
   */
  lastMaterialChangeRule: "R1" | "R2" | "R3" | "R4" | "R5" | null;
}

/**
 * B5 component-hash vector. See `BriefingFingerprintResult.components`
 * for scope semantics. All values are `sha256:<hex>` strings.
 */
export interface ComponentHashVector {
  hubs: string;
  frontier: string;
  refusal: string;
  witnessing: string;
}

export type ComponentName = keyof ComponentHashVector;

export type StalenessResult = { stale: false } | { stale: "R1" | "R2" | "R3" | "R4" | "R5" };

// ── Cache layers (B12 / WS-1) ────────────────────────────────────────────────

interface CacheEntry {
  deliberationId: string;
  fields: MaterialFields;
  components: ComponentHashVector;
  computedAt: string;
}

type RuleLabel = "R1" | "R2" | "R3" | "R4" | "R5" | null;

interface LatestEntry {
  hash: string;
  computedAt: string;
  rule: RuleLabel;
  /** ISO of the most recent entry whose rule !== null. Surfaces R-attribution
   *  across stable hashes without scanning history. */
  lastChangeAt: string | null;
  lastChangeRule: RuleLabel;
}

/** L0 fallback only — bounded; not cross-instance coherent. */
const L0_HASH_LIMIT = 256;
const L0_LATEST_LIMIT = 256;
const l0Hash = new Map<string, CacheEntry>();
const l0Latest = new Map<string, LatestEntry>();

const REDIS_TTL_SECONDS = 300;
const keyHash = (h: string) => `fp:hash:${h}`;
const keyLatest = (d: string) => `fp:latest:${d}`;

function l0SetHash(h: string, e: CacheEntry) {
  if (l0Hash.size >= L0_HASH_LIMIT) {
    const oldest = l0Hash.keys().next().value;
    if (oldest !== undefined) l0Hash.delete(oldest);
  }
  l0Hash.set(h, e);
}
function l0SetLatest(d: string, e: LatestEntry) {
  if (l0Latest.size >= L0_LATEST_LIMIT) {
    const oldest = l0Latest.keys().next().value;
    if (oldest !== undefined) l0Latest.delete(oldest);
  }
  l0Latest.set(d, e);
}

async function l1GetHash(h: string): Promise<CacheEntry | null> {
  const r = tryGetUpstashRedis();
  if (!r) return null;
  try {
    const raw = await r.get<CacheEntry>(keyHash(h));
    return raw ?? null;
  } catch {
    return null;
  }
}
async function l1SetHash(h: string, e: CacheEntry): Promise<void> {
  const r = tryGetUpstashRedis();
  if (!r) return;
  try {
    await r.set(keyHash(h), e, { ex: REDIS_TTL_SECONDS });
  } catch {
    /* swallow */
  }
}
async function l1GetLatest(d: string): Promise<LatestEntry | null> {
  const r = tryGetUpstashRedis();
  if (!r) return null;
  try {
    const raw = await r.get<LatestEntry>(keyLatest(d));
    return raw ?? null;
  } catch {
    return null;
  }
}
async function l1SetLatest(d: string, e: LatestEntry): Promise<void> {
  const r = tryGetUpstashRedis();
  if (!r) return;
  try {
    await r.set(keyLatest(d), e, { ex: REDIS_TTL_SECONDS });
  } catch {
    /* swallow */
  }
}

/**
 * L2 (Postgres) — `BriefingFingerprintHistory`. Append-only.
 * `materialChangeSummary` carries the full `{fields, components, computedAt}`
 * snapshot so an L1 miss can fully rehydrate without re-running the readout.
 */
async function l2AppendHistory(
  deliberationId: string,
  entry: CacheEntry,
  rule: RuleLabel,
): Promise<void> {
  try {
    const p = prisma as unknown as {
      briefingFingerprintHistory?: {
        create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
      };
    };
    if (!p.briefingFingerprintHistory) return;
    await p.briefingFingerprintHistory.create({
      data: {
        deliberationId,
        fingerprint: getEntryHashKey(entry),
        materialChangeRule: rule,
        materialChangeSummary: {
          fields: entry.fields,
          components: entry.components,
          computedAt: entry.computedAt,
        },
        computedAt: new Date(entry.computedAt),
      },
    });
  } catch {
    /* swallow — degrades to Redis-only / L0 */
  }
}

async function l2GetByHash(hash: string): Promise<CacheEntry | null> {
  try {
    const p = prisma as unknown as {
      briefingFingerprintHistory?: {
        findFirst: (args: {
          where: { fingerprint: string };
          orderBy?: { computedAt: "desc" };
        }) => Promise<{
          deliberationId: string;
          materialChangeSummary: unknown;
        } | null>;
      };
    };
    if (!p.briefingFingerprintHistory) return null;
    const row = await p.briefingFingerprintHistory.findFirst({
      where: { fingerprint: hash },
      orderBy: { computedAt: "desc" },
    });
    if (!row) return null;
    const summary = row.materialChangeSummary as {
      fields?: MaterialFields;
      components?: ComponentHashVector;
      computedAt?: string;
    } | null;
    if (!summary?.fields || !summary.components || !summary.computedAt) return null;
    return {
      deliberationId: row.deliberationId,
      fields: summary.fields,
      components: summary.components,
      computedAt: summary.computedAt,
    };
  } catch {
    return null;
  }
}

async function l2GetLatest(deliberationId: string): Promise<LatestEntry | null> {
  try {
    const p = prisma as unknown as {
      briefingFingerprintHistory?: {
        findMany: (args: {
          where: { deliberationId: string };
          orderBy: { computedAt: "desc" };
          take: number;
        }) => Promise<
          Array<{
            fingerprint: string;
            materialChangeRule: RuleLabel;
            computedAt: Date;
          }>
        >;
      };
    };
    if (!p.briefingFingerprintHistory) return null;
    // Pull the most recent two rows: row[0] is `latest`, the first row with
    // a non-null rule is the most recent material change.
    const rows = await p.briefingFingerprintHistory.findMany({
      where: { deliberationId },
      orderBy: { computedAt: "desc" },
      take: 20,
    });
    if (rows.length === 0) return null;
    const top = rows[0];
    const lastChange = rows.find((r) => r.materialChangeRule !== null);
    return {
      hash: top.fingerprint,
      computedAt: top.computedAt.toISOString(),
      rule: top.materialChangeRule,
      lastChangeAt: lastChange?.computedAt.toISOString() ?? null,
      lastChangeRule: lastChange?.materialChangeRule ?? null,
    };
  } catch {
    return null;
  }
}

/** Cached lookup of an entry's hash: small reverse-index to avoid recomputing
 *  for L0 entries on rehydrate. */
const l0EntryHashes = new WeakMap<CacheEntry, string>();
function getEntryHashKey(e: CacheEntry): string {
  const cached = l0EntryHashes.get(e);
  if (cached) return cached;
  const h = computeHash(e.fields);
  l0EntryHashes.set(e, h);
  return h;
}

async function loadCacheEntry(hash: string): Promise<CacheEntry | null> {
  const l1 = await l1GetHash(hash);
  if (l1) {
    l0SetHash(hash, l1);
    return l1;
  }
  const l2 = await l2GetByHash(hash);
  if (l2) {
    l0SetHash(hash, l2);
    await l1SetHash(hash, l2);
    return l2;
  }
  return l0Hash.get(hash) ?? null;
}

async function loadLatestEntry(
  deliberationId: string,
): Promise<LatestEntry | null> {
  const l1 = await l1GetLatest(deliberationId);
  if (l1) {
    l0SetLatest(deliberationId, l1);
    return l1;
  }
  const l2 = await l2GetLatest(deliberationId);
  if (l2) {
    l0SetLatest(deliberationId, l2);
    await l1SetLatest(deliberationId, l2);
    return l2;
  }
  return l0Latest.get(deliberationId) ?? null;
}

/** Test-only: clear L0. L1/L2 are not touched. */
export function __resetBriefingFingerprintL0(): void {
  l0Hash.clear();
  l0Latest.clear();
}

// ── Hash computation ──────────────────────────────────────────────────────────

function sha256(s: string): string {
  return "sha256:" + crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function computeHash(fields: MaterialFields): string {
  const payload = JSON.stringify({
    hubSet: [...fields.hubSet].sort(),
    loadBearingRankingTop10: fields.loadBearingRankingTop10,
    openExposurePoints: fields.openExposurePoints,
    refusalConclusionIds: [...fields.refusalConclusionIds].sort(),
    prioritizedCqTop15: fields.prioritizedCqTop15,
  });
  return sha256(payload);
}

/**
 * B5: compute the four-way component digest vector over disjoint
 * subsets of `MaterialFields`. Pure function — same input ⇒ same
 * output. Used both for diff-based rule attribution and as a
 * consistency check against the combined `contentHash`.
 *
 * Disjointness matters: each material field appears in exactly one
 * component, so a field change toggles exactly one component digest.
 * `refusalCount` is omitted (derivable from `refusalConclusionIds`).
 */
export function computeComponentHashes(
  fields: MaterialFields,
): ComponentHashVector {
  const hubs = sha256(
    JSON.stringify({
      hubSet: [...fields.hubSet].sort(),
      hubShape: fields.hubShape,
    }),
  );
  const frontier = sha256(
    JSON.stringify({
      loadBearingRankingTop10: fields.loadBearingRankingTop10,
      prioritizedCqTop15: fields.prioritizedCqTop15,
    }),
  );
  const refusal = sha256(
    JSON.stringify({
      refusalConclusionIds: [...fields.refusalConclusionIds].sort(),
    }),
  );
  const witnessing = sha256(
    JSON.stringify({ openExposurePoints: fields.openExposurePoints }),
  );
  return { hubs, frontier, refusal, witnessing };
}

/**
 * B5: per-component change set. Returns the components whose digest
 * differs between `prev` and `curr`. O(4) string comparison —
 * intended as a cheap precheck before invoking the full R1–R5 scan.
 */
export function diffComponents(
  prev: ComponentHashVector,
  curr: ComponentHashVector,
): Set<ComponentName> {
  const out = new Set<ComponentName>();
  if (prev.hubs !== curr.hubs) out.add("hubs");
  if (prev.frontier !== curr.frontier) out.add("frontier");
  if (prev.refusal !== curr.refusal) out.add("refusal");
  if (prev.witnessing !== curr.witnessing) out.add("witnessing");
  return out;
}

// ── Material field extraction ─────────────────────────────────────────────────

async function extractMaterialFields(
  deliberationId: string,
  readout: SyntheticReadout,
): Promise<MaterialFields> {
  // Hub set: argumentIds of topology hubs
  const hubSet = (readout.topology?.hubs?.set ?? []).map((h) => h.argumentId);
  const hubShape = readout.topology?.hubs?.shape ?? "empty";

  // Load-bearing ranking top-10
  const loadBearingRankingTop10 =
    readout.frontier?.loadBearingnessRanking?.slice(0, 10) ?? [];

  // Refusal surface
  const refusalEntries = readout.refusalSurface?.cannotConcludeBecause ?? [];
  const refusalConclusionIds = refusalEntries
    .map((e) => e.conclusionClaimId)
    .filter(Boolean) as string[];
  const refusalCount = refusalEntries.length;

  // Prioritized open CQs top-15
  const prioritizedCqs = derivePrioritizedOpenCqs(readout);
  const prioritizedCqTop15 = prioritizedCqs.slice(0, 15).map((cq) => cq.id);

  // openExposurePoints from the Ludics layer (witnessable + latent)
  let openExposurePoints = 0;
  try {
    const schema = await getDeliberationSchema(deliberationId, false);
    if (schema) {
      openExposurePoints =
        schema.witnessingSummary.witnessableLoci + schema.witnessingSummary.latentLoci;
    }
  } catch {
    // Ludics layer not yet populated — openExposurePoints stays 0
  }

  return {
    hubSet,
    hubShape,
    loadBearingRankingTop10,
    openExposurePoints,
    refusalCount,
    prioritizedCqTop15,
    refusalConclusionIds,
  };
}

// ── Rule evaluation ───────────────────────────────────────────────────────────

/**
 * Check which rule (if any) fired between `prev` and `curr`.
 * Returns the first rule that fires, in R1–R5 order.
 *
 * B5: when `prevComponents`/`currComponents` are supplied, components
 * whose digest is unchanged skip their owning rules (R1→hubs,
 * R2→refusal, R3/R4→frontier, R5→witnessing). Same return value;
 * just fewer field comparisons on the hot path.
 */
export function evaluateStalenessRules(
  prev: MaterialFields,
  curr: MaterialFields,
  prevComponents?: ComponentHashVector,
  currComponents?: ComponentHashVector,
): "R1" | "R2" | "R3" | "R4" | "R5" | null {
  const changed =
    prevComponents && currComponents
      ? diffComponents(prevComponents, currComponents)
      : null;

  // R1: hubSet or hubShape changed
  if (!changed || changed.has("hubs")) {
    const prevHubKey = [...prev.hubSet].sort().join(",") + "|" + prev.hubShape;
    const currHubKey = [...curr.hubSet].sort().join(",") + "|" + curr.hubShape;
    if (prevHubKey !== currHubKey) return "R1";
  }

  // R2: new entry added to cannotConcludeBecause
  if (!changed || changed.has("refusal")) {
    const prevRefusal = new Set(prev.refusalConclusionIds);
    const hasNewRefusal = curr.refusalConclusionIds.some(
      (id) => !prevRefusal.has(id),
    );
    if (hasNewRefusal) return "R2";
  }

  // R3 + R4 share the frontier component.
  if (!changed || changed.has("frontier")) {
    // R3: top-5 of loadBearingRanking changed by ≥1 position
    const prevTop5 = prev.loadBearingRankingTop10.slice(0, 5);
    const currTop5 = curr.loadBearingRankingTop10.slice(0, 5);
    const top5Changed =
      prevTop5.length !== currTop5.length ||
      prevTop5.some((id, i) => currTop5[i] !== id);
    if (top5Changed) return "R3";

    // R4: a hub-targeting CQ entered the top-15 that wasn't there before
    // (We mark hub-targeting by checking if the CQ's targetArgumentId is in hubSet)
    const prevCqSet = new Set(prev.prioritizedCqTop15);
    const currHubSet = new Set(curr.hubSet);
    // A new hub-targeting CQ = in curr top-15 but not in prev top-15,
    // where the targetArgumentId is in the current hubSet.
    const hasNewHubCq = curr.prioritizedCqTop15.some((cqId) => {
      if (prevCqSet.has(cqId)) return false;
      const targetArgId = cqId.split("::")[0];
      return currHubSet.has(targetArgId);
    });
    if (hasNewHubCq) return "R4";
  }

  // R5: openExposurePoints increased by ≥ R5_THRESHOLD
  if (!changed || changed.has("witnessing")) {
    if (curr.openExposurePoints - prev.openExposurePoints >= R5_THRESHOLD)
      return "R5";
  }

  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute and return the current briefing fingerprint for a deliberation.
 */
export async function computeBriefingFingerprint(
  deliberationId: string,
): Promise<BriefingFingerprintResult | null> {
  const readout = await computeSyntheticReadout(deliberationId);
  if (!readout) return null;

  const fields = await extractMaterialFields(deliberationId, readout);
  const contentHash = computeHash(fields);
  const components = computeComponentHashes(fields);
  const computedAt = new Date().toISOString();

  const entry: CacheEntry = { deliberationId, fields, components, computedAt };
  l0EntryHashes.set(entry, contentHash);

  // Look up the previous "latest" pointer for this deliberation.
  const prevLatest = await loadLatestEntry(deliberationId);

  let rule: RuleLabel = null;
  let lastMaterialChangeAt: string | null = prevLatest?.lastChangeAt ?? null;
  let lastMaterialChangeRule: RuleLabel = prevLatest?.lastChangeRule ?? null;

  if (prevLatest && prevLatest.hash !== contentHash) {
    // Hash changed — attribute the rule. Pull full prev state from cache.
    const prevEntry = await loadCacheEntry(prevLatest.hash);
    rule = prevEntry
      ? evaluateStalenessRules(
          prevEntry.fields,
          fields,
          prevEntry.components,
          components,
        )
      : "R1"; // conservative when prev state is unrecoverable
    lastMaterialChangeAt = computedAt;
    lastMaterialChangeRule = rule;
  } else if (!prevLatest) {
    // First computation for this deliberation — no rule.
    rule = null;
  }

  const nextLatest: LatestEntry = {
    hash: contentHash,
    computedAt,
    rule,
    lastChangeAt: lastMaterialChangeAt,
    lastChangeRule: lastMaterialChangeRule,
  };

  // Write-through: L2 (durable) → L1 (hot) → L0 (in-proc).
  await l2AppendHistory(deliberationId, entry, rule);
  await l1SetHash(contentHash, entry);
  await l1SetLatest(deliberationId, nextLatest);
  l0SetHash(contentHash, entry);
  l0SetLatest(deliberationId, nextLatest);

  return {
    contentHash,
    components,
    computedAt,
    materialFields: fields,
    lastMaterialChangeAt,
    lastMaterialChangeRule,
  };
}

/**
 * Check whether a previously issued hash is stale.
 * Returns { stale: false } if the hash matches the current fingerprint,
 * otherwise returns the first rule that fired.
 */
export async function checkBriefingFingerprint(
  deliberationId: string,
  hash: string,
): Promise<StalenessResult> {
  const current = await computeBriefingFingerprint(deliberationId);
  if (!current) return { stale: "R1" };

  if (current.contentHash === hash) return { stale: false };

  // Look up prior material fields for the supplied hash (L1 → L2 → L0).
  const prevCached = await loadCacheEntry(hash);
  if (!prevCached) {
    // No recoverable state for this hash — conservative: signal R1
    return { stale: "R1" };
  }

  const rule = evaluateStalenessRules(
    prevCached.fields,
    current.materialFields,
    prevCached.components,
    current.components,
  );
  return { stale: rule ?? "R1" };
}
