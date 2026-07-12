/**
 * AIF Exporter
 * Main export functionality for converting Mesh schemes to AIF/RDF formats
 */

import { prisma } from "@/lib/prismaclient";
import { AIFGraphBuilder } from "./graphBuilder";
import { serializeToRDFXML, serializeToTurtle, serializeToJSONLD } from "./serializers";
import { getCQsWithInheritance } from "@/lib/argumentation/cqInheritance";
import {
  AIFExportOptions,
  AIFExportResult,
  AIFBulkExportResult,
  AIFClusterExportOptions,
  DEFAULT_EXPORT_OPTIONS,
  SchemeWithRelations,
} from "./ontologyTypes";
import { AIF_NAMESPACES, AIF_BASE_URI } from "./ontologyTypes";

/**
 * Export a single scheme to AIF format
 */
export async function exportSchemeToAIF(
  schemeId: string,
  options: Partial<AIFExportOptions> = {}
): Promise<AIFExportResult> {
  const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };
  const startTime = Date.now();

  try {
    // Fetch scheme with relations
    const scheme = await prisma.argumentScheme.findUnique({
      where: { id: schemeId },
      include: {
        cqs: opts.includeCQs ? {
          select: {
            id: true,
            cqKey: true,
            text: true,
            attackKind: true,
          },
        } : false,
        // Phase 8E.3: Load full parent hierarchy for transitive ancestors
        parentScheme: opts.includeHierarchy ? {
          include: {
            parentScheme: {
              include: {
                parentScheme: {
                  include: {
                    parentScheme: true, // Support up to 4 levels of nesting
                  },
                },
              },
            },
          },
        } : false,
        // childSchemes: We don't need this for single scheme export
      } as any, // Type assertion for Phase 6 fields
    });

    if (!scheme) {
      return {
        success: false,
        format: opts.format,
        metadata: {
          schemeCount: 0,
          questionCount: 0,
          tripleCount: 0,
          exportedAt: new Date(),
        },
        error: {
          code: "SCHEME_NOT_FOUND",
          message: `Scheme with id ${schemeId} not found`,
        },
      };
    }

    // Build RDF graph
    const builder = new AIFGraphBuilder(opts.baseURI || AIF_BASE_URI, AIF_NAMESPACES);
    
    // Fetch inherited CQs if requested
    if (opts.includeCQs) {
      const inheritedCQs = await getCQsWithInheritance(schemeId, true);
      await builder.addSchemeWithInheritedCQs(scheme as SchemeWithRelations, inheritedCQs, {
        includeHierarchy: opts.includeHierarchy,
        includeCQs: opts.includeCQs,
        includeMeshExtensions: opts.includeMeshExtensions,
      });
    } else {
      builder.addScheme(scheme as SchemeWithRelations, {
        includeHierarchy: opts.includeHierarchy,
        includeCQs: false,
        includeMeshExtensions: opts.includeMeshExtensions,
      });
    }

    const triples = builder.getTriples();
    const namespaces = builder.getNamespaces();

    // Serialize to requested format
    let data: string;
    switch (opts.format) {
      case "rdfxml":
        data = serializeToRDFXML(triples, namespaces);
        break;
      case "turtle":
        data = await serializeToTurtle(triples, namespaces);
        break;
      case "jsonld":
        data = serializeToJSONLD(triples, namespaces);
        break;
      default:
        throw new Error(`Unsupported format: ${opts.format}`);
    }

    const schemeWithCqs = scheme as any;
    const questionCount = schemeWithCqs.cqs ? schemeWithCqs.cqs.length : 0;

    return {
      success: true,
      data,
      format: opts.format,
      metadata: {
        schemeCount: 1,
        questionCount,
        tripleCount: triples.length,
        exportedAt: new Date(),
      },
    };
  } catch (error) {
    return {
      success: false,
      format: opts.format,
      metadata: {
        schemeCount: 0,
        questionCount: 0,
        tripleCount: 0,
        exportedAt: new Date(),
      },
      error: {
        code: "EXPORT_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
        details: error,
      },
    };
  }
}

/**
 * Export a scheme by its key
 */
export async function exportSchemeByKey(
  key: string,
  options: Partial<AIFExportOptions> = {}
): Promise<AIFExportResult> {
  try {
    const scheme = await prisma.argumentScheme.findFirst({
      where: { key },
      select: { id: true },
    });

    if (!scheme) {
      const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };
      return {
        success: false,
        format: opts.format,
        metadata: {
          schemeCount: 0,
          questionCount: 0,
          tripleCount: 0,
          exportedAt: new Date(),
        },
        error: {
          code: "SCHEME_NOT_FOUND",
          message: `Scheme with key ${key} not found`,
        },
      };
    }

    return exportSchemeToAIF(scheme.id, options);
  } catch (error) {
    const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };
    return {
      success: false,
      format: opts.format,
      metadata: {
        schemeCount: 0,
        questionCount: 0,
        tripleCount: 0,
        exportedAt: new Date(),
      },
      error: {
        code: "EXPORT_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
        details: error,
      },
    };
  }
}

/**
 * Export all schemes in a cluster family
 */
export async function exportClusterFamily(
  clusterTag: string,
  options: Partial<AIFClusterExportOptions> = {}
): Promise<AIFExportResult> {
  const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };

  try {
    // Fetch all schemes in cluster
    // Using type assertion for Phase 6 field that may not be in generated Prisma types yet
    const schemes = await prisma.argumentScheme.findMany({
      where: { clusterTag } as any,
      include: {
        cqs: opts.includeCQs ? {
          select: {
            id: true,
            cqKey: true,
            text: true,
            attackKind: true,
          },
        } : false,
        // Phase 8E.3: Load parent hierarchy for each scheme in cluster
        parentScheme: opts.includeHierarchy ? {
          include: {
            parentScheme: {
              include: {
                parentScheme: {
                  include: {
                    parentScheme: true,
                  },
                },
              },
            },
          },
        } : false,
      } as any, // Type assertion for Phase 6 fields
    });

    if (schemes.length === 0) {
      return {
        success: false,
        format: opts.format,
        metadata: {
          schemeCount: 0,
          questionCount: 0,
          tripleCount: 0,
          exportedAt: new Date(),
        },
        error: {
          code: "CLUSTER_NOT_FOUND",
          message: `No schemes found with cluster tag ${clusterTag}`,
        },
      };
    }

    // Build unified graph for all schemes
    const builder = new AIFGraphBuilder(opts.baseURI || AIF_BASE_URI, AIF_NAMESPACES);
    
    let totalQuestions = 0;
    for (const scheme of schemes) {
      if (opts.includeCQs) {
        const inheritedCQs = await getCQsWithInheritance(scheme.id, true);
        await builder.addSchemeWithInheritedCQs(scheme as SchemeWithRelations, inheritedCQs, {
          includeHierarchy: opts.includeHierarchy,
          includeCQs: opts.includeCQs,
          includeMeshExtensions: opts.includeMeshExtensions,
        });
        totalQuestions += inheritedCQs.length;
      } else {
        builder.addScheme(scheme as SchemeWithRelations, {
          includeHierarchy: opts.includeHierarchy,
          includeCQs: false,
          includeMeshExtensions: opts.includeMeshExtensions,
        });
      }
    }

    const triples = builder.getTriples();
    const namespaces = builder.getNamespaces();

    // Serialize to requested format
    let data: string;
    switch (opts.format) {
      case "rdfxml":
        data = serializeToRDFXML(triples, namespaces);
        break;
      case "turtle":
        data = await serializeToTurtle(triples, namespaces);
        break;
      case "jsonld":
        data = serializeToJSONLD(triples, namespaces);
        break;
      default:
        throw new Error(`Unsupported format: ${opts.format}`);
    }

    return {
      success: true,
      data,
      format: opts.format,
      metadata: {
        schemeCount: schemes.length,
        questionCount: totalQuestions,
        tripleCount: triples.length,
        exportedAt: new Date(),
      },
    };
  } catch (error) {
    return {
      success: false,
      format: opts.format,
      metadata: {
        schemeCount: 0,
        questionCount: 0,
        tripleCount: 0,
        exportedAt: new Date(),
      },
      error: {
        code: "EXPORT_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
        details: error,
      },
    };
  }
}

/**
 * Export multiple schemes by ID
 */
export async function exportMultipleSchemes(
  schemeIds: string[],
  options: Partial<AIFExportOptions> = {}
): Promise<AIFBulkExportResult> {
  const results: Record<string, AIFExportResult> = {};
  let successful = 0;
  let failed = 0;

  for (const schemeId of schemeIds) {
    const result = await exportSchemeToAIF(schemeId, options);
    results[schemeId] = result;
    
    if (result.success) {
      successful++;
    } else {
      failed++;
    }
  }

  return {
    success: failed === 0,
    exports: results,
    summary: {
      total: schemeIds.length,
      successful,
      failed,
    },
  };
}

/**
 * Export all schemes in the database
 */
export async function exportAllSchemes(
  options: Partial<AIFExportOptions> = {}
): Promise<AIFExportResult> {
  const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };

  try {
    const schemes = await prisma.argumentScheme.findMany({
      include: {
        cqs: opts.includeCQs ? {
          select: {
            id: true,
            cqKey: true,
            text: true,
            attackKind: true,
          },
        } : false,
        // Phase 8E.3: Load parent hierarchy for all schemes
        parentScheme: opts.includeHierarchy ? {
          include: {
            parentScheme: {
              include: {
                parentScheme: {
                  include: {
                    parentScheme: true,
                  },
                },
              },
            },
          },
        } : false,
      } as any, // Type assertion for Phase 6 fields
    });

    if (schemes.length === 0) {
      return {
        success: false,
        format: opts.format,
        metadata: {
          schemeCount: 0,
          questionCount: 0,
          tripleCount: 0,
          exportedAt: new Date(),
        },
        error: {
          code: "NO_SCHEMES_FOUND",
          message: "No schemes found in database",
        },
      };
    }

    // Build unified graph
    const builder = new AIFGraphBuilder(opts.baseURI || AIF_BASE_URI, AIF_NAMESPACES);
    
    let totalQuestions = 0;
    for (const scheme of schemes) {
      builder.addScheme(scheme as SchemeWithRelations, {
        includeHierarchy: opts.includeHierarchy,
        includeCQs: opts.includeCQs,
        includeMeshExtensions: opts.includeMeshExtensions,
      });
      
      const schemeWithCqs = scheme as any;
      if (schemeWithCqs.cqs) {
        totalQuestions += schemeWithCqs.cqs.length;
      }
    }

    const triples = builder.getTriples();
    const namespaces = builder.getNamespaces();

    // Serialize
    let data: string;
    switch (opts.format) {
      case "rdfxml":
        data = serializeToRDFXML(triples, namespaces);
        break;
      case "turtle":
        data = await serializeToTurtle(triples, namespaces);
        break;
      case "jsonld":
        data = serializeToJSONLD(triples, namespaces);
        break;
      default:
        throw new Error(`Unsupported format: ${opts.format}`);
    }

    return {
      success: true,
      data,
      format: opts.format,
      metadata: {
        schemeCount: schemes.length,
        questionCount: totalQuestions,
        tripleCount: triples.length,
        exportedAt: new Date(),
      },
    };
  } catch (error) {
    return {
      success: false,
      format: opts.format,
      metadata: {
        schemeCount: 0,
        questionCount: 0,
        tripleCount: 0,
        exportedAt: new Date(),
      },
      error: {
        code: "EXPORT_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
        details: error,
      },
    };
  }
}
