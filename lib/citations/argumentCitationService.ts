/**
 * Service for managing argument citations
 * Phase 3.2: Argument-Level Citations
 */

import { prisma } from "@/lib/prismaclient";
import {
  ArgCitationType,
  ArgumentCitationInput,
  ArgumentCitationSummary,
  ArgumentWithCitations,
  CitationMetrics,
} from "./argumentCitationTypes";

// ============================================================
// CITATION CRUD
// ============================================================

/**
 * Create a citation between arguments
 */
export async function createCitation(
  input: ArgumentCitationInput,
  userId: string
): Promise<ArgumentCitationSummary> {
  const {
    citingArgumentId,
    citedArgumentId,
    citationType,
    annotation,
    citedInContext,
  } = input;

  // Prevent self-citation
  if (citingArgumentId === citedArgumentId) {
    throw new Error("Cannot cite the same argument");
  }

  // Verify both arguments exist
  const [citingArg, citedArg] = await Promise.all([
    prisma.argument.findUnique({
      where: { id: citingArgumentId },
      include: { deliberation: { select: { title: true } } },
    }),
    prisma.argument.findUnique({
      where: { id: citedArgumentId },
      include: { deliberation: { select: { title: true } } },
    }),
  ]);

  if (!citingArg) {
    throw new Error(`Citing argument not found: ${citingArgumentId}`);
  }
  if (!citedArg) {
    throw new Error(`Cited argument not found: ${citedArgumentId}`);
  }

  // Check for duplicate citation
  const existing = await prisma.argumentCitation.findUnique({
    where: {
      citingArgumentId_citedArgumentId: {
        citingArgumentId,
        citedArgumentId,
      },
    },
  });

  if (existing) {
    throw new Error("Citation already exists between these arguments");
  }

  // Create citation
  const citation = await prisma.argumentCitation.create({
    data: {
      citingArgumentId,
      citedArgumentId,
      citationType,
      annotation,
      citedInContext: citedInContext || undefined,
      createdById: userId,
    },
    include: {
      citingArgument: {
        include: { deliberation: { select: { title: true } } },
      },
      citedArgument: {
        include: { deliberation: { select: { title: true } } },
      },
    },
  });

  // Update metrics for cited argument (fire and forget)
  updateCitationMetrics(citedArgumentId).catch(() => {});

  return formatCitationSummary(citation);
}

/**
 * Get a citation by ID
 */
export async function getCitation(
  citationId: string
): Promise<ArgumentCitationSummary | null> {
  const citation = await prisma.argumentCitation.findUnique({
    where: { id: citationId },
    include: {
      citingArgument: {
        include: { deliberation: { select: { title: true } } },
      },
      citedArgument: {
        include: { deliberation: { select: { title: true } } },
      },
    },
  });

  if (!citation) return null;
  return formatCitationSummary(citation);
}

/**
 * Delete a citation
 */
export async function deleteCitation(
  citationId: string,
  userId: string
): Promise<void> {
  const citation = await prisma.argumentCitation.findUnique({
    where: { id: citationId },
  });

  if (!citation) {
    throw new Error(`Citation not found: ${citationId}`);
  }

  // Only creator can delete
  if (citation.createdById !== userId) {
    throw new Error("Not authorized to delete this citation");
  }

  await prisma.argumentCitation.delete({
    where: { id: citationId },
  });

  // Update metrics for cited argument
  updateCitationMetrics(citation.citedArgumentId).catch(() => {});
}

/**
 * Update citation annotation
 */
export async function updateCitationAnnotation(
  citationId: string,
  annotation: string | null,
  userId: string
): Promise<ArgumentCitationSummary> {
  const citation = await prisma.argumentCitation.findUnique({
    where: { id: citationId },
  });

  if (!citation) {
    throw new Error(`Citation not found: ${citationId}`);
  }

  if (citation.createdById !== userId) {
    throw new Error("Not authorized to update this citation");
  }

  const updated = await prisma.argumentCitation.update({
    where: { id: citationId },
    data: { annotation },
    include: {
      citingArgument: {
        include: { deliberation: { select: { title: true } } },
      },
      citedArgument: {
        include: { deliberation: { select: { title: true } } },
      },
    },
  });

  return formatCitationSummary(updated);
}

// ============================================================
// CITATION QUERIES
// ============================================================

/**
 * Get all citations for an argument (both made and received)
 */
export async function getArgumentCitations(
  argumentId: string
): Promise<ArgumentWithCitations | null> {
  const argument = await prisma.argument.findUnique({
    where: { id: argumentId },
    include: {
      citationsMade: {
        include: {
          citedArgument: {
            include: { deliberation: { select: { title: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      citationsReceived: {
        include: {
          citingArgument: {
            include: { deliberation: { select: { title: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      permalink: true,
      citationMetrics: true,
    },
  });

  if (!argument) return null;

  return {
    id: argument.id,
    text: argument.text,
    authorId: argument.authorId,
    deliberationId: argument.deliberationId,
    citationsMade: argument.citationsMade.map((c) => ({
      id: c.id,
      citingArgumentId: c.citingArgumentId,
      citedArgumentId: c.citedArgumentId,
      citationType: c.citationType as ArgCitationType,
      annotation: c.annotation,
      citedInContext: c.citedInContext as any,
      createdById: c.createdById,
      createdAt: c.createdAt,
      citedArgument: {
        id: c.citedArgument.id,
        text: c.citedArgument.text,
        authorId: c.citedArgument.authorId,
        deliberationId: c.citedArgument.deliberationId,
        deliberationTitle: c.citedArgument.deliberation.title ?? undefined,
      },
    })),
    citationsReceived: argument.citationsReceived.map((c) => ({
      id: c.id,
      citingArgumentId: c.citingArgumentId,
      citedArgumentId: c.citedArgumentId,
      citationType: c.citationType as ArgCitationType,
      annotation: c.annotation,
      citedInContext: c.citedInContext as any,
      createdById: c.createdById,
      createdAt: c.createdAt,
      citingArgument: {
        id: c.citingArgument.id,
        text: c.citingArgument.text,
        authorId: c.citingArgument.authorId,
        deliberationId: c.citingArgument.deliberationId,
        deliberationTitle: c.citingArgument.deliberation.title ?? undefined,
      },
    })),
    permalink: argument.permalink
      ? {
          shortCode: argument.permalink.shortCode,
          slug: argument.permalink.slug,
          fullUrl: argument.permalink.permalinkUrl,
          version: argument.permalink.version,
          accessCount: argument.permalink.accessCount,
          createdAt: argument.permalink.createdAt,
        }
      : null,
    metrics: argument.citationMetrics
      ? {
          totalCitations: argument.citationMetrics.totalCitations,
          supportCitations: argument.citationMetrics.supportCitations,
          extensionCitations: argument.citationMetrics.extensionCitations,
          contrastCitations: argument.citationMetrics.contrastCitations,
          rebuttalCitations: argument.citationMetrics.rebuttalCitations,
          externalCitations: argument.citationMetrics.externalCitations,
          selfCitations: argument.citationMetrics.selfCitations,
          lastCalculatedAt: argument.citationMetrics.lastCalculatedAt,
        }
      : null,
  };
}

/**
 * Get citations received by an argument, grouped by type
 */
export async function getCitationsByType(
  argumentId: string
): Promise<Record<ArgCitationType, ArgumentCitationSummary[]>> {
  const citations = await prisma.argumentCitation.findMany({
    where: { citedArgumentId: argumentId },
    include: {
      citingArgument: {
        include: { deliberation: { select: { title: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const grouped: Record<ArgCitationType, ArgumentCitationSummary[]> = {
    SUPPORT: [],
    EXTENSION: [],
    APPLICATION: [],
    CONTRAST: [],
    REBUTTAL: [],
    REFINEMENT: [],
    METHODOLOGY: [],
    CRITIQUE: [],
  };

  for (const citation of citations) {
    const summary = formatCitationSummary(citation);
    grouped[citation.citationType as ArgCitationType].push(summary);
  }

  return grouped;
}

/**
 * Get most cited arguments across the platform
 */
export async function getMostCitedArguments(
  limit: number = 20,
  deliberationId?: string
): Promise<Array<{ argumentId: string; text: string; totalCitations: number }>> {
  const where = deliberationId
    ? { argument: { deliberationId } }
    : {};

  const metrics = await prisma.argumentCitationMetrics.findMany({
    where,
    orderBy: { totalCitations: "desc" },
    take: limit,
    include: {
      argument: {
        select: { id: true, text: true },
      },
    },
  });

  return metrics.map((m) => ({
    argumentId: m.argument.id,
    text: m.argument.text,
    totalCitations: m.totalCitations,
  }));
}

// ============================================================
// METRICS
// ============================================================

/**
 * Update or create citation metrics for an argument
 */
export async function updateCitationMetrics(
  argumentId: string
): Promise<CitationMetrics> {
  const argument = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: { authorId: true, deliberationId: true },
  });

  if (!argument) {
    throw new Error(`Argument not found: ${argumentId}`);
  }

  // Get all citations received
  const citations = await prisma.argumentCitation.findMany({
    where: { citedArgumentId: argumentId },
    include: {
      citingArgument: {
        select: { authorId: true, deliberationId: true },
      },
    },
  });

  // Calculate metrics
  let supportCitations = 0;
  let extensionCitations = 0;
  let contrastCitations = 0;
  let rebuttalCitations = 0;
  let externalCitations = 0;
  let selfCitations = 0;

  for (const citation of citations) {
    // Count by type
    switch (citation.citationType) {
      case "SUPPORT":
        supportCitations++;
        break;
      case "EXTENSION":
      case "APPLICATION":
      case "REFINEMENT":
      case "METHODOLOGY":
        extensionCitations++;
        break;
      case "CONTRAST":
        contrastCitations++;
        break;
      case "REBUTTAL":
      case "CRITIQUE":
        rebuttalCitations++;
        break;
    }

    // External citations (from different deliberation)
    if (citation.citingArgument.deliberationId !== argument.deliberationId) {
      externalCitations++;
    }

    // Self citations (same author)
    if (citation.citingArgument.authorId === argument.authorId) {
      selfCitations++;
    }
  }

  // Upsert metrics
  const metrics = await prisma.argumentCitationMetrics.upsert({
    where: { argumentId },
    create: {
      argumentId,
      totalCitations: citations.length,
      supportCitations,
      extensionCitations,
      contrastCitations,
      rebuttalCitations,
      externalCitations,
      selfCitations,
      lastCalculatedAt: new Date(),
    },
    update: {
      totalCitations: citations.length,
      supportCitations,
      extensionCitations,
      contrastCitations,
      rebuttalCitations,
      externalCitations,
      selfCitations,
      lastCalculatedAt: new Date(),
    },
  });

  return {
    totalCitations: metrics.totalCitations,
    supportCitations: metrics.supportCitations,
    extensionCitations: metrics.extensionCitations,
    contrastCitations: metrics.contrastCitations,
    rebuttalCitations: metrics.rebuttalCitations,
    externalCitations: metrics.externalCitations,
    selfCitations: metrics.selfCitations,
    lastCalculatedAt: metrics.lastCalculatedAt,
  };
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Format citation database record for API response
 */
function formatCitationSummary(citation: any): ArgumentCitationSummary {
  return {
    id: citation.id,
    citingArgumentId: citation.citingArgumentId,
    citedArgumentId: citation.citedArgumentId,
    citationType: citation.citationType as ArgCitationType,
    annotation: citation.annotation,
    citedInContext: citation.citedInContext,
    createdById: citation.createdById,
    createdAt: citation.createdAt,
    citingArgument: citation.citingArgument
      ? {
          id: citation.citingArgument.id,
          text: citation.citingArgument.text,
          authorId: citation.citingArgument.authorId,
          deliberationId: citation.citingArgument.deliberationId,
          deliberationTitle: citation.citingArgument.deliberation?.title,
        }
      : undefined,
    citedArgument: citation.citedArgument
      ? {
          id: citation.citedArgument.id,
          text: citation.citedArgument.text,
          authorId: citation.citedArgument.authorId,
          deliberationId: citation.citedArgument.deliberationId,
          deliberationTitle: citation.citedArgument.deliberation?.title,
        }
      : undefined,
  };
}
