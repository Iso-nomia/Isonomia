export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { compileFromMoves, ScopingStrategy } from "@/packages/ludics-engine/compileFromMoves";
import { syncLudicsToAif } from "@/lib/ludics/syncToAif";
import { invalidateInsightsCache } from "@/lib/ludics/insightsCache";
import { resolveCitationCallerUserId, isMcpBearer } from "@/lib/citation/mcpAuth";
import { rateLimit } from "@/lib/rateLimit";
import { z } from "zod";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const zBody = z.object({
  deliberationId: z.string(),
  scopingStrategy: z.custom<ScopingStrategy>().optional(),
  forceRecompile: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  // Auth: cookie/Firebase first, then MCP shared-secret bearer — so the MCP
  // `compile_deliberation` tool can force a synchronous refresh of the derived
  // Ludics view without a session cookie. A compile wipes+recreates every design
  // for the deliberation, so it must not be anonymous.
  const baseUserId = await resolveCitationCallerUserId(req);
  if (!baseUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, ...NO_STORE });
  }

  const parsed = zBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400, ...NO_STORE },
    );
  }

  const { deliberationId, scopingStrategy, forceRecompile } = parsed.data;

  // Rate limit MCP-bearer compiles only (Q5: 6/h — a compile is expensive,
  // wipe-and-recreate on every design; discourage hammering). Human/cookie
  // callers (the web compile button) are unaffected. Keyed on the bare bearer
  // identity so all MCP callers share the bucket (like /api/ca).
  const mcp = isMcpBearer(req);
  if (mcp) {
    const ok = await rateLimit(baseUserId, { max: 6, window: "1 h" }, "rl:mcp_compile");
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "Rate limit exceeded — max 6 MCP compiles per hour", code: "COMPILE_RATE_LIMITED" },
        { status: 429, ...NO_STORE },
      );
    }
  }

  const startedAt = Date.now();
  try {
    // Compile with specified strategy (defaults to 'legacy' for backward compatibility)
    const result = await compileFromMoves(deliberationId as string, {
      scopingStrategy: scopingStrategy ?? "legacy",
      forceRecompile: forceRecompile ?? true,
    });

    // Refresh the derived AIF graph + invalidate insights caches so an explicit
    // compile leaves the whole derived view consistent, not just LudicDesign.
    // Best-effort (mirrors /api/dialogue/move + /api/ca): the compile itself is
    // already committed; a sync/cache failure must not 500 the response.
    await syncLudicsToAif(deliberationId).catch((err) => {
      console.error("[ludics/compile] Failed to sync to AIF:", err);
    });
    await invalidateInsightsCache(deliberationId).catch((err) => {
      console.error("[ludics/compile] Failed to invalidate insights cache:", err);
    });

    const tookMs = Date.now() - startedAt;
    console.log("[ludics/compile] compiled", {
      deliberationId,
      designCount: result.designs.length,
      tookMs,
      via: mcp ? "mcp" : "web",
    });

    return NextResponse.json(
      {
        ok: true,
        designs: result.designs,
        designCount: result.designs.length,
        scopingStrategy: scopingStrategy ?? "legacy",
        tookMs,
      },
      NO_STORE,
    );
  } catch (error: any) {
    console.error("Error compiling ludics designs:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "compilation failed" },
      { status: 500, ...NO_STORE },
    );
  }
}
