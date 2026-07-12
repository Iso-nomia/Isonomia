// lib/arguments/structure-import.ts
/**
 * Argument Structure Import/Export Utilities
 * 
 * Handles extraction and reconstruction of Toulmin argument structures
 * for cross-deliberation imports. Preserves statements, inferences, premises,
 * and evidence links while remapping claim IDs via the transport functor.
 */

import { prisma } from "@/lib/prismaclient";
import { markArgumentAsComposed } from "@/lib/arguments/detect-composition";

// ============================================================================
// Types
// ============================================================================

export type ArgumentStructure = {
  title?: string | null;
  statements: {
    id: string;
    text: string;
    role: string;
    tags: string[];
  }[];
  inferences: {
    id: string;
    kind: string;
    conclusionId: string;
    premiseIds: string[];
    schemeKey?: string | null;
    cqKeys: string[];
  }[];
  evidence: {
    uri?: string | null;
    note?: string | null;
  }[];
  // Premise arguments (for recursive import)
  premiseArguments?: string[];
};

// ============================================================================
// Extract Structure from Source Argument
// ============================================================================

/**
 * Extracts complete argument structure from source deliberation.
 * Includes Toulmin diagram (statements, inferences, premises) and evidence.
 * 
 * @param argumentId - Source argument ID
 * @param deliberationId - Source deliberation ID (for validation)
 * @returns Complete argument structure or null if not found
 */
export async function extractArgumentStructure(
  argumentId: string,
  deliberationId: string
): Promise<ArgumentStructure | null> {
  // Fetch argument with debateNodes to find diagramId
  const arg = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: {
      id: true,
      deliberationId: true,
      debateNodes: {
        select: {
          diagramId: true,
        },
      },
    },
  });

  if (!arg || arg.deliberationId !== deliberationId) {
    return null;
  }

  // Find the first debateNode with a diagramId
  const diagramId = arg.debateNodes.find((n) => n.diagramId)?.diagramId;
  if (!diagramId) {
    return null;
  }

  // Fetch the ArgumentDiagram
  const diagram = await prisma.argumentDiagram.findUnique({
    where: { id: diagramId },
    select: {
      id: true,
      title: true,
      statements: {
        select: {
          id: true,
          text: true,
          role: true,
          tags: true,
        },
      },
      inferences: {
        select: {
          id: true,
          kind: true,
          conclusionId: true,
          schemeKey: true,
          cqKeys: true,
          premises: {
            select: {
              statementId: true,
            },
          },
        },
      },
      evidence: {
        select: {
          uri: true,
          note: true,
        },
      },
    },
  });

  if (!diagram) {
    return null;
  }

  // Find premise arguments - FIXED: Query ConflictApplication instead of ArgumentEdge
  // ArgumentEdge is legacy/empty - attack data lives in the AIF system
  // For support relationships, we need to find arguments that this argument builds upon
  // This is typically stored in ArgumentPremise links or referenced in the diagram itself
  
  // Get all premise claims for this argument
  const premiseClaimIds = await prisma.argumentPremise.findMany({
    where: { argumentId },
    select: { claimId: true }
  });
  
  // Find arguments that have these claims as their conclusions
  // (i.e., arguments that support this one)
  const premiseArguments = await prisma.argument.findMany({
    where: {
      deliberationId,
      claimId: { in: premiseClaimIds.map(p => p.claimId) }
    },
    select: { id: true }
  });

  return {
    title: diagram.title,
    statements: diagram.statements.map((s) => ({
      id: s.id,
      text: s.text,
      role: s.role,
      tags: s.tags,
    })),
    inferences: diagram.inferences.map((inf) => ({
      id: inf.id,
      kind: inf.kind,
      conclusionId: inf.conclusionId,
      premiseIds: inf.premises.map((p) => p.statementId),
      schemeKey: inf.schemeKey,
      cqKeys: inf.cqKeys,
    })),
    evidence: diagram.evidence.map((e) => ({
      uri: e.uri,
      note: e.note,
    })),
    premiseArguments: premiseArguments.map(a => a.id),
  };
}

// ============================================================================
// Reconstruct Structure in Target Deliberation
// ============================================================================

export type ClaimMapping = Record<string, string>; // fromClaimId -> toClaimId

/**
 * Reconstructs argument structure in target deliberation with remapped claim IDs.
 * Creates new ArgumentDiagram with all statements, inferences, and evidence.
 * 
 * @param structure - Source argument structure
 * @param targetDeliberationId - Target deliberation ID
 * @param targetClaimId - Target claim ID for conclusion
 * @param claimMapping - Claim ID mapping (fromClaimId -> toClaimId)
 * @param createdById - User ID creating the import
 * @returns Created argument ID and diagram ID
 */
export async function reconstructArgumentStructure(
  structure: ArgumentStructure,
  targetDeliberationId: string,
  targetClaimId: string,
  claimMapping: ClaimMapping,
  createdById: string
): Promise<{ argumentId: string; diagramId: string }> {
  // Create new ArgumentDiagram with statements
  const diagram = await prisma.argumentDiagram.create({
    data: {
      title: structure.title,
      createdById,
      statements: {
        create: structure.statements.map((s) => ({
          text: s.text,
          role: s.role as any,
          tags: s.tags,
        })),
      },
    },
    select: {
      id: true,
      statements: {
        select: { id: true, text: true },
      },
    },
  });

  // Build mapping: old statement ID -> new statement ID (by text match)
  const textToNewId = new Map<string, string>(
    diagram.statements.map((s) => [s.text, s.id])
  );
  const oldToNewId = new Map<string, string>();
  for (const oldStmt of structure.statements) {
    const newId = textToNewId.get(oldStmt.text);
    if (newId) {
      oldToNewId.set(oldStmt.id, newId);
    }
  }

  // Create inferences with remapped statement IDs
  for (const inf of structure.inferences) {
    const newConclusionId = oldToNewId.get(inf.conclusionId);
    if (!newConclusionId) continue;

    const newInf = await prisma.inference.create({
      data: {
        diagramId: diagram.id,
        kind: inf.kind as any,
        conclusionId: newConclusionId,
        schemeKey: inf.schemeKey,
        cqKeys: inf.cqKeys,
      },
      select: { id: true },
    });

    // Create premise links
    const premiseData = inf.premiseIds
      .map((oldPremId) => {
        const newPremId = oldToNewId.get(oldPremId);
        return newPremId
          ? { inferenceId: newInf.id, statementId: newPremId }
          : null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    if (premiseData.length > 0) {
      await prisma.inferencePremise.createMany({
        data: premiseData,
        skipDuplicates: true,
      });
    }
  }

  // Create evidence links
  if (structure.evidence.length > 0) {
    await prisma.evidenceLink.createMany({
      data: structure.evidence
        .filter((e) => e.uri != null)
        .map((e) => ({
          diagramId: diagram.id,
          uri: e.uri!,
          note: e.note ?? null,
        })),
      skipDuplicates: true,
    });
  }

  // Create argument in target deliberation
  const argument = await prisma.argument.create({
    data: {
      deliberationId: targetDeliberationId,
      claimId: targetClaimId,
      text: structure.title || "Imported argument",
      authorId: createdById,
      isImplicit: false,
    },
    select: { id: true },
  });

  // Create DebateNode linking argument to diagram
  await prisma.debateNode.create({
    data: {
      sheetId: targetDeliberationId, // Assuming deliberation has a related sheet
      argumentId: argument.id,
      diagramId: diagram.id,
      title: structure.title,
    },
  });

  return {
    argumentId: argument.id,
    diagramId: diagram.id,
  };
}

// ============================================================================
// Recursive Import Utilities
// ============================================================================

/**
 * Recursively imports premise arguments up to specified depth.
 * Creates ArgumentEdge (type='support') for dependencies.
 * 
 * @param premiseArgumentIds - Premise argument IDs from source
 * @param sourceDeliberationId - Source deliberation ID
 * @param targetDeliberationId - Target deliberation ID
 * @param targetArgumentId - Target argument ID (depends on premises)
 * @param claimMapping - Claim ID mapping
 * @param createdById - User ID
 * @param currentDepth - Current recursion depth
 * @param maxDepth - Maximum recursion depth (default 3)
 * @returns Imported premise argument IDs
 */
export async function recursivelyImportPremises(
  premiseArgumentIds: string[],
  sourceDeliberationId: string,
  targetDeliberationId: string,
  targetArgumentId: string,
  claimMapping: ClaimMapping,
  createdById: string,
  currentDepth: number = 1,
  maxDepth: number = 3
): Promise<string[]> {
  if (currentDepth > maxDepth || premiseArgumentIds.length === 0) {
    return [];
  }

  const importedIds: string[] = [];

  for (const premArgId of premiseArgumentIds) {
    // Extract premise argument structure
    const structure = await extractArgumentStructure(
      premArgId,
      sourceDeliberationId
    );

    if (!structure) continue;

    // Get premise argument's claim
    const premArg = await prisma.argument.findUnique({
      where: { id: premArgId },
      select: { claimId: true },
    });

    if (!premArg?.claimId) continue;

    // Map claim ID
    const targetPremiseClaimId = claimMapping[premArg.claimId];
    if (!targetPremiseClaimId) continue;

    // Reconstruct in target
    const { argumentId: newPremiseArgId } = await reconstructArgumentStructure(
      structure,
      targetDeliberationId,
      targetPremiseClaimId,
      claimMapping,
      createdById
    );

    importedIds.push(newPremiseArgId);

    // NOTE: Support relationships in the new system should be implicit through
    // ArgumentPremise links (premise claims that are conclusions of other arguments)
    // ArgumentEdge is legacy/empty. If we need explicit support edges in the future,
    // consider using ConflictApplication with a "SUPPORTS" type or a new table.
    
    // For now, the support relationship is captured by:
    // 1. The premise claim in targetArgumentId references targetPremiseClaimId
    // 2. newPremiseArgId has targetPremiseClaimId as its conclusion
    // This creates an implicit support chain that can be traversed via claim links

    // Recursively import nested premises
    if (structure.premiseArguments && structure.premiseArguments.length > 0) {
      await recursivelyImportPremises(
        structure.premiseArguments,
        sourceDeliberationId,
        targetDeliberationId,
        newPremiseArgId,
        claimMapping,
        createdById,
        currentDepth + 1,
        maxDepth
      );
    }
  }

  // NEW (Phase 2): Mark parent argument as composed if premises were imported
  if (importedIds.length > 0) {
    await markArgumentAsComposed(targetArgumentId, "Composed via recursive premise import");
  }

  return importedIds;
}
