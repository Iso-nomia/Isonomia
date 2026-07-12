/**
 * Public argument search page — Phase 1 of the Argument-Search roadmap.
 *
 * Server-rendered (no client fetch) so first paint includes results and
 * crawlers see the full document. Calls /api/v3/search/arguments via an
 * absolute internal fetch so this stays a thin shell over the existing
 * engine.
 *
 * Locked decisions (see docs/Argument_Google_Scholar_Roadmap.md):
 *   - Standalone minimal shell (mirrors /a/[identifier], not the app shell)
 *   - Default mode = "hybrid" (matches MCP)
 *   - JSON discovery via <link rel="alternate"> only; no ?format=json on
 *     the page route. The single canonical JSON endpoint is the v3 API.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import SearchControls from "@/components/search/SearchControls";
import ArgumentResultCard, {
  type SearchResult,
} from "@/components/search/ArgumentResultCard";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

/**
 * Resolve the base URL for server-side internal fetches.
 * Prefer the incoming request's host/proto so dev (localhost), preview, and
 * production all hit themselves instead of the hard-coded prod fallback.
 * Falls back to NEXT_PUBLIC_APP_URL / isonomia.app for contexts where the
 * headers helper is unavailable (e.g. generateMetadata in some edge cases).
 */
function resolveRequestBaseUrl(): string {
  try {
    const h = headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") ||
        (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // headers() can throw outside a request scope; fall through to BASE_URL.
  }
  return BASE_URL;
}
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

type RawSearchParams = Record<string, string | string[] | undefined>;
type PageProps = {
  searchParams?: Promise<RawSearchParams>;
};

type ParsedQuery = {
  q: string;
  scheme: string;
  sort: "recent" | "dialectical_fitness";
  mode: "hybrid" | "lexical" | "vector";
  against: string;
  limit: number;
  testedOnly: boolean;
  minCq: string;
  minEvidence: string;
  since: string;
  until: string;
};

function pickFirst(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return (v[0] ?? "").trim();
  return (v ?? "").trim();
}

function parseQuery(sp: RawSearchParams | undefined): ParsedQuery {
  const raw = sp ?? {};
  const q = pickFirst(raw.q);
  const scheme = pickFirst(raw.scheme).toLowerCase();
  const sortRaw = pickFirst(raw.sort).toLowerCase();
  const sort: ParsedQuery["sort"] =
    sortRaw === "dialectical_fitness" ? "dialectical_fitness" : "recent";
  const modeRaw = pickFirst(raw.mode).toLowerCase();
  const mode: ParsedQuery["mode"] =
    modeRaw === "lexical" || modeRaw === "vector" ? modeRaw : "hybrid";
  const against = pickFirst(raw.against);
  const limitRaw = Number(pickFirst(raw.limit));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(MAX_LIMIT, Math.floor(limitRaw))
    : DEFAULT_LIMIT;
  const testedOnlyRaw = pickFirst(raw.tested_only).toLowerCase();
  const testedOnly =
    testedOnlyRaw === "1" || testedOnlyRaw === "true" || testedOnlyRaw === "yes";
  const minCqNum = Number(pickFirst(raw.min_cq_satisfied));
  const minCq =
    Number.isFinite(minCqNum) && minCqNum > 0 ? String(Math.floor(minCqNum)) : "";
  const minEvidenceNum = Number(pickFirst(raw.min_evidence));
  const minEvidence =
    Number.isFinite(minEvidenceNum) && minEvidenceNum > 0
      ? String(Math.floor(minEvidenceNum))
      : "";
  const since = pickFirst(raw.since);
  const until = pickFirst(raw.until);
  return { q, scheme, sort, mode, against, limit, testedOnly, minCq, minEvidence, since, until };
}

function buildApiUrl(parsed: ParsedQuery, baseUrl: string = BASE_URL): string {
  const u = new URL(`${baseUrl}/api/v3/search/arguments`);
  if (parsed.q) u.searchParams.set("q", parsed.q);
  if (parsed.scheme) u.searchParams.set("scheme", parsed.scheme);
  if (parsed.sort !== "recent") u.searchParams.set("sort", parsed.sort);
  if (parsed.mode !== "lexical") u.searchParams.set("mode", parsed.mode);
  if (parsed.against) u.searchParams.set("against", parsed.against);
  if (parsed.testedOnly) u.searchParams.set("tested_only", "1");
  if (parsed.minCq) u.searchParams.set("min_cq_satisfied", parsed.minCq);
  if (parsed.minEvidence) u.searchParams.set("min_evidence", parsed.minEvidence);
  if (parsed.since) u.searchParams.set("since", parsed.since);
  if (parsed.until) u.searchParams.set("until", parsed.until);
  u.searchParams.set("limit", String(parsed.limit));
  // Phase 5 — always opt the consumer page into counter-citation
  // discovery. Cards render the strongest contester (or "none on file")
  // so users never see a one-sided ranking.
  u.searchParams.set("include_strongest_counter", "1");
  // Phase 10a (10.3) — also surface the downstream cited-by summary on each
  // card (who builds on / contests this, + strongest citer). Bounded to the
  // top cards; the route composes the cited-by endpoint's exact classification.
  u.searchParams.set("include_cited_by", "1");
  return u.toString();
}

function buildCanonical(parsed: ParsedQuery): string {
  const u = new URL(`${BASE_URL}/search/arguments`);
  if (parsed.q) u.searchParams.set("q", parsed.q);
  if (parsed.scheme) u.searchParams.set("scheme", parsed.scheme);
  if (parsed.sort !== "recent") u.searchParams.set("sort", parsed.sort);
  if (parsed.mode !== "hybrid") u.searchParams.set("mode", parsed.mode);
  if (parsed.against) u.searchParams.set("against", parsed.against);
  if (parsed.testedOnly) u.searchParams.set("tested_only", "1");
  if (parsed.minCq) u.searchParams.set("min_cq_satisfied", parsed.minCq);
  if (parsed.minEvidence) u.searchParams.set("min_evidence", parsed.minEvidence);
  if (parsed.since) u.searchParams.set("since", parsed.since);
  if (parsed.until) u.searchParams.set("until", parsed.until);
  if (parsed.limit !== DEFAULT_LIMIT) u.searchParams.set("limit", String(parsed.limit));
  return u.toString();
}

type ApiResponse = {
  ok: boolean;
  query: {
    q: string;
    limit: number;
    scheme: string | null;
    against: string | null;
    againstClaimText: string | null;
    sort: "recent" | "dialectical_fitness";
    mode: "lexical" | "hybrid" | "vector";
  };
  fitnessFormula?: Record<string, number>;
  count: number;
  results: SearchResult[];
};

async function runSearch(
  parsed: ParsedQuery,
  baseUrl: string,
): Promise<ApiResponse | null> {
  try {
    const res = await fetch(buildApiUrl(parsed, baseUrl), {
      // Server-side fetch within the same Next deployment. Cache-friendly
      // because the API itself sets s-maxage=30.
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as ApiResponse;
  } catch {
    return null;
  }
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = (await searchParams) || {};
  const parsed = parseQuery(sp);
  const canonical = buildCanonical(parsed);
  const titleBase = parsed.q
    ? `"${parsed.q}" — Argument search`
    : "Search arguments";
  const title = `${titleBase} — Isonomia`;
  const description = parsed.q
    ? `Public Isonomia arguments matching "${parsed.q}", ranked by ${parsed.sort === "dialectical_fitness" ? "dialectical fitness" : "recency"}.`
    : "Search Isonomia's public corpus of dialectically-attested arguments.";

  // Build the alternate JSON-LD / JSON discovery URLs that mirror the human page.
  const apiUrl = buildApiUrl(parsed);

  // Phase 3.6 \u2014 OG card. The /api/og/search/arguments route renders a
  // 1200\u00d7630 PNG with the query embedded so shared links have a real
  // preview instead of falling back to the site default.
  const ogImage = (() => {
    const u = new URL(`${BASE_URL}/api/og/search/arguments`);
    if (parsed.q) u.searchParams.set("q", parsed.q);
    if (parsed.sort !== "recent") u.searchParams.set("sort", parsed.sort);
    if (parsed.mode !== "hybrid") u.searchParams.set("mode", parsed.mode);
    return u.toString();
  })();

  return {
    title,
    description,
    metadataBase: new URL(BASE_URL),
    alternates: {
      canonical,
      types: {
        "application/json": apiUrl,
        "application/ld+json": apiUrl,
      },
    },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      siteName: "Isonomia",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ArgumentSearchPage({ searchParams }: PageProps) {
  const sp = (await searchParams) || {};
  const parsed = parseQuery(sp);
  const requestBaseUrl = resolveRequestBaseUrl();
  // Public-facing URLs (alternates, programmatic-access link) stay on the
  // canonical BASE_URL so shared/canonical links don't leak preview hosts.
  const apiUrl = buildApiUrl(parsed);
  const canonical = buildCanonical(parsed);

  // Only hit the API when the user has expressed search intent. Empty-state
  // landing renders instantly with no DB query.
  const hasIntent = !!(
    parsed.q ||
    parsed.scheme ||
    parsed.against ||
    parsed.testedOnly ||
    parsed.minCq ||
    parsed.minEvidence ||
    parsed.since ||
    parsed.until
  );
  const response = hasIntent ? await runSearch(parsed, requestBaseUrl) : null;
  const results = response?.results ?? [];
  const againstText = response?.query?.againstClaimText ?? null;

  // "Show more" — naive limit-bumping. Cursor-based pagination is a Phase 2
  // follow-up; this is sufficient up to MAX_LIMIT.
  const canShowMore =
    response != null &&
    response.count >= parsed.limit &&
    parsed.limit < MAX_LIMIT;
  const showMoreUrl = canShowMore
    ? buildCanonical({ ...parsed, limit: Math.min(MAX_LIMIT, parsed.limit + DEFAULT_LIMIT) })
    : null;

  return (
    <main className="page">
      <style dangerouslySetInnerHTML={{ __html: pageStyles() }} />

      {/* Discovery alternates so LLM agents and standards-aware crawlers
          can reach the canonical JSON / JSON-LD form of this query. */}
      <link rel="alternate" type="application/json" href={apiUrl} />
      <link rel="alternate" type="application/ld+json" href={apiUrl} />

      <nav className="topnav">
        <Link href="/" className="brand">
          <span className="brand-mesh">Isonomia</span>
          <span className="brand-sub">Argument Search</span>
        </Link>
        <div className="nav-actions">
          <Link href="/quick" className="btn btn-ghost">
            Propose argument
          </Link>
          <Link href="/" className="btn btn-ghost">
            Home
          </Link>
        </div>
      </nav>

      <section className="content">
        <header className="page-head">
          <h1>Search public arguments</h1>
          <p className="lede">
            Every result is a permalink to a structured argument with a
            stated scheme, evidence with provenance hashes, and a tracked
            standing in its dialectical context.{" "}
            <Link href="/test/ai-epistemic" className="inline-link">
              How this works
            </Link>
            .
          </p>
        </header>

        <SearchControls
          initialQ={parsed.q}
          initialScheme={parsed.scheme}
          initialSort={parsed.sort}
          initialMode={parsed.mode}
          initialTestedOnly={parsed.testedOnly}
          initialMinCq={parsed.minCq}
          initialMinEvidence={parsed.minEvidence}
          initialSince={parsed.since}
          initialUntil={parsed.until}
        />

        {parsed.against ? (
          <div className="against-banner">
            <strong>Counter-argument discovery:</strong>{" "}
            {againstText
              ? <>showing arguments that contest <em>"{againstText}"</em>.</>
              : <>showing arguments that contest claim <code>{parsed.against}</code>.</>}
            <Link
              href={buildCanonical({ ...parsed, against: "" })}
              className="against-clear"
            >
              clear
            </Link>
          </div>
        ) : null}

        <section className="results" aria-live="polite">
          {!hasIntent ? (
            <EmptyLanding canonical={canonical} />
          ) : response == null ? (
            <ErrorState />
          ) : results.length === 0 ? (
            <HonestEmpty parsed={parsed} againstText={againstText} />
          ) : (
            <>
              <p className="results-summary">
                {response.count} result{response.count === 1 ? "" : "s"}
                {parsed.sort === "dialectical_fitness"
                  ? " · ranked by dialectical fitness"
                  : " · most recent first"}
                {response.query.mode !== "lexical"
                  ? ` · ${response.query.mode} retrieval`
                  : null}
              </p>
              <ol className="result-list">
                {results.map((r) => (
                  <li key={r.argumentId}>
                    <ArgumentResultCard result={r} />
                  </li>
                ))}
              </ol>
              {showMoreUrl ? (
                <div className="show-more-wrap">
                  <Link href={showMoreUrl} className="btn btn-ghost">
                    Show more results
                  </Link>
                </div>
              ) : null}
            </>
          )}
        </section>

        <footer className="page-foot">
          <p>
            Programmatic access:{" "}
            <a href={apiUrl} className="inline-link" rel="nofollow">
              {apiUrl.replace(BASE_URL, "")}
            </a>
            {" · "}
            <Link href="/api/v3/docs" className="inline-link">
              OpenAPI
            </Link>
            {" · "}
            <Link href="/.well-known/argument-graph" className="inline-link">
              discovery manifest
            </Link>
          </p>
        </footer>
      </section>
    </main>
  );
}

function EmptyLanding({ canonical }: { canonical: string }) {
  return (
    <div className="empty empty-landing">
      <h2>Try a query.</h2>
      <p className="muted">
        Free-text matches argument prose and conclusion-claim text. Examples:
      </p>
      <ul className="example-queries">
        <li>
          <Link href="/search/arguments?q=social+media+adolescent+depression">
            social media adolescent depression
          </Link>
        </li>
        <li>
          <Link href="/search/arguments?q=remote+work+productivity">
            remote work productivity
          </Link>
        </li>
        <li>
          <Link href="/search/arguments?q=carbon+pricing&sort=dialectical_fitness">
            carbon pricing — sorted by dialectical fitness
          </Link>
        </li>
      </ul>
      <p className="muted small">
        Canonical URL: <code>{canonical}</code>
      </p>
    </div>
  );
}

function HonestEmpty({
  parsed,
  againstText,
}: {
  parsed: ParsedQuery;
  againstText: string | null;
}) {
  if (parsed.against) {
    return (
      <div className="empty">
        <h2>No counter-arguments yet.</h2>
        <p className="muted">
          {againstText
            ? <>Isonomia has no public argument on file that contests <em>"{againstText}"</em>.</>
            : <>Isonomia has no public argument on file that contests claim <code>{parsed.against}</code>.</>}
          {" "}
          That's an honest empty — not a search failure. Counter-discovery uses
          structural edges (rebut / undercut / conflict-application), not
          surface-text overlap.
        </p>
        <p className="muted">
          <Link href="/quick" className="inline-link">
            Propose a counter-argument →
          </Link>
        </p>
      </div>
    );
  }
  return (
    <div className="empty">
      <h2>No matches.</h2>
      <p className="muted">
        Nothing in the public corpus matches{" "}
        {parsed.q ? <em>"{parsed.q}"</em> : "those filters"}
        {parsed.mode === "lexical"
          ? <> in <strong>exact-words</strong> mode. Try switching mode to <strong>Hybrid</strong> for paraphrase recall.</>
          : <>.</>}
      </p>
      <p className="muted">
        <Link href="/quick" className="inline-link">
          Propose an argument →
        </Link>
      </p>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="empty">
      <h2>Search is temporarily unavailable.</h2>
      <p className="muted">
        The /api/v3/search/arguments endpoint did not return a successful
        response. Please try again in a moment.
      </p>
    </div>
  );
}

function pageStyles(): string {
  return `
    *, *::before, *::after { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      padding: 0;
      background: #f8fafc;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      font-size: 15px;
      line-height: 1.6;
    }
    a { color: inherit; }
    .page { min-height: 100vh; }

    .topnav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .brand { display: flex; align-items: baseline; gap: 6px; text-decoration: none; }
    .brand-mesh { font-size: 18px; font-weight: 800; color: #6366f1; letter-spacing: -0.03em; }
    .brand-sub { font-size: 13px; color: #94a3b8; }
    .nav-actions { display: flex; align-items: center; gap: 8px; }

    .btn {
      display: inline-flex;
      align-items: center;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: none;
      transition: background 0.15s, color 0.15s;
    }
    .btn-ghost { background: transparent; color: #475569; }
    .btn-ghost:hover { background: #f1f5f9; color: #1e293b; }

    .content {
      max-width: 820px;
      margin: 0 auto;
      padding: 40px 24px 80px;
    }
    .page-head h1 {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 8px;
    }
    .lede { color: #475569; margin: 0 0 24px; }
    .inline-link { color: #6366f1; text-decoration: none; border-bottom: 1px solid transparent; }
    .inline-link:hover { border-bottom-color: currentColor; }

    .against-banner {
      padding: 12px 14px;
      border-radius: 8px;
      background: #fef3c7;
      border: 1px solid #fcd34d;
      color: #78350f;
      margin: 0 0 16px;
      font-size: 14px;
    }
    .against-clear {
      margin-left: 12px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
      color: #92400e;
      text-decoration: none;
      border-bottom: 1px solid currentColor;
    }

    .results-summary {
      font-size: 13px;
      color: #64748b;
      margin: 0 0 12px;
    }
    .result-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }

    /* Result card */
    .result-card {
      padding: 16px 18px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .result-card:hover { border-color: #c7d2fe; box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04); }
    .card-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-bottom: 10px;
    }
    .standing-badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 12px;
    }
    .standing-badge.tone-good { background: #dcfce7; color: #166534; }
    .standing-badge.tone-warn { background: #fef3c7; color: #854d0e; }
    .standing-badge.tone-bad { background: #fee2e2; color: #991b1b; }
    .standing-badge.tone-neutral { background: #e0f2fe; color: #075985; }
    .standing-badge.tone-muted { background: #f1f5f9; color: #475569; }
    .scheme-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 12px;
      background: #eef2ff;
      color: #4338ca;
    }
    .fitness-chip, .hybrid-chip {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 12px;
      background: #f8fafc;
      color: #475569;
      border: 1px solid #e2e8f0;
    }
    .conclusion-link { text-decoration: none; }
    .conclusion {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 8px;
      line-height: 1.4;
    }
    .conclusion-link:hover .conclusion { color: #4338ca; }
    .argument-text {
      font-size: 14px;
      color: #334155;
      margin: 0 0 12px;
    }
    .card-foot {
      font-size: 12px;
      color: #64748b;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .card-foot .meta-sep { color: #cbd5e1; }
    .permalink { color: #6366f1; text-decoration: none; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .permalink:hover { text-decoration: underline; }
    .attestation-link, .counter-link { color: #475569; text-decoration: none; border-bottom: 1px dashed #cbd5e1; }
    .attestation-link:hover, .counter-link:hover { color: #1e293b; border-bottom-color: #94a3b8; }

    .empty {
      padding: 32px 24px;
      background: #fff;
      border: 1px dashed #cbd5e1;
      border-radius: 10px;
      text-align: left;
    }
    .empty h2 { margin: 0 0 8px; font-size: 18px; font-weight: 700; }
    .empty .muted { color: #64748b; margin: 0 0 8px; }
    .empty .small { font-size: 12px; }
    .example-queries { padding-left: 18px; margin: 8px 0 16px; color: #4338ca; }
    .example-queries a { text-decoration: none; }
    .example-queries a:hover { text-decoration: underline; }

    .show-more-wrap {
      margin-top: 16px;
      display: flex;
      justify-content: center;
    }

    .page-foot {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #94a3b8;
    }
    .page-foot code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #64748b; }
  `;
}
