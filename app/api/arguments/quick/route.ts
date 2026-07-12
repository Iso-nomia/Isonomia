/**
 * POST /api/arguments/quick
 *
 * Phase 2 (Step 2.4 + 2.7): Streamlined argument creation for the
 * "create and immediately share" use case.
 *
 * Creates a Claim + ClaimEvidence records + Argument + permalink in one
 * atomic call. If no deliberationId is supplied, the argument is placed
 * in the user's auto-created "My Arguments" standalone deliberation.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { resolveCitationCallerUserId, isMcpBearer, namespaceForSpeakAs } from "@/lib/citation/mcpAuth";
import { normalizeCoordinates, writeActProvenance } from "@/lib/provenance/coordinates";
import { mintClaimMoid } from "@/lib/ids/mintMoid";
import { getOrCreatePermalink } from "@/lib/citations/permalinkService";
import { isSafePublicUrl, getOrFetchLinkPreview } from "@/lib/unfurl";
import { enrichEvidenceProvenanceInBackground } from "@/lib/citations/evidenceProvenance";
import { enrichDeliberationNameInBackground } from "@/lib/deliberations/autoNameEnrichment";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

// ─── Rate limiter: 20 quick arguments per user per hour ──────────────────────
const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis: redisClient,
  limiter: Ratelimit.fixedWindow(20, "1 h"),
  prefix: "rl:quick_arg",
});

// ─── Input schema ─────────────────────────────────────────────────────────────
const EvidenceItem = z
  .object({
    url: z.string().url(),
    title: z.string().max(500).optional(),
    // `quote` = verbatim excerpt from the source (preferred for direct
    // quotation). `summary` = a paraphrased claim about what the source
    // shows (preferred when recording a position rather than excerpting).
    // Exactly one is typical; if both are provided, `summary` wins.
    // Either form is stored on `ClaimEvidence.citation` so the fitness
    // scorer (which keys on contentSha256, not text) treats them
    // identically.
    quote: z.string().max(2000).optional(),
    summary: z.string().max(2000).optional(),
  })
  .transform((ev) => ({
    ...ev,
    citationText: ev.summary ?? ev.quote,
  }));

const QuickArgSchema = z.object({
  claim: z
    .string()
    .min(1, "Claim is required")
    .max(2000, "Claim must be 2000 characters or fewer")
    .transform((s) => s.replace(/<[^>]*>/g, "").trim()), // strip HTML
  evidence: z.array(EvidenceItem).max(10).optional().default([]),
  reasoning: z
    .string()
    .max(5000)
    .optional()
    .transform((s) => s?.replace(/<[^>]*>/g, "").trim()),
  deliberationId: z.string().optional(),
  isPublic: z.boolean().optional().default(true),
  // §4 dialogical-side capability (MCP-bearer only): author as `mcp-bot:<speakAs>`
  // so the same side can later defend this argument. Ignored for cookie callers.
  speakAs: z.string().min(1).max(64).optional(),
  // N-1 (decorrelated-gating capture): raw independence coordinates of the
  // authoring agent/harness; persisted as an ActProvenance row on the argument.
  coordinates: z.any().optional(),
});

// ─── "My Arguments" deliberation helper (Step 2.7) ───────────────────────────
const MY_ARGUMENTS_HOST_PREFIX = "standalone-my-arguments-";

async function getOrCreateMyArgumentsDeliberation(
  userId: string
): Promise<string> {
  const hostId = `${MY_ARGUMENTS_HOST_PREFIX}${userId}`;
  const existing = await prisma.deliberation.findFirst({
    where: { hostType: "free", hostId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.deliberation.create({
    data: {
      hostType: "free",
      hostId,
      createdById: userId,
      title: "My Arguments",
    },
    select: { id: true },
  });
  return created.id;
}

// ─── Embed code builders ──────────────────────────────────────────────────────
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

function buildEmbedCodes(shortCode: string, claimText: string) {
  const link = `${BASE_URL}/a/${shortCode}`;
  const embedSrc = `${BASE_URL}/embed/argument/${shortCode}?theme=auto`;
  const iframe = `<iframe src="${embedSrc}" width="600" height="400" frameborder="0" allow="clipboard-read; clipboard-write" loading="lazy" title="Isonomia Argument"></iframe>`;
  const truncated =
    claimText.length > 120 ? claimText.slice(0, 120) + "…" : claimText;
  const markdown = `**Claim:** ${claimText}\n\n[View full argument on Isonomia](${link})`;
  const plainText = `CLAIM: ${claimText}\n\nLink: ${link}`;

  return { link, iframe, markdown, plainText };
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Auth — accept either a browser session/Firebase ID token *or*
  // the MCP shared-secret bearer (resolves to `MCP_AUTHOR_USER_ID`,
  // default `"mcp-bot"`). Mirrors the citation-route auth pattern so
  // `propose_argument` works from Claude Desktop / other MCP clients.
  const userId = await resolveCitationCallerUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Bare caller id — rate limiting + "My Arguments" ownership. Authorship id
  // (userIdStr) may be namespaced to a dialogical side after we parse `speakAs`.
  let userIdStr = userId;
  // Track AI-EPI Pt.3 §5 — arguments written via the MCP shared-secret
  // bearer are AI-authored. Standing system holds them at
  // `untested-default` until a human engages.
  const viaMcp = isMcpBearer(req);

  // Rate limit
  const { success: withinLimit } = await ratelimit.limit(userIdStr);
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Rate limit exceeded — max 20 quick arguments per hour" },
      { status: 429 }
    );
  }

  // Parse & validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = QuickArgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { claim, evidence, reasoning, deliberationId, isPublic, speakAs, coordinates } = parsed.data;
  const coords = normalizeCoordinates(coordinates);

  // §4: namespace the authorship id to the dialogical side (MCP-bearer only).
  userIdStr = namespaceForSpeakAs({ isMcpBearer: viaMcp, baseUserId: userId, speakAs });

  // Validate evidence URLs (SSRF guard)
  for (const ev of evidence) {
    if (!isSafePublicUrl(ev.url)) {
      return NextResponse.json(
        { error: `Unsafe or non-public URL: ${ev.url}` },
        { status: 400 }
      );
    }
  }

  // Validate deliberationId if provided
  if (deliberationId) {
    const delib = await prisma.deliberation.findUnique({
      where: { id: deliberationId },
      select: { id: true, createdById: true },
    });
    if (!delib) {
      return NextResponse.json(
        { error: "Deliberation not found" },
        { status: 400 }
      );
    }
  }

  try {
    // Resolve target deliberation
    const targetDelibId =
      deliberationId ?? (await getOrCreateMyArgumentsDeliberation(userId));

    // Generate claim moid
    const moid = mintClaimMoid(claim);

    // Create or find existing claim with this moid
    const claimRecord = await prisma.claim.upsert({
      where: { moid },
      create: {
        text: claim,
        moid,
        createdById: userIdStr,
        deliberationId: targetDelibId,
      },
      update: {}, // claim already exists — reuse it
      select: { id: true, text: true, moid: true },
    });

    // Auto-unfurl evidence titles where not provided (best-effort, non-blocking)
    const enrichedEvidence = await Promise.all(
      evidence.map(async (ev) => {
        if (ev.title) return ev;
        try {
          const preview = await getOrFetchLinkPreview(ev.url);
          return { ...ev, title: preview.title ?? undefined };
        } catch {
          return ev;
        }
      })
    );

    // Track whether async provenance enrichment was kicked off, so the
    // response can advise the caller (e.g. an MCP client) to delay any
    // follow-up `get_argument` read until contentSha256 is populated.
    let provenancePending = false;

    // Create ClaimEvidence records
    if (enrichedEvidence.length > 0) {
      await prisma.claimEvidence.createMany({
        data: enrichedEvidence.map((ev) => ({
          claimId: claimRecord.id,
          uri: ev.url,
          title: ev.title ?? null,
          citation: ev.citationText ?? null,
          addedById: userIdStr,
        })),
        skipDuplicates: true,
      });

      // Track A.4 — fire-and-forget evidence provenance enrichment.
      // Fetches each source URL, hashes the body, captures HTTP metadata,
      // and requests an archive.org snapshot. Persists onto the row.
      // Intentionally NOT awaited — must not block response latency.
      try {
        const created = await prisma.claimEvidence.findMany({
          where: {
            claimId: claimRecord.id,
            uri: { in: enrichedEvidence.map((e) => e.url) },
          },
          select: { id: true },
        });
        enrichEvidenceProvenanceInBackground(created.map((c) => c.id));
        provenancePending = created.length > 0;
      } catch {
        // best-effort; failure here doesn't break the create flow
      }
    }

    // Create the Argument
    const argument = await prisma.argument.create({
      data: {
        deliberationId: targetDelibId,
        authorId: userIdStr,
        text: claim,
        conclusionClaimId: claimRecord.id,
        // If reasoning is provided, store it as the argument text alongside the claim
        ...(reasoning ? { text: reasoning } : {}),
        ...(viaMcp
          ? {
              authorKind: "AI" as const,
              aiProvenance: {
                via: "mcp",
                tool: "propose_argument",
                createdAt: new Date().toISOString(),
                // N-1: continuity copy; the queryable source of truth is the
                // ActProvenance row written just below.
                ...(coords ? { coordinates: coords } : {}),
              },
            }
          : {}),
      },
      select: { id: true, text: true, confidence: true },
    });

    // N-1: capture the author's independence coordinates (best-effort; the
    // argument is already committed above). contextLineageId is unrecoverable
    // if not written at authoring time.
    await writeActProvenance(prisma, "argument", argument.id, {
      ...(coords ?? {}),
      authorKind: viaMcp ? "AI" : "HUMAN",
      capturedVia: viaMcp ? "mcp" : "ui",
    });

    // Fire-and-forget: once a deliberation accumulates content, an LLM pass
    // may upgrade an auto-generated / NULL title to a concise summary name.
    // Self-debouncing and guarded against clobbering human titles (Phase 6).
    enrichDeliberationNameInBackground(targetDelibId);

    // Create ArgumentPermalink
    const permalink = await getOrCreatePermalink(argument.id);

    const embedCodes = buildEmbedCodes(permalink.shortCode, claim);

    return NextResponse.json({
      ok: true,
      argument: {
        id: argument.id,
        text: argument.text,
        confidence: argument.confidence,
      },
      claim: {
        id: claimRecord.id,
        text: claimRecord.text,
        moid: claimRecord.moid,
      },
      permalink: {
        shortCode: permalink.shortCode,
        slug: permalink.slug,
        url: embedCodes.link,
      },
      embedCodes,
      // Track A.4 — surfaces background enrichment to MCP/AI callers so
      // they know fitness will rise after the URL is fetched and hashed.
      provenancePending,
      retryAfterMs: provenancePending ? 60_000 : 0,
    });
  } catch (e: any) {
    console.error("[POST /api/arguments/quick]", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to create argument" },
      { status: 500 }
    );
  }
}
