/**
 * verify-mode-B v2 — shared-root / convergent-lineage detection (C5, the flagship).
 *
 * The essay's C5: independence is lineage-disjointness; "N sources" and "one
 * source N-times-removed" are identical at the point of consumption because the
 * DAG is invisible from any single node. v0 caught only same-source-via-multiple-
 * URLs. v2 goes one hop UPSTREAM: for each source we extract its own origin
 * signals — the DOIs it cites, its wire byline, the press releases it links — and
 * union sources that share an upstream. Two differently-worded articles that both
 * cite one study, or both carry a Reuters byline, collapse into one lineage. This
 * is the "three articles → one press release" check.
 *
 * Honest ceiling (Q-055): the decisive signal is only recoverable by fetching each
 * source and parsing its citations, and many pages link the study/PR poorly — so
 * false-independents (missed shared roots) are expected. This reports the roots it
 * COULD identify, never a certified independence count.
 *
 * `extractUpstreamsFromHtml` and `clusterByUpstream` are pure and unit-tested;
 * `fetchUpstreams` is the impure network shell.
 */
import { load } from "cheerio";
import { isSafePublicUrl } from "@/lib/unfurl";
import { normalizeDoi } from "@/lib/verify/convergence";
import { fetchHtml } from "@/lib/verify/sourceText";

export type UpstreamKind = "cited-doi" | "wire" | "press-release";

export interface UpstreamRef {
  kind: UpstreamKind;
  /** Namespaced identity used for matching: `doi:…` | `wire:…` | `pr:…`. */
  key: string;
  /** Human label. */
  label: string;
}

export interface SourceWithUpstream {
  /** Stable id (usually the input URL). */
  id: string;
  url: string;
  title?: string | null;
  upstreams: UpstreamRef[];
}

// ─── Pure extraction ──────────────────────────────────────────────────────────

const DOI_RE = /\b10\.\d{4,9}\/[-._;()/:a-z0-9]+/gi;
const MAX_DOIS = 15; // bound reference-heavy pages so they don't over-connect

const WIRES: { key: string; label: string; test: RegExp }[] = [
  { key: "wire:reuters", label: "Reuters", test: /\bReuters\b/ },
  { key: "wire:ap", label: "Associated Press", test: /\bAssociated Press\b|\(AP\)/ },
  { key: "wire:afp", label: "Agence France-Presse", test: /\bAgence France-Presse\b|\(AFP\)/ },
  { key: "wire:bloomberg", label: "Bloomberg", test: /\bBloomberg\b/ },
  { key: "wire:pa", label: "PA Media", test: /\bPA Media\b/ },
];

const PR_HOSTS = [
  "eurekalert.org",
  "newswise.com",
  "prnewswire.com",
  "businesswire.com",
  "globenewswire.com",
  "prweb.com",
];

/**
 * Extract a source's upstream origin signals from its HTML. Pure. `excludeDoi`
 * drops the source's OWN DOI so a paper doesn't count as its own upstream.
 */
export function extractUpstreamsFromHtml(html: string, opts: { excludeDoi?: string } = {}): UpstreamRef[] {
  const $ = load(html);
  $("script, style, noscript").remove();
  const refs: UpstreamRef[] = [];
  const seen = new Set<string>();
  const add = (r: UpstreamRef) => {
    if (!seen.has(r.key)) {
      seen.add(r.key);
      refs.push(r);
    }
  };

  const hrefs = $("a[href]")
    .map((_, a) => $(a).attr("href") || "")
    .get();

  // Cited DOIs (from text + hrefs).
  const exclude = opts.excludeDoi ? normalizeDoi(opts.excludeDoi) : null;
  const hay = $.root().text() + " " + hrefs.join(" ");
  let doiCount = 0;
  for (const m of hay.matchAll(DOI_RE)) {
    const doi = normalizeDoi(m[0]).replace(/[.,;:)\]]+$/, "");
    if (!doi || doi === exclude) continue;
    add({ kind: "cited-doi", key: `doi:${doi}`, label: doi });
    if (++doiCount >= MAX_DOIS) break;
  }

  // Wire byline (from visible text).
  const text = $("body").text() || $.root().text();
  for (const w of WIRES) if (w.test.test(text)) add({ kind: "wire", key: w.key, label: w.label });

  // Press-release hosts (from links).
  for (const href of hrefs) {
    try {
      const u = new URL(href);
      const host = u.host.replace(/^www\./, "");
      if (PR_HOSTS.some((h) => host === h || host.endsWith("." + h))) {
        add({ kind: "press-release", key: `pr:${host}${u.pathname}`, label: host });
      }
    } catch {
      /* skip */
    }
  }

  return refs;
}

// ─── Pure clustering (union-find over shared upstreams) ───────────────────────

export interface Lineage {
  members: SourceWithUpstream[];
  /** Upstreams held by ≥2 members — the actual shared roots. */
  sharedUpstreams: UpstreamRef[];
}

export interface LineageResult {
  sources: number;
  /** Number of connected components (independent lineages we could distinguish). */
  lineages: number;
  /** Components with >1 member, largest first — the convergence findings. */
  convergent: Lineage[];
  /** Sources for which no upstream signal was found (can't place → own lineage). */
  noUpstream: number;
  headline: string;
}

/** Cluster sources by shared upstream. Order-independent. Pure. */
export function clusterByUpstream(sources: SourceWithUpstream[]): LineageResult {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (parent.get(c) !== r) {
      const nxt = parent.get(c)!;
      parent.set(c, r);
      c = nxt;
    }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const s of sources) parent.set(s.id, s.id);

  // Union all sources that share an upstream key.
  const byKey = new Map<string, string[]>();
  for (const s of sources) {
    for (const u of s.upstreams) {
      const arr = byKey.get(u.key) ?? byKey.set(u.key, []).get(u.key)!;
      arr.push(s.id);
    }
  }
  for (const ids of byKey.values()) {
    for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]);
  }

  // Group into components.
  const comps = new Map<string, SourceWithUpstream[]>();
  for (const s of sources) {
    const r = find(s.id);
    const arr = comps.get(r) ?? comps.set(r, []).get(r)!;
    arr.push(s);
  }

  const convergent: Lineage[] = [];
  for (const members of comps.values()) {
    if (members.length < 2) continue;
    const count = new Map<string, { ref: UpstreamRef; n: number }>();
    for (const m of members) {
      for (const u of m.upstreams) {
        const e = count.get(u.key) ?? { ref: u, n: 0 };
        e.n += 1;
        count.set(u.key, e);
      }
    }
    const sharedUpstreams = [...count.values()].filter((e) => e.n >= 2).map((e) => e.ref);
    convergent.push({ members, sharedUpstreams });
  }
  convergent.sort((a, b) => b.members.length - a.members.length);

  return {
    sources: sources.length,
    lineages: comps.size,
    convergent,
    noUpstream: sources.filter((s) => s.upstreams.length === 0).length,
    headline: `${sources.length} source${sources.length === 1 ? "" : "s"} → ${comps.size} lineage${comps.size === 1 ? "" : "s"}`,
  };
}

// ─── Impure fetch shell ───────────────────────────────────────────────────────

/** Fetch a source and extract its upstream signals. Returns `[]` on any failure. */
export async function fetchUpstreams(
  url: string,
  opts: { timeoutMs?: number; ownDoi?: string } = {},
): Promise<UpstreamRef[]> {
  if (!isSafePublicUrl(url)) return [];
  const html = await fetchHtml(url, { timeoutMs: opts.timeoutMs });
  if (html == null) return [];
  return extractUpstreamsFromHtml(html, { excludeDoi: opts.ownDoi });
}
