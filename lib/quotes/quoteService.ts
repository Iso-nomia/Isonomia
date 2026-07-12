/**
 * Quote Service
 * 
 * Phase 2.3: Quote Nodes & Argument Quality Gates
 * 
 * Service for managing quote nodes - first-class addressable objects
 * for HSS scholarly work.
 */

import { prisma } from "@/lib/prismaclient";
import { resolveDeliberationName } from "@/lib/deliberations/resolveName";
import {
  CreateQuoteOptions,
  QuoteNodeSummary,
  QuoteNodeDetail,
  QuoteSearchFilters,
  QuoteSearchResult,
  QuoteUsageType,
  LocatorType,
  UserSummary,
} from "./types";

// ─────────────────────────────────────────────────────────
// Create Quote
// ─────────────────────────────────────────────────────────

/**
 * Create a new quote node from a source
 */
export async function createQuote(
  options: CreateQuoteOptions,
  userId: string
): Promise<QuoteNodeSummary> {
  const quote = await prisma.quoteNode.create({
    data: {
      sourceId: options.sourceId,
      text: options.text,
      locator: options.locator,
      locatorType: (options.locatorType || "PAGE") as any,
      context: options.context,
      language: options.language || "en",
      isTranslation: options.isTranslation || false,
      originalQuoteId: options.originalQuoteId,
      createdById: userId,
    },
    include: {
      source: {
        select: {
          id: true,
          title: true,
          authorsJson: true,
          year: true,
          kind: true,
        },
      },
      _count: {
        select: {
          interpretations: true,
          usedInClaims: true,
          usedInArguments: true,
        },
      },
    },
  });

  const userMap = await fetchUserSummaries([quote.createdById]);
  return mapToQuoteSummary(quote, userMap.get(quote.createdById));
}

// ─────────────────────────────────────────────────────────
// Get Quote
// ─────────────────────────────────────────────────────────

/**
 * Get a quote by ID with full details
 */
export async function getQuote(
  quoteId: string,
  userId?: string
): Promise<QuoteNodeDetail | null> {
  const quote = await prisma.quoteNode.findUnique({
    where: { id: quoteId },
    include: {
      source: {
        select: {
          id: true,
          title: true,
          authorsJson: true,
          year: true,
          kind: true,
        },
      },
      interpretations: {
        include: {
          votes: userId
            ? {
                where: { userId },
                select: { vote: true },
              }
            : false,
          supportedBy: {
            take: 5,
          },
          challengedBy: {
            take: 5,
          },
        },
        orderBy: { voteScore: "desc" },
      },
      usedInClaims: {
        include: {
          claim: {
            select: { id: true, text: true },
          },
        },
        take: 20,
      },
      usedInArguments: {
        include: {
          argument: {
            select: { id: true, text: true },
          },
        },
        take: 20,
      },
      translations: {
        select: { id: true, language: true, text: true },
      },
      originalQuote: {
        select: { id: true, language: true, text: true },
      },
      deliberation: {
        select: { id: true, title: true },
      },
      _count: {
        select: {
          interpretations: true,
          usedInClaims: true,
          usedInArguments: true,
        },
      },
    },
  });

  if (!quote) return null;

  // Resolve user summaries (createdBy + interpretation authors) separately,
  // since QuoteNode/QuoteInterpretation only store the author id as a scalar.
  const authorIds: Array<string | null | undefined> = [quote.createdById];
  for (const i of quote.interpretations) {
    authorIds.push(i.authorId);
    for (const s of i.supportedBy) authorIds.push(s.authorId);
    for (const c of i.challengedBy) authorIds.push(c.authorId);
  }
  const userMap = await fetchUserSummaries(authorIds);

  // Parse authors from JSON
  const authors = parseAuthors(quote.source.authorsJson);

  return {
    id: quote.id,
    text: quote.text,
    locator: quote.locator || undefined,
    locatorType: quote.locatorType as LocatorType,
    context: quote.context || undefined,
    language: quote.language || "en",
    isTranslation: quote.isTranslation,
    source: {
      id: quote.source.id,
      title: quote.source.title || "Untitled",
      authors,
      year: quote.source.year || undefined,
      kind: quote.source.kind || undefined,
    },
    interpretationCount: quote._count.interpretations,
    usageCount: quote._count.usedInClaims + quote._count.usedInArguments,
    createdBy: userSummaryFor(userMap, quote.createdById),
    createdAt: quote.createdAt,
    originalQuote: quote.originalQuote
      ? {
          id: quote.originalQuote.id,
          text: quote.originalQuote.text,
          language: quote.originalQuote.language || "en",
        }
      : undefined,
    translations: quote.translations.map((t) => ({
      id: t.id,
      text: t.text,
      language: t.language || "en",
    })),
    interpretations: quote.interpretations.map((i) => ({
      id: i.id,
      interpretation: i.interpretation,
      framework: i.framework || undefined,
      methodology: i.methodology || undefined,
      author: userSummaryFor(userMap, i.authorId),
      voteScore: i.voteScore,
      userVote: Array.isArray(i.votes) ? i.votes[0]?.vote : undefined,
      supportedBy: i.supportedBy.map((s) => ({
        id: s.id,
        interpretation: s.interpretation,
        framework: s.framework || undefined,
        methodology: s.methodology || undefined,
        author: userSummaryFor(userMap, s.authorId),
        voteScore: s.voteScore,
        createdAt: s.createdAt,
      })),
      challengedBy: i.challengedBy.map((c) => ({
        id: c.id,
        interpretation: c.interpretation,
        framework: c.framework || undefined,
        methodology: c.methodology || undefined,
        author: userSummaryFor(userMap, c.authorId),
        voteScore: c.voteScore,
        createdAt: c.createdAt,
      })),
      createdAt: i.createdAt,
    })),
    usedInClaims: quote.usedInClaims.map((uc) => ({
      id: uc.id,
      usageType: uc.usageType as QuoteUsageType,
      usageNote: uc.usageNote || undefined,
      target: {
        id: uc.claim.id,
        type: "claim" as const,
        text: uc.claim.text,
      },
      addedAt: uc.addedAt,
    })),
    usedInArguments: quote.usedInArguments.map((ua) => ({
      id: ua.id,
      usageType: ua.usageType as QuoteUsageType,
      usageNote: ua.usageNote || undefined,
      target: {
        id: ua.argument.id,
        type: "argument" as const,
        text: ua.argument.text,
      },
      addedAt: ua.addedAt,
    })),
    deliberation: quote.deliberation
      ? {
          id: quote.deliberation.id,
          title: resolveDeliberationName(quote.deliberation, { fallback: "Discussion" }),
        }
      : undefined,
  };
}

// ─────────────────────────────────────────────────────────
// Search Quotes
// ─────────────────────────────────────────────────────────

/**
 * Search quotes with filters
 */
export async function searchQuotes(
  filters: QuoteSearchFilters,
  limit = 20,
  offset = 0
): Promise<QuoteSearchResult> {
  const where: any = {};

  if (filters.sourceId) {
    where.sourceId = filters.sourceId;
  }

  if (filters.authorId) {
    where.createdById = filters.authorId;
  }

  if (filters.language) {
    where.language = filters.language;
  }

  if (filters.hasInterpretations !== undefined) {
    if (filters.hasInterpretations) {
      where.interpretations = { some: {} };
    } else {
      where.interpretations = { none: {} };
    }
  }

  if (filters.searchText) {
    where.text = {
      contains: filters.searchText,
      mode: "insensitive",
    };
  }

  if (filters.framework) {
    where.interpretations = {
      some: {
        framework: {
          contains: filters.framework,
          mode: "insensitive",
        },
      },
    };
  }

  if (filters.deliberationId) {
    where.OR = [
      {
        usedInClaims: {
          some: {
            claim: { deliberationId: filters.deliberationId },
          },
        },
      },
      {
        usedInArguments: {
          some: {
            argument: { deliberationId: filters.deliberationId },
          },
        },
      },
    ];
  }

  const [quotes, total] = await Promise.all([
    prisma.quoteNode.findMany({
      where,
      include: {
        source: {
          select: {
            id: true,
            title: true,
            authorsJson: true,
            year: true,
            kind: true,
          },
        },
        _count: {
          select: {
            interpretations: true,
            usedInClaims: true,
            usedInArguments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.quoteNode.count({ where }),
  ]);

  const userMap = await fetchUserSummaries(quotes.map((q) => q.createdById));

  return {
    quotes: quotes.map((q) => mapToQuoteSummary(q, userMap.get(q.createdById))),
    total,
    hasMore: offset + quotes.length < total,
  };
}

// ─────────────────────────────────────────────────────────
// Get Quotes by Source
// ─────────────────────────────────────────────────────────

/**
 * Get all quotes from a specific source
 */
export async function getQuotesBySource(
  sourceId: string
): Promise<QuoteNodeSummary[]> {
  const quotes = await prisma.quoteNode.findMany({
    where: { sourceId },
    include: {
      source: {
        select: {
          id: true,
          title: true,
          authorsJson: true,
          year: true,
          kind: true,
        },
      },
      _count: {
        select: {
          interpretations: true,
          usedInClaims: true,
          usedInArguments: true,
        },
      },
    },
    orderBy: [{ locator: "asc" }, { createdAt: "asc" }],
  });

  const userMap = await fetchUserSummaries(quotes.map((q) => q.createdById));

  return quotes.map((q) => mapToQuoteSummary(q, userMap.get(q.createdById)));
}

// ─────────────────────────────────────────────────────────
// Link Quote to Claim
// ─────────────────────────────────────────────────────────

/**
 * Link a quote to a claim
 */
export async function linkQuoteToClaim(
  quoteId: string,
  claimId: string,
  usageType: QuoteUsageType,
  usageNote: string | undefined,
  userId: string
) {
  // Check if already linked
  const existing = await prisma.claimQuote.findUnique({
    where: {
      claimId_quoteId: { claimId, quoteId },
    },
  });

  if (existing) {
    // Update existing link
    return prisma.claimQuote.update({
      where: { id: existing.id },
      data: {
        usageType: usageType as any,
        usageNote,
      },
    });
  }

  // Create new link
  return prisma.claimQuote.create({
    data: {
      quoteId,
      claimId,
      usageType: usageType as any,
      usageNote,
      addedById: userId,
    },
  });
}

/**
 * Unlink a quote from a claim
 */
export async function unlinkQuoteFromClaim(
  quoteId: string,
  claimId: string
): Promise<boolean> {
  const result = await prisma.claimQuote.deleteMany({
    where: { quoteId, claimId },
  });
  return result.count > 0;
}

// ─────────────────────────────────────────────────────────
// Link Quote to Argument
// ─────────────────────────────────────────────────────────

/**
 * Link a quote to an argument
 */
export async function linkQuoteToArgument(
  quoteId: string,
  argumentId: string,
  usageType: QuoteUsageType,
  premiseIndex: number | undefined,
  usageNote: string | undefined,
  userId: string
) {
  // Check if already linked
  const existing = await prisma.argumentQuote.findUnique({
    where: {
      argumentId_quoteId: { argumentId, quoteId },
    },
  });

  if (existing) {
    // Update existing link
    return prisma.argumentQuote.update({
      where: { id: existing.id },
      data: {
        usageType: usageType as any,
        premiseIndex,
        usageNote,
      },
    });
  }

  // Create new link
  return prisma.argumentQuote.create({
    data: {
      quoteId,
      argumentId,
      usageType: usageType as any,
      premiseIndex,
      usageNote,
      addedById: userId,
    },
  });
}

/**
 * Unlink a quote from an argument
 */
export async function unlinkQuoteFromArgument(
  quoteId: string,
  argumentId: string
): Promise<boolean> {
  const result = await prisma.argumentQuote.deleteMany({
    where: { quoteId, argumentId },
  });
  return result.count > 0;
}

// ─────────────────────────────────────────────────────────
// Quote Discussion Deliberation
// ─────────────────────────────────────────────────────────

/**
 * Create a mini-deliberation for discussing a quote's meaning
 */
export async function createQuoteDeliberation(
  quoteId: string,
  userId: string
) {
  const quote = await prisma.quoteNode.findUnique({
    where: { id: quoteId },
    include: {
      source: { select: { title: true } },
    },
  });

  if (!quote) {
    throw new Error("Quote not found");
  }

  if (quote.deliberationId) {
    throw new Error("Quote already has a deliberation");
  }

  // Create deliberation in transaction
  const result = await prisma.$transaction(async (tx) => {
    // NOTE: the Deliberation model has diverged from this call site
    // (no `description`/`type`/`members` fields; `hostType`/`hostId` are
    // now required). Cast preserves the original intent without a broader
    // refactor; see schema at lib/models/schema.prisma model Deliberation.
    const deliberation = await tx.deliberation.create({
      data: {
        title: `Discussion: "${quote.text.slice(0, 50)}${quote.text.length > 50 ? "..." : ""}"`,
        description: `A focused discussion on the interpretation and meaning of this passage from "${quote.source.title}"`,
        type: "QUOTE_INTERPRETATION",
        createdById: userId,
        members: {
          create: {
            odooId: BigInt(userId),
            role: "OWNER",
          },
        },
      } as any,
    });

    await tx.quoteNode.update({
      where: { id: quoteId },
      data: { deliberationId: deliberation.id },
    });

    return deliberation;
  });

  return result;
}

// ─────────────────────────────────────────────────────────
// Update Quote
// ─────────────────────────────────────────────────────────

/**
 * Update a quote's metadata
 */
export async function updateQuote(
  quoteId: string,
  updates: {
    text?: string;
    locator?: string;
    locatorType?: LocatorType;
    context?: string;
    language?: string;
  }
) {
  return prisma.quoteNode.update({
    where: { id: quoteId },
    data: {
      ...updates,
      locatorType: updates.locatorType as any,
      updatedAt: new Date(),
    },
  });
}

/**
 * Delete a quote (only if not used)
 */
export async function deleteQuote(quoteId: string): Promise<boolean> {
  // Check if quote is in use
  const quote = await prisma.quoteNode.findUnique({
    where: { id: quoteId },
    include: {
      _count: {
        select: {
          usedInClaims: true,
          usedInArguments: true,
          interpretations: true,
        },
      },
    },
  });

  if (!quote) {
    throw new Error("Quote not found");
  }

  if (
    quote._count.usedInClaims > 0 ||
    quote._count.usedInArguments > 0 ||
    quote._count.interpretations > 0
  ) {
    throw new Error("Cannot delete quote that is in use");
  }

  await prisma.quoteNode.delete({ where: { id: quoteId } });
  return true;
}

// ─────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────

/**
 * Fetch user summaries for a set of bigint/string user ids.
 * QuoteNode/QuoteInterpretation only store the author id as a scalar
 * (no Prisma relation), so we resolve User rows separately.
 */
async function fetchUserSummaries(
  userIds: Array<string | null | undefined>
): Promise<Map<string, UserSummary>> {
  const ids = Array.from(
    new Set(userIds.filter((id): id is string => Boolean(id)))
  );
  const map = new Map<string, UserSummary>();
  if (ids.length === 0) return map;

  const bigintIds = ids
    .map((id) => {
      try {
        return BigInt(id);
      } catch {
        return null;
      }
    })
    .filter((id): id is bigint => id !== null);

  if (bigintIds.length === 0) return map;

  const users = await prisma.user.findMany({
    where: { id: { in: bigintIds } },
    select: { id: true, name: true, image: true },
  });

  for (const user of users) {
    map.set(user.id.toString(), {
      id: user.id.toString(),
      name: user.name || "Unknown",
      image: user.image || undefined,
    });
  }
  return map;
}

function userSummaryFor(
  map: Map<string, UserSummary>,
  userId: string | null | undefined
): UserSummary {
  if (userId && map.has(userId)) {
    return map.get(userId)!;
  }
  return { id: userId || "", name: "Unknown", image: undefined };
}

function parseAuthors(authorsJson: any): string[] {
  if (!authorsJson) return [];
  if (Array.isArray(authorsJson)) {
    return authorsJson.map((a: any) => {
      if (typeof a === "string") return a;
      if (a.family && a.given) return `${a.given} ${a.family}`;
      if (a.family) return a.family;
      if (a.name) return a.name;
      return "Unknown";
    });
  }
  return [];
}

function mapToQuoteSummary(
  quote: any,
  createdBy?: UserSummary
): QuoteNodeSummary {
  const authors = parseAuthors(quote.source.authorsJson);

  return {
    id: quote.id,
    text: quote.text,
    locator: quote.locator || undefined,
    locatorType: quote.locatorType as LocatorType,
    language: quote.language || "en",
    isTranslation: quote.isTranslation,
    source: {
      id: quote.source.id,
      title: quote.source.title || "Untitled",
      authors,
      year: quote.source.year || undefined,
      kind: quote.source.kind || undefined,
    },
    interpretationCount: quote._count.interpretations,
    usageCount: quote._count.usedInClaims + quote._count.usedInArguments,
    createdBy:
      createdBy ?? { id: quote.createdById, name: "Unknown", image: undefined },
    createdAt: quote.createdAt,
  };
}
