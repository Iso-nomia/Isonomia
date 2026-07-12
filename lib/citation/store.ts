/**
 * Persistence layer for the Auto-Citation Engine.
 *
 * Phase 2 of docs/AUTO_CITATION_ENGINE_ROADMAP.md.
 *
 *   upsertResolvedCitation(resolved, { userId })
 *
 * Lifts a `ResolvedCitation` (the in-flight resolver shape) into a
 * `Source` row by deduplicating on, in priority order:
 *
 *   1. `doi` (Source.doi is @unique)
 *   2. `Source.fingerprint` (sha1 of canonical doi|url|title)
 *   3. `Source.url` (Source.url is @unique)
 *
 * Always writes the resolution-lifecycle bookkeeping fields
 * (`lastResolveAttemptAt`, `resolveError`, `resolverVersion`,
 * `enrichmentSource`, `enrichmentStatus`, `enrichedAt`) so a single
 * follow-up query tells the operator when each Source was last
 * inspected and which adapter produced its metadata.
 *
 * Behaviour notes:
 *
 * - Never overwrites an existing non-null bibliographic field with a
 *   weaker resolution. (We only fill blanks; "high"-confidence
 *   replacements are out of scope for v1.)
 * - On `confidence: "none"`, no Source is created. The caller's URL is
 *   recorded only via the resolver's in-memory cache; persisting a
 *   useless row would pollute search.
 * - The resolver version is read from `RESOLVER_VERSION` so future
 *   schema/regex changes can be diffed against the persisted value.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prismaclient";
import { generateFingerprint } from "@/lib/citation/fingerprint";
import type { ResolvedCitation } from "./resolve/types";

export const RESOLVER_VERSION = "0.1.0";

export interface UpsertOptions {
  /** User the new Source row is attributed to (`Source.createdById`). */
  userId: string;
  /** When true, persists even `confidence: "none"` results as bare URL stubs. */
  persistEmpty?: boolean;
}

export interface UpsertResult {
  source: { id: string; title: string | null; url: string | null; doi: string | null };
  /** True when the resolver matched an existing Source row. */
  cached: boolean;
}

export async function upsertResolvedCitation(
  resolved: ResolvedCitation,
  opts: UpsertOptions,
): Promise<UpsertResult | null> {
  if (resolved.confidence === "none" && !opts.persistEmpty) return null;

  const src = resolved.source;
  const url = resolved.canonicalUrl;
  const doi = resolved.doi ?? src?.identifier?.startsWith("10.") ? resolved.doi ?? src?.identifier : undefined;
  const title = src?.title ?? null;
  const fingerprint = generateFingerprint(url, doi ?? undefined, title ?? undefined);

  // ── Locate any existing Source by DOI → fingerprint → URL ──
  const existing = await prisma.source.findFirst({
    where: {
      OR: [
        ...(doi ? [{ doi }] : []),
        { fingerprint },
        { url },
      ],
    },
    select: {
      id: true,
      title: true,
      url: true,
      doi: true,
      authorsJson: true,
      year: true,
      abstractText: true,
      container: true,
      publisher: true,
      volume: true,
      issue: true,
      pages: true,
      keywords: true,
      pdfUrl: true,
      authorOrcids: true,
      openAlexId: true,
      identifierType: true,
      kind: true,
      enrichmentStatus: true,
      enrichmentSource: true,
      archiveUrl: true,
      archivedAt: true,
    },
  });

  const enrichmentSource = resolved.resolvedFrom;
  const lastResolveAttemptAt = new Date();

  if (existing) {
    // Fill blanks only.
    const fillIfEmpty = <T,>(curr: T | null | undefined, next: T | null | undefined) =>
      curr == null || (Array.isArray(curr) && curr.length === 0) ? next ?? undefined : undefined;

    const data: Prisma.SourceUpdateInput = {
      title: fillIfEmpty(existing.title, src?.title),
      url: fillIfEmpty(existing.url, url),
      doi: fillIfEmpty(existing.doi, doi),
      authorsJson:
        Array.isArray(existing.authorsJson) && existing.authorsJson.length > 0
          ? undefined
          : (src?.authorsJson as Prisma.InputJsonValue | undefined),
      year: fillIfEmpty(existing.year, src?.year),
      abstractText: fillIfEmpty(existing.abstractText, src?.abstractText),
      container: fillIfEmpty(existing.container, src?.container),
      publisher: fillIfEmpty(existing.publisher, src?.publisher),
      volume: fillIfEmpty(existing.volume, src?.volume),
      issue: fillIfEmpty(existing.issue, src?.issue),
      pages: fillIfEmpty(existing.pages, src?.pages),
      keywords:
        existing.keywords?.length ? undefined : (src?.keywords ?? undefined),
      pdfUrl: fillIfEmpty(existing.pdfUrl, src?.pdfUrl),
      authorOrcids:
        existing.authorOrcids?.length ? undefined : (src?.authorOrcids ?? undefined),
      identifierType: fillIfEmpty(existing.identifierType, src?.identifierType),
      kind: existing.kind ?? src?.kind,
      fingerprint, // safe to update; it's just sha1 of dedup tuple
      // Phase 6: Wayback archive snapshot (fill-if-empty)
      archiveUrl: fillIfEmpty(existing.archiveUrl, resolved.archiveUrl),
      archivedAt:
        existing.archivedAt == null && resolved.archiveCapturedAt
          ? new Date(resolved.archiveCapturedAt)
          : undefined,
      // Resolver bookkeeping (always overwritten — they describe the *attempt*).
      lastResolveAttemptAt,
      resolveError: null,
      resolverVersion: RESOLVER_VERSION,
      enrichmentStatus: existing.enrichmentStatus === "enriched" ? undefined : "enriched",
      enrichedAt: new Date(),
      enrichmentSource,
    };
    const updated = await prisma.source.update({
      where: { id: existing.id },
      data,
      select: { id: true, title: true, url: true, doi: true },
    });
    return { source: updated, cached: true };
  }

  // ── Insert ──
  const created = await prisma.source.create({
    data: {
      kind: src?.kind ?? "web",
      title,
      authorsJson: src?.authorsJson as Prisma.InputJsonValue | undefined,
      year: src?.year,
      container: src?.container,
      publisher: src?.publisher,
      volume: src?.volume,
      issue: src?.issue,
      pages: src?.pages,
      doi: doi ?? undefined,
      url,
      identifierType: src?.identifierType,
      openAlexId: undefined,
      authorOrcids: src?.authorOrcids ?? [],
      abstractText: src?.abstractText,
      keywords: src?.keywords ?? [],
      pdfUrl: src?.pdfUrl,
      fingerprint,
      // Phase 6: Wayback archive snapshot
      archiveUrl: resolved.archiveUrl,
      archivedAt: resolved.archiveCapturedAt ? new Date(resolved.archiveCapturedAt) : undefined,
      createdById: opts.userId,
      // Resolver bookkeeping
      lastResolveAttemptAt,
      resolverVersion: RESOLVER_VERSION,
      enrichmentStatus: "enriched",
      enrichedAt: new Date(),
      enrichmentSource,
    },
    select: { id: true, title: true, url: true, doi: true },
  });
  return { source: created, cached: false };
}

/**
 * Record a failed resolution attempt without creating a Source. Useful
 * for the negative-cache / retry-after-24h policy in Phase 8.
 *
 * Currently a no-op for in-memory negative caching; the persisted
 * counterpart is intentionally deferred until we have a per-URL queue
 * worth retrying.
 */
export async function recordResolveFailure(
  _canonicalUrl: string,
  _error: string,
): Promise<void> {
  // Intentional no-op — see docstring.
}
