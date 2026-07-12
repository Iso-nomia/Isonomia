"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CanonicalClaimSummary,
  CrossRoomSearchResult,
  ArgumentImportResult,
  ImportType,
} from "./types";

// ─────────────────────────────────────────────────────────
// Query Keys
// ─────────────────────────────────────────────────────────

export const crossDelibKeys = {
  all: ["cross-delib"] as const,
  canonical: (id: string) => [...crossDelibKeys.all, "canonical", id] as const,
  search: (query: string) => [...crossDelibKeys.all, "search", query] as const,
  related: (id: string) => [...crossDelibKeys.all, "related", id] as const,
  claimStatus: (id: string) => [...crossDelibKeys.all, "claim-status", id] as const,
};

// ─────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────

export function useCrossRoomSearch(
  query: string,
  excludeDeliberationId?: string
) {
  return useQuery({
    queryKey: crossDelibKeys.search(query),
    queryFn: async (): Promise<CrossRoomSearchResult[]> => {
      const params = new URLSearchParams({ query });
      if (excludeDeliberationId) {
        params.set("exclude", excludeDeliberationId);
      }
      const res = await fetch(`/api/cross-room-search?${params}`);
      if (!res.ok) throw new Error("Failed to search");
      return res.json();
    },
    enabled: query.length >= 3,
  });
}

export function useCanonicalClaims(searchParams?: {
  query?: string;
  field?: string;
  minInstances?: number;
}) {
  const queryString = new URLSearchParams(
    Object.entries(searchParams || {})
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  ).toString();

  return useQuery({
    queryKey: [...crossDelibKeys.all, "canonicals", queryString],
    queryFn: async (): Promise<CanonicalClaimSummary[]> => {
      const res = await fetch(`/api/canonical-claims?${queryString}`);
      if (!res.ok) throw new Error("Failed to fetch canonical claims");
      return res.json();
    },
  });
}

export function useRelatedDeliberations(deliberationId: string) {
  return useQuery({
    queryKey: crossDelibKeys.related(deliberationId),
    queryFn: async () => {
      const res = await fetch(`/api/deliberations/${deliberationId}/shared-claims-related`);
      if (!res.ok) throw new Error("Failed to fetch related deliberations");
      return res.json();
    },
    enabled: !!deliberationId,
  });
}

export function useClaimCrossRoomStatus(claimId: string) {
  return useQuery({
    queryKey: crossDelibKeys.claimStatus(claimId),
    queryFn: async () => {
      const res = await fetch(`/api/claims/${claimId}/cross-room-status`);
      if (!res.ok) throw new Error("Failed to fetch cross-room status");
      return res.json();
    },
    enabled: !!claimId,
  });
}

// ─────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────

export function useRegisterCanonicalClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      claimId,
      field,
    }: {
      claimId: string;
      field?: string;
    }): Promise<CanonicalClaimSummary> => {
      const res = await fetch("/api/canonical-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId, field }),
      });
      if (!res.ok) throw new Error("Failed to register claim");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crossDelibKeys.all });
    },
  });
}

export function useImportArgument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sourceArgumentId,
      targetDeliberationId,
      importType,
      importReason,
      preserveAttribution,
      modifications,
    }: {
      sourceArgumentId: string;
      targetDeliberationId: string;
      importType: ImportType;
      importReason?: string;
      preserveAttribution?: boolean;
      modifications?: {
        newConclusion?: string;
        excludePremises?: string[];
        addPremises?: string[];
      };
    }): Promise<ArgumentImportResult> => {
      const res = await fetch(`/api/arguments/${sourceArgumentId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetDeliberationId,
          importType,
          importReason,
          preserveAttribution,
          modifications,
        }),
      });
      if (!res.ok) throw new Error("Failed to import argument");
      return res.json();
    },
    onSuccess: (_, { targetDeliberationId }) => {
      queryClient.invalidateQueries({
        queryKey: ["deliberation", targetDeliberationId],
      });
      queryClient.invalidateQueries({ queryKey: crossDelibKeys.all });
    },
  });
}
