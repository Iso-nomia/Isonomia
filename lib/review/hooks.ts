/**
 * React Query hooks for peer review
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ReviewDeliberationSummary,
  ReviewerAssignmentSummary,
  ReviewerCommitmentSummary,
  ReviewProgressSummary,
  CreateReviewInput,
} from "./types";

// ===============================
// Query Keys
// ===============================

export const reviewKeys = {
  all: ["reviews"] as const,
  lists: () => [...reviewKeys.all, "list"] as const,
  list: (filters: Record<string, any>) =>
    [...reviewKeys.lists(), filters] as const,
  details: () => [...reviewKeys.all, "detail"] as const,
  detail: (id: string) => [...reviewKeys.details(), id] as const,
  assignments: (reviewId: string) =>
    [...reviewKeys.detail(reviewId), "assignments"] as const,
  commitments: (reviewId: string) =>
    [...reviewKeys.detail(reviewId), "commitments"] as const,
  responses: (reviewId: string) =>
    [...reviewKeys.detail(reviewId), "responses"] as const,
  progress: (reviewId: string) =>
    [...reviewKeys.detail(reviewId), "progress"] as const,
  timeline: (reviewId: string) =>
    [...reviewKeys.detail(reviewId), "timeline"] as const,
};

// ===============================
// Review Queries
// ===============================

export function useReview(reviewId: string) {
  return useQuery({
    queryKey: reviewKeys.detail(reviewId),
    queryFn: async (): Promise<ReviewDeliberationSummary> => {
      const res = await fetch(`/api/review/${reviewId}`);
      if (!res.ok) throw new Error("Failed to fetch review");
      return res.json();
    },
    enabled: !!reviewId,
  });
}

export function useUserReviews(options?: {
  role?: "editor" | "reviewer" | "author";
  status?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (options?.role) params.set("role", options.role);
  if (options?.status) params.set("status", options.status);
  if (options?.page) params.set("page", String(options.page));
  if (options?.limit) params.set("limit", String(options.limit));

  return useQuery({
    queryKey: reviewKeys.list(options || {}),
    queryFn: async () => {
      const res = await fetch(`/api/review?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch reviews");
      return res.json();
    },
  });
}

export function useReviewProgress(reviewId: string) {
  return useQuery({
    queryKey: reviewKeys.progress(reviewId),
    queryFn: async (): Promise<
      ReviewProgressSummary & { canAdvance: boolean; blockers: string[] }
    > => {
      const res = await fetch(`/api/review/${reviewId}/progress`);
      if (!res.ok) throw new Error("Failed to fetch progress");
      return res.json();
    },
    enabled: !!reviewId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useReviewTimeline(reviewId: string) {
  return useQuery({
    queryKey: reviewKeys.timeline(reviewId),
    queryFn: async () => {
      const res = await fetch(`/api/review/${reviewId}/timeline`);
      if (!res.ok) throw new Error("Failed to fetch timeline");
      return res.json();
    },
    enabled: !!reviewId,
  });
}

// ===============================
// Assignment Queries & Mutations
// ===============================

export function useReviewerAssignments(reviewId: string) {
  return useQuery({
    queryKey: reviewKeys.assignments(reviewId),
    queryFn: async (): Promise<ReviewerAssignmentSummary[]> => {
      const res = await fetch(`/api/review/${reviewId}/assignments`);
      if (!res.ok) throw new Error("Failed to fetch assignments");
      return res.json();
    },
    enabled: !!reviewId,
  });
}

export function useInviteReviewer(reviewId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      userId: string;
      role?: string;
      deadline?: string;
    }) => {
      const res = await fetch(`/api/review/${reviewId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to invite reviewer");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: reviewKeys.assignments(reviewId),
      });
    },
  });
}

export function useRespondToInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assignmentId,
      accept,
      declineReason,
    }: {
      assignmentId: string;
      accept: boolean;
      declineReason?: string;
    }) => {
      const res = await fetch(
        `/api/review/assignments/${assignmentId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accept, declineReason }),
        }
      );
      if (!res.ok) throw new Error("Failed to respond to invitation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all });
    },
  });
}

// ===============================
// Commitment Queries & Mutations
// ===============================

export function useReviewCommitments(
  reviewId: string,
  options?: { onlyBlocking?: boolean; onlyUnresolved?: boolean }
) {
  const params = new URLSearchParams();
  if (options?.onlyBlocking) params.set("blocking", "true");
  if (options?.onlyUnresolved) params.set("unresolved", "true");

  return useQuery({
    queryKey: [...reviewKeys.commitments(reviewId), options],
    queryFn: async (): Promise<ReviewerCommitmentSummary[]> => {
      const res = await fetch(
        `/api/review/${reviewId}/commitments?${params.toString()}`
      );
      if (!res.ok) throw new Error("Failed to fetch commitments");
      return res.json();
    },
    enabled: !!reviewId,
  });
}

export function useAssignmentCommitments(assignmentId: string) {
  return useQuery({
    queryKey: ["assignment", assignmentId, "commitments"],
    queryFn: async (): Promise<ReviewerCommitmentSummary[]> => {
      const res = await fetch(
        `/api/review/assignments/${assignmentId}/commitments`
      );
      if (!res.ok) throw new Error("Failed to fetch commitments");
      return res.json();
    },
    enabled: !!assignmentId,
  });
}

export function useCreateCommitment(assignmentId: string, reviewId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      topic: string;
      description: string;
      position: string;
      strength: string;
      argumentId?: string;
      targetClaimId?: string;
    }) => {
      const res = await fetch(
        `/api/review/assignments/${assignmentId}/commitments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) throw new Error("Failed to create commitment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: reviewKeys.commitments(reviewId),
      });
      queryClient.invalidateQueries({
        queryKey: reviewKeys.progress(reviewId),
      });
      queryClient.invalidateQueries({
        queryKey: ["assignment", assignmentId, "commitments"],
      });
    },
  });
}

export function useResolveCommitment(reviewId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      commitmentId,
      resolutionNote,
    }: {
      commitmentId: string;
      resolutionNote: string;
    }) => {
      const res = await fetch(
        `/api/review/commitments/${commitmentId}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolutionNote }),
        }
      );
      if (!res.ok) throw new Error("Failed to resolve commitment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: reviewKeys.commitments(reviewId),
      });
      queryClient.invalidateQueries({
        queryKey: reviewKeys.progress(reviewId),
      });
    },
  });
}

export function useReopenCommitment(reviewId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commitmentId: string) => {
      const res = await fetch(
        `/api/review/commitments/${commitmentId}/resolve`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) throw new Error("Failed to reopen commitment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: reviewKeys.commitments(reviewId),
      });
      queryClient.invalidateQueries({
        queryKey: reviewKeys.progress(reviewId),
      });
    },
  });
}

// ===============================
// Response Queries & Mutations
// ===============================

export function useAuthorResponses(reviewId: string) {
  return useQuery({
    queryKey: reviewKeys.responses(reviewId),
    queryFn: async () => {
      const res = await fetch(`/api/review/${reviewId}/responses`);
      if (!res.ok) throw new Error("Failed to fetch responses");
      return res.json();
    },
    enabled: !!reviewId,
  });
}

export function useResponseSummary(reviewId: string) {
  return useQuery({
    queryKey: [...reviewKeys.responses(reviewId), "summary"],
    queryFn: async () => {
      const res = await fetch(`/api/review/${reviewId}/responses?summary=true`);
      if (!res.ok) throw new Error("Failed to fetch response summary");
      return res.json();
    },
    enabled: !!reviewId,
  });
}

export function useCreateAuthorResponse(reviewId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      phaseId: string;
      summary: string;
      moves: Array<{
        targetCommitmentId?: string;
        targetArgumentId?: string;
        moveType: string;
        explanation: string;
        supportingArgumentId?: string;
        revisionDescription?: string;
        revisionLocation?: string;
      }>;
      revisionId?: string;
    }) => {
      const res = await fetch(`/api/review/${reviewId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create response");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: reviewKeys.responses(reviewId),
      });
      queryClient.invalidateQueries({
        queryKey: reviewKeys.progress(reviewId),
      });
    },
  });
}

// ===============================
// Review Actions
// ===============================

export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateReviewInput) => {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to create review");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.lists() });
    },
  });
}

export function useUpdateReviewStatus(reviewId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch(`/api/review/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update review status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.detail(reviewId) });
      queryClient.invalidateQueries({ queryKey: reviewKeys.progress(reviewId) });
    },
  });
}

export function useAdvancePhase(reviewId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/review/${reviewId}/phase/advance`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.blockers?.join(", ") || "Cannot advance phase");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.detail(reviewId) });
      queryClient.invalidateQueries({ queryKey: reviewKeys.progress(reviewId) });
      queryClient.invalidateQueries({ queryKey: reviewKeys.timeline(reviewId) });
    },
  });
}

export function useMakeDecision(reviewId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { decision: string; note: string }) => {
      const res = await fetch(`/api/review/${reviewId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to make decision");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.detail(reviewId) });
      queryClient.invalidateQueries({ queryKey: reviewKeys.progress(reviewId) });
      queryClient.invalidateQueries({ queryKey: reviewKeys.timeline(reviewId) });
    },
  });
}
