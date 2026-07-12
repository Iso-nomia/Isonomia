/**
 * Prisma Adapter
 * 
 * Converts between Prisma database models and runtime theory types.
 * 
 * Prisma Models:
 * - LudicDesign, LudicAct, LudicChronicle (database)
 * - LudicBehaviour, LudicMaterialDesign (database)
 * 
 * Theory Types:
 * - LudicDesignTheory, DialogueAct, Chronicle (runtime)
 * - LudicBehaviourTheory (runtime)
 */

import type {
  DialogueAct,
  DialogueActType,
  Chronicle,
  LudicDesignTheory,
  LudicBehaviourTheory,
  LudicAddress,
  Polarity,
} from "../types/ludics-theory";
import {
  addressToKey,
  keyToAddress,
  isDaimon,
  chronicleHasDaimon,
} from "../types/ludics-theory";

// ============================================================================
// Prisma Type Definitions (matching schema.prisma)
// ============================================================================

/**
 * LudicAct from Prisma (simplified for adapter)
 */
export interface PrismaLudicAct {
  id: string;
  designId: string;
  kind: "PROPER" | "DAIMON";
  polarity: "P" | "O" | "pos" | "neg" | "daimon" | null;
  locusId: string | null;
  ramification: string[];
  expression: string | null;
  isAdditive: boolean;
  orderInDesign: number;
  metaJson?: unknown;
}

/**
 * LudicDesign from Prisma (with relations)
 */
export interface PrismaLudicDesign {
  id: string;
  deliberationId: string;
  participantId: string;
  rootLocusId: string;
  semantics: string;
  hasDaimon: boolean;
  version: number;
  scope?: string | null;
  scopeType?: string | null;
  acts?: PrismaLudicAct[];
}

/**
 * LudicLocus from Prisma
 */
export interface PrismaLudicLocus {
  id: string;
  deliberationId: string;
  path: string;
  parentId: string | null;
  depth: number;
}

/**
 * LudicBehaviour from Prisma
 */
export interface PrismaLudicBehaviour {
  id: string;
  deliberationId: string;
  base: string;
  polarity: string;
  regular?: boolean | null;
  uniformBound?: number | null;
}

// ============================================================================
// Locus Path Mapping
// ============================================================================

/**
 * Locus path map: locus ID → ludic address
 */
export type LocusPathMap = Map<string, LudicAddress>;

/**
 * Build locus path map from loci
 */
export function buildLocusPathMap(loci: PrismaLudicLocus[]): LocusPathMap {
  const map: LocusPathMap = new Map();
  
  for (const locus of loci) {
    // Parse path like "0.1.2" to [0, 1, 2]
    const address = locus.path === "" || locus.path === "0"
      ? []
      : locus.path.split(".").map((s) => parseInt(s, 10));
    map.set(locus.id, address);
  }
  
  return map;
}

// ============================================================================
// Polarity Conversion
// ============================================================================

/**
 * Convert Prisma polarity to theory polarity
 */
export function prismaToTheoryPolarity(
  polarity: PrismaLudicAct["polarity"]
): Polarity {
  if (polarity === "P" || polarity === "pos") return "+";
  if (polarity === "O" || polarity === "neg") return "-";
  // Daimon is always positive
  return "+";
}

/**
 * Convert theory polarity to Prisma polarity
 */
export function theoryToPrismaPolarity(polarity: Polarity): "P" | "O" {
  return polarity === "+" ? "P" : "O";
}

// ============================================================================
// Act Type Mapping
// ============================================================================

/**
 * Infer dialogue act type from Prisma act
 */
export function inferActType(act: PrismaLudicAct): DialogueActType {
  if (act.kind === "DAIMON") return "daimon";
  
  // Try to infer from expression content or metadata
  const expr = act.expression?.toLowerCase() ?? "";
  if (expr.includes("support") || expr.includes("because")) return "argue";
  if (expr.includes("attack") || expr.includes("but") || expr.includes("however")) return "negate";
  if (expr.includes("?") || expr.includes("why")) return "ask";
  if (expr.includes("concede") || expr.includes("agree")) return "concede";
  
  return "claim";
}

// ============================================================================
// Prisma → Theory Conversion
// ============================================================================

/**
 * Convert Prisma LudicAct to theory DialogueAct
 */
export function prismaActToTheory(
  act: PrismaLudicAct,
  locusPathMap: LocusPathMap
): DialogueAct {
  const focus = act.locusId 
    ? locusPathMap.get(act.locusId) ?? []
    : [];
  
  // Parse ramification strings to addresses
  const ramification: LudicAddress[] = act.ramification.map((r) => {
    // Ramification might be suffixes like "0", "1" or full paths
    if (r.includes(".")) {
      return r.split(".").map((s) => parseInt(s, 10));
    }
    // If just a single number, it's a child index
    return [...focus, parseInt(r, 10)];
  });

  return {
    id: act.id,
    polarity: prismaToTheoryPolarity(act.polarity),
    focus,
    ramification,
    expression: act.expression ?? "",
    type: inferActType(act),
    timestamp: act.orderInDesign,
  };
}

/**
 * Convert Prisma LudicDesign to theory LudicDesignTheory
 */
export function prismaDesignToTheory(
  design: PrismaLudicDesign,
  locusPathMap: LocusPathMap
): LudicDesignTheory {
  const acts = design.acts ?? [];
  
  // Convert all acts
  const dialogueActs = acts
    .sort((a, b) => a.orderInDesign - b.orderInDesign)
    .map((act) => prismaActToTheory(act, locusPathMap));
  
  // Build chronicles from acts
  // For simplicity, treat the ordered acts as a single chronicle
  // A more sophisticated version would reconstruct the tree structure
  const chronicles: Chronicle[] = dialogueActs.length > 0
    ? [{
        id: `chr_${design.id}`,
        actions: dialogueActs,
        isComplete: dialogueActs.some(isDaimon) || 
                    dialogueActs[dialogueActs.length - 1]?.ramification.length === 0,
      }]
    : [];
  
  // Determine base from root locus
  const rootAddress = locusPathMap.get(design.rootLocusId) ?? [];
  
  // Check for daimon
  const hasDaimon = design.hasDaimon || dialogueActs.some(isDaimon);
  
  return {
    id: design.id,
    base: [rootAddress],
    polarity: dialogueActs[0]?.polarity ?? "+",
    chronicles,
    hasDaimon,
    isWinning: !hasDaimon,
    deliberationId: design.deliberationId,
    participantId: design.participantId,
  };
}

/**
 * Convert Prisma LudicBehaviour to theory LudicBehaviourTheory
 */
export function prismaBehaviourToTheory(
  behaviour: PrismaLudicBehaviour,
  designs: LudicDesignTheory[]
): LudicBehaviourTheory {
  // Parse base like "⊢ ξ" or "ξ ⊢"
  const isPositive = behaviour.polarity === "positive" || 
                     behaviour.base.startsWith("⊢");
  
  return {
    id: behaviour.id,
    base: [[]], // Root base
    designs,
    polarity: isPositive ? "+" : "-",
    isComplete: behaviour.regular ?? false,
    deliberationId: behaviour.deliberationId,
  };
}

// ============================================================================
// Theory → Prisma Conversion
// ============================================================================

/**
 * Convert theory DialogueAct to Prisma LudicAct creation data
 */
export function theoryActToPrisma(
  act: DialogueAct,
  designId: string,
  locusId: string,
  orderInDesign: number
): Omit<PrismaLudicAct, "id"> {
  return {
    designId,
    kind: act.type === "daimon" ? "DAIMON" : "PROPER",
    polarity: theoryToPrismaPolarity(act.polarity),
    locusId,
    ramification: act.ramification.map((r) => addressToKey(r)),
    expression: act.expression,
    isAdditive: false,
    orderInDesign,
  };
}

/**
 * Convert theory LudicDesignTheory to Prisma LudicDesign creation data
 */
export function theoryDesignToPrisma(
  design: LudicDesignTheory,
  rootLocusId: string
): Omit<PrismaLudicDesign, "id" | "acts"> {
  return {
    deliberationId: design.deliberationId ?? "",
    participantId: design.participantId ?? "",
    rootLocusId,
    semantics: "ludics-theory-v1",
    hasDaimon: design.hasDaimon,
    version: 1,
  };
}

/**
 * Convert theory LudicBehaviourTheory to Prisma LudicBehaviour creation data
 */
export function theoryBehaviourToPrisma(
  behaviour: LudicBehaviourTheory
): Omit<PrismaLudicBehaviour, "id"> {
  const baseStr = behaviour.polarity === "+"
    ? "⊢ ξ"
    : "ξ ⊢";
  
  return {
    deliberationId: behaviour.deliberationId ?? "",
    base: baseStr,
    polarity: behaviour.polarity === "+" ? "positive" : "negative",
    regular: behaviour.isComplete,
  };
}

// ============================================================================
// Batch Conversion Helpers
// ============================================================================

/**
 * Convert multiple Prisma designs to theory designs
 */
export function convertPrismaDesigns(
  designs: PrismaLudicDesign[],
  locusPathMap: LocusPathMap
): LudicDesignTheory[] {
  return designs.map((d) => prismaDesignToTheory(d, locusPathMap));
}

/**
 * Prepare theory design for Prisma insertion
 * Returns the design data and act data separately
 */
export function prepareTheoryDesignForPrisma(
  design: LudicDesignTheory,
  rootLocusId: string,
  locusIdMap: Map<string, string> // address key → locus ID
): {
  design: Omit<PrismaLudicDesign, "id" | "acts">;
  acts: Array<Omit<PrismaLudicAct, "id">>;
} {
  const designData = theoryDesignToPrisma(design, rootLocusId);
  
  const actsData: Array<Omit<PrismaLudicAct, "id">> = [];
  let order = 0;
  
  for (const chronicle of design.chronicles) {
    for (const act of chronicle.actions) {
      const locusId = locusIdMap.get(addressToKey(act.focus)) ?? rootLocusId;
      actsData.push(theoryActToPrisma(act, "", locusId, order++));
    }
  }
  
  return { design: designData, acts: actsData };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate that a Prisma design can be converted
 */
export function validatePrismaDesign(
  design: PrismaLudicDesign
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!design.id) {
    errors.push("Design missing id");
  }
  if (!design.deliberationId) {
    errors.push("Design missing deliberationId");
  }
  if (!design.rootLocusId) {
    errors.push("Design missing rootLocusId");
  }
  
  if (design.acts) {
    for (const act of design.acts) {
      if (!act.kind) {
        errors.push(`Act ${act.id} missing kind`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate roundtrip conversion
 */
export function validatePrismaRoundtrip(
  original: PrismaLudicDesign,
  locusPathMap: LocusPathMap,
  locusIdMap: Map<string, string>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Convert to theory
  const theory = prismaDesignToTheory(original, locusPathMap);
  
  // Convert back
  const { design: recovered } = prepareTheoryDesignForPrisma(
    theory,
    original.rootLocusId,
    locusIdMap
  );
  
  // Check essential fields
  if (recovered.deliberationId !== original.deliberationId) {
    errors.push("deliberationId mismatch");
  }
  if (recovered.hasDaimon !== original.hasDaimon) {
    errors.push("hasDaimon mismatch");
  }
  
  return { valid: errors.length === 0, errors };
}
