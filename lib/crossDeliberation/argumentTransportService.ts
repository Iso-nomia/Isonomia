/**
 * Phase 3.3: Argument Transport Service
 * Handles importing arguments from one deliberation to another
 * with full provenance tracking and attribution.
 * 
 * Adapts to the existing ArgumentImport model (Plexus/functor design)
 * by using the new academic fields (importType, importReason, etc.)
 */

import { prisma } from "@/lib/prismaclient";
import crypto from "crypto";
import { ArgumentImportInput, ArgumentImportResult, ImportType } from "./types";

// ─────────────────────────────────────────────────────────
// Argument Import
// ─────────────────────────────────────────────────────────

/**
 * Import an argument from one deliberation to another.
 * Creates a new argument in the target deliberation with full provenance.
 */
export async function importArgument(
  input: ArgumentImportInput,
  userId: string
): Promise<ArgumentImportResult> {
  const {
    sourceArgumentId,
    targetDeliberationId,
    importType,
    importReason,
    preserveAttribution = true,
    modifications,
  } = input;

  // Fetch the source argument with all related data
  const sourceArg = await prisma.argument.findUnique({
    where: { id: sourceArgumentId },
    include: {
      premises: {
        include: {
          claim: { select: { id: true, text: true } },
        },
      },
      conclusion: { select: { id: true, text: true } },
      deliberation: { select: { id: true, title: true } },
    },
  });

  if (!sourceArg) {
    throw new Error("Source argument not found");
  }

  // Verify target deliberation exists
  const targetDelib = await prisma.deliberation.findUnique({
    where: { id: targetDeliberationId },
  });

  if (!targetDelib) {
    throw new Error("Target deliberation not found");
  }

  // Prevent importing into same deliberation
  if (sourceArg.deliberationId === targetDeliberationId) {
    throw new Error("Cannot import argument into its own deliberation");
  }

  // Build the imported argument based on import type
  const wasModified = !!(
    modifications?.newConclusion ||
    modifications?.excludePremises?.length ||
    modifications?.addPremises?.length
  );

  const result = await prisma.$transaction(async (tx) => {
    // Determine argument text based on import type
    let argText = sourceArg.text;
    if (importType === "SKELETON") {
      argText = `[Imported structure from "${sourceArg.deliberation.title}"]`;
    } else if (importType === "REFERENCE") {
      argText = `[Reference] ${sourceArg.text.substring(0, 200)}...`;
    }

    if (modifications?.newConclusion && importType !== "REFERENCE") {
      argText = modifications.newConclusion;
    }

    // Create the imported argument in the target deliberation
    const newArgument = await tx.argument.create({
      data: {
        deliberationId: targetDeliberationId,
        authorId: preserveAttribution ? sourceArg.authorId : userId,
        text: argText,
        sources: sourceArg.sources as any,
        confidence: sourceArg.confidence,
        schemeId: importType === "FULL" || importType === "SKELETON" ? sourceArg.schemeId : null,
      },
    });

    // Create premises if importing full or premises-only
    const linkedClaims: string[] = [];

    if (importType === "FULL" || importType === "PREMISES_ONLY") {
      const premisesToImport = sourceArg.premises.filter((p) => {
        if (modifications?.excludePremises?.includes(p.claimId)) {
          return false;
        }
        return true;
      });

      for (const premise of premisesToImport) {
        // Create a new claim in the target deliberation
        const newClaim = await tx.claim.create({
          data: {
            text: premise.claim.text,
            createdById: preserveAttribution ? sourceArg.authorId : userId,
            moid: `imported-${crypto.randomBytes(8).toString("hex")}`,
            deliberationId: targetDeliberationId,
          },
        });

        await tx.argumentPremise.create({
          data: {
            argumentId: newArgument.id,
            claimId: newClaim.id,
            isImplicit: premise.isImplicit,
          },
        });

        linkedClaims.push(newClaim.id);
      }

      // Add any new premises
      if (modifications?.addPremises) {
        for (const premiseText of modifications.addPremises) {
          const newClaim = await tx.claim.create({
            data: {
              text: premiseText,
              createdById: userId,
              moid: `added-${crypto.randomBytes(8).toString("hex")}`,
              deliberationId: targetDeliberationId,
            },
          });

          await tx.argumentPremise.create({
            data: {
              argumentId: newArgument.id,
              claimId: newClaim.id,
            },
          });

          linkedClaims.push(newClaim.id);
        }
      }
    }

    // Handle conclusion for FULL import
    if (importType === "FULL" && sourceArg.conclusion && !modifications?.newConclusion) {
      const newConclusion = await tx.claim.create({
        data: {
          text: sourceArg.conclusion.text,
          createdById: preserveAttribution ? sourceArg.authorId : userId,
          moid: `imported-concl-${crypto.randomBytes(8).toString("hex")}`,
          deliberationId: targetDeliberationId,
        },
      });

      await tx.argument.update({
        where: { id: newArgument.id },
        data: { conclusionClaimId: newConclusion.id },
      });

      linkedClaims.push(newConclusion.id);
    }

    // Create the import provenance record using the existing ArgumentImport model
    const fingerprint = crypto
      .createHash("sha1")
      .update(
        `${sourceArg.deliberationId}|${targetDeliberationId}|${sourceArgumentId}|${importType}`
      )
      .digest("hex");

    // Build structure snapshot for provenance
    const structureJson = {
      sourceText: sourceArg.text,
      premises: sourceArg.premises.map((p) => ({
        claimId: p.claimId,
        text: p.claim.text,
        isImplicit: p.isImplicit,
      })),
      conclusion: sourceArg.conclusion
        ? { claimId: sourceArg.conclusion.id, text: sourceArg.conclusion.text }
        : null,
      schemeId: sourceArg.schemeId,
    };

    const importRecord = await tx.argumentImport.create({
      data: {
        fromDeliberationId: sourceArg.deliberationId,
        toDeliberationId: targetDeliberationId,
        fromArgumentId: sourceArgumentId,
        toArgumentId: newArgument.id,
        kind: "import",
        fingerprint,
        structureJson,
        // Academic import fields
        importType: importType as "FULL" | "PREMISES_ONLY" | "SKELETON" | "REFERENCE",
        importReason,
        preserveAttribution,
        originalAuthorId: sourceArg.authorId,
        wasModified,
        modificationNotes: wasModified
          ? JSON.stringify(modifications)
          : null,
        importedById: userId,
      },
    });

    return {
      importedArgumentId: newArgument.id,
      sourceArgumentId,
      importRecord: {
        id: importRecord.id,
        importType: importType as ImportType,
        wasModified,
      },
      linkedClaims,
    };
  });

  return result;
}

// ─────────────────────────────────────────────────────────
// Import Provenance Queries
// ─────────────────────────────────────────────────────────

/**
 * Get import provenance for an argument
 */
export async function getArgumentImportProvenance(argumentId: string) {
  // Check if this argument was imported (as target)
  const asImported = await prisma.argumentImport.findFirst({
    where: { toArgumentId: argumentId },
    include: {
      fromDeliberation: { select: { id: true, title: true } },
      toDeliberation: { select: { id: true, title: true } },
      fromArgument: {
        select: {
          id: true,
          text: true,
          authorId: true,
          deliberationId: true,
        },
      },
    },
  });

  if (!asImported) return null;

  const record = asImported as any;
  return {
    id: record.id,
    sourceDeliberation: record.fromDeliberation,
    targetDeliberation: record.toDeliberation,
    sourceArgument: record.fromArgument,
    importType: record.importType || record.kind || "FULL",
    importReason: record.importReason,
    preserveAttribution: record.preserveAttribution,
    originalAuthorId: record.originalAuthorId,
    wasModified: record.wasModified,
    modificationNotes: record.modificationNotes,
    importedById: record.importedById,
    createdAt: record.createdAt,
    structureSnapshot: record.structureJson,
  };
}

/**
 * Get all imports for a deliberation (incoming)
 */
export async function getDeliberationImports(deliberationId: string) {
  const imports = await prisma.argumentImport.findMany({
    where: { toDeliberationId: deliberationId },
    include: {
      fromDeliberation: { select: { id: true, title: true } },
      fromArgument: {
        select: { id: true, text: true, authorId: true },
      },
      toArgument: {
        select: { id: true, text: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return imports.map((imp) => {
    const record = imp as any;
    return {
      id: record.id,
      sourceDeliberation: record.fromDeliberation,
      sourceArgument: record.fromArgument,
      importedArgument: record.toArgument,
      importType: record.importType || record.kind || "FULL",
      importReason: record.importReason,
      preserveAttribution: record.preserveAttribution,
      wasModified: record.wasModified,
      createdAt: record.createdAt,
    };
  });
}

/**
 * Get all exports from a deliberation (outgoing)
 */
export async function getArgumentExports(deliberationId: string) {
  const exports = await prisma.argumentImport.findMany({
    where: { fromDeliberationId: deliberationId },
    include: {
      toDeliberation: { select: { id: true, title: true } },
      fromArgument: {
        select: { id: true, text: true, authorId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return exports.map((exp) => {
    const record = exp as any;
    return {
      id: record.id,
      targetDeliberation: record.toDeliberation,
      argument: record.fromArgument,
      importType: record.importType || record.kind || "FULL",
      wasModified: record.wasModified,
      createdAt: record.createdAt,
    };
  });
}
