/**
 * Phase 5.1: React Query hooks for cross-field features
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  AcademicFieldSummary,
  ConceptSummary,
  ConceptWithEquivalences,
  ConceptEquivalenceType,
  CrossFieldAlertData,
  CrossFieldAlertStatus,
  FieldHierarchy,
  FieldWithRelations,
} from "./types";

// ============================================================
// Query Keys
// ============================================================

export const crossFieldKeys = {
  all: ["crossfield"] as const,
  fields: () => [...crossFieldKeys.all, "fields"] as const,
  fieldHierarchy: () => [...crossFieldKeys.fields(), "hierarchy"] as const,
  field: (id: string) => [...crossFieldKeys.fields(), id] as const,
  fieldSearch: (query: string) =>
    [...crossFieldKeys.fields(), "search", query] as const,

  concepts: () => [...crossFieldKeys.all, "concepts"] as const,
  concept: (id: string) => [...crossFieldKeys.concepts(), id] as const,
  conceptsByField: (fieldId: string) =>
    [...crossFieldKeys.concepts(), "field", fieldId] as const,
  conceptSearch: (query: string) =>
    [...crossFieldKeys.concepts(), "search", query] as const,
  similarConcepts: (id: string) =>
    [...crossFieldKeys.concepts(), id, "similar"] as const,

  alerts: () => [...crossFieldKeys.all, "alerts"] as const,
  alertCount: () => [...crossFieldKeys.alerts(), "count"] as const,
};

// ============================================================
// Field Hooks
// ============================================================

export function useFields() {
  return useQuery({
    queryKey: crossFieldKeys.fields(),
    queryFn: async (): Promise<AcademicFieldSummary[]> => {
      const res = await fetch("/api/crossfield/fields");
      if (!res.ok) throw new Error("Failed to fetch fields");
      return res.json();
    },
  });
}

export function useFieldHierarchy() {
  return useQuery({
    queryKey: crossFieldKeys.fieldHierarchy(),
    queryFn: async (): Promise<FieldHierarchy[]> => {
      const res = await fetch("/api/crossfield/fields?hierarchy=true");
      if (!res.ok) throw new Error("Failed to fetch field hierarchy");
      return res.json();
    },
  });
}

export function useField(fieldId: string) {
  return useQuery({
    queryKey: crossFieldKeys.field(fieldId),
    queryFn: async (): Promise<FieldWithRelations> => {
      const res = await fetch(`/api/crossfield/fields/${fieldId}`);
      if (!res.ok) throw new Error("Failed to fetch field");
      return res.json();
    },
    enabled: !!fieldId,
  });
}

export function useFieldSearch(query: string) {
  return useQuery({
    queryKey: crossFieldKeys.fieldSearch(query),
    queryFn: async (): Promise<AcademicFieldSummary[]> => {
      const res = await fetch(
        `/api/crossfield/fields?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error("Failed to search fields");
      return res.json();
    },
    enabled: query.length >= 2,
  });
}

export function useCreateField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      parentFieldId?: string;
      aliases?: string[];
      keyTerms?: string[];
      epistemicStyle?: string;
    }) => {
      const res = await fetch("/api/crossfield/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create field");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crossFieldKeys.fields() });
    },
  });
}

// ============================================================
// Concept Hooks
// ============================================================

export function useConcept(conceptId: string) {
  return useQuery({
    queryKey: crossFieldKeys.concept(conceptId),
    queryFn: async (): Promise<ConceptWithEquivalences> => {
      const res = await fetch(`/api/crossfield/concepts/${conceptId}`);
      if (!res.ok) throw new Error("Failed to fetch concept");
      return res.json();
    },
    enabled: !!conceptId,
  });
}

export function useConceptsByField(fieldId: string) {
  return useQuery({
    queryKey: crossFieldKeys.conceptsByField(fieldId),
    queryFn: async (): Promise<ConceptSummary[]> => {
      const res = await fetch(`/api/crossfield/concepts?fieldId=${fieldId}`);
      if (!res.ok) throw new Error("Failed to fetch concepts");
      return res.json();
    },
    enabled: !!fieldId,
  });
}

export function useConceptSearch(query: string, fieldId?: string) {
  return useQuery({
    queryKey: crossFieldKeys.conceptSearch(query),
    queryFn: async (): Promise<ConceptSummary[]> => {
      const params = new URLSearchParams({ q: query });
      if (fieldId) params.set("fieldId", fieldId);
      const res = await fetch(`/api/crossfield/concepts?${params}`);
      if (!res.ok) throw new Error("Failed to search concepts");
      return res.json();
    },
    enabled: query.length >= 2,
  });
}

export function useSimilarConcepts(conceptId: string, minSimilarity = 0.7) {
  return useQuery({
    queryKey: crossFieldKeys.similarConcepts(conceptId),
    queryFn: async (): Promise<
      Array<{ concept: ConceptSummary; similarity: number }>
    > => {
      const res = await fetch(
        `/api/crossfield/concepts/${conceptId}/similar?minSimilarity=${minSimilarity}`
      );
      if (!res.ok) throw new Error("Failed to find similar concepts");
      return res.json();
    },
    enabled: !!conceptId,
  });
}

export function useCreateConcept() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      definition: string;
      fieldId: string;
      aliases?: string[];
      relatedTerms?: string[];
    }) => {
      const res = await fetch("/api/crossfield/concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create concept");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: crossFieldKeys.conceptsByField(variables.fieldId),
      });
    },
  });
}

export function useProposeEquivalence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      sourceConceptId: string;
      targetConceptId: string;
      equivalenceType: ConceptEquivalenceType;
      justification: string;
    }) => {
      const res = await fetch("/api/crossfield/equivalences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to propose equivalence");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: crossFieldKeys.concept(variables.sourceConceptId),
      });
      queryClient.invalidateQueries({
        queryKey: crossFieldKeys.concept(variables.targetConceptId),
      });
    },
  });
}

export function useVerifyEquivalence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (equivalenceId: string) => {
      const res = await fetch(
        `/api/crossfield/equivalences/${equivalenceId}/verify`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to verify equivalence");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crossFieldKeys.concepts() });
    },
  });
}

// ============================================================
// Alert Hooks
// ============================================================

export function useAlerts(options?: {
  status?: CrossFieldAlertStatus;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: [...crossFieldKeys.alerts(), options],
    queryFn: async (): Promise<{
      alerts: CrossFieldAlertData[];
      total: number;
    }> => {
      const params = new URLSearchParams();
      if (options?.status) params.set("status", options.status);
      if (options?.limit) params.set("limit", options.limit.toString());
      if (options?.offset) params.set("offset", options.offset.toString());

      const res = await fetch(`/api/crossfield/alerts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return res.json();
    },
  });
}

export function useUnreadAlertCount() {
  return useQuery({
    queryKey: crossFieldKeys.alertCount(),
    queryFn: async (): Promise<number> => {
      const res = await fetch("/api/crossfield/alerts?countOnly=true");
      if (!res.ok) throw new Error("Failed to fetch alert count");
      const data = await res.json();
      return data.count;
    },
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useUpdateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      alertId,
      action,
    }: {
      alertId: string;
      action: "read" | "actioned" | "dismiss";
    }) => {
      const res = await fetch(`/api/crossfield/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Failed to update alert");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crossFieldKeys.alerts() });
      queryClient.invalidateQueries({ queryKey: crossFieldKeys.alertCount() });
    },
  });
}
