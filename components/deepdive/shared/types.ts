/**
 * Shared Types for DeepDivePanel V3
 * 
 * Type definitions used across deliberation panel components
 */

export type TabValue = 
  | "debate" 
  | "arguments" 
  | "dialogue" 
  | "ludics" 
  | "admin" 
  | "sources" 
  | "thesis" 
  | "aspic" 
  | "analytics";

export type ConfidenceMode = "product" | "min";

export type RepresentationRule = "utilitarian" | "harmonic" | "maxcov";

export interface DeliberationPanelProps {
  deliberationId: string;
  containerClassName?: string;
  className?: string;
  selectedClaimId?: string;
  onClose?: () => void;
  hostName?: string | null;
}

export interface Selection {
  id: string;
  deliberationId: string;
  rule: RepresentationRule;
  k: number;
  coverageAvg: number;
  coverageMin: number;
  jrSatisfied: boolean;
  views: {
    index: number;
    arguments: { id: string; text: string; confidence?: number | null }[];
  }[];
}

export interface SelectedClaim {
  id: string;
  locusPath?: string | null;
}

export interface SelectedArgument {
  id: string;
  text?: string;
  conclusionText?: string;
  conclusionClaimId?: string;
  schemeKey?: string;
  schemeId?: string;
  schemeName?: string;
  premises?: Array<{ id: string; text: string; isImplicit?: boolean }>;
}

export interface ReplyTarget {
  id: string;
  preview?: string;
}

export type CardFilter = "all" | "mine" | "published";

export type LeftSheetTab = "arguments" | "claims";
