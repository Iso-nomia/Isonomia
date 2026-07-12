/**
 * Phase 5.1: Service for managing concepts and their cross-field equivalences
 */

import { prisma } from "@/lib/prismaclient";
import { generateEmbedding } from "@/lib/search/claimEmbeddings";
import {
  ConceptSummary,
  ConceptWithEquivalences,
  ConceptEquivalenceProposal,
  ConceptEquivalenceStatus,
  ConceptEquivalenceType,
  EpistemicStyle,
} from "./types";

/**
 * Create a new concept
 */
export async function createConcept(
  userId: string,
  data: {
    name: string;
    definition: string;
    fieldId: string;
    aliases?: string[];
    relatedTerms?: string[];
    keySourceId?: string;
  }
): Promise<ConceptSummary> {
  // Generate embedding for similarity matching
  const embeddingText = `${data.name}: ${data.definition}`;
  const embedding = await generateEmbedding(embeddingText);

  const concept = await prisma.fieldConcept.create({
    data: {
      name: data.name,
      definition: data.definition,
      fieldId: data.fieldId,
      aliases: data.aliases || [],
      relatedTerms: data.relatedTerms || [],
      keySourceId: data.keySourceId,
      embedding,
      createdById: BigInt(userId),
    },
    include: {
      field: true,
      _count: {
        select: { equivalencesAs: true, claims: true },
      },
    },
  });

  return {
    id: concept.id,
    name: concept.name,
    definition: concept.definition,
    fieldId: concept.fieldId,
    fieldName: concept.field.name,
    aliases: concept.aliases,
    equivalenceCount: concept._count.equivalencesAs,
    claimCount: concept._count.claims,
  };
}

/**
 * Get concept with all equivalences
 */
export async function getConceptWithEquivalences(
  conceptId: string
): Promise<ConceptWithEquivalences | null> {
  const concept = await prisma.fieldConcept.findUnique({
    where: { id: conceptId },
    include: {
      field: {
        include: {
          _count: { select: { claims: true, concepts: true } },
        },
      },
      equivalencesAs: {
        include: {
          targetConcept: {
            include: {
              field: true,
              _count: { select: { equivalencesAs: true, claims: true } },
            },
          },
        },
      },
      equivalentTo: {
        include: {
          sourceConcept: {
            include: {
              field: true,
              _count: { select: { equivalencesAs: true, claims: true } },
            },
          },
        },
      },
    },
  });

  if (!concept) return null;

  // Combine both directions of equivalences
  const equivalences = [
    ...concept.equivalencesAs.map((e) => ({
      targetConcept: {
        id: e.targetConcept.id,
        name: e.targetConcept.name,
        definition: e.targetConcept.definition,
        fieldId: e.targetConcept.fieldId,
        fieldName: e.targetConcept.field.name,
        aliases: e.targetConcept.aliases,
        equivalenceCount: e.targetConcept._count.equivalencesAs,
        claimCount: e.targetConcept._count.claims,
      },
      equivalenceType: e.equivalenceType as ConceptEquivalenceType,
      confidence: e.confidence,
      status: e.status as ConceptEquivalenceStatus,
    })),
    ...concept.equivalentTo.map((e) => ({
      targetConcept: {
        id: e.sourceConcept.id,
        name: e.sourceConcept.name,
        definition: e.sourceConcept.definition,
        fieldId: e.sourceConcept.fieldId,
        fieldName: e.sourceConcept.field.name,
        aliases: e.sourceConcept.aliases,
        equivalenceCount: e.sourceConcept._count.equivalencesAs,
        claimCount: e.sourceConcept._count.claims,
      },
      equivalenceType: e.equivalenceType as ConceptEquivalenceType,
      confidence: e.confidence,
      status: e.status as ConceptEquivalenceStatus,
    })),
  ];

  return {
    id: concept.id,
    name: concept.name,
    definition: concept.definition,
    field: {
      id: concept.field.id,
      name: concept.field.name,
      slug: concept.field.slug,
      epistemicStyle: concept.field.epistemicStyle as EpistemicStyle,
      subFieldCount: 0,
      claimCount: concept.field._count.claims,
      conceptCount: concept.field._count.concepts,
    },
    aliases: concept.aliases,
    relatedTerms: concept.relatedTerms,
    equivalences,
  };
}

/**
 * Propose concept equivalence
 */
export async function proposeEquivalence(
  userId: string,
  proposal: ConceptEquivalenceProposal
): Promise<void> {
  // Ensure concepts exist and are from different fields
  const [source, target] = await Promise.all([
    prisma.fieldConcept.findUnique({ where: { id: proposal.sourceConceptId } }),
    prisma.fieldConcept.findUnique({ where: { id: proposal.targetConceptId } }),
  ]);

  if (!source || !target) {
    throw new Error("Concept not found");
  }

  if (source.fieldId === target.fieldId) {
    throw new Error("Concepts must be from different fields");
  }

  await prisma.conceptEquivalence.create({
    data: {
      sourceConceptId: proposal.sourceConceptId,
      targetConceptId: proposal.targetConceptId,
      equivalenceType: proposal.equivalenceType,
      justification: proposal.justification,
      proposedById: BigInt(userId),
      status: "PROPOSED",
    },
  });
}

/**
 * Verify concept equivalence
 */
export async function verifyEquivalence(
  equivalenceId: string,
  userId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Add verifier
    await tx.conceptEquivalence.update({
      where: { id: equivalenceId },
      data: {
        verifiedBy: {
          connect: { id: BigInt(userId) },
        },
        verificationCount: { increment: 1 },
      },
    });

    // Check if verification threshold met (3 verifiers)
    const equivalence = await tx.conceptEquivalence.findUnique({
      where: { id: equivalenceId },
      select: { verificationCount: true },
    });

    if (equivalence && equivalence.verificationCount >= 3) {
      await tx.conceptEquivalence.update({
        where: { id: equivalenceId },
        data: { status: "VERIFIED" },
      });
    }
  });
}

/**
 * Find similar concepts across fields using embeddings
 */
export async function findSimilarConcepts(
  conceptId: string,
  minSimilarity = 0.7
): Promise<Array<{ concept: ConceptSummary; similarity: number }>> {
  const sourceConcept = await prisma.fieldConcept.findUnique({
    where: { id: conceptId },
    select: { embedding: true, fieldId: true },
  });

  if (!sourceConcept || !sourceConcept.embedding || sourceConcept.embedding.length === 0) {
    return [];
  }

  // Find concepts in other fields with similar embeddings
  // Note: In production, use pgvector for efficient similarity search
  const otherConcepts = await prisma.fieldConcept.findMany({
    where: {
      fieldId: { not: sourceConcept.fieldId },
      NOT: { embedding: { isEmpty: true } },
    },
    include: {
      field: true,
      _count: { select: { equivalencesAs: true, claims: true } },
    },
    take: 100, // Limit for performance
  });

  const results: Array<{ concept: ConceptSummary; similarity: number }> = [];

  for (const concept of otherConcepts) {
    if (!concept.embedding || concept.embedding.length === 0) continue;

    const similarity = cosineSimilarity(
      sourceConcept.embedding,
      concept.embedding
    );

    if (similarity >= minSimilarity) {
      results.push({
        concept: {
          id: concept.id,
          name: concept.name,
          definition: concept.definition,
          fieldId: concept.fieldId,
          fieldName: concept.field.name,
          aliases: concept.aliases,
          equivalenceCount: concept._count.equivalencesAs,
          claimCount: concept._count.claims,
        },
        similarity,
      });
    }
  }

  return results.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Get concepts by field
 */
export async function getConceptsByField(
  fieldId: string
): Promise<ConceptSummary[]> {
  const concepts = await prisma.fieldConcept.findMany({
    where: { fieldId },
    include: {
      field: true,
      _count: { select: { equivalencesAs: true, claims: true } },
    },
    orderBy: { name: "asc" },
  });

  return concepts.map((c) => ({
    id: c.id,
    name: c.name,
    definition: c.definition,
    fieldId: c.fieldId,
    fieldName: c.field.name,
    aliases: c.aliases,
    equivalenceCount: c._count.equivalencesAs,
    claimCount: c._count.claims,
  }));
}

/**
 * Search concepts across all fields
 */
export async function searchConcepts(
  query: string,
  fieldId?: string
): Promise<ConceptSummary[]> {
  const concepts = await prisma.fieldConcept.findMany({
    where: {
      AND: [
        fieldId ? { fieldId } : {},
        {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { definition: { contains: query, mode: "insensitive" } },
            { aliases: { has: query } },
          ],
        },
      ],
    },
    include: {
      field: true,
      _count: { select: { equivalencesAs: true, claims: true } },
    },
    take: 30,
  });

  return concepts.map((c) => ({
    id: c.id,
    name: c.name,
    definition: c.definition,
    fieldId: c.fieldId,
    fieldName: c.field.name,
    aliases: c.aliases,
    equivalenceCount: c._count.equivalencesAs,
    claimCount: c._count.claims,
  }));
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
