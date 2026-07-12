/**
 * Phase 3.4.3: Timeline Types
 * 
 * Types for temporal visualization of evidence evolution.
 */

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  date: Date;
  title: string;
  description?: string;
  
  // Reference to entity
  entityType: string;
  entityId: string;
  
  // Metadata for rendering
  color?: string;
  icon?: string;
  importance?: number; // 1-5 scale
}

export type TimelineEventType =
  | "source_published"
  | "source_cited"
  | "argument_created"
  | "deliberation_started"
  | "claim_made"
  | "retraction"
  | "correction";

export interface TimelineFilter {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: TimelineEventType[];
  minImportance?: number;
}

export interface TimelineData {
  events: TimelineEvent[];
  dateRange: {
    earliest: Date;
    latest: Date;
  };
  summary: {
    totalEvents: number;
    byType: Record<string, number>;
    byYear: Record<number, number>;
  };
}

// Event colors for visualization
export const EVENT_COLORS: Record<TimelineEventType, string> = {
  source_published: "#3b82f6",
  source_cited: "#10b981",
  argument_created: "#8b5cf6",
  deliberation_started: "#f59e0b",
  claim_made: "#ec4899",
  retraction: "#ef4444",
  correction: "#f97316",
};

// Event display labels
export const EVENT_LABELS: Record<TimelineEventType, string> = {
  source_published: "Published",
  source_cited: "Cited",
  argument_created: "Argument",
  deliberation_started: "Started",
  claim_made: "Claim",
  retraction: "Retraction",
  correction: "Correction",
};
