/**
 * OpenAlex enrichment adapter for the Auto-Citation Engine.
 *
 * Phase 3 of docs/AUTO_CITATION_ENGINE_ROADMAP.md.
 *
 * Wraps the existing `enrichFromOpenAlex(doi)` helper from
 * `lib/integrations/openAlex.ts` and projects its output onto the
 * fields of `ResolvedSource` that may still be empty after Crossref:
 *
 *   - `abstractText`  (Crossref rarely carries abstracts)
 *   - `keywords`      (concepts + topics)
 *   - `pdfUrl`        (open-access PDF link)
 *   - `url`           (OA landing page when no other URL is set)
 *
 * Crossref-supplied fields are never overwritten; OpenAlex is purely
 * additive enrichment on top of an authoritative DOI hit.
 */

import { acquireHostToken } from "./rateLimit";
import { enrichFromOpenAlex } from "@/lib/integrations/openAlex";
import type { ResolvedSource } from "@/lib/integrations/crossref";

export interface OpenAlexEnrichResult {
  source: ResolvedSource;
  /** Whether at least one field on `source` was filled by this call. */
  changed: boolean;
}

/**
 * Enrich a Crossref-resolved Source with OpenAlex metadata. Returns the
 * same shape with additive fields. Returns `null` only if OpenAlex is
 * outright unreachable; missing optional fields produce `changed:false`.
 */
export async function enrichSourceWithOpenAlex(
  source: ResolvedSource,
  doi: string,
): Promise<OpenAlexEnrichResult | null> {
  const ok = await acquireHostToken("https://api.openalex.org");
  if (!ok) return null;

  const enrichment = await enrichFromOpenAlex(doi);
  if (!enrichment) return null;

  const next: ResolvedSource = { ...source };
  let changed = false;

  if (!next.abstractText && enrichment.abstract) {
    next.abstractText = enrichment.abstract;
    changed = true;
  }

  // Merge concepts + topics into keywords without duplication.
  if (enrichment.concepts.length || enrichment.topics.length) {
    const have = new Set((next.keywords ?? []).map((k) => k.toLowerCase()));
    const merged = [...(next.keywords ?? [])];
    for (const k of [...enrichment.concepts, ...enrichment.topics]) {
      if (!have.has(k.toLowerCase())) {
        merged.push(k);
        have.add(k.toLowerCase());
      }
    }
    if (merged.length !== (next.keywords?.length ?? 0)) {
      next.keywords = merged;
      changed = true;
    }
  }

  if (!next.pdfUrl && enrichment.pdfUrl) {
    next.pdfUrl = enrichment.pdfUrl;
    changed = true;
  }

  if (!next.url && enrichment.oaUrl) {
    next.url = enrichment.oaUrl;
    changed = true;
  }

  return { source: next, changed };
}
