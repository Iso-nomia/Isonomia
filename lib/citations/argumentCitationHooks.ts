"use client";

/**
 * React Query hooks for argument citations
 * Phase 3.2: Argument-Level Citations (Chunk 7)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArgumentWithCitations,
  CitationGraph,
  ArgCitationType,
  ArgumentPermalinkInfo,
  ArgumentCitationSummary,
  CitationTextResult,
} from "./argumentCitationTypes";

// ============================================================
// QUERY KEYS
// ============================================================

export const argumentCitationKeys = {
  all: ["argument-citations"] as const,
  argument: (id: string) => [...argumentCitationKeys.all, "argument", id] as const,
  graph: (id: string) => [...argumentCitationKeys.all, "graph", id] as const,
  deliberationGraph: (id: string) =>
    [...argumentCitationKeys.all, "deliberation-graph", id] as const,
  permalink: (id: string) => [...argumentCitationKeys.all, "permalink", id] as const,
  mostCited: (deliberationId?: string) =>
    [...argumentCitationKeys.all, "most-cited", deliberationId || "all"] as const,
};

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface PermalinkWithCitation extends ArgumentPermalinkInfo {
  citation?: CitationTextResult;
}

interface CreateCitationParams {
  citingArgumentId: string;
  citedArgumentId: string;
  citationType: ArgCitationType;
  annotation?: string;
  citedInContext?: {
    premiseArgumentId: string;
    premiseClaimId: string;
  };
}

interface DeleteCitationParams {
  citationId: string;
  citingArgumentId: string;
  citedArgumentId: string;
}

interface UpdateCitationParams {
  citationId: string;
  argumentId: string;
  annotation: string | null;
}

interface DeliberationCitationGraphData {
  graph: CitationGraph;
  stats?: {
    totalArguments: number;
    totalCitationsMade: number;
    totalCitationsReceived: number;
    argumentsWithCitations: number;
    citationDensity: number;
    mostCitedArguments: Array<{
      id: string;
      text: string;
      citationCount: number;
    }>;
  };
}

// ============================================================
// QUERY HOOKS
// ============================================================

/**
 * Hook to fetch argument citations (both made and received)
 */
export function useArgumentCitations(argumentId: string | null | undefined) {
  return useQuery({
    queryKey: argumentCitationKeys.argument(argumentId || ""),
    queryFn: async (): Promise<ArgumentWithCitations> => {
      const res = await fetch(`/api/arguments/${argumentId}/arg-citations`);
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch citations");
      }
      const data = await res.json();
      return data.data;
    },
    enabled: !!argumentId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch citation graph for an argument
 */
export function useArgumentCitationGraph(
  argumentId: string | null | undefined,
  options?: {
    depth?: number;
    includeIndirect?: boolean;
    enabled?: boolean;
  }
) {
  const { depth = 2, includeIndirect = true, enabled = true } = options || {};

  return useQuery({
    queryKey: [...argumentCitationKeys.graph(argumentId || ""), depth, includeIndirect],
    queryFn: async (): Promise<CitationGraph> => {
      const params = new URLSearchParams({
        depth: String(depth),
        includeIndirect: String(includeIndirect),
      });
      const res = await fetch(
        `/api/arguments/${argumentId}/citation-graph?${params}`
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch citation graph");
      }
      const data = await res.json();
      return data.data;
    },
    enabled: !!argumentId && enabled,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to fetch citation graph for a deliberation
 */
export function useDeliberationCitationGraph(
  deliberationId: string | null | undefined,
  options?: {
    includeExternal?: boolean;
    includeStats?: boolean;
    enabled?: boolean;
  }
) {
  const { includeExternal = true, includeStats = false, enabled = true } = options || {};

  return useQuery({
    queryKey: [
      ...argumentCitationKeys.deliberationGraph(deliberationId || ""),
      includeExternal,
      includeStats,
    ],
    queryFn: async (): Promise<DeliberationCitationGraphData> => {
      const params = new URLSearchParams({
        includeExternal: String(includeExternal),
        includeStats: String(includeStats),
      });
      const res = await fetch(
        `/api/deliberations/${deliberationId}/citation-graph?${params}`
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch citation graph");
      }
      const data = await res.json();
      return data.data;
    },
    enabled: !!deliberationId && enabled,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to fetch permalink for an argument
 */
export function usePermalink(
  argumentId: string | null | undefined,
  options?: {
    format?: "apa" | "mla" | "chicago" | "bibtex" | "mesh";
    enabled?: boolean;
  }
) {
  const { format, enabled = true } = options || {};

  return useQuery({
    queryKey: [...argumentCitationKeys.permalink(argumentId || ""), format],
    queryFn: async (): Promise<PermalinkWithCitation> => {
      const params = format ? `?format=${format}` : "";
      const res = await fetch(`/api/arguments/${argumentId}/permalink${params}`);
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch permalink");
      }
      const data = await res.json();
      return data.data;
    },
    enabled: !!argumentId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - permalinks don't change often
  });
}

// ============================================================
// MUTATION HOOKS
// ============================================================

/**
 * Hook to create a citation between arguments
 */
export function useCreateCitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateCitationParams): Promise<ArgumentCitationSummary> => {
      const { citingArgumentId, ...body } = params;
      const res = await fetch(`/api/arguments/${citingArgumentId}/arg-citations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to create citation");
      }
      const data = await res.json();
      return data.data;
    },
    onSuccess: (_: ArgumentCitationSummary, params: CreateCitationParams) => {
      // Invalidate citations for both arguments
      queryClient.invalidateQueries({
        queryKey: argumentCitationKeys.argument(params.citingArgumentId),
      });
      queryClient.invalidateQueries({
        queryKey: argumentCitationKeys.argument(params.citedArgumentId),
      });
      // Also invalidate any graphs that might include these arguments
      queryClient.invalidateQueries({
        queryKey: argumentCitationKeys.graph(params.citingArgumentId),
      });
      queryClient.invalidateQueries({
        queryKey: argumentCitationKeys.graph(params.citedArgumentId),
      });
    },
  });
}

/**
 * Hook to delete a citation
 */
export function useDeleteCitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: DeleteCitationParams): Promise<void> => {
      const { citationId, citingArgumentId } = params;
      const res = await fetch(
        `/api/arguments/${citingArgumentId}/arg-citations/${citationId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to delete citation");
      }
    },
    onSuccess: (_: void, params: DeleteCitationParams) => {
      // Invalidate citations for both arguments
      queryClient.invalidateQueries({
        queryKey: argumentCitationKeys.argument(params.citingArgumentId),
      });
      queryClient.invalidateQueries({
        queryKey: argumentCitationKeys.argument(params.citedArgumentId),
      });
    },
  });
}

/**
 * Hook to update citation annotation
 */
export function useUpdateCitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateCitationParams): Promise<ArgumentCitationSummary> => {
      const { citationId, argumentId, annotation } = params;
      const res = await fetch(
        `/api/arguments/${argumentId}/arg-citations/${citationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ annotation }),
        }
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to update citation");
      }
      const data = await res.json();
      return data.data;
    },
    onSuccess: (_: ArgumentCitationSummary, params: UpdateCitationParams) => {
      queryClient.invalidateQueries({
        queryKey: argumentCitationKeys.argument(params.argumentId),
      });
    },
  });
}

// ============================================================
// UTILITY HOOKS
// ============================================================

/**
 * Hook to copy permalink or citation text to clipboard
 */
export function useCopyPermalink(argumentId: string | null | undefined) {
  const permalinkQuery = usePermalink(argumentId);

  const copyUrl = async (): Promise<boolean> => {
    if (!permalinkQuery.data?.fullUrl) return false;
    try {
      await navigator.clipboard.writeText(permalinkQuery.data.fullUrl);
      return true;
    } catch {
      return false;
    }
  };

  const copyCitation = async (
    format: "apa" | "mla" | "chicago" | "bibtex" | "mesh"
  ): Promise<boolean> => {
    if (!argumentId) return false;
    try {
      const res = await fetch(`/api/arguments/${argumentId}/permalink?format=${format}`);
      if (!res.ok) return false;
      const data = await res.json();
      if (data.data?.citation?.text) {
        await navigator.clipboard.writeText(data.data.citation.text);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return {
    ...permalinkQuery,
    copyUrl,
    copyCitation,
  };
}

/**
 * Hook to prefetch citation data
 */
export function usePrefetchCitations() {
  const queryClient = useQueryClient();

  const prefetchArgumentCitations = (argumentId: string) => {
    queryClient.prefetchQuery({
      queryKey: argumentCitationKeys.argument(argumentId),
      queryFn: async () => {
        const res = await fetch(`/api/arguments/${argumentId}/arg-citations`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        return data.data;
      },
      staleTime: 30 * 1000,
    });
  };

  const prefetchCitationGraph = (argumentId: string, depth = 2) => {
    queryClient.prefetchQuery({
      queryKey: [...argumentCitationKeys.graph(argumentId), depth, true],
      queryFn: async () => {
        const res = await fetch(
          `/api/arguments/${argumentId}/citation-graph?depth=${depth}&includeIndirect=true`
        );
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        return data.data;
      },
      staleTime: 60 * 1000,
    });
  };

  return {
    prefetchArgumentCitations,
    prefetchCitationGraph,
  };
}
