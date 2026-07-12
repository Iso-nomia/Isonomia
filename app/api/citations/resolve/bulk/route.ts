/**
 * POST /api/citations/resolve/bulk
 *
 * Phase 7 of docs/AUTO_CITATION_ENGINE_ROADMAP.md.
 *
 * Bulk URL → Source resolver. Two response modes:
 *
 *   • JSON (default): waits for the entire batch and returns a single
 *     `{ results: ResolvedCitationRecord[] }` payload. Use for small
 *     pastes (≤25 URLs) where the caller wants one round-trip.
 *
 *   • SSE (Accept: text/event-stream): streams one `progress` event per
 *     resolved URL, then a final `done` event. Use for stack imports
 *     where the UI shows per-row spinners.
 *
 * Request body:
 *   {
 *     urls: string[],            // 1..200, deduped server-side
 *     concurrency?: number,      // 1..10, default 3
 *     persistEmpty?: boolean,    // default false
 *   }
 *
 * Auth: required. Hard cap 200 URLs/request to keep one user from
 * monopolising the outbound rate-limit budget.
 */

export const runtime = "nodejs";
// SSE requires the Node runtime (not Edge) so we can hold the stream
// open while the resolver waterfall reaches out to Crossref/arXiv/etc.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCitationCallerUserId } from "@/lib/citation/mcpAuth";
import { resolveAll, type ResolvedCitationRecord } from "@/lib/citation/resolveAll";
import { resolveUrlToCitation } from "@/lib/citation/resolve";
import { upsertResolvedCitation } from "@/lib/citation/store";

const Body = z.object({
  urls: z.array(z.string().url()).min(1).max(200),
  concurrency: z.number().int().min(1).max(10).optional(),
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
      {
        error: "Invalid request body",
        details: err instanceof z.ZodError ? err.errors : String(err),
      },
      { status: 400 },
    );
  }

  const accept = req.headers.get("accept") ?? "";
  const wantsSse = accept.includes("text/event-stream");

  if (!wantsSse) {
    const results = await resolveAll(body.urls, {
      userId,
      concurrency: body.concurrency,
      persistEmpty: body.persistEmpty,
    });
    return NextResponse.json({ results, total: results.length });
  }

  // ── SSE branch ────────────────────────────────────────
  // We can't reuse `resolveAll` directly because it returns the full
  // array at the end. Re-implement the same dedup + bounded concurrency
  // here, but emit per-URL events as each one finishes.
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const u of body.urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    ordered.push(u);
  }
  const concurrency = Math.max(1, Math.min(body.concurrency ?? 3, 10));
  const uid = userId;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      send("start", { total: ordered.length });

      let cursor = 0;
      let completed = 0;

      const worker = async () => {
        while (true) {
          const i = cursor++;
          if (i >= ordered.length) return;
          const url = ordered[i];
          let record: ResolvedCitationRecord;
          try {
            const resolved = await resolveUrlToCitation(url);
            const upsert = await upsertResolvedCitation(resolved, {
              userId: uid,
              persistEmpty: body.persistEmpty,
            });
            record = {
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
            record = {
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
          completed += 1;
          send("progress", { index: i, completed, total: ordered.length, record });
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(concurrency, ordered.length) }, worker),
      );
      send("done", { total: ordered.length, completed });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
