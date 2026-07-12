/**
 * lib/sources/sourceProvenance.ts
 *
 * Source-level provenance enrichment: fetch the URL, hash the body, request
 * an archive.org snapshot, and persist the result on the `Source` row.
 *
 * Mirrors `lib/citations/evidenceProvenance.ts` (which targets `ClaimEvidence`
 * rows) but operates on `Source` rows so we can pre-seed an evidence corpus
 * (B2) before any claims/arguments exist.
 *
 * Never throws. Errors are recorded on the row's `archiveError` field where
 * applicable; callers should use `enrichSourceProvenanceInBackground` to
 * detach enrichment from the request lifetime.
 */

import { prisma } from "@/lib/prismaclient";
import {
  fetchEvidenceProvenance,
  lookupExistingArchive,
  requestArchiveSnapshot,
} from "@/lib/citations/evidenceProvenance";

export type SourceProvenanceResult = {
  contentHash: string | null;
  archiveUrl: string | null;
  archivedAt: Date | null;
  error: string | null;
};

/**
 * Enrich a single Source row. Skips when `force=false` (default) and the
 * row already has a `contentHash`.
 */
export async function enrichSourceProvenance(
  sourceId: string,
  opts: { force?: boolean; archive?: boolean } = {}
): Promise<SourceProvenanceResult | null> {
  const force = opts.force ?? false;
  const archive = opts.archive ?? true;

  const row = await prisma.source.findUnique({
    where: { id: sourceId },
    select: { id: true, url: true, contentHash: true },
  });
  if (!row) return null;
  if (!row.url) return null;
  if (!force && row.contentHash) return null;

  const fetched = await fetchEvidenceProvenance(row.url);

  let archived: Awaited<ReturnType<typeof requestArchiveSnapshot>> = {
    archivedUrl: null,
    archivedAt: null,
    error: null,
  };
  if (archive && fetched.ok) {
    archived = await requestArchiveSnapshot(row.url);
    if (!archived.archivedUrl) {
      const fallback = await lookupExistingArchive(row.url);
      if (fallback.archivedUrl) archived = fallback;
    }
  }

  const merged: SourceProvenanceResult = {
    contentHash: fetched.contentSha256,
    archiveUrl: archived.archivedUrl,
    archivedAt: archived.archivedAt,
    error: fetched.error || archived.error,
  };

  try {
    await prisma.source.update({
      where: { id: sourceId },
      data: {
        contentHash: merged.contentHash,
        archiveUrl: merged.archiveUrl,
        archivedAt: merged.archivedAt,
        archiveStatus: merged.archiveUrl ? "archived" : merged.error ? "failed" : "none",
        archiveError: merged.error,
        lastCheckedAt: new Date(),
        verificationStatus: fetched.ok ? "verified" : fetched.error ? "unavailable" : "unverified",
        httpStatus: fetched.httpStatus ?? undefined,
      },
    });
  } catch {
    // Persistence failure is non-fatal; will retry on next access.
  }

  return merged;
}

/**
 * Fire-and-forget batch enrichment. Caller MUST NOT await the return value.
 */
export function enrichSourceProvenanceInBackground(
  sourceIds: string[],
  opts: { force?: boolean; archive?: boolean } = {}
): void {
  if (!sourceIds.length) return;
  void Promise.allSettled(sourceIds.map((id) => enrichSourceProvenance(id, opts))).catch(() => {});
}
