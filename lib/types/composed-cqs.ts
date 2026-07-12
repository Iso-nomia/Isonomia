// lib/types/composed-cqs.ts
import type { CriticalQuestion, ArgumentSchemeInstance } from "@prisma/client";
import type { ArgumentSchemeInstanceWithScheme } from "./argument-net";

/**
 * ComposedCriticalQuestion - A critical question with metadata about its source scheme
 * and relationships to other schemes in a multi-scheme argument.
 */
export interface ComposedCriticalQuestion extends CriticalQuestion {
  // Source scheme info
  sourceSchemeInstance: ArgumentSchemeInstanceWithScheme;
  sourceSchemeName: string;
  sourceSchemeRole: "primary" | "supporting" | "presupposed" | "implicit";
  
  // Targeting info - which scheme/role this CQ attacks
  targetsSchemeRole?: "primary" | "supporting" | "presupposed" | "implicit";
  
  // Composition metadata
  compositionOrder: number; // Order in composed set (primary schemes first)
  isFromPrimaryScheme: boolean;
  
  // Relationships to other CQs
  relatedCQIds?: string[]; // CQs from other schemes that are semantically related
}

/**
 * ComposedCQSet - Complete set of composed critical questions from all schemes
 * in an argument, organized multiple ways for different views.
 */
export interface ComposedCQSet {
  argumentId: string;
  totalCQs: number;
  
  // CQs organized by source scheme
  byScheme: {
    schemeInstanceId: string;
    schemeName: string;
    schemeRole: "primary" | "supporting" | "presupposed" | "implicit";
    schemeKey: string;
    cqs: ComposedCriticalQuestion[];
  }[];
  
  // CQs organized by attack type
  byAttackType: {
    attackType: string;
    displayName: string;
    cqs: ComposedCriticalQuestion[];
  }[];
  
  // CQs organized by target (which scheme role they attack)
  byTarget: {
    targetRole: "primary" | "supporting" | "presupposed" | "implicit";
    cqs: ComposedCriticalQuestion[];
  }[];
  
  // Statistics for the composed set
  stats: {
    fromPrimary: number;
    fromSupporting: number;
    fromPresupposed: number;
    fromImplicit: number;
    byAttackType: Record<string, number>;
  };
}

/**
 * CQFilter - Filter options for composed critical questions
 */
export interface CQFilter {
  schemeInstanceIds?: string[];
  attackTypes?: string[];
  sourceRoles?: Array<"primary" | "supporting" | "presupposed" | "implicit">;
  targetRoles?: Array<"primary" | "supporting" | "presupposed" | "implicit">;
}
