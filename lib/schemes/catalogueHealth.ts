/**
 * lib/schemes/catalogueHealth.ts
 *
 * Roadmap E1 (SCHEMES_MCP_ALIGNMENT_ROADMAP §3) — catalogue-health projection.
 *
 * A *derived* (never stored) health view over an `ArgumentScheme` row, computed
 * from columns that already exist (`kind`, `key`, `clusterTag`, `fingerprint`).
 * No migration is required: this is a read-path projection consumed by the
 * scheme list endpoint, the per-scheme endpoint, and — downstream — the MCP
 * `list_schemes` enrichment (Phase A.1) and the `propose_structured_argument`
 * health gate (Phase B.1).
 *
 * Discipline notes:
 *   - `duplicateOf` / `canonicalKey` are derived from a *fingerprint collision*.
 *     A shared `fingerprint` is necessary-but-not-sufficient for behavioural
 *     equality (Spec 4 §3.5): the authoritative confirmation is the verifier
 *     (`verifyBehaviourEquality`, surfaced by Phase C `verify_scheme_equality`).
 *     This projection therefore reports collisions as *candidates*; no row is
 *     silently merged on the strength of a fingerprint match alone. At the
 *     Phase 4d baseline the catalogue has zero collisions, so `duplicateOf` is
 *     null for every current row.
 *   - The function is pure and synchronous so it can be unit-tested over a
 *     fixture catalogue without a database.
 */

/** Known test/placeholder scheme keys (see scripts/audits/classify-ontoclean.ts §3.2). */
const KNOWN_TEST_PLACEHOLDER_KEYS = new Set<string>(["scheme_test", "test_scheme"]);

/** Cluster tag reserved for test fixtures excluded from the production catalogue. */
const TEST_FIXTURES_CLUSTER = "_test_fixtures";

/** Matches a `test` token at a key boundary, e.g. `test_foo`, `foo_test`, `foo_test_bar`. */
const TEST_TOKEN = /(^|_)test($|_)/;

/** Minimal row shape needed to derive catalogue health. */
export type SchemeHealthRow = {
  key: string;
  kind: string | null | undefined;
  clusterTag: string | null | undefined;
  fingerprint: string | null | undefined;
};

/** Derived health projection for a single scheme row. */
export type CatalogueHealth = {
  /** True when the row is a first-class argument pattern (`kind === "argument-scheme"`). */
  isArgumentPattern: boolean;
  /** True when the row is dialogue-meta machinery rather than an argument pattern. */
  isDialogueMeta: boolean;
  /** True when the row looks like a leftover test/placeholder rather than a real scheme. */
  isTestPlaceholder: boolean;
  /**
   * Candidate canonical key when this row shares a fingerprint with a sibling
   * that is chosen as canonical; null when this row is itself canonical (or the
   * fingerprint is unique / unmaterialised). Fingerprint collision is a
   * candidate only — confirm with the verifier before treating as a true duplicate.
   */
  duplicateOf: string | null;
  /**
   * The canonical key for this row's fingerprint bucket. When the fingerprint is
   * unique or unmaterialised this is the row's own key.
   */
  canonicalKey: string;
  /** True when the row has no clusterTag (a folksonomy signal). */
  clusterTagMissing: boolean;
  /** True when the behaviour fingerprint column is populated. */
  fingerprintMaterialised: boolean;
};

/**
 * Index from materialised fingerprint → sorted list of scheme keys sharing it.
 * Only argument-pattern rows with a non-null fingerprint participate; the
 * canonical key for a bucket is the lexicographically smallest key (stable and
 * deterministic across calls).
 */
export type FingerprintPeerIndex = Map<string, string[]>;

/**
 * Returns true when a scheme key/clusterTag looks like a test or placeholder
 * entry rather than a real argument pattern.
 */
export function isTestPlaceholderKey(
  key: string,
  clusterTag: string | null | undefined,
): boolean {
  if (KNOWN_TEST_PLACEHOLDER_KEYS.has(key)) return true;
  if ((clusterTag ?? "").trim() === TEST_FIXTURES_CLUSTER) return true;
  return TEST_TOKEN.test(key);
}

/**
 * Build the fingerprint→keys index over a catalogue. Pass every row you want
 * considered for collision detection (typically all `kind === "argument-scheme"`
 * rows). Rows with a null/empty fingerprint are skipped. Each bucket's key list
 * is sorted ascending so callers get a deterministic canonical.
 */
export function buildFingerprintPeerIndex(
  rows: ReadonlyArray<Pick<SchemeHealthRow, "key" | "fingerprint">>,
): FingerprintPeerIndex {
  const index: FingerprintPeerIndex = new Map();
  for (const row of rows) {
    const fp = (row.fingerprint ?? "").trim();
    if (!fp) continue;
    const bucket = index.get(fp);
    if (bucket) {
      bucket.push(row.key);
    } else {
      index.set(fp, [row.key]);
    }
  }
  for (const bucket of index.values()) {
    bucket.sort();
  }
  return index;
}

/**
 * Compute the derived catalogue-health projection for a single scheme row.
 *
 * @param row        The scheme row (key/kind/clusterTag/fingerprint).
 * @param peerIndex  Fingerprint→keys index built via `buildFingerprintPeerIndex`
 *                   over the catalogue. Omit (or pass an empty map) to skip
 *                   collision detection — `duplicateOf` will be null and
 *                   `canonicalKey` will be the row's own key.
 */
export function computeCatalogueHealth(
  row: SchemeHealthRow,
  peerIndex?: FingerprintPeerIndex,
): CatalogueHealth {
  const kind = row.kind ?? "argument-scheme";
  const fp = (row.fingerprint ?? "").trim();
  const fingerprintMaterialised = fp.length > 0;

  let canonicalKey = row.key;
  let duplicateOf: string | null = null;

  if (fingerprintMaterialised && peerIndex) {
    const bucket = peerIndex.get(fp);
    if (bucket && bucket.length > 1) {
      // Lexicographically smallest key in the bucket is canonical.
      const canonical = bucket[0];
      canonicalKey = canonical;
      if (row.key !== canonical) {
        duplicateOf = canonical;
      }
    }
  }

  return {
    isArgumentPattern: kind === "argument-scheme",
    isDialogueMeta: kind === "dialogue-meta",
    isTestPlaceholder: isTestPlaceholderKey(row.key, row.clusterTag),
    duplicateOf,
    canonicalKey,
    clusterTagMissing: !((row.clusterTag ?? "").trim()),
    fingerprintMaterialised,
  };
}
