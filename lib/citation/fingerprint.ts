import crypto from "node:crypto";

/**
 * Canonicalize and hash a (doi, url, title) triple into a stable
 * deduplication key. Used by Source upsert paths in:
 *   - app/api/sources/route.ts
 *   - app/api/sources/import/route.ts
 *   - app/api/reference-managers/[connectionId]/sync/route.ts
 *
 * Lifted from those three identical copies as part of the Auto-Citation
 * Engine Phase 0 audit (docs/AUTO_CITATION_ENGINE_ROADMAP.md). Behavior
 * MUST remain identical: any change here changes existing Source.fingerprint
 * values and breaks dedup.
 */
export function generateFingerprint(
  url?: string,
  doi?: string,
  title?: string,
): string {
  const canonical = [
    doi?.toLowerCase(),
    url?.toLowerCase().replace(/^https?:\/\//, ""),
    title?.toLowerCase().replace(/[^\w\s]/g, "").trim(),
  ]
    .filter(Boolean)
    .join("|");

  return crypto.createHash("sha1").update(canonical).digest("hex");
}
