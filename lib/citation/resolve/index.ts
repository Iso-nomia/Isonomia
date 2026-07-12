/**
 * Auto-Citation Engine — resolution waterfall.
 *
 * Phase 1 of docs/AUTO_CITATION_ENGINE_ROADMAP.md.
 *
 *   resolveUrlToCitation(url)
 *     ├─ canonicalize (lexical → HEAD redirect-follow)
 *     ├─ in-process LRU cache hit?            → return
 *     ├─ extract DOI from URL?                → resolveDOI() (Crossref)
 *     ├─ otherwise: HTML fetch + scrapeHighwire
 *     │   └─ if Highwire surfaced a DOI       → resolveDOI() upgrade
 *     └─ on total failure: ResolvedCitation with confidence='none'
 *
 * arXiv, OpenAlex enrichment, Wayback, and LLM fallback are deliberately
 * out of scope here — they land in Phases 3 and 6.
 *
 * No DB writes. No rate limiting. Single LRU cache, in-memory.
 * Persistence + per-host buckets ship in Phase 2.
 */

import { resolveDOI } from "@/lib/integrations/crossref";
import type { ResolvedSource } from "@/lib/integrations/crossref";
import { canonicalizeUrl, canonicalizeUrlSync } from "./canonicalize";
import { extractDoiFromUrl, extractArxivIdFromUrl } from "./extractDoi";
import { scrapeHighwire } from "./highwire";
import { acquireHostToken, reportHostOutcome } from "./rateLimit";
import { resolveArxivFromUrl } from "./arxiv";
import { enrichSourceWithOpenAlex } from "./openalex";
import { resolveByLlm } from "./llm";
import { lookupArchiveSnapshot, requestArchiveCapture } from "./archive";
import { recordResolution } from "../telemetry";
import type { Confidence, ResolvedCitation, ResolverSource } from "./types";

// ──────────────────────────────────────────────────────────
// Cache
// ──────────────────────────────────────────────────────────

interface CacheEntry {
  value: ResolvedCitation;
  insertedAt: number;
  ttlMs: number;
}

const CACHE_MAX = 500;
// Phase 8: differentiated TTLs.
//   • Successful resolutions are durable — the underlying Source row
//     was persisted, so re-resolving wastes outbound requests. 30 days.
//   • Failed resolutions retry every 24h so a host that comes back
//     online (or a paper that gets a DOI minted) eventually gets
//     re-attempted, without spamming the network in the meantime.
const CACHE_TTL_SUCCESS_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_TTL_FAILURE_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): ResolvedCitation | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.insertedAt > hit.ttlMs) {
    cache.delete(key);
    return null;
  }
  // LRU: re-insert.
  cache.delete(key);
  cache.set(key, hit);
  recordResolution({
    url: key,
    source: hit.value.resolvedFrom,
    confidence: hit.value.confidence,
    durationMs: hit.value.durationMs,
    cached: true,
    enrichedBy: hit.value.enrichedBy,
    archived: !!hit.value.archiveUrl,
  });
  return hit.value;
}

function cacheSet(key: string, value: ResolvedCitation): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  const ttlMs = value.confidence === "none" ? CACHE_TTL_FAILURE_MS : CACHE_TTL_SUCCESS_MS;
  cache.set(key, { value, insertedAt: Date.now(), ttlMs });
  recordResolution({
    url: key,
    source: value.resolvedFrom,
    confidence: value.confidence,
    durationMs: value.durationMs,
    cached: false,
    enrichedBy: value.enrichedBy,
    archived: !!value.archiveUrl,
  });
}

/** Test/admin hook. Never call in request handlers. */
export function _clearCitationResolverCache(): void {
  cache.clear();
}

// ──────────────────────────────────────────────────────────
// Public entry point
// ──────────────────────────────────────────────────────────

export interface ResolveOptions {
  /** Skip the network HEAD redirect step (use lexical canonicalization only). */
  skipRedirectFollow?: boolean;
  /** Override the User-Agent for outbound HTTP. */
  userAgent?: string;
  /** Per-fetch timeout in ms. Default 8s. */
  timeoutMs?: number;
}

const DEFAULT_USER_AGENT =
  process.env.CITATION_RESOLVER_USER_AGENT ??
  "MeshCitationResolver/0.1 (+https://meshhq.app/citation-resolver)";

export async function resolveUrlToCitation(
  inputUrl: string,
  opts: ResolveOptions = {},
): Promise<ResolvedCitation> {
  const startedAt = Date.now();
  const userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;
  const timeoutMs = opts.timeoutMs ?? 8_000;

  // ── 1. Canonicalize ───────────────────────────────────
  const canonicalUrl = opts.skipRedirectFollow
    ? canonicalizeUrlSync(inputUrl)
    : await canonicalizeUrl(inputUrl, { timeoutMs, userAgent });

  // ── 2. Cache hit? ─────────────────────────────────────
  const cached = cacheGet(canonicalUrl);
  if (cached) return cached;

  const warnings: string[] = [];

  // ── 2b. Derive identifiers from URL up front. These travel on
  // every result regardless of waterfall outcome — so a 403 from the
  // publisher does not erase the fact that the URL embedded a DOI.
  const derivedIdentifiers: { doi?: string; arxivId?: string } = {};
  const _derivedDoi = extractDoiFromUrl(canonicalUrl);
  if (_derivedDoi) derivedIdentifiers.doi = _derivedDoi;
  const _derivedArxiv = extractArxivIdFromUrl(canonicalUrl);
  if (_derivedArxiv) derivedIdentifiers.arxivId = _derivedArxiv;

  // ── 3a. arXiv ID detectable from the URL? ─────────────
  // arXiv comes before Crossref because arxiv.org URLs do not contain
  // the eventual journal DOI (if any), and the Atom feed is the
  // authoritative source for preprint metadata.
  const arxivResult = await safeResolveArxiv(canonicalUrl, { userAgent, timeoutMs }, warnings);
  if (arxivResult) {
    let source = arxivResult.source;
    const enrichedBy: ResolverSource[] = [];
    // If the arXiv entry surfaced a journal DOI, enrich abstracts/concepts.
    const arxivDoi = source.identifier && /^10\./.test(source.identifier) ? source.identifier : undefined;
    if (arxivDoi) {
      const enriched = await safeEnrichOpenAlex(source, arxivDoi, warnings);
      if (enriched) {
        source = enriched.source;
        if (enriched.changed) enrichedBy.push("openalex");
      }
    }
    const result = makeResult({
      canonicalUrl,
      inputUrl,
      doi: arxivDoi,
      source,
      resolvedFrom: "arxiv",
      enrichedBy,
      confidence: arxivResult.confidence,
      startedAt,
      warnings,
      derivedIdentifiers,
    });
    await attachArchiveSnapshot(result, { userAgent }, warnings);
    cacheSet(canonicalUrl, result);
    return result;
  }

  // ── 3b. DOI directly extractable from the URL? ────────
  const urlDoi = derivedIdentifiers.doi;
  if (urlDoi) {
    const crossref = await safeResolveDoi(urlDoi, warnings);
    if (crossref) {
      let source = crossref;
      const enrichedBy: ResolverSource[] = [];
      const enriched = await safeEnrichOpenAlex(source, urlDoi, warnings);
      if (enriched) {
        source = enriched.source;
        if (enriched.changed) enrichedBy.push("openalex");
      }
      const result = makeResult({
        canonicalUrl,
        inputUrl,
        doi: source.identifier,
        source,
        resolvedFrom: "crossref",
        enrichedBy,
        confidence: "high",
        startedAt,
        warnings,
        derivedIdentifiers,
      });
      await attachArchiveSnapshot(result, { userAgent }, warnings);
      cacheSet(canonicalUrl, result);
      return result;
    }
    warnings.push(`crossref: failed to resolve DOI '${urlDoi}' extracted from URL`);
  }

  // ── 4. Fetch HTML and scrape Highwire/DC/OG ───────────
  const html = await safeFetchHtml(canonicalUrl, { userAgent, timeoutMs }, warnings);
  if (html) {
    const scraped = scrapeHighwire(html, canonicalUrl);
    if (scraped) {
      // If the page surfaced a DOI we did not see in the URL, upgrade
      // to Crossref for authoritative metadata.
      const scrapedDoi = scraped.source.identifier && /^10\./.test(scraped.source.identifier)
        ? scraped.source.identifier
        : undefined;
      if (scrapedDoi) {
        const crossref = await safeResolveDoi(scrapedDoi, warnings);
        if (crossref) {
          let source = crossref;
          const enrichedBy: ResolverSource[] = ["highwire"];
          const enriched = await safeEnrichOpenAlex(source, scrapedDoi, warnings);
          if (enriched) {
            source = enriched.source;
            if (enriched.changed) enrichedBy.push("openalex");
          }
          const result = makeResult({
            canonicalUrl,
            inputUrl,
            doi: source.identifier,
            source,
            resolvedFrom: "crossref",
            enrichedBy,
            confidence: "high",
            startedAt,
            warnings,
            derivedIdentifiers,
          });
          await attachArchiveSnapshot(result, { userAgent }, warnings);
          cacheSet(canonicalUrl, result);
          return result;
        }
        warnings.push(
          `crossref: failed to upgrade Highwire-extracted DOI '${scrapedDoi}'`,
        );
      }

      const result = makeResult({
        canonicalUrl,
        inputUrl,
        doi: scrapedDoi,
        source: scraped.source,
        resolvedFrom: "highwire",
        confidence: scraped.confidence,
        startedAt,
        warnings,
        derivedIdentifiers,
      });
      await attachArchiveSnapshot(result, { userAgent }, warnings);
      cacheSet(canonicalUrl, result);
      return result;
    }
    warnings.push("highwire: no usable metadata in HTML");
  }

  // ── 4b. LLM fallback (Phase 6) ─────────────────────────
  // Only when we already have HTML in hand — we won't re-fetch just to
  // ask GPT. This is a "we got bytes but no structured metadata" case.
  if (html) {
    const llm = await safeResolveByLlm({ html, url: canonicalUrl, timeoutMs }, warnings);
    if (llm) {
      const result = makeResult({
        canonicalUrl,
        inputUrl,
        doi: llm.source.identifier && /^10\./.test(llm.source.identifier) ? llm.source.identifier : undefined,
        source: llm.source,
        resolvedFrom: "llm",
        confidence: llm.confidence,
        startedAt,
        warnings,
        derivedIdentifiers,
      });
      await attachArchiveSnapshot(result, { userAgent }, warnings);
      cacheSet(canonicalUrl, result);
      return result;
    }
  }

  // ── 5. Total failure — try Wayback as last-ditch ──────
  const archive = await safeLookupArchive(canonicalUrl, { userAgent }, warnings);
  const result = makeResult({
    canonicalUrl,
    inputUrl,
    source: null,
    resolvedFrom: archive ? "wayback" : "manual",
    confidence: "none",
    startedAt,
    warnings,
    archiveUrl: archive?.archiveUrl,
    archiveCapturedAt: archive?.capturedAt,
    derivedIdentifiers,
  });
  // Negative cache for a shorter window — don't poison long-term.
  // (We still write the same entry; TTL handles this for now.)
  cacheSet(canonicalUrl, result);
  return result;
}

// ──────────────────────────────────────────────────────────
// Internals
// ──────────────────────────────────────────────────────────

async function safeResolveDoi(
  doi: string,
  warnings: string[],
): Promise<ResolvedSource | null> {
  try {
    const ok = await acquireHostToken("https://api.crossref.org");
    if (!ok) {
      warnings.push("crossref: rate-limit wait timeout or breaker open");
      return null;
    }
    const r = await resolveDOI(doi);
    reportHostOutcome("https://api.crossref.org", r != null);
    return r;
  } catch (err) {
    reportHostOutcome("https://api.crossref.org", false);
    warnings.push(
      `crossref: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

async function safeResolveArxiv(
  url: string,
  opts: { userAgent: string; timeoutMs: number },
  warnings: string[],
): Promise<{ source: ResolvedSource; confidence: "high" } | null> {
  try {
    const r = await resolveArxivFromUrl(url, opts);
    // Only count hits as breaker signal — null often just means "URL
    // isn't an arXiv URL", which isn't a host failure.
    if (r != null) reportHostOutcome("https://export.arxiv.org", true);
    return r;
  } catch (err) {
    reportHostOutcome("https://export.arxiv.org", false);
    warnings.push(
      `arxiv: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

async function safeEnrichOpenAlex(
  source: ResolvedSource,
  doi: string,
  warnings: string[],
): Promise<{ source: ResolvedSource; changed: boolean } | null> {
  try {
    return await enrichSourceWithOpenAlex(source, doi);
  } catch (err) {
    warnings.push(
      `openalex: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

async function safeFetchHtml(
  url: string,
  opts: { userAgent: string; timeoutMs: number },
  warnings: string[],
): Promise<string | null> {
  const ok = await acquireHostToken(url);
  if (!ok) {
    warnings.push(`fetch: rate-limit wait timeout for ${url}`);
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": opts.userAgent,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      reportHostOutcome(url, false);
      warnings.push(`fetch: HTTP ${res.status} for ${url}`);
      return null;
    }
    const ctype = res.headers.get("content-type") ?? "";
    if (!/html|xml/i.test(ctype)) {
      // 2xx but not HTML — count as success for the breaker.
      reportHostOutcome(url, true);
      warnings.push(`fetch: skipping non-HTML content-type '${ctype}'`);
      return null;
    }
    reportHostOutcome(url, true);
    return await res.text();
  } catch (err) {
    reportHostOutcome(url, false);
    warnings.push(
      `fetch: ${err instanceof Error ? err.message : String(err)} for ${url}`,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface MakeResultArgs {
  canonicalUrl: string;
  inputUrl: string;
  doi?: string;
  source: ResolvedSource | null;
  resolvedFrom: ResolverSource;
  enrichedBy?: ResolverSource[];
  confidence: Confidence;
  startedAt: number;
  warnings: string[];
  archiveUrl?: string;
  archiveCapturedAt?: string;
  derivedIdentifiers: { doi?: string; arxivId?: string };
}

function makeResult(args: MakeResultArgs): ResolvedCitation {
  return {
    canonicalUrl: args.canonicalUrl,
    inputUrl: args.inputUrl,
    doi: args.doi ?? args.derivedIdentifiers.doi,
    source: args.source,
    resolvedFrom: args.resolvedFrom,
    enrichedBy: args.enrichedBy ?? [],
    confidence: args.confidence,
    resolvedAt: new Date().toISOString(),
    durationMs: Date.now() - args.startedAt,
    warnings: args.warnings.length ? args.warnings : undefined,
    archiveUrl: args.archiveUrl,
    archiveCapturedAt: args.archiveCapturedAt,
    derivedIdentifiers: args.derivedIdentifiers,
  };
}

// ──────────────────────────────────────────────────────────
// Phase 6 helpers — LLM fallback + Wayback archive
// ──────────────────────────────────────────────────────────

async function safeResolveByLlm(
  opts: { html: string; url: string; timeoutMs: number },
  warnings: string[],
): Promise<{ source: ResolvedSource; confidence: "low" } | null> {
  try {
    const r = await resolveByLlm(opts);
    if (!r) warnings.push("llm: no usable bibliographic info extracted");
    return r;
  } catch (err) {
    warnings.push(`llm: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function safeLookupArchive(
  url: string,
  opts: { userAgent: string },
  warnings: string[],
): Promise<{ archiveUrl: string; capturedAt: string } | null> {
  try {
    const snap = await lookupArchiveSnapshot(url, opts);
    if (!snap) {
      // No snapshot exists yet — fire one off so the next caller gets it.
      requestArchiveCapture(url, opts);
      return null;
    }
    return { archiveUrl: snap.archiveUrl, capturedAt: snap.capturedAt };
  } catch (err) {
    warnings.push(`wayback: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Mutates `result.archiveUrl` / `result.archiveCapturedAt` in place when
 * a snapshot is found. Used to enrich successful resolutions with a
 * stable archive copy alongside the live URL.
 */
async function attachArchiveSnapshot(
  result: ResolvedCitation,
  opts: { userAgent: string },
  warnings: string[],
): Promise<void> {
  // Skip when we already have one (cache replay) or when there's no URL.
  if (result.archiveUrl || !result.canonicalUrl) return;
  const snap = await safeLookupArchive(result.canonicalUrl, opts, warnings);
  if (snap) {
    result.archiveUrl = snap.archiveUrl;
    result.archiveCapturedAt = snap.capturedAt;
  }
}
