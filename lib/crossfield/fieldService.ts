/**
 * Phase 5.1: Service for managing academic field taxonomy
 */

import { prisma } from "@/lib/prismaclient";
import {
  AcademicFieldSummary,
  EpistemicStyle,
  FieldHierarchy,
  FieldRelationType,
  FieldWithRelations,
} from "./types";

/**
 * Get all top-level fields
 */
export async function getTopLevelFields(): Promise<AcademicFieldSummary[]> {
  const fields = await prisma.academicField.findMany({
    where: { parentFieldId: null },
    include: {
      _count: {
        select: {
          subFields: true,
          claims: true,
          concepts: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return fields.map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    description: f.description || undefined,
    epistemicStyle: f.epistemicStyle as EpistemicStyle,
    subFieldCount: f._count.subFields,
    claimCount: f._count.claims,
    conceptCount: f._count.concepts,
  }));
}

/**
 * Get field hierarchy (tree structure)
 */
export async function getFieldHierarchy(): Promise<FieldHierarchy[]> {
  const allFields = await prisma.academicField.findMany({
    orderBy: { name: "asc" },
  });

  // Build tree
  const fieldMap = new Map<string, FieldHierarchy>();
  const roots: FieldHierarchy[] = [];

  // First pass: create nodes
  allFields.forEach((f) => {
    fieldMap.set(f.id, {
      id: f.id,
      name: f.name,
      slug: f.slug,
      epistemicStyle: f.epistemicStyle as EpistemicStyle,
      children: [],
    });
  });

  // Second pass: build tree
  allFields.forEach((f) => {
    const node = fieldMap.get(f.id)!;
    if (f.parentFieldId) {
      const parent = fieldMap.get(f.parentFieldId);
      if (parent) {
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  return roots;
}

/**
 * Get field with all relationships
 */
export async function getFieldWithRelations(
  fieldId: string
): Promise<FieldWithRelations | null> {
  const field = await prisma.academicField.findUnique({
    where: { id: fieldId },
    include: {
      parentField: true,
      subFields: {
        include: {
          _count: { select: { claims: true, concepts: true } },
        },
      },
      relatedFields: {
        include: {
          targetField: {
            include: {
              _count: { select: { claims: true, concepts: true } },
            },
          },
        },
      },
    },
  });

  if (!field) return null;

  return {
    id: field.id,
    name: field.name,
    slug: field.slug,
    description: field.description || undefined,
    epistemicStyle: field.epistemicStyle as EpistemicStyle,
    aliases: field.aliases,
    keyTerms: field.keyTerms,
    parent: field.parentField
      ? {
          id: field.parentField.id,
          name: field.parentField.name,
          slug: field.parentField.slug,
          epistemicStyle: field.parentField.epistemicStyle as EpistemicStyle,
          subFieldCount: 0,
          claimCount: 0,
          conceptCount: 0,
        }
      : undefined,
    subFields: field.subFields.map((sf) => ({
      id: sf.id,
      name: sf.name,
      slug: sf.slug,
      epistemicStyle: sf.epistemicStyle as EpistemicStyle,
      subFieldCount: 0,
      claimCount: sf._count.claims,
      conceptCount: sf._count.concepts,
    })),
    relatedFields: field.relatedFields.map((r) => ({
      field: {
        id: r.targetField.id,
        name: r.targetField.name,
        slug: r.targetField.slug,
        epistemicStyle: r.targetField.epistemicStyle as EpistemicStyle,
        subFieldCount: 0,
        claimCount: r.targetField._count.claims,
        conceptCount: r.targetField._count.concepts,
      },
      relationType: r.relationType as FieldRelationType,
      strength: r.strength,
    })),
  };
}

/**
 * Create a new academic field
 */
export async function createField(data: {
  name: string;
  description?: string;
  parentFieldId?: string;
  aliases?: string[];
  keyTerms?: string[];
  epistemicStyle?: EpistemicStyle;
}): Promise<AcademicFieldSummary> {
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const field = await prisma.academicField.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      parentFieldId: data.parentFieldId,
      aliases: data.aliases || [],
      keyTerms: data.keyTerms || [],
      epistemicStyle: data.epistemicStyle || "MIXED",
    },
    include: {
      _count: {
        select: { subFields: true, claims: true, concepts: true },
      },
    },
  });

  return {
    id: field.id,
    name: field.name,
    slug: field.slug,
    description: field.description || undefined,
    epistemicStyle: field.epistemicStyle as EpistemicStyle,
    subFieldCount: field._count.subFields,
    claimCount: field._count.claims,
    conceptCount: field._count.concepts,
  };
}

/**
 * Add relationship between fields
 */
export async function addFieldRelation(
  sourceFieldId: string,
  targetFieldId: string,
  relationType: FieldRelationType,
  strength = 0.5
): Promise<void> {
  await prisma.fieldRelation.upsert({
    where: {
      sourceFieldId_targetFieldId: {
        sourceFieldId,
        targetFieldId,
      },
    },
    create: {
      sourceFieldId,
      targetFieldId,
      relationType,
      strength,
    },
    update: {
      relationType,
      strength,
    },
  });

  // Create reverse relationship if complementary/overlapping
  if (relationType === "OVERLAPPING" || relationType === "COMPLEMENTARY") {
    await prisma.fieldRelation.upsert({
      where: {
        sourceFieldId_targetFieldId: {
          sourceFieldId: targetFieldId,
          targetFieldId: sourceFieldId,
        },
      },
      create: {
        sourceFieldId: targetFieldId,
        targetFieldId: sourceFieldId,
        relationType,
        strength,
      },
      update: {
        relationType,
        strength,
      },
    });
  }
}

/**
 * Search fields by name or alias
 */
export async function searchFields(query: string): Promise<AcademicFieldSummary[]> {
  const fields = await prisma.academicField.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { aliases: { has: query } },
        { keyTerms: { hasSome: query.split(" ") } },
      ],
    },
    include: {
      _count: {
        select: { subFields: true, claims: true, concepts: true },
      },
    },
    take: 20,
  });

  return fields.map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    description: f.description || undefined,
    epistemicStyle: f.epistemicStyle as EpistemicStyle,
    subFieldCount: f._count.subFields,
    claimCount: f._count.claims,
    conceptCount: f._count.concepts,
  }));
}

/**
 * Get fields associated with a set of claims
 */
export async function getFieldsForClaims(
  claimIds: string[]
): Promise<Map<string, AcademicFieldSummary[]>> {
  const claims = await prisma.claim.findMany({
    where: { id: { in: claimIds } },
    include: { academicField: true },
  });

  const result = new Map<string, AcademicFieldSummary[]>();

  claims.forEach((claim) => {
    if (claim.academicField) {
      const existing = result.get(claim.id) || [];
      existing.push({
        id: claim.academicField.id,
        name: claim.academicField.name,
        slug: claim.academicField.slug,
        epistemicStyle: claim.academicField.epistemicStyle as EpistemicStyle,
        subFieldCount: 0,
        claimCount: 0,
        conceptCount: 0,
      });
      result.set(claim.id, existing);
    }
  });

  return result;
}

/**
 * Get a field by slug
 */
export async function getFieldBySlug(
  slug: string
): Promise<AcademicFieldSummary | null> {
  const field = await prisma.academicField.findUnique({
    where: { slug },
    include: {
      _count: {
        select: { subFields: true, claims: true, concepts: true },
      },
    },
  });

  if (!field) return null;

  return {
    id: field.id,
    name: field.name,
    slug: field.slug,
    description: field.description || undefined,
    epistemicStyle: field.epistemicStyle as EpistemicStyle,
    subFieldCount: field._count.subFields,
    claimCount: field._count.claims,
    conceptCount: field._count.concepts,
  };
}
