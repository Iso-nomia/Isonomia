export const dynamic = "force-dynamic";

/**
 * Source Registration API
 *
 * Phase 1.1: Paper-to-Claim Pipeline
 *
 * Creates source records from DOIs with automatic metadata resolution
 * via Crossref and optional enrichment via OpenAlex.
 *
 * @route POST /api/sources - Create a new source from DOI or manual data
 * @route GET /api/sources - List/search sources
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import { resolveDOI, normalizeDOI, isValidDOI } from "@/lib/integrations/crossref";
import { enrichFromOpenAlex } from "@/lib/integrations/openAlex";
import { onSourceCreated } from "@/lib/triggers/knowledgeGraphTriggers";
import { generateFingerprint } from "@/lib/citation/fingerprint";
import { z } from "zod";

// ─────────────────────────────────────────────────────────
// Request Schemas
// ─────────────────────────────────────────────────────────

const CreateSourceFromDOISchema = z.object({
  doi: z.string().min(1),
  skipEnrichment: z.boolean().optional().default(false),
});

const CreateSourceManualSchema = z.object({
  title: z.string().min(1),
  authors: z.array(z.string()).optional(),
  year: z.number().int().optional(),
  url: z.string().url().optional(),
  container: z.string().optional(),
  publisher: z.string().optional(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.string().optional(),
  abstractText: z.string().optional(),
  kind: z.enum(["article", "book", "web", "dataset", "video", "other"]).optional().default("article"),
});

const CreateSourceSchema = z.union([
  CreateSourceFromDOISchema,
  CreateSourceManualSchema,
]);

// ─────────────────────────────────────────────────────────
// POST: Create Source
// ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    
    // Determine if this is a DOI-based or manual creation
    if (body.doi) {
      return handleDOICreation(body, userId.toString());
    } else if (body.title) {
      return handleManualCreation(body, userId.toString());
    } else {
      return NextResponse.json(
        { error: "Either 'doi' or 'title' is required" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Source creation error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Handle DOI-based source creation with Crossref resolution
 */
async function handleDOICreation(body: unknown, userId: string) {
  const input = CreateSourceFromDOISchema.parse(body);
  
  // Normalize DOI
  const normalizedDOI = normalizeDOI(input.doi);
  if (!normalizedDOI) {
    return NextResponse.json(
      { error: "Invalid DOI format", details: `Could not parse: ${input.doi}` },
      { status: 400 }
    );
  }

  // Check for existing source with this DOI
  const existing = await prisma.source.findUnique({
    where: { doi: normalizedDOI },
    include: {
      claims: {
        take: 10,
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { claims: true } },
    },
  });

  if (existing) {
    return NextResponse.json({
      success: true,
      source: existing,
      created: false,
      message: "Source already exists with this DOI",
    });
  }

  // Resolve DOI via Crossref
  const crossrefData = await resolveDOI(normalizedDOI);
  if (!crossrefData) {
    return NextResponse.json(
      { 
        error: "DOI resolution failed", 
        details: `Could not resolve DOI: ${normalizedDOI}. The DOI may be invalid or Crossref may be temporarily unavailable.` 
      },
      { status: 404 }
    );
  }

  // Build source data
  let sourceData: Record<string, unknown> = {
    doi: crossrefData.identifier,
    identifierType: crossrefData.identifierType,
    title: crossrefData.title,
    authorsJson: crossrefData.authorsJson,
    authorOrcids: crossrefData.authorOrcids,
    year: crossrefData.year,
    abstractText: crossrefData.abstractText,
    container: crossrefData.container,
    volume: crossrefData.volume,
    issue: crossrefData.issue,
    pages: crossrefData.pages,
    publisher: crossrefData.publisher,
    keywords: crossrefData.keywords,
    url: crossrefData.url,
    kind: crossrefData.kind,
    pdfUrl: crossrefData.pdfUrl,
    createdById: userId,
    fingerprint: generateFingerprint(crossrefData.url, normalizedDOI, crossrefData.title),
    enrichmentStatus: "pending",
  };

  // Optionally enrich with OpenAlex
  if (!input.skipEnrichment) {
    const enrichment = await enrichFromOpenAlex(normalizedDOI);
    if (enrichment) {
      sourceData = {
        ...sourceData,
        openAlexId: enrichment.openAlexId,
        abstractText: enrichment.abstract || sourceData.abstractText,
        keywords: enrichment.concepts.length > 0 
          ? enrichment.concepts 
          : (sourceData.keywords as string[]),
        pdfUrl: enrichment.pdfUrl || sourceData.pdfUrl,
        enrichmentStatus: "enriched",
        enrichedAt: new Date(),
        enrichmentSource: "openalex",
      };
    }
  }

  // Create the source
  const source = await prisma.source.create({
    data: sourceData as any,
    include: {
      claims: true,
      _count: { select: { claims: true } },
    },
  });

  // Trigger knowledge graph update
  onSourceCreated(source.id).catch(console.error);

  return NextResponse.json(
    { 
      success: true, 
      source, 
      created: true,
      message: "Source created successfully from DOI",
    },
    { status: 201 }
  );
}

/**
 * Handle manual source creation
 */
async function handleManualCreation(body: unknown, userId: string) {
  const input = CreateSourceManualSchema.parse(body);

  // Build authors JSON from array
  const authorsJson = (input.authors || []).map((name) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      const family = parts.pop()!;
      const given = parts.join(" ");
      return { family, given };
    }
    return { literal: name };
  });

  // Check for existing by URL
  if (input.url) {
    const existing = await prisma.source.findUnique({
      where: { url: input.url },
    });
    if (existing) {
      return NextResponse.json({
        success: true,
        source: existing,
        created: false,
        message: "Source already exists with this URL",
      });
    }
  }

  // Create fingerprint for deduplication
  const fingerprint = generateFingerprint(input.url, undefined, input.title);

  // Check for similar source by fingerprint
  const similarSource = await prisma.source.findFirst({
    where: { fingerprint },
  });
  if (similarSource) {
    return NextResponse.json({
      success: true,
      source: similarSource,
      created: false,
      message: "A similar source already exists",
    });
  }

  const source = await prisma.source.create({
    data: {
      title: input.title,
      authorsJson,
      year: input.year,
      url: input.url,
      container: input.container,
      publisher: input.publisher,
      volume: input.volume,
      issue: input.issue,
      pages: input.pages,
      abstractText: input.abstractText,
      kind: input.kind,
      identifierType: "MANUAL",
      createdById: userId,
      fingerprint,
      enrichmentStatus: "pending",
    },
    include: {
      claims: true,
      _count: { select: { claims: true } },
    },
  });

  // Trigger knowledge graph update
  onSourceCreated(source.id).catch(console.error);

  return NextResponse.json(
    {
      success: true,
      source,
      created: true,
      message: "Source created successfully",
    },
    { status: 201 }
  );
}

// ─────────────────────────────────────────────────────────
// GET: List/Search Sources
// ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const doi = searchParams.get("doi");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const withClaims = searchParams.get("withClaims") === "true";

    // Build where clause
    let where: Record<string, unknown> = {};

    if (doi) {
      // Lookup by DOI
      const normalizedDOI = normalizeDOI(doi);
      if (normalizedDOI) {
        where.doi = normalizedDOI;
      }
    } else if (query) {
      // Full text search on title, container, keywords
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { container: { contains: query, mode: "insensitive" } },
        { keywords: { has: query } },
      ];
    }

    // Execute query
    const [sources, total] = await Promise.all([
      prisma.source.findMany({
        where,
        include: {
          claims: withClaims ? {
            take: 5,
            orderBy: { createdAt: "desc" },
          } : false,
          _count: { select: { claims: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.source.count({ where }),
    ]);

    return NextResponse.json({
      sources,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + sources.length < total,
      },
    });
  } catch (error) {
    console.error("Source list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
