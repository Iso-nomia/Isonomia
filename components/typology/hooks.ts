"use client";

/**
 * Typology — shared SWR hooks, DTOs, and API mutators (B3).
 *
 * One place for endpoint URLs and DTO shapes. Mirrors
 * `components/facilitation/hooks.ts`.
 */

import * as React from "react";
import useSWR, { type SWRConfiguration } from "swr";

const fetcher = async (url: string) => {
  const r = await fetch(url, { cache: "no-store", redirect: "manual" });
  // Middleware-level auth redirects (307 → /login) come back as opaque-redirect
  // when `redirect: "manual"`. Surface that as a structured error so consumers
  // can show a "Sign in to view" affordance instead of a JSON parse failure.
  if (r.type === "opaqueredirect" || r.status === 0) {
    const err = new Error("AUTH_REQUIRED") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  if (!r.ok) {
    const err = new Error(`HTTP ${r.status}`) as Error & { status?: number };
    err.status = r.status;
    throw err;
  }
  return r.json();
};

// ─── Polling cadences (ms) ───────────────────────────────────────────────
export const POLL_TAGS_MS = 10_000;
export const POLL_CANDIDATES_MS = 5_000;
export const POLL_SUMMARIES_MS = 15_000;

// ─── DTOs ────────────────────────────────────────────────────────────────

export type DisagreementAxisKey = "VALUE" | "EMPIRICAL" | "FRAMING" | "INTEREST";
export type DisagreementTagTargetType = "CLAIM" | "ARGUMENT" | "EDGE";
export type DisagreementTagAuthorRole = "PARTICIPANT" | "FACILITATOR" | "HOST";
export type DisagreementTagSeedSource =
  | "MANUAL"
  | "INTERVENTION_SEED"
  | "METRIC_SEED"
  | "REPEATED_ATTACK_SEED"
  | "VALUE_LEXICON_SEED"
  | "IMPORTED";
export type MetaConsensusSummaryStatus = "DRAFT" | "PUBLISHED" | "RETRACTED";

export interface DisagreementAxisDTO {
  id: string;
  key: DisagreementAxisKey;
  displayName: string;
  description: string | null;
  colorToken: string | null;
  interventionHint: string | null;
  version: number;
  isActive: boolean;
}

export interface DisagreementTagDTO {
  id: string;
  deliberationId: string;
  sessionId: string | null;
  targetType: DisagreementTagTargetType;
  targetId: string;
  axisId: string;
  axisVersion: number;
  confidence: string;
  evidenceText: string;
  evidenceJson: Record<string, unknown> | null;
  authoredById: string;
  authoredRole: DisagreementTagAuthorRole;
  seedSource: DisagreementTagSeedSource;
  confirmedAt: string | null;
  confirmedById: string | null;
  retractedAt: string | null;
  retractedById: string | null;
  retractedReasonText: string | null;
  createdAt: string;
}

export interface TagsListResponse {
  tags: DisagreementTagDTO[];
  nextCursor: string | null;
}

export interface TypologyCandidateDTO {
  id: string;
  sessionId: string;
  deliberationId: string;
  targetType: DisagreementTagTargetType | null;
  targetId: string | null;
  suggestedAxisId: string;
  suggestedAxisVersion: number;
  seedSource: DisagreementTagSeedSource;
  rationaleText: string;
  priority: number;
  ruleName: string;
  ruleVersion: number;
  promotedToTagId: string | null;
  promotedAt: string | null;
  dismissedAt: string | null;
  dismissedReasonText: string | null;
  createdAt: string;
}

export interface CandidatesListResponse {
  candidates: TypologyCandidateDTO[];
  nextCursor: string | null;
}

export interface MetaConsensusSummaryBody {
  agreedOn: string[];
  disagreedOn: Array<{
    axisKey: DisagreementAxisKey;
    summary: string;
    supportingTagIds: string[];
  }>;
  blockers: string[];
  nextSteps: string[];
}

export interface MetaConsensusSummaryDTO {
  id: string;
  deliberationId: string;
  sessionId: string | null;
  version: number;
  status: MetaConsensusSummaryStatus;
  authoredById: string;
  publishedAt: string | null;
  publishedById: string | null;
  retractedAt: string | null;
  retractedById: string | null;
  retractedReasonText: string | null;
  parentSummaryId: string | null;
  bodyJson: MetaConsensusSummaryBody;
  narrativeText: string | null;
  snapshotJson: Record<string, unknown> | null;
  snapshotHash: string | null;
  createdAt: string;
}

export interface SummariesListResponse {
  summaries: MetaConsensusSummaryDTO[];
  nextCursor: string | null;
}

export interface SummaryDetailResponse {
  summary: MetaConsensusSummaryDTO;
  supportingTags: DisagreementTagDTO[];
  events: unknown[];
  hashChainValid: boolean;
  brokenAtEventId?: string | null;
}

export interface TypologyEventDTO {
  id: string;
  deliberationId: string;
  sessionId: string | null;
  eventType: string;
  actorId: string;
  actorRole: string;
  payloadJson: Record<string, unknown> | null;
  hashChainPrev: string | null;
  hashChainSelf: string;
  tagId: string | null;
  summaryId: string | null;
  candidateId: string | null;
  createdAt: string;
}

export interface EventsResponse {
  events: TypologyEventDTO[];
  nextCursor: string | null;
  hashChainValid: boolean;
  brokenAtEventId: string | null;
}

export interface AxesResponse {
  axes: DisagreementAxisDTO[];
}

// ─── Hooks ───────────────────────────────────────────────────────────────

const cfg = (refreshMs: number): SWRConfiguration => ({
  refreshInterval: refreshMs,
  revalidateOnFocus: false,
  shouldRetryOnError: true,
  errorRetryCount: 3,
});

export function useAxes() {
  return useSWR<AxesResponse>("/api/typology/axes", fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });
}

/** Lookup table from axis id → axis key, populated from `useAxes()`. */
export function useAxisIdToKey(): Map<string, DisagreementAxisKey> {
  const { data } = useAxes();
  return React.useMemo(() => {
    const m = new Map<string, DisagreementAxisKey>();
    for (const a of data?.axes ?? []) m.set(a.id, a.key);
    return m;
  }, [data]);
}



export function useTags(
  deliberationId: string | null,
  opts: {
    sessionId?: string | null;
    targetType?: DisagreementTagTargetType;
    targetId?: string;
    axisKey?: DisagreementAxisKey;
    includeRetracted?: boolean;
  } = {},
) {
  const params = new URLSearchParams();
  if (opts.sessionId !== undefined)
    params.set("sessionId", opts.sessionId === null ? "null" : opts.sessionId);
  if (opts.targetType) params.set("targetType", opts.targetType);
  if (opts.targetId) params.set("targetId", opts.targetId);
  if (opts.axisKey) params.set("axisKey", opts.axisKey);
  if (opts.includeRetracted) params.set("includeRetracted", "true");
  const qs = params.toString();
  return useSWR<TagsListResponse>(
    deliberationId
      ? `/api/deliberations/${deliberationId}/typology/tags${qs ? `?${qs}` : ""}`
      : null,
    fetcher,
    cfg(POLL_TAGS_MS),
  );
}

export function useCandidates(
  sessionId: string | null,
  status: "pending" | "promoted" | "dismissed" | "all" = "pending",
) {
  return useSWR<CandidatesListResponse>(
    sessionId
      ? `/api/facilitation/sessions/${sessionId}/typology/candidates?status=${status}`
      : null,
    fetcher,
    cfg(POLL_CANDIDATES_MS),
  );
}

export function useSummaries(
  deliberationId: string | null,
  opts: { sessionId?: string | null; all?: boolean } = {},
) {
  const params = new URLSearchParams();
  if (opts.sessionId !== undefined)
    params.set("sessionId", opts.sessionId === null ? "null" : opts.sessionId);
  if (opts.all) params.set("all", "true");
  const qs = params.toString();
  return useSWR<SummariesListResponse>(
    deliberationId
      ? `/api/deliberations/${deliberationId}/typology/summaries${qs ? `?${qs}` : ""}`
      : null,
    fetcher,
    cfg(POLL_SUMMARIES_MS),
  );
}

export function useSummaryDetail(summaryId: string | null) {
  return useSWR<SummaryDetailResponse>(
    summaryId ? `/api/typology/summaries/${summaryId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}

export function useTypologyEvents(
  deliberationId: string | null,
  sessionId?: string | null,
) {
  const params = new URLSearchParams();
  if (sessionId !== undefined)
    params.set("sessionId", sessionId === null ? "null" : sessionId);
  params.set("limit", "200");
  return useSWR<EventsResponse>(
    deliberationId
      ? `/api/deliberations/${deliberationId}/typology/events?${params.toString()}`
      : null,
    fetcher,
    cfg(POLL_TAGS_MS),
  );
}

// ─── Mutators ────────────────────────────────────────────────────────────

async function postJson(url: string, body: unknown = {}, method: "POST" | "PATCH" = "POST") {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = (json as { error?: { code?: string } }).error?.code ?? "ERROR";
    const message =
      (json as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`;
    const err = new Error(message) as Error & { status: number; code: string; details?: unknown };
    err.status = res.status;
    err.code = code;
    err.details = (json as { error?: { details?: unknown } }).error?.details;
    throw err;
  }
  return json;
}

export const typologyApi = {
  proposeTag: (
    deliberationId: string,
    body: {
      targetType: DisagreementTagTargetType;
      targetId: string;
      axisKey: DisagreementAxisKey;
      confidence: number;
      evidenceText: string;
      evidenceJson?: Record<string, unknown>;
      sessionId?: string | null;
    },
  ) => postJson(`/api/deliberations/${deliberationId}/typology/tags`, body),
  confirmTag: (tagId: string, body: { confidence?: number } = {}) =>
    postJson(`/api/typology/tags/${tagId}/confirm`, body),
  retractTag: (tagId: string, body: { reasonText: string }) =>
    postJson(`/api/typology/tags/${tagId}/retract`, body),
  promoteCandidate: (
    candidateId: string,
    body: {
      confidence?: number;
      evidenceText?: string;
      axisKey?: DisagreementAxisKey;
      sessionScope?: boolean;
    },
  ) => postJson(`/api/typology/candidates/${candidateId}/promote`, body),
  dismissCandidate: (candidateId: string, body: { reasonText: string }) =>
    postJson(`/api/typology/candidates/${candidateId}/dismiss`, body),
  draftSummary: (
    deliberationId: string,
    body: {
      sessionId?: string | null;
      bodyJson: MetaConsensusSummaryBody;
      narrativeText?: string | null;
      parentSummaryId?: string | null;
    },
  ) => postJson(`/api/deliberations/${deliberationId}/typology/summaries`, body),
  editDraft: (
    summaryId: string,
    body: { bodyJson?: MetaConsensusSummaryBody; narrativeText?: string | null },
  ) => postJson(`/api/typology/summaries/${summaryId}`, body, "PATCH"),
  publishSummary: (summaryId: string) =>
    postJson(`/api/typology/summaries/${summaryId}/publish`, {}),
  retractSummary: (summaryId: string, body: { reasonText: string }) =>
    postJson(`/api/typology/summaries/${summaryId}/retract`, body),
};

// ─── Misc helpers ────────────────────────────────────────────────────────

export const AXIS_LABEL: Record<DisagreementAxisKey, string> = {
  VALUE: "Value",
  EMPIRICAL: "Empirical",
  FRAMING: "Framing",
  INTEREST: "Interest",
};

/** Tailwind classes per axis. Used by `AxisBadge` and the editor selectors. */
export const AXIS_CLASSES: Record<
  DisagreementAxisKey,
  { bg: string; border: string; text: string; chip: string }
> = {
  VALUE: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-800",
    chip: "bg-amber-100 text-amber-800 border-amber-300",
  },
  EMPIRICAL: {
    bg: "bg-sky-50",
    border: "border-sky-300",
    text: "text-sky-800",
    chip: "bg-sky-100 text-sky-800 border-sky-300",
  },
  FRAMING: {
    bg: "bg-violet-50",
    border: "border-violet-300",
    text: "text-violet-800",
    chip: "bg-violet-100 text-violet-800 border-violet-300",
  },
  INTEREST: {
    bg: "bg-rose-50",
    border: "border-rose-300",
    text: "text-rose-800",
    chip: "bg-rose-100 text-rose-800 border-rose-300",
  },
};

/** Format a Decimal-as-string confidence to 2dp (`"0.72"` → `"0.72"`). */
export function fmtConfidence(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return n.toFixed(2);
}
