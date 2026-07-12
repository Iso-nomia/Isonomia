"use client";

/**
 * Facilitation cockpit — shared SWR hooks and DTO types (C3).
 *
 * One place to centralize endpoint URLs and revalidation cadences so the
 * cockpit's three columns stay aligned with the polling contract documented in
 * docs/facilitation/SSE_CONTRACT.md.
 */

import useSWR, { type SWRConfiguration } from "swr";

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

// ─── Polling cadences (ms) — match docs/facilitation/SSE_CONTRACT.md §1 ──
export const POLL_EVENTS_MS = 5_000;
export const POLL_INTERVENTIONS_MS = 5_000;
export const POLL_METRICS_MS = 15_000;

// ─── DTOs ────────────────────────────────────────────────────────────────

export type EquityMetricKind =
  | "PARTICIPATION_GINI"
  | "CHALLENGE_CONCENTRATION"
  | "RESPONSE_LATENCY_P50"
  | "ATTENTION_DEFICIT"
  | "FACILITATOR_LOAD";

export type FacilitationFramingType = "open" | "choice" | "evaluative" | "generative";

export type FacilitationCheckSeverity = "BLOCK" | "WARN" | "INFO";

export interface FacilitationCheckDTO {
  id: string;
  questionId: string;
  runId: string;
  kind: string;
  severity: FacilitationCheckSeverity;
  messageText: string;
  evidenceJson: unknown;
  acknowledgedAt: string | null;
  acknowledgedById: string | null;
  createdAt: string;
}

export interface FacilitationQuestionDTO {
  id: string;
  deliberationId: string;
  version: number;
  text: string;
  framingType: FacilitationFramingType;
  qualityReportJson: unknown;
  lockedAt: string | null;
  lockedById: string | null;
  authoredById: string;
  parentQuestionId: string | null;
  createdAt: string;
  updatedAt: string;
  checks?: FacilitationCheckDTO[];
}

export interface FacilitationSessionDTO {
  id: string;
  deliberationId: string;
  status: "OPEN" | "CLOSED" | "ESCALATED";
  isPublic: boolean;
  openedById: string;
  closedById: string | null;
  openedAt: string;
  closedAt: string | null;
  notesText: string | null;
}

export interface FacilitationEventDTO {
  id: string;
  sessionId: string;
  eventType: string;
  actorId: string;
  actorRole: string;
  payloadJson: Record<string, unknown> | null;
  hashChainPrev: string | null;
  hashChainSelf: string;
  metricSnapshotId: string | null;
  interventionId: string | null;
  createdAt: string;
}

export interface FacilitationEventsResponse {
  items: FacilitationEventDTO[];
  hashChainValid: boolean;
  hashChainFailure?: { failedIndex?: number };
}

export interface FacilitationInterventionDTO {
  id: string;
  sessionId: string;
  kind: string;
  targetType: string;
  targetId: string;
  recommendedAt: string;
  appliedAt: string | null;
  appliedById: string | null;
  dismissedAt: string | null;
  dismissedById: string | null;
  dismissedReasonText: string | null;
  dismissedReasonTag: string | null;
  rationaleJson: { headline?: string; details?: string } | null;
  triggeredByMetric: EquityMetricKind | null;
}

export interface InterventionsListResponse {
  items: FacilitationInterventionDTO[];
  nextCursor: string | null;
}

export interface MetricSnapshotDTO {
  id: string;
  metricKind: EquityMetricKind;
  value: number;
  breakdownJson: unknown;
  windowStart: string;
  windowEnd: string;
  isFinal: boolean;
}

export interface CurrentMetricsResponse {
  deliberationId: string;
  sessionId: string | null;
  snapshots: Array<MetricSnapshotDTO | null>;
}

export interface MetricsHistoryResponse {
  deliberationId: string;
  sessionId: string | null;
  metricKind: EquityMetricKind;
  items: MetricSnapshotDTO[];
}

// ─── Hooks ───────────────────────────────────────────────────────────────

const cfg = (refreshMs: number): SWRConfiguration => ({
  refreshInterval: refreshMs,
  revalidateOnFocus: false,
  shouldRetryOnError: true,
  errorRetryCount: 3,
});

export function useFacilitationEvents(sessionId: string | null) {
  return useSWR<FacilitationEventsResponse>(
    sessionId ? `/api/facilitation/sessions/${sessionId}/events?limit=200` : null,
    fetcher,
    cfg(POLL_EVENTS_MS),
  );
}

export function useFacilitationInterventions(
  sessionId: string | null,
  status: "PENDING" | "APPLIED" | "DISMISSED" | "ALL" = "PENDING",
) {
  // The API schema accepts the lowercase service-layer enum
  // (`open|applied|dismissed|all`); translate the public-facing UI status.
  const apiStatus = (
    {
      PENDING: "open",
      APPLIED: "applied",
      DISMISSED: "dismissed",
      ALL: "all",
    } as const
  )[status];
  const qs = apiStatus === "all" ? "" : `?status=${apiStatus}`;
  return useSWR<InterventionsListResponse>(
    sessionId ? `/api/facilitation/sessions/${sessionId}/interventions${qs}` : null,
    fetcher,
    cfg(POLL_INTERVENTIONS_MS),
  );
}

export function useFacilitationCurrentMetrics(
  deliberationId: string | null,
  window: "current" | "final" = "current",
) {
  return useSWR<CurrentMetricsResponse>(
    deliberationId
      ? `/api/deliberations/${deliberationId}/facilitation/metrics?window=${window}`
      : null,
    fetcher,
    cfg(POLL_METRICS_MS),
  );
}

export function useFacilitationMetricHistory(
  deliberationId: string | null,
  metricKind: EquityMetricKind | null,
  limit = 60,
) {
  return useSWR<MetricsHistoryResponse>(
    deliberationId && metricKind
      ? `/api/deliberations/${deliberationId}/facilitation/metrics/history?metricKind=${metricKind}&limit=${limit}`
      : null,
    fetcher,
    cfg(POLL_METRICS_MS),
  );
}

export function useFacilitationReport(
  deliberationId: string | null,
  sessionId?: string | null,
) {
  const url = deliberationId
    ? `/api/deliberations/${deliberationId}/facilitation/report${
        sessionId ? `?sessionId=${sessionId}` : ""
      }`
    : null;
  return useSWR<{ report: unknown }>(url, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
}

// ─── Mutators ────────────────────────────────────────────────────────────

async function postJson(url: string, body: unknown = {}) {
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = (json as { error?: { code?: string } }).error?.code ?? "ERROR";
    const message =
      (json as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`;
    const err = new Error(message) as Error & {
      status: number;
      code: string;
      details?: unknown;
    };
    err.status = res.status;
    err.code = code;
    err.details = (json as { error?: { details?: unknown } }).error?.details;
    throw err;
  }
  return json;
}

export const facilitationApi = {
  openSession: (deliberationId: string, body: { isPublic?: boolean; summary?: string }) =>
    postJson(`/api/deliberations/${deliberationId}/facilitation/sessions`, body),
  closeSession: (sessionId: string, body: { summary?: string } = {}) =>
    postJson(`/api/facilitation/sessions/${sessionId}/close`, body),
  initiateHandoff: (
    sessionId: string,
    body: { toUserId: string; notesText: string },
  ) => postJson(`/api/facilitation/sessions/${sessionId}/handoff`, body),
  acceptHandoff: (handoffId: string) =>
    postJson(`/api/facilitation/handoffs/${handoffId}/accept`),
  declineHandoff: (handoffId: string, body: { notesText?: string } = {}) =>
    postJson(`/api/facilitation/handoffs/${handoffId}/decline`, body),
  cancelHandoff: (handoffId: string, body: { notesText?: string } = {}) =>
    postJson(`/api/facilitation/handoffs/${handoffId}/cancel`, body),

  authorQuestion: (
    deliberationId: string,
    body: { text: string; framingType: FacilitationFramingType },
  ) => postJson(`/api/deliberations/${deliberationId}/facilitation/questions`, body),
  reviseQuestion: (
    questionId: string,
    body: { text: string; framingType?: FacilitationFramingType },
  ) => postJson(`/api/facilitation/questions/${questionId}/revise`, body),
  runChecks: (questionId: string) =>
    postJson(`/api/facilitation/questions/${questionId}/check`),
  lockQuestion: (questionId: string, body: { acknowledgedCheckIds?: string[] } = {}) =>
    postJson(`/api/facilitation/questions/${questionId}/lock`, body),
  reopenQuestion: (
    questionId: string,
    body: { reasonText: string; sessionId?: string },
  ) => postJson(`/api/facilitation/questions/${questionId}/reopen`, body),

  applyIntervention: (interventionId: string, body: { noteText?: string } = {}) =>
    postJson(`/api/facilitation/interventions/${interventionId}/apply`, body),
  dismissIntervention: (
    interventionId: string,
    body: { reasonText: string; reasonTag?: string },
  ) => postJson(`/api/facilitation/interventions/${interventionId}/dismiss`, body),
};
