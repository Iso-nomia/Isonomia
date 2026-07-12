"use client";

/**
 * FacilitationTimeline — C3.5
 *
 * Vertical event stream for a single FacilitationSession with hash-chain
 * attestation. Polls `/api/facilitation/sessions/:id/events` per the
 * SSE_CONTRACT cadence; renders ARIA `role=log` so AT users hear new entries.
 */

import * as React from "react";
import {
  useFacilitationEvents,
  type FacilitationEventDTO,
} from "@/components/facilitation/hooks";
import { ChainValidityBadge } from "@/components/facilitation/ChainValidityBadge";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const EVENT_DOT: Record<string, string> = {
  SESSION_OPENED: "bg-emerald-500",
  SESSION_CLOSED: "bg-slate-600",
  HANDOFF_INITIATED: "bg-amber-500",
  HANDOFF_ACCEPTED: "bg-emerald-500",
  HANDOFF_DECLINED: "bg-rose-500",
  HANDOFF_CANCELED: "bg-slate-400",
  QUESTION_AUTHORED: "bg-indigo-400",
  QUESTION_REVISED: "bg-indigo-400",
  QUESTION_LOCKED: "bg-indigo-600",
  QUESTION_REOPENED: "bg-amber-500",
  CHECKS_RUN: "bg-slate-300",
  INTERVENTION_RECOMMENDED: "bg-amber-400",
  INTERVENTION_APPLIED: "bg-emerald-500",
  INTERVENTION_DISMISSED: "bg-slate-400",
  METRIC_SNAPSHOT: "bg-blue-400",
};

function dot(eventType: string) {
  return EVENT_DOT[eventType] ?? "bg-slate-300";
}

function shortHash(hash: string | null) {
  if (!hash) return "—";
  return hash.slice(0, 8);
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function describeEvent(e: FacilitationEventDTO): string {
  const p = e.payloadJson ?? {};
  const summary = (key: string) => (typeof p[key] === "string" ? String(p[key]) : null);
  switch (e.eventType) {
    case "SESSION_OPENED":
      return "Session opened";
    case "SESSION_CLOSED":
      return "Session closed";
    case "HANDOFF_INITIATED":
      return `Handoff requested${summary("reason") ? ` — ${summary("reason")}` : ""}`;
    case "HANDOFF_ACCEPTED":
      return "Handoff accepted";
    case "HANDOFF_DECLINED":
      return "Handoff declined";
    case "QUESTION_AUTHORED":
      return `Question v${p.version ?? "?"} authored`;
    case "QUESTION_REVISED":
      return `Question revised → v${p.version ?? "?"}`;
    case "QUESTION_LOCKED":
      return "Question locked";
    case "QUESTION_REOPENED":
      return "Question reopened";
    case "CHECKS_RUN":
      return `Checks run (${
        typeof p.checkCount === "number" ? p.checkCount : "?"
      })`;
    case "INTERVENTION_RECOMMENDED":
      return `Intervention recommended (${p.kind ?? "?"})`;
    case "INTERVENTION_APPLIED":
      return "Intervention applied";
    case "INTERVENTION_DISMISSED":
      return "Intervention dismissed";
    case "METRIC_SNAPSHOT":
      return `Metric snapshot (${p.metricKind ?? "?"})`;
    default:
      return e.eventType;
  }
}

export interface FacilitationTimelineProps {
  sessionId: string | null;
  className?: string;
  /** Hide the header (chain badge + filter chips); useful when embedded. */
  compact?: boolean;
}

const ALL_TYPES = Object.keys(EVENT_DOT);

export function FacilitationTimeline({
  sessionId,
  className,
  compact = false,
}: FacilitationTimelineProps) {
  const { data, error, isLoading } = useFacilitationEvents(sessionId);
  const [filter, setFilter] = React.useState<string | null>(null);

  if (!sessionId) {
    return (
      <div className="text-sm text-slate-500 italic">No active session.</div>
    );
  }
  if (isLoading && !data) {
    return <div className="text-sm text-slate-500">Loading events…</div>;
  }
  if (error) {
    return (
      <div className="text-sm text-rose-600">
        Failed to load events: {(error as Error).message}
      </div>
    );
  }
  const items = data?.items ?? [];
  const visible = filter ? items.filter((e) => e.eventType === filter) : items;

  return (
    <section
      className={`flex h-full flex-col ${className ?? ""}`}
      aria-label="Facilitation event stream"
    >
      {!compact && (
        <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
          <h3 className="text-sm font-medium text-slate-800">Event stream</h3>
          <ChainValidityBadge
            valid={data?.hashChainValid}
            failedIndex={data?.hashChainFailure?.failedIndex}
            chainLabel="session chain"
          />
          <span className="ml-auto text-xs text-slate-500">{items.length} events</span>
        </header>
      )}
      {!compact && (
        <div className="flex flex-wrap gap-1 border-b border-slate-100 px-3 py-1.5">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={`rounded-full border px-2 py-0.5 text-xs ${
              filter === null
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            All
          </button>
          {ALL_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t === filter ? null : t)}
              className={`rounded-full border px-2 py-0.5 text-xs ${
                filter === t
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              {t.toLowerCase().replace(/_/g, " ")}
            </button>
          ))}
        </div>
      )}
      <hr className="border-slate-300"></hr>
      <ScrollArea className="flex-1">
        <ol role="log" aria-live="polite" className="relative px-4 py-3">
          <span className="absolute left-[1.4rem] top-3 bottom-3 w-px bg-slate-200" />
          {visible.length === 0 && (
            <li className="text-sm text-slate-500 italic">No events yet.</li>
          )}
          {visible.map((e) => (
            <li key={e.id} className="relative mb-3 pl-6">
              <span
                className={`absolute left-1 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${dot(
                  e.eventType,
                )}`}
                aria-hidden="true"
              />
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-slate-800">
                  {describeEvent(e)}
                </span>
                <span className="text-xs text-slate-400">{formatTime(e.createdAt)}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {shortHash(e.hashChainSelf)}
                </Badge>
                {e.actorRole && (
                  <span className="text-[11px]">{e.actorRole}</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </ScrollArea>
    </section>
  );
}
