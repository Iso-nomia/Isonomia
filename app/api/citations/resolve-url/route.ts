/**
 * POST /api/citations/resolve-url
 *
 * Phase 2 of docs/AUTO_CITATION_ENGINE_ROADMAP.md.
 *
 * Resolve an arbitrary URL to a verified `Source` row. Distinct from the
 * legacy `/api/citations/resolve` endpoint, which is a register-by-ref
 * facade that accepts caller-supplied metadata; this endpoint actually
 * runs the Crossref → Highwire waterfall and persists to `Source`.
 *
 * Request:
 *   { url: string, persistEmpty?: boolean }
 *
 * Response (200):
 *   {
 *     source: { id, title, url, doi } | null,    // null when confidence='none'
 *     resolvedFrom: ResolverSource,
 *     enrichedBy: ResolverSource[],
 *     confidence: "high" | "medium" | "low" | "none",
 *     cached: boolean,                            // hit existing Source row?
 *     durationMs: number,
 *     warnings?: string[],
 *   }
 *
 * Auth: required (citation resolution is rate-limited per user).
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCitationCallerUserId } from "@/lib/citation/mcpAuth";
import { resolveUrlToCitation } from "@/lib/citation/resolve";
import { upsertResolvedCitation } from "@/lib/citation/store";

const Body = z.object({
  url: z.string().url(),
  persistEmpty: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const userId = await resolveCitationCallerUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", details: err instanceof z.ZodError ? err.errors : String(err) },
      { status: 400 },
    );
  }

  const resolved = await resolveUrlToCitation(body.url);

  // Confidence "none" → return the resolver verdict but skip persistence
  // unless the caller explicitly opted in.
  const upsert = await upsertResolvedCitation(resolved, {
    userId,
    persistEmpty: body.persistEmpty,
  });

  // Project the in-flight ResolvedSource onto the chip's render contract.
  // We deliberately don't return everything on Source (abstract is large,
  // raw author JSON has shape variance); the composer only needs what it
  // displays.
  const rs = resolved.source;
  const citation = upsert
    ? {
        sourceId: upsert.source.id,
        title: upsert.source.title,
        doi: upsert.source.doi,
        url: upsert.source.url,
        year: rs?.year ?? null,
        authors: (rs?.authorsJson ?? []).map((a) => ({
          family: a.family ?? null,
          given: a.given ?? null,
        })),
        container: rs?.container ?? null,
        publisher: rs?.publisher ?? null,
        pdfUrl: rs?.pdfUrl ?? null,
      }
    : null;

  return NextResponse.json({
    source: upsert?.source ?? null,
    citation,
    resolvedFrom: resolved.resolvedFrom,
    enrichedBy: resolved.enrichedBy,
    confidence: resolved.confidence,
    cached: upsert?.cached ?? false,
    durationMs: resolved.durationMs,
    warnings: resolved.warnings,
    archiveUrl: resolved.archiveUrl ?? null,
    archiveCapturedAt: resolved.archiveCapturedAt ?? null,
    // Identifiers derived cheaply from the input URL itself, populated
    // even when confidence is "none" — lets callers attach evidence
    // with a known DOI/arXiv id when the publisher 403s.
    derivedIdentifiers: resolved.derivedIdentifiers,
  });
}
