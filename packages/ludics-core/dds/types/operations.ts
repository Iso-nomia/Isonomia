/**
 * DDS Phase 5 - Part 2: Type Operations
 * 
 * Based on Faggian & Hyland (2002) - §6.4
 * 
 * Operations for creating, checking, and manipulating types.
 * Types are behaviours with additional structure for typing designs.
 */

import type { Action } from "../types";
import type { DesignForCorrespondence } from "../correspondence/types";
import type { Behaviour } from "../behaviours/types";
import { createBehaviourFromDesigns } from "../behaviours/closure";
import type {
  LudicsType,
  TypeCategory,
  TypeStructure,
  Typing,
  TypeEquivalence,
  TypeEquivalenceMethod,
  TypeEquivalenceProof,
  TypeCreationOptions,
  TypeCheckingContext,
  createLudicsType,
  createTyping,
  typeToString,
  typeStructuresEqual,
} from "./types";

/**
 * Create a type from a behaviour (Definition 6.4)
 * 
 * Types are specific kinds of behaviours that satisfy uniformity conditions.
 */
export async function createTypeFromBehaviour(
  behaviour: Behaviour,
  name: string,
  category: TypeCategory,
  allDesigns: DesignForCorrespondence[],
  options?: TypeCreationOptions
): Promise<LudicsType> {
  // Get designs in behaviour
  const inhabitantIds = behaviour.closureDesignIds;

  // Generate formula if not provided
  const formula = options?.formula || generateTypeFormula(category, name);

  // Optionally validate inhabitants
  if (options?.validateInhabitants) {
    const designs = allDesigns.filter((d) => inhabitantIds.includes(d.id));
    const isValid = validateTypeInhabitants(designs, category);
    if (!isValid) {
      console.warn(`Type inhabitants don't satisfy ${category} structure`);
    }
  }

  return {
    id: `type-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    behaviourId: behaviour.id,
    category,
    inhabitantIds,
    formula,
    createdAt: new Date(),
  };
}

/**
 * Create a type from designs (computes behaviour first)
 */
export async function createTypeFromDesigns(
  designs: DesignForCorrespondence[],
  allDesigns: DesignForCorrespondence[],
  name: string,
  category: TypeCategory,
  options?: TypeCreationOptions
): Promise<LudicsType> {
  // Create behaviour from designs
  const behaviour = await createBehaviourFromDesigns(designs, allDesigns, {
    name: `behaviour-for-${name}`,
    closureOptions: {
      maxIterations: 10,
      cacheIntermediates: true,
    },
  });

  return createTypeFromBehaviour(behaviour, name, category, allDesigns, options);
}

/**
 * Generate formula representation for a type category
 */
function generateTypeFormula(category: TypeCategory, name: string): string {
  switch (category) {
    case "base":
      return name;
    case "arrow":
      return `${name} → ?`; // Simplified
    case "product":
      return `${name} × ?`;
    case "sum":
      return `${name} + ?`;
    case "unit":
      return "1";
    case "void":
      return "0";
    case "linear":
      return `!${name}`;
    default:
      return name;
  }
}

/**
 * Validate that designs satisfy type structure requirements
 */
function validateTypeInhabitants(
  designs: DesignForCorrespondence[],
  category: TypeCategory
): boolean {
  if (designs.length === 0) {
    return category === "void"; // Only void type can be empty
  }

  switch (category) {
    case "unit":
      // Unit type should have exactly one trivial inhabitant
      return designs.length === 1 && (designs[0].acts || []).length === 0;

    case "void":
      // Void type has no inhabitants
      return designs.length === 0;

    case "arrow":
      // Arrow type inhabitants should have interaction structure
      return designs.every((d) => hasArrowStructure(d));

    case "product":
      // Product type inhabitants should have pair structure
      return designs.every((d) => hasProductStructure(d));

    case "sum":
      // Sum type inhabitants should have injection structure
      return designs.every((d) => hasSumStructure(d));

    case "base":
    case "linear":
    default:
      return true;
  }
}

/**
 * Check if design has arrow (function) structure
 */
function hasArrowStructure(design: DesignForCorrespondence): boolean {
  const acts = design.acts || [];
  if (acts.length < 2) return false;

  // Should have alternating polarities (input-output pattern)
  for (let i = 1; i < acts.length; i++) {
    if (acts[i].polarity === acts[i - 1].polarity) {
      return false;
    }
  }

  return true;
}

/**
 * Check if design has product (pair) structure
 */
function hasProductStructure(design: DesignForCorrespondence): boolean {
  const acts = design.acts || [];
  if (acts.length === 0) return false;

  // First act should have ramification of at least 2 (projections)
  const firstAct = acts[0];
  return (firstAct.ramification?.length || 0) >= 2;
}

/**
 * Check if design has sum (either) structure
 */
function hasSumStructure(design: DesignForCorrespondence): boolean {
  const acts = design.acts || [];
  if (acts.length === 0) return false;

  // First act should indicate injection (typically ramification of 1)
  const firstAct = acts[0];
  return (firstAct.ramification?.length || 0) === 1;
}

/**
 * Check if a design inhabits a type (D : A)
 * 
 * A design inhabits a type if it's in the type's behaviour.
 */
export function checkTyping(
  design: DesignForCorrespondence,
  type: LudicsType
): Typing {
  const isMember = type.inhabitantIds.includes(design.id);

  return {
    id: `typing-${design.id}-${type.id}`,
    designId: design.id,
    typeId: type.id,
    judgment: `${design.id} : ${type.name}`,
    isValid: isMember,
    proof: isMember
      ? {
          method: "membership",
          membershipWitness: {
            behaviourId: type.behaviourId,
          },
        }
      : undefined,
    checkedAt: new Date(),
  };
}

/**
 * Check type equivalence
 */
export function checkTypeEquivalence(
  type1: LudicsType,
  type2: LudicsType,
  method: TypeEquivalenceMethod
): TypeEquivalence {
  let areEquivalent = false;
  let proof: TypeEquivalenceProof | undefined;

  switch (method) {
    case "syntactic":
      areEquivalent = type1.formula === type2.formula;
      proof = {
        method: "syntactic",
        syntacticWitness: {
          formula1: type1.formula || "",
          formula2: type2.formula || "",
        },
      };
      break;

    case "semantic": {
      // Check if types have same inhabitants
      const ids1 = new Set(type1.inhabitantIds);
      const ids2 = new Set(type2.inhabitantIds);

      const common = type1.inhabitantIds.filter((id) => ids2.has(id));
      const uniqueTo1 = type1.inhabitantIds.filter((id) => !ids2.has(id));
      const uniqueTo2 = type2.inhabitantIds.filter((id) => !ids1.has(id));

      areEquivalent = uniqueTo1.length === 0 && uniqueTo2.length === 0;

      proof = {
        method: "semantic",
        semanticWitness: {
          commonInhabitantIds: common,
          uniqueToType1: uniqueTo1,
          uniqueToType2: uniqueTo2,
        },
      };
      break;
    }

    case "behavioural":
      // Check if underlying behaviours are equal
      areEquivalent = type1.behaviourId === type2.behaviourId;
      proof = {
        method: "behavioural",
        behaviouralWitness: {
          behaviour1Id: type1.behaviourId,
          behaviour2Id: type2.behaviourId,
          areSameClosure: areEquivalent,
        },
      };
      break;
  }

  return {
    type1Id: type1.id,
    type2Id: type2.id,
    areEquivalent,
    equivalenceType: method,
    proof,
  };
}

/**
 * Construct arrow type (A → B)
 */
export async function createArrowType(
  name: string,
  inputType: LudicsType,
  outputType: LudicsType,
  allDesigns: DesignForCorrespondence[]
): Promise<LudicsType> {
  // Arrow type inhabitants: designs that take input type and produce output type
  const inhabitants = allDesigns.filter((design) =>
    isArrowDesign(design, inputType, outputType, allDesigns)
  );

  // Create behaviour from inhabitants
  const behaviour = await createBehaviourFromDesigns(inhabitants, allDesigns, {
    name: `behaviour-${name}`,
  });

  return {
    id: `type-arrow-${Date.now()}`,
    name,
    behaviourId: behaviour.id,
    category: "arrow",
    inhabitantIds: behaviour.closureDesignIds,
    formula: `${inputType.name} → ${outputType.name}`,
    createdAt: new Date(),
  };
}

/**
 * Check if design represents an arrow type (A → B)
 */
function isArrowDesign(
  design: DesignForCorrespondence,
  inputType: LudicsType,
  outputType: LudicsType,
  allDesigns: DesignForCorrespondence[]
): boolean {
  const acts = design.acts || [];
  if (acts.length < 2) return false;

  // Arrow design should start with negative polarity (input)
  // and end with positive polarity (output)
  const firstAct = acts[0];
  const lastAct = acts[acts.length - 1];

  if (firstAct.polarity !== "O") return false; // Input should be negative
  if (lastAct.polarity !== "P") return false; // Output should be positive

  // Simplified check - full implementation would verify type compatibility
  return hasArrowStructure(design);
}

/**
 * Construct product type (A × B)
 */
export async function createProductType(
  name: string,
  leftType: LudicsType,
  rightType: LudicsType,
  allDesigns: DesignForCorrespondence[]
): Promise<LudicsType> {
  // Product type inhabitants: designs with pair structure
  const inhabitants = allDesigns.filter((design) =>
    isProductDesign(design, leftType, rightType)
  );

  const behaviour = await createBehaviourFromDesigns(inhabitants, allDesigns, {
    name: `behaviour-${name}`,
  });

  return {
    id: `type-product-${Date.now()}`,
    name,
    behaviourId: behaviour.id,
    category: "product",
    inhabitantIds: behaviour.closureDesignIds,
    formula: `${leftType.name} × ${rightType.name}`,
    createdAt: new Date(),
  };
}

/**
 * Check if design represents a product type
 */
function isProductDesign(
  design: DesignForCorrespondence,
  leftType: LudicsType,
  rightType: LudicsType
): boolean {
  return hasProductStructure(design);
}

/**
 * Construct sum type (A + B)
 */
export async function createSumType(
  name: string,
  leftType: LudicsType,
  rightType: LudicsType,
  allDesigns: DesignForCorrespondence[]
): Promise<LudicsType> {
  // Sum type inhabitants: designs with injection structure
  const inhabitants = allDesigns.filter((design) =>
    isSumDesign(design, leftType, rightType)
  );

  const behaviour = await createBehaviourFromDesigns(inhabitants, allDesigns, {
    name: `behaviour-${name}`,
  });

  return {
    id: `type-sum-${Date.now()}`,
    name,
    behaviourId: behaviour.id,
    category: "sum",
    inhabitantIds: behaviour.closureDesignIds,
    formula: `${leftType.name} + ${rightType.name}`,
    createdAt: new Date(),
  };
}

/**
 * Check if design represents a sum type
 */
function isSumDesign(
  design: DesignForCorrespondence,
  leftType: LudicsType,
  rightType: LudicsType
): boolean {
  return hasSumStructure(design);
}

/**
 * Create unit type
 */
export async function createUnitType(
  allDesigns: DesignForCorrespondence[]
): Promise<LudicsType> {
  // Unit type has one trivial inhabitant
  const unitDesigns = allDesigns.filter(
    (d) => (d.acts || []).length === 0
  );

  const behaviour = await createBehaviourFromDesigns(
    unitDesigns.length > 0 ? [unitDesigns[0]] : [],
    allDesigns,
    { name: "behaviour-unit" }
  );

  return {
    id: "type-unit",
    name: "Unit",
    behaviourId: behaviour.id,
    category: "unit",
    inhabitantIds: behaviour.closureDesignIds,
    formula: "1",
    createdAt: new Date(),
  };
}

/**
 * Create void type
 */
export async function createVoidType(
  allDesigns: DesignForCorrespondence[]
): Promise<LudicsType> {
  // Void type has no inhabitants
  const behaviour = await createBehaviourFromDesigns([], allDesigns, {
    name: "behaviour-void",
  });

  return {
    id: "type-void",
    name: "Void",
    behaviourId: behaviour.id,
    category: "void",
    inhabitantIds: [],
    formula: "0",
    createdAt: new Date(),
  };
}

/**
 * Get all designs that inhabit a type
 */
export function getTypeInhabitants(
  type: LudicsType,
  allDesigns: DesignForCorrespondence[]
): DesignForCorrespondence[] {
  return allDesigns.filter((d) => type.inhabitantIds.includes(d.id));
}

/**
 * Get all types that a design inhabits
 */
export function getDesignTypes(
  design: DesignForCorrespondence,
  types: LudicsType[]
): LudicsType[] {
  return types.filter((t) => t.inhabitantIds.includes(design.id));
}

/**
 * Check if type A is a subtype of type B (A ⊆ B)
 * 
 * A is subtype of B if all inhabitants of A are also inhabitants of B.
 */
export function isSubtype(typeA: LudicsType, typeB: LudicsType): boolean {
  const bInhabitants = new Set(typeB.inhabitantIds);
  return typeA.inhabitantIds.every((id) => bInhabitants.has(id));
}

/**
 * Check if type A is a supertype of type B (A ⊇ B)
 */
export function isSupertype(typeA: LudicsType, typeB: LudicsType): boolean {
  return isSubtype(typeB, typeA);
}

/**
 * Find the least upper bound (join) of two types
 */
export async function typeLeastUpperBound(
  typeA: LudicsType,
  typeB: LudicsType,
  allDesigns: DesignForCorrespondence[]
): Promise<LudicsType | null> {
  // Union of inhabitants
  const unionIds = [
    ...new Set([...typeA.inhabitantIds, ...typeB.inhabitantIds]),
  ];

  const unionDesigns = allDesigns.filter((d) => unionIds.includes(d.id));

  if (unionDesigns.length === 0) return null;

  return createTypeFromDesigns(
    unionDesigns,
    allDesigns,
    `${typeA.name} ∨ ${typeB.name}`,
    "base"
  );
}

/**
 * Find the greatest lower bound (meet) of two types
 */
export async function typeGreatestLowerBound(
  typeA: LudicsType,
  typeB: LudicsType,
  allDesigns: DesignForCorrespondence[]
): Promise<LudicsType | null> {
  // Intersection of inhabitants
  const bIds = new Set(typeB.inhabitantIds);
  const intersectionIds = typeA.inhabitantIds.filter((id) => bIds.has(id));

  const intersectionDesigns = allDesigns.filter((d) =>
    intersectionIds.includes(d.id)
  );

  if (intersectionDesigns.length === 0) {
    return createVoidType(allDesigns);
  }

  return createTypeFromDesigns(
    intersectionDesigns,
    allDesigns,
    `${typeA.name} ∧ ${typeB.name}`,
    "base"
  );
}
