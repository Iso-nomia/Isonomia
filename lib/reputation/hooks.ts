/**
 * React Query hooks for reputation system
 * Phase 4.2: Argumentation-Based Reputation
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ScholarStatsSummary,
  ExpertiseAreaSummary,
  ReviewerProfileSummary,
} from "./types";

// ===============================
// Query Keys
// ===============================

export const reputationKeys = {
  all: ["reputation"] as const,
  stats: () => [...reputationKeys.all, "stats"] as const,
  userStats: (userId: string) => [...reputationKeys.stats(), userId] as const,
  leaderboard: (filters?: Record<string, unknown>) =>
    [...reputationKeys.all, "leaderboard", filters] as const,
  expertise: () => [...reputationKeys.all, "expertise"] as const,
  userExpertise: (userId: string) =>
    [...reputationKeys.expertise(), userId] as const,
  topicExperts: (topicArea: string) =>
    [...reputationKeys.expertise(), "topic", topicArea] as const,
  reviewer: () => [...reputationKeys.all, "reviewer"] as const,
  reviewerProfile: (userId: string) =>
    [...reputationKeys.reviewer(), userId] as const,
  contributions: () => [...reputationKeys.all, "contributions"] as const,
  userContributions: (userId: string) =>
    [...reputationKeys.contributions(), userId] as const,
};

// ===============================
// Stats Hooks
// ===============================

export function useScholarStats(userId: string) {
  return useQuery({
    queryKey: reputationKeys.userStats(userId),
    queryFn: async (): Promise<ScholarStatsSummary> => {
      const res = await fetch(`/api/reputation/stats/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useRecalculateStats(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/reputation/stats/${userId}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to recalculate stats");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: reputationKeys.userStats(userId),
      });
    },
  });
}

// ===============================
// Leaderboard Hook
// ===============================

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userImage: string | null;
  reputationScore: number;
  totalArguments: number;
  consensusRate: number;
  citationCount: number;
}

export function useReputationLeaderboard(options?: {
  limit?: number;
  minContributions?: number;
}) {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", options.limit.toString());
  if (options?.minContributions)
    params.set("minContributions", options.minContributions.toString());

  return useQuery({
    queryKey: reputationKeys.leaderboard(options),
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      const res = await fetch(
        `/api/reputation/leaderboard?${params.toString()}`
      );
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ===============================
// Expertise Hooks
// ===============================

export function useUserExpertise(userId: string) {
  return useQuery({
    queryKey: reputationKeys.userExpertise(userId),
    queryFn: async (): Promise<ExpertiseAreaSummary[]> => {
      const res = await fetch(`/api/reputation/expertise/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch expertise");
      return res.json();
    },
    enabled: !!userId,
  });
}

interface TopicExpert {
  userId: string;
  userName: string;
  expertiseLevel: string;
  contributionCount: number;
}

export function useTopicExperts(topicArea: string, limit = 10) {
  return useQuery({
    queryKey: reputationKeys.topicExperts(topicArea),
    queryFn: async (): Promise<TopicExpert[]> => {
      const encodedTopic = encodeURIComponent(topicArea);
      const res = await fetch(
        `/api/reputation/topic/${encodedTopic}/experts?limit=${limit}`
      );
      if (!res.ok) throw new Error("Failed to fetch experts");
      return res.json();
    },
    enabled: !!topicArea,
  });
}

// ===============================
// Reviewer Profile Hooks
// ===============================

export function useReviewerProfile(userId: string) {
  return useQuery({
    queryKey: reputationKeys.reviewerProfile(userId),
    queryFn: async (): Promise<ReviewerProfileSummary> => {
      const res = await fetch(`/api/reputation/reviewer/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch reviewer profile");
      return res.json();
    },
    enabled: !!userId,
  });
}

// ===============================
// Contributions Hooks
// ===============================

interface Contribution {
  id: string;
  type: string;
  createdAt: string;
  deliberation?: { id: string; title: string | null };
  argument?: { id: string; text: string };
  baseWeight: number;
  qualityMultiplier: number;
}

export function useUserContributions(
  userId: string,
  options?: { type?: string; limit?: number }
) {
  const params = new URLSearchParams();
  if (options?.type) params.set("type", options.type);
  if (options?.limit) params.set("limit", options.limit.toString());

  return useQuery({
    queryKey: [...reputationKeys.userContributions(userId), options],
    queryFn: async (): Promise<Contribution[]> => {
      const res = await fetch(
        `/api/reputation/contributions/${userId}?${params.toString()}`
      );
      if (!res.ok) throw new Error("Failed to fetch contributions");
      return res.json();
    },
    enabled: !!userId,
  });
}

interface ContributionSummaryEntry {
  type: string;
  count: number;
  totalWeight: number;
}

export function useContributionSummary(userId: string) {
  return useQuery({
    queryKey: [...reputationKeys.userContributions(userId), "summary"],
    queryFn: async (): Promise<ContributionSummaryEntry[]> => {
      const res = await fetch(
        `/api/reputation/contributions/${userId}?summary=true`
      );
      if (!res.ok) throw new Error("Failed to fetch contribution summary");
      return res.json();
    },
    enabled: !!userId,
  });
}

// ===============================
// Current User Shorthand Hooks
// ===============================

export function useMyStats() {
  return useQuery({
    queryKey: [...reputationKeys.stats(), "me"],
    queryFn: async (): Promise<ScholarStatsSummary> => {
      const res = await fetch("/api/reputation/stats/me");
      if (!res.ok) throw new Error("Failed to fetch my stats");
      return res.json();
    },
  });
}

export function useMyExpertise() {
  return useQuery({
    queryKey: [...reputationKeys.expertise(), "me"],
    queryFn: async (): Promise<ExpertiseAreaSummary[]> => {
      const res = await fetch("/api/reputation/expertise/me");
      if (!res.ok) throw new Error("Failed to fetch my expertise");
      return res.json();
    },
  });
}

export function useMyContributions(options?: { type?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (options?.type) params.set("type", options.type);
  if (options?.limit) params.set("limit", options.limit.toString());

  return useQuery({
    queryKey: [...reputationKeys.contributions(), "me", options],
    queryFn: async (): Promise<Contribution[]> => {
      const res = await fetch(
        `/api/reputation/contributions/me?${params.toString()}`
      );
      if (!res.ok) throw new Error("Failed to fetch my contributions");
      return res.json();
    },
  });
}

export function useMyReviewerProfile() {
  return useQuery({
    queryKey: [...reputationKeys.reviewer(), "me"],
    queryFn: async (): Promise<ReviewerProfileSummary> => {
      const res = await fetch("/api/reputation/reviewer/me");
      if (!res.ok) throw new Error("Failed to fetch my reviewer profile");
      return res.json();
    },
  });
}
