/**
 * verify-mode-B v0 — cheap convergence clustering (pure, no I/O).
 *
 * Given resolved references for the outbound links on a page, cluster them by
 * *identity root* and report "N tellings → M roots". This is the honest, cheap
 * tier of the essay's C5 (independence = lineage-disjointness): it catches the
 * same source reached by multiple URLs (e.g. doi.org + publisher + repository, or
 * two links to one article), which is real dedup — but NOT "three different
 * articles citing one press release" (that is v2, and needs each source's own
 * outbound citations).
 *
 * Root key = DOI (if resolved) else canonical URL. Registrable domain is carried
 * for display but is DELIBERATELY NOT a merge key: collapsing distinct articles
 * under one outlet would manufacture false convergence — the exact failure the
 * essay's honesty budget warns against.
 *
 * Pure and Prisma-free: the `/api/verify/resolve` route does the resolution and
 * hands `ResolvedRef[]` in. First brick of `lib/verify/**` (a future provenance-core).
 */

export interface ResolvedRef {
  /** The URL as it appeared on the page. */
  inputUrl: string;
  /** Canonical URL after redirect-follow + tracking-param strip (resolver output). */
  canonicalUrl: string;
  /** DOI if the resolver extracted one. */
  doi?: string | null;
  /** Host of the canonical URL (display only — never a merge key). */
  domain?: string | null;
  /** Bibliographic title, if resolved. */
  title?: string | null;
  /** Resolver confidence in the *metadata* ("high" | "medium" | "low" | "none"). */
  confidence?: string;
}

export type RootKind = "doi" | "url";

export interface ConvergenceCluster {
  /** Namespaced identity: `doi:<doi>` or `url:<canonicalUrl>`. */
  rootKey: string;
  rootKind: RootKind;
  /** Human label — the DOI or the canonical URL. */
  rootLabel: string;
  /** Representative domain (from the first member). */
  domain: string | null;
  /** The page references that collapse to this root. */
  members: ResolvedRef[];
}

export interface ConvergenceResult {
  /** Number of references with a usable identity root. */
  tellings: number;
  /** Number of distinct identity roots. */
  roots: number;
  /** True when some references collapsed (roots < tellings). */
  convergent: boolean;
  /** Clusters, most-collapsed first. Multi-member clusters are the finding. */
  clusters: ConvergenceCluster[];
  /** References with no usable identity (not even a canonical URL) — reported, not clustered. */
  unresolved: ResolvedRef[];
  /** e.g. "5 tellings → 3 roots". */
  headline: string;
}

/** Normalize a DOI so `https://doi.org/10.X`, `doi:10.X`, and `10.X` cluster together. */
export function normalizeDoi(doi: string): string {
  return doi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:/, "")
    .replace(/\/+$/, "");
}

function rootOf(ref: ResolvedRef): { key: string; kind: RootKind; label: string } | null {
  if (ref.doi && ref.doi.trim()) {
    const doi = normalizeDoi(ref.doi);
    if (doi) return { key: `doi:${doi}`, kind: "doi", label: doi };
  }
  if (ref.canonicalUrl && ref.canonicalUrl.trim()) {
    return { key: `url:${ref.canonicalUrl}`, kind: "url", label: ref.canonicalUrl };
  }
  return null;
}

/**
 * Cluster resolved references by identity root. Order-independent; a reference
 * with no root lands in `unresolved`.
 */
export function clusterConvergence(refs: ResolvedRef[]): ConvergenceResult {
  const byRoot = new Map<string, ConvergenceCluster>();
  const unresolved: ResolvedRef[] = [];

  for (const ref of refs) {
    const root = rootOf(ref);
    if (!root) {
      unresolved.push(ref);
      continue;
    }
    const existing = byRoot.get(root.key);
    if (existing) {
      existing.members.push(ref);
    } else {
      byRoot.set(root.key, {
        rootKey: root.key,
        rootKind: root.kind,
        rootLabel: root.label,
        domain: ref.domain ?? null,
        members: [ref],
      });
    }
  }

  const clusters = [...byRoot.values()].sort(
    (a, b) => b.members.length - a.members.length || a.rootKey.localeCompare(b.rootKey),
  );
  const tellings = clusters.reduce((n, c) => n + c.members.length, 0);
  const roots = clusters.length;

  return {
    tellings,
    roots,
    convergent: roots < tellings,
    clusters,
    unresolved,
    headline: `${tellings} telling${tellings === 1 ? "" : "s"} → ${roots} root${roots === 1 ? "" : "s"}`,
  };
}
