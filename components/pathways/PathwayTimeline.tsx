"use client";

/**
 * PathwayTimeline — A3.1
 *
 * Read-only vertical timeline of `PathwayEvent`s for a given institutional
 * pathway. Renders:
 *  - Round grouping (revisions create new rounds, derived from REVISED events)
 *  - Per-event icon + label + actor + timestamp + payload preview
 *  - Event-type filter chips
 *  - Hash-chain validity badge (returned by the events endpoint)
 *
 * Data source: `GET /api/pathways/[id]/events` (public when pathway.isPublic).
 */

import * as React from "react";
import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

type EventType =
  | "DRAFT_OPENED"
  | "ITEM_ADDED"
  | "ITEM_REMOVED"
  | "PACKET_FINALIZED"
  | "SUBMITTED"
  | "ACKNOWLEDGED"
  | "RESPONSE_RECEIVED"
  | "ITEM_DISPOSITIONED"
  | "REVISED"
  | "CLOSED";

interface PathwayEvent {
  id: string;
  eventType: EventType;
  actorId: string | null;
  actorRole: string | null;
  payload: Record<string, unknown> | null;
  hashChainPrev: string | null;
  hashChainSelf: string;
  createdAt: string;
}

interface EventsResponse {
  items: PathwayEvent[];
  nextCursor: string | null;
  hashChainValid: boolean;
  hashChainFailure?: { index: number | null; reason: string | null };
}

const EVENT_LABELS: Record<EventType, string> = {
  DRAFT_OPENED: "Draft opened",
  ITEM_ADDED: "Item added",
  ITEM_REMOVED: "Item removed",
  PACKET_FINALIZED: "Packet finalized",
  SUBMITTED: "Submitted to institution",
  ACKNOWLEDGED: "Acknowledged",
  RESPONSE_RECEIVED: "Response received",
  ITEM_DISPOSITIONED: "Item dispositioned",
  REVISED: "Revision opened",
  CLOSED: "Pathway closed",
};

const EVENT_DOT_COLORS: Record<EventType, string> = {
  DRAFT_OPENED: "bg-slate-400",
  ITEM_ADDED: "bg-slate-300",
  ITEM_REMOVED: "bg-slate-300",
  PACKET_FINALIZED: "bg-indigo-500",
  SUBMITTED: "bg-indigo-600",
  ACKNOWLEDGED: "bg-blue-500",
  RESPONSE_RECEIVED: "bg-emerald-500",
  ITEM_DISPOSITIONED: "bg-emerald-400",
  REVISED: "bg-amber-500",
  CLOSED: "bg-slate-600",
};

const FILTER_ORDER: EventType[] = [
  "DRAFT_OPENED",
  "ITEM_ADDED",
  "PACKET_FINALIZED",
  "SUBMITTED",
  "ACKNOWLEDGED",
  "RESPONSE_RECEIVED",
  "ITEM_DISPOSITIONED",
  "REVISED",
  "CLOSED",
];

export interface PathwayTimelineProps {
  pathwayId: string;
  className?: string;
  /** When true, renders payload JSON preview under each event. */
  showPayloads?: boolean;
}

interface Round {
  index: number;
  startedAt: string;
  events: PathwayEvent[];
}

function groupIntoRounds(events: PathwayEvent[]): Round[] {
  const rounds: Round[] = [];
  let current: Round | null = null;
  for (const ev of events) {
    if (!current || ev.eventType === "REVISED") {
      current = {
        index: rounds.length + 1,
        startedAt: ev.createdAt,
        events: [],
      };
      rounds.push(current);
    }
    current.events.push(ev);
  }
  return rounds;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function shortHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  return hash.length > 12 ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : hash;
}

export function PathwayTimeline({
  pathwayId,
  className,
  showPayloads = false,
}: PathwayTimelineProps) {
  const { data, error, isLoading } = useSWR<EventsResponse>(
    pathwayId ? `/api/pathways/${pathwayId}/events?limit=200` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const [activeFilters, setActiveFilters] = React.useState<Set<EventType>>(
    new Set(),
  );

  const toggleFilter = (t: EventType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const events = data?.items ?? [];
  const filtered = activeFilters.size
    ? events.filter((e) => activeFilters.has(e.eventType))
    : events;
  const rounds = groupIntoRounds(filtered);

  if (isLoading) {
    return (
      <div className={`text-sm text-slate-500 ${className ?? ""}`}>
        Loading pathway timeline…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`text-sm text-rose-600 ${className ?? ""}`}
        role="alert"
      >
        Could not load timeline: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      {/* Header: hash-chain badge + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <ChainValidityBadge
          valid={data?.hashChainValid ?? null}
          failure={data?.hashChainFailure}
        />
        <div className="ml-auto flex flex-wrap gap-1">
          {FILTER_ORDER.map((t) => {
            const active = activeFilters.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleFilter(t)}
                aria-pressed={active}
                className={[
                  "rounded-full px-2 py-0.5 text-xs border transition",
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-300 hover:border-slate-400",
                ].join(" ")}
              >
                {EVENT_LABELS[t]}
              </button>
            );
          })}
          {activeFilters.size > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilters(new Set())}
              className="rounded-full px-2 py-0.5 text-xs border border-slate-200 text-slate-500 hover:text-slate-700"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {rounds.length === 0 ? (
        <div className="text-sm text-slate-500">
          No events {activeFilters.size ? "match the current filters." : "yet."}
        </div>
      ) : (
        <ol className="space-y-6">
          {rounds.map((round) => (
            <RoundSection
              key={`${round.index}-${round.startedAt}`}
              round={round}
              showPayloads={showPayloads}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function RoundSection({
  round,
  showPayloads,
}: {
  round: Round;
  showPayloads: boolean;
}) {
  return (
    <li>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Round {round.index}
        <span className="ml-2 font-normal normal-case text-slate-400">
          started {formatTimestamp(round.startedAt)}
        </span>
      </div>
      <ol className="relative ml-2 border-l border-slate-200 pl-4">
        {round.events.map((ev) => (
          <EventRow key={ev.id} event={ev} showPayload={showPayloads} />
        ))}
      </ol>
    </li>
  );
}

function EventRow({
  event,
  showPayload,
}: {
  event: PathwayEvent;
  showPayload: boolean;
}) {
  const dot = EVENT_DOT_COLORS[event.eventType] ?? "bg-slate-400";
  return (
    <li className="relative pb-4 last:pb-0">
      <span
        className={`absolute -left-[22px] top-1.5 h-3 w-3 rounded-full ring-2 ring-white ${dot}`}
        aria-hidden="true"
      />
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-medium text-slate-900">
          {EVENT_LABELS[event.eventType] ?? event.eventType}
        </span>
        {event.actorRole && (
          <span className="text-xs text-slate-500">
            by {event.actorRole}
            {event.actorId ? ` (${event.actorId})` : ""}
          </span>
        )}
        <span className="ml-auto text-xs text-slate-400">
          {formatTimestamp(event.createdAt)}
        </span>
      </div>
      <div className="mt-0.5 font-mono text-[10px] text-slate-400">
        prev {shortHash(event.hashChainPrev)} → self {shortHash(event.hashChainSelf)}
      </div>
      {showPayload && event.payload && (
        <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-[11px] text-slate-700">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      )}
    </li>
  );
}

function ChainValidityBadge({
  valid,
  failure,
}: {
  valid: boolean | null;
  failure?: { index: number | null; reason: string | null };
}) {
  if (valid === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
        Hash chain: —
      </span>
    );
  }
  if (valid) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
        title="The append-only event log verified successfully end-to-end."
      >
        <span aria-hidden>✓</span> Hash chain verified
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700"
      title={failure?.reason ?? "Hash chain verification failed"}
      role="alert"
    >
      <span aria-hidden>!</span> Hash chain invalid
      {failure?.index != null ? ` (event #${failure.index})` : ""}
    </span>
  );
}

export default PathwayTimeline;
