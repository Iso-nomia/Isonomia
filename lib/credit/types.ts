/**
 * Types for Phase 4.3: Academic Credit Integration
 * ORCID integration, CV export, and institutional reporting
 */

export type OrcidWorkType =
  | "SCHOLARLY_ARGUMENT"
  | "PEER_REVIEW"
  | "RESEARCH_SYNTHESIS"
  | "CITATION";

export type OrcidSyncStatus = "PENDING" | "SYNCED" | "FAILED" | "DELETED";

export type CvExportFormat =
  | "JSON_LD"
  | "BIBTEX"
  | "WORD"
  | "PDF"
  | "LATEX"
  | "CSV";

export type InstitutionalReportType =
  | "FACULTY_CONTRIBUTIONS"
  | "DEPARTMENT_SUMMARY"
  | "INSTITUTION_OVERVIEW"
  | "IMPACT_REPORT";

export interface OrcidConnectionSummary {
  id: string;
  userId: bigint;
  orcidId: string;
  autoSyncEnabled: boolean;
  lastSyncAt?: Date;
  syncedWorkCount: number;
  hasErrors: boolean;
}

export interface OrcidWorkData {
  type: OrcidWorkType;
  sourceId: string;
  title: string;
  description?: string;
  workDate: Date;
  externalUrl?: string;
}

export interface CvExportOptions {
  format: CvExportFormat;
  dateRange?: {
    start: Date;
    end: Date;
  };
  includeTypes?: string[];
  includeMetrics?: boolean;
}

export interface CvEntry {
  type: string;
  title: string;
  date: Date;
  description?: string;
  context?: string; // Deliberation title
  metrics?: {
    citations?: number;
    consensusLevel?: number;
    impact?: number;
  };
  url?: string;
}

export interface InstitutionalReportData {
  period: {
    start: Date;
    end: Date;
  };
  totalContributors: number;
  totalContributions: number;
  byType: Record<string, number>;
  topContributors: Array<{
    userId: bigint;
    name: string;
    count: number;
    score: number;
  }>;
  impactMetrics: {
    totalCitations: number;
    consensusAchieved: number;
    reviewsCompleted: number;
  };
}
