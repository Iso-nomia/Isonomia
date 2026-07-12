/**
 * Bounded-concurrency batch resolver for the Auto-Citation Engine.
 *
 * Phase 4 of docs/AUTO_CITATION_ENGINE_ROADMAP.md.
 *
 *   resolveAll(urls, { userId })
 *     → Promise<ResolvedCitationRecord[]>
 *
 * For each URL: run `resolveUrlToCitation` then `upsertResolvedCitation`,
 * with at most `concurrency` (default 3) inflight at a time. Failures
 * never throw — they surface as records with `confidence: "none"` so a
 * caller can short-circuit the orchestrator without a try/catch.
 *
 * Each record is the *durable* shape we persist on
 * `aiProvenance.citations[]` and (in later phases)
 * `ArgumentSupport.provenanceJson.citations[]`. The `sourceId` field is
 * the only identifier that survives long-term — everything else is a
 * convenience snapshot for UI rendering without an extra join.
 */

import { resolveUrlToCitation } from "@/lib/citation/resolve";
import { upsertResolvedCitation } from "@/lib/citation/store";
import type { ResolvedCitation } from "@/lib/citation/resolve/types";

export interface ResolvedCitationRecord {
  /** Original URL the orchestrator passed in. */
  inputUrl: string;
  /** Canonical URL used as the resolver cache key. */
  canonicalUrl: string;
  /** Persisted Source.id — null when confidence='none' and not stored. */
  sourceId: string | null;
  doi?: string;
  title?: string;
  resolvedFrom: ResolvedCitation["resolvedFrom"];
  enrichedBy: ResolvedCitation["enrichedBy"];
  confidence: ResolvedCitation["confidence"];
  durationMs: number;
  warnings?: string[];
  archiveUrl?: string;
  archiveCapturedAt?: string;
  /**
   * Identifiers derived cheaply from the input URL itself (DOI prefix
   * scan, arXiv ID regex). Populated even when confidence='none' so
   * callers can still attach evidence with a known DOI when the
   * publisher 403s.
   */
  derivedIdentifiers: { doi?: string; arxivId?: string };
}

export interface ResolveAllOptions {
  /** User to attribute new Source rows to. Required. */
  userId: string;
  /** Max inflight resolutions. Default 3. */
  concurrency?: number;
  /** Persist confidence='none' results as bare URL stubs. Default false. */
  persistEmpty?: boolean;
}

export async function resolveAll(
  urls: string[],
  opts: ResolveAllOptions,
): Promise<ResolvedCitationRecord[]> {
  if (!urls.length) return [];
  const concurrency = Math.max(1, opts.concurrency ?? 3);

  // De-duplicate while preserving order. Two callers passing the same
  // URL twice should not double-charge our outbound rate budget.
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    ordered.push(u);
  }

  const results: ResolvedCitationRecord[] = new Array(ordered.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= ordered.length) return;
      const url = ordered[i];
      results[i] = await resolveOne(url, opts);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, ordered.length) }, worker);
  await Promise.all(workers);
  return results;
}

async function resolveOne(
  url: string,
  opts: ResolveAllOptions,
): Promise<ResolvedCitationRecord> {
  try {
    const resolved = await resolveUrlToCitation(url);
    const upsert = await upsertResolvedCitation(resolved, {
      userId: opts.userId,
      persistEmpty: opts.persistEmpty,
    });
    return {
      inputUrl: url,
      canonicalUrl: resolved.canonicalUrl,
      sourceId: upsert?.source.id ?? null,
      doi: resolved.doi,
      title: resolved.source?.title ?? undefined,
      resolvedFrom: resolved.resolvedFrom,
      enrichedBy: resolved.enrichedBy,
      confidence: resolved.confidence,
      durationMs: resolved.durationMs,
      warnings: resolved.warnings,
      archiveUrl: resolved.archiveUrl,
      archiveCapturedAt: resolved.archiveCapturedAt,
      derivedIdentifiers: resolved.derivedIdentifiers,
    };
  } catch (err) {
    return {
      inputUrl: url,
      canonicalUrl: url,
      sourceId: null,
      resolvedFrom: "manual",
      enrichedBy: [],
      confidence: "none",
      durationMs: 0,
      warnings: [err instanceof Error ? err.message : String(err)],
      derivedIdentifiers: {},
    };
  }
}
