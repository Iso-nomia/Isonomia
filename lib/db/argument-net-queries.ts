/**
 * Database Access Layer for ArgumentNet (Phase 1.1)
 * 
 * CRUD operations for multi-scheme arguments, scheme instances, dependencies,
 * and scheme net patterns.
 */

import { prisma } from "@/lib/prismaclient";
import type {
  ArgumentWithSchemes,
  ArgumentWithSchemesOptions,
  SchemeRole,
  ExplicitnessLevel,
} from "@/lib/types/argument-net";

// ============================================================================
// Argument Queries
// ============================================================================

/**
 * Get argument with all scheme instances and dependencies
 */
export async function getArgumentWithSchemes(
  argumentId: string,
  options: ArgumentWithSchemesOptions = {}
): Promise<ArgumentWithSchemes | null> {
  const {
    includeScheme = true,
    includeClaim = true,
    includeConclusion = true,
  } = options;

  const arg = await prisma.argument.findUnique({
    where: { id: argumentId },
    include: {
      argumentSchemes: {
        include: {
          scheme: true,
        },
        orderBy: [
          { role: "asc" }, // Primary first, then supporting, presupposed, implicit
          { order: "asc" },
        ],
      },
      ...(includeScheme && { scheme: true }),
      ...(includeClaim && { claim: true }),
      ...(includeConclusion && { conclusion: true }),
    },
  });

  return arg as ArgumentWithSchemes | null;
}

/**
 * Get all arguments for a claim with scheme instances
 */
export async function getClaimArgumentsWithSchemes(
  claimId: string,
  options: ArgumentWithSchemesOptions = {}
): Promise<ArgumentWithSchemes[]> {
  const {
    includeScheme = true,
    includeClaim = false,
    includeConclusion = true,
  } = options;

  const args = await prisma.argument.findMany({
    where: { claimId },
    include: {
      argumentSchemes: {
        include: {
          scheme: true,
        },
        orderBy: [
          { role: "asc" },
          { order: "asc" },
        ],
      },
      ...(includeScheme && { scheme: true }),
      ...(includeClaim && { claim: true }),
      ...(includeConclusion && { conclusion: true }),
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return args as ArgumentWithSchemes[];
}

/**
 * Get all arguments in a deliberation with scheme instances
 */
export async function getDeliberationArgumentsWithSchemes(
  deliberationId: string,
  options: ArgumentWithSchemesOptions = {}
): Promise<ArgumentWithSchemes[]> {
  const {
    includeScheme = true,
    includeClaim = true,
    includeConclusion = true,
  } = options;

  const args = await prisma.argument.findMany({
    where: { deliberationId },
    include: {
      argumentSchemes: {
        include: {
          scheme: true,
        },
        orderBy: [
          { role: "asc" },
          { order: "asc" },
        ],
      },
      ...(includeScheme && { scheme: true }),
      ...(includeClaim && { claim: true }),
      ...(includeConclusion && { conclusion: true }),
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return args as ArgumentWithSchemes[];
}

// ============================================================================
// Scheme Instance Mutations
// ============================================================================

/**
 * Add scheme instance to argument
 */
export async function addSchemeToArgument(
  argumentId: string,
  schemeId: string,
  data: {
    role?: SchemeRole;
    explicitness?: ExplicitnessLevel;
    confidence?: number;
    textEvidence?: string;
    justification?: string;
  } = {}
) {
  const {
    role = "supporting",
    explicitness = "explicit",
    confidence = 1.0,
    textEvidence,
    justification,
  } = data;

  // Get current max order for this role
  const existingInstances = await prisma.argumentSchemeInstance.findMany({
    where: {
      argumentId,
      role,
    },
    orderBy: {
      order: "desc",
    },
    take: 1,
  });

  const nextOrder = existingInstances.length > 0 ? existingInstances[0].order + 1 : 0;

  // Determine isPrimary based on role
  const isPrimary = role === "primary";

  return prisma.argumentSchemeInstance.create({
    data: {
      argumentId,
      schemeId,
      role,
      explicitness,
      order: nextOrder,
      confidence,
      isPrimary,
      textEvidence,
      justification,
    },
    include: {
      scheme: true,
    },
  });
}

/**
 * Remove scheme instance from argument
 */
export async function removeSchemeFromArgument(instanceId: string) {
  return prisma.argumentSchemeInstance.delete({
    where: { id: instanceId },
  });
}

/**
 * Update scheme instance
 */
export async function updateSchemeInstance(
  instanceId: string,
  data: {
    role?: SchemeRole;
    explicitness?: ExplicitnessLevel;
    order?: number;
    confidence?: number;
    textEvidence?: string;
    justification?: string;
  }
) {
  const updateData: any = { ...data };

  // If role is being changed to primary, update isPrimary
  if (data.role) {
    updateData.isPrimary = data.role === "primary";
  }

  return prisma.argumentSchemeInstance.update({
    where: { id: instanceId },
    data: updateData,
    include: {
      scheme: true,
    },
  });
}

/**
 * Reorder scheme instances within a role
 */
export async function reorderSchemeInstances(
  argumentId: string,
  role: SchemeRole,
  instanceIds: string[]
) {
  // Update each instance with its new order
  const updates = instanceIds.map((id, index) =>
    prisma.argumentSchemeInstance.update({
      where: { id },
      data: { order: index },
    })
  );

  return prisma.$transaction(updates);
}

/**
 * Set primary scheme (ensures only one primary per argument)
 */
export async function setPrimaryScheme(
  argumentId: string,
  instanceId: string
) {
  return prisma.$transaction(async (tx) => {
    // Remove primary status from all other instances
    await tx.argumentSchemeInstance.updateMany({
      where: {
        argumentId,
        id: { not: instanceId },
      },
      data: {
        isPrimary: false,
        role: "supporting", // Demote to supporting if currently primary
      },
    });

    // Set this instance as primary
    await tx.argumentSchemeInstance.update({
      where: { id: instanceId },
      data: {
        isPrimary: true,
        role: "primary",
        order: 0,
      },
    });
  });
}

// ============================================================================
// Dependency Mutations
// ============================================================================

/**
 * Add dependency between arguments
 */
export async function addArgumentDependency(
  sourceArgId: string,
  targetArgId: string,
  data: {
    dependencyType: string;
    description?: string;
  }
) {
  return prisma.argumentDependency.create({
    data: {
      sourceArgId,
      targetArgId,
      dependencyType: data.dependencyType,
      description: data.description,
    },
  });
}

/**
 * Add dependency between scheme instances
 */
export async function addSchemeDependency(
  sourceSchemeId: string,
  targetSchemeId: string,
  data: {
    dependencyType: string;
    description?: string;
  }
) {
  return prisma.argumentDependency.create({
    data: {
      sourceSchemeId,
      targetSchemeId,
      dependencyType: data.dependencyType,
      description: data.description,
    },
  });
}

/**
 * Remove dependency
 */
export async function removeDependency(dependencyId: string) {
  return prisma.argumentDependency.delete({
    where: { id: dependencyId },
  });
}

/**
 * Get arguments that depend on this argument
 */
export async function getArgumentDependents(argumentId: string) {
  // Note: explicit relations could be added in schema if needed; for now we
  // just return the IDs and clients can fetch separately.
  return prisma.argumentDependency.findMany({
    where: { targetArgId: argumentId },
  });
}

/**
 * Get arguments this argument depends on
 */
export async function getArgumentDependencies(argumentId: string) {
  // Note: explicit relations could be added in schema if needed.
  return prisma.argumentDependency.findMany({
    where: { sourceArgId: argumentId },
  });
}

/**
 * Get scheme dependencies for an argument
 */
export async function getSchemeDependencies(argumentId: string) {
  // Get all scheme instance IDs for this argument
  const instances = await prisma.argumentSchemeInstance.findMany({
    where: { argumentId },
    select: { id: true },
  });

  const instanceIds = instances.map((i) => i.id);

  return prisma.argumentDependency.findMany({
    where: {
      OR: [
        { sourceSchemeId: { in: instanceIds } },
        { targetSchemeId: { in: instanceIds } },
      ],
    },
  });
}

// ============================================================================
// Scheme Net Pattern Queries
// ============================================================================

/**
 * Get all scheme net patterns
 */
export async function getSchemeNetPatterns(options: {
  domain?: string;
  tags?: string[];
  limit?: number;
} = {}) {
  const { domain, tags, limit } = options;

  return prisma.schemeNetPattern.findMany({
    where: {
      ...(domain && { domain }),
      ...(tags && tags.length > 0 && { tags: { hasSome: tags } }),
    },
    orderBy: {
      usageCount: "desc",
    },
    ...(limit && { take: limit }),
  });
}

/**
 * Get scheme net pattern by ID
 */
export async function getSchemeNetPattern(patternId: string) {
  return prisma.schemeNetPattern.findUnique({
    where: { id: patternId },
  });
}

/**
 * Create scheme net pattern
 */
export async function createSchemeNetPattern(data: {
  name: string;
  description: string;
  domain?: string;
  structure: any; // JSON
  examples?: string[];
  tags?: string[];
}) {
  return prisma.schemeNetPattern.create({
    data: {
      name: data.name,
      description: data.description,
      domain: data.domain,
      structure: data.structure,
      examples: data.examples || [],
      tags: data.tags || [],
      usageCount: 0,
    },
  });
}

/**
 * Increment usage count for pattern
 */
export async function incrementPatternUsage(patternId: string) {
  return prisma.schemeNetPattern.update({
    where: { id: patternId },
    data: {
      usageCount: {
        increment: 1,
      },
    },
  });
}

// ============================================================================
// Statistics Queries
// ============================================================================

/**
 * Get multi-scheme statistics for a deliberation
 */
export async function getMultiSchemeStatistics(deliberationId: string) {
  const args = await prisma.argument.findMany({
    where: { deliberationId },
    include: {
      argumentSchemes: {
        include: {
          scheme: true,
        },
      },
    },
  });

  const totalArguments = args.length;
  const argumentsWithMultipleSchemes = args.filter(
    (arg) => arg.argumentSchemes.length > 1
  ).length;

  const totalSchemeCount = args.reduce(
    (sum, arg) => sum + arg.argumentSchemes.length,
    0
  );
  const averageSchemesPerArgument =
    totalArguments > 0 ? totalSchemeCount / totalArguments : 0;

  // Count scheme usage
  const schemeUsage: Record<string, any> = {};
  args.forEach((arg) => {
    arg.argumentSchemes.forEach((inst) => {
      if (!schemeUsage[inst.schemeId]) {
        schemeUsage[inst.schemeId] = {
          schemeId: inst.schemeId,
          schemeName: inst.scheme.name || "Unnamed",
          count: 0,
          primaryCount: 0,
          supportingCount: 0,
        };
      }
      schemeUsage[inst.schemeId].count++;
      if (inst.role === "primary") {
        schemeUsage[inst.schemeId].primaryCount++;
      } else if (inst.role === "supporting") {
        schemeUsage[inst.schemeId].supportingCount++;
      }
    });
  });

  const mostUsedSchemes = Object.values(schemeUsage).sort(
    (a: any, b: any) => b.count - a.count
  );

  // Role distribution
  const roleDistribution = {
    primary: 0,
    supporting: 0,
    presupposed: 0,
    implicit: 0,
  };

  // Explicitness distribution
  const explicitnessDistribution = {
    explicit: 0,
    presupposed: 0,
    implied: 0,
  };

  args.forEach((arg) => {
    arg.argumentSchemes.forEach((inst) => {
      if (inst.role in roleDistribution) {
        roleDistribution[inst.role as keyof typeof roleDistribution]++;
      }
      if (inst.explicitness in explicitnessDistribution) {
        explicitnessDistribution[
          inst.explicitness as keyof typeof explicitnessDistribution
        ]++;
      }
    });
  });

  return {
    totalArguments,
    argumentsWithMultipleSchemes,
    averageSchemesPerArgument,
    mostUsedSchemes,
    roleDistribution,
    explicitnessDistribution,
  };
}

/**
 * Get most common scheme combinations
 */
export async function getMostCommonSchemeCombinations(
  deliberationId: string,
  limit = 10
) {
  const args = await prisma.argument.findMany({
    where: { deliberationId },
    include: {
      argumentSchemes: {
        include: {
          scheme: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          role: "asc",
        },
      },
    },
  });

  // Group by scheme combination
  const combinations: Record<string, any> = {};

  args.forEach((arg) => {
    if (arg.argumentSchemes.length > 1) {
      const schemeIds = arg.argumentSchemes
        .map((inst) => inst.schemeId)
        .sort()
        .join("|");

      if (!combinations[schemeIds]) {
        combinations[schemeIds] = {
          schemes: arg.argumentSchemes.map((inst) => ({
            id: inst.scheme.id,
            name: inst.scheme.name,
            role: inst.role,
          })),
          count: 0,
        };
      }

      combinations[schemeIds].count++;
    }
  });

  return Object.values(combinations)
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, limit);
}
