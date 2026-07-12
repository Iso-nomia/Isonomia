"use client";

/**
 * InstitutionProfile — A3.2 (UI workstream order)
 *
 * Public-facing institution page. Renders:
 *  - Institution metadata (name, kind, jurisdiction, verified flag)
 *  - Membership preview
 *  - Active vs closed pathway counts
 *  - Pathways list (filterable by status), each row expandable into the
 *    `PathwayTimeline` for that pathway
 *
 * Data sources:
 *  - GET /api/institutions/[id]
 *  - GET /api/institutions/[id]/pathways?status=...
 */

import * as React from "react";
import useSWR from "swr";
import Link from "next/link";
import { PathwayTimeline } from "./PathwayTimeline";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

type PathwayStatus = "OPEN" | "AWAITING_RESPONSE" | "IN_REVISION" | "CLOSED";

interface InstitutionDetail {
  institution: {
    id: string;
    slug: string;
    name: string;
    kind: string;
    jurisdiction: string | null;
    verifiedAt: string | null;
    linkedDeliberationId: string | null;
    contactJson: Record<string, unknown> | null;
  };
  members: Array<{
    id: string;
    displayName: string;
    role: string;
    verifiedAt: string | null;
  }>;
  activePathwayCount: number;
  responseLatency: {
    medianAcknowledgementMs: number | null;
    medianResponseMs: number | null;
  };
}

interface PathwaysListResponse {
  institution: { id: string; slug: string; name: string; kind: string };
  items: Array<{
    id: string;
    deliberationId: string;
    subject: string;
    status: PathwayStatus;
    isPublic: boolean;
    openedAt: string;
    closedAt: string | null;
    openedById: string | null;
    currentPacketId: string | null;
    currentPacket: {
      id: string;
      version: number;
      status: string;
      title: string | null;
    } | null;
    deliberation: { id: string; title: string | null };
  }>;
  nextCursor: string | null;
}

const STATUS_LABELS: Record<PathwayStatus | "ALL", string> = {
  ALL: "All",
  OPEN: "Open",
  AWAITING_RESPONSE: "Awaiting response",
  IN_REVISION: "In revision",
  CLOSED: "Closed",
};

const STATUS_BADGE: Record<PathwayStatus, string> = {
  OPEN: "bg-blue-50 text-blue-700 border-blue-200",
  AWAITING_RESPONSE: "bg-amber-50 text-amber-700 border-amber-200",
  IN_REVISION: "bg-violet-50 text-violet-700 border-violet-200",
  CLOSED: "bg-slate-100 text-slate-600 border-slate-300",
};

function formatLatency(ms: number | null): string {
  if (ms == null) return "—";
  const hours = ms / 36e5;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export interface InstitutionProfileProps {
  institutionId: string;
  className?: string;
}

export function InstitutionProfile({
  institutionId,
  className,
}: InstitutionProfileProps) {
  const [statusFilter, setStatusFilter] = React.useState<PathwayStatus | "ALL">(
    "ALL",
  );
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const { data: detail, error: detailErr } = useSWR<InstitutionDetail>(
    institutionId ? `/api/institutions/${institutionId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const pathwaysUrl = institutionId
    ? `/api/institutions/${institutionId}/pathways${statusFilter !== "ALL" ? `?status=${statusFilter}` : ""}`
    : null;

  const { data: pathways, error: pathwaysErr } = useSWR<PathwaysListResponse>(
    pathwaysUrl,
    fetcher,
    { revalidateOnFocus: false },
  );

  if (detailErr) {
    return (
      <div className={`text-sm text-rose-600 ${className ?? ""}`} role="alert">
        Could not load institution: {(detailErr as Error).message}
      </div>
    );
  }

  if (!detail) {
    return (
      <div className={`text-sm text-slate-500 ${className ?? ""}`}>
        Loading institution…
      </div>
    );
  }

  const inst = detail.institution;

  return (
    <div className={`space-y-6 ${className ?? ""}`}>
      <Header institution={inst} verified={!!inst.verifiedAt} />

      <MetricsRow
        activePathwayCount={detail.activePathwayCount}
        responseLatency={detail.responseLatency}
        memberCount={detail.members.length}
      />

      {detail.members.length > 0 && <MemberStrip members={detail.members} />}

      <section aria-labelledby="pathways-heading">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2
            id="pathways-heading"
            className="text-base font-semibold text-slate-900"
          >
            Pathways
          </h2>
          <div className="ml-auto flex flex-wrap gap-1" role="tablist">
            {(Object.keys(STATUS_LABELS) as Array<PathwayStatus | "ALL">).map(
              (key) => {
                const active = statusFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setStatusFilter(key)}
                    className={[
                      "rounded-full px-2.5 py-0.5 text-xs border transition",
                      active
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-300 hover:border-slate-400",
                    ].join(" ")}
                  >
                    {STATUS_LABELS[key]}
                  </button>
                );
              },
            )}
          </div>
        </div>

        {pathwaysErr ? (
          <div className="text-sm text-rose-600" role="alert">
            Could not load pathways: {(pathwaysErr as Error).message}
          </div>
        ) : !pathways ? (
          <div className="text-sm text-slate-500">Loading pathways…</div>
        ) : pathways.items.length === 0 ? (
          <div className="rounded border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            No pathways{" "}
            {statusFilter !== "ALL"
              ? `with status “${STATUS_LABELS[statusFilter]}”.`
              : "yet."}
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 rounded border border-slate-200">
            {pathways.items.map((pw) => (
              <PathwayRow
                key={pw.id}
                pathway={pw}
                expanded={expandedId === pw.id}
                onToggle={() =>
                  setExpandedId((prev) => (prev === pw.id ? null : pw.id))
                }
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Header({
  institution,
  verified,
}: {
  institution: InstitutionDetail["institution"];
  verified: boolean;
}) {
  return (
    <header className="flex flex-wrap items-start gap-3 border-b border-slate-200 pb-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-xl font-semibold text-slate-900">
            {institution.name}
          </h1>
          {verified && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
              title="Verified institution"
            >
              <span aria-hidden>✓</span> Verified
            </span>
          )}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            {institution.kind}
          </span>
          {institution.jurisdiction && (
            <span className="text-xs text-slate-500">
              {institution.jurisdiction}
            </span>
          )}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          /{institution.slug}
          {institution.linkedDeliberationId && (
            <>
              {" · "}
              <Link
                href={`/deliberation/${institution.linkedDeliberationId}`}
                className="text-indigo-600 hover:underline"
              >
                Linked deliberation
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MetricsRow({
  activePathwayCount,
  responseLatency,
  memberCount,
}: {
  activePathwayCount: number;
  responseLatency: InstitutionDetail["responseLatency"];
  memberCount: number;
}) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Metric label="Active pathways" value={String(activePathwayCount)} />
      <Metric label="Members" value={String(memberCount)} />
      <Metric
        label="Median ack latency"
        value={formatLatency(responseLatency.medianAcknowledgementMs)}
      />
      <Metric
        label="Median response latency"
        value={formatLatency(responseLatency.medianResponseMs)}
      />
    </dl>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-lg font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function MemberStrip({
  members,
}: {
  members: InstitutionDetail["members"];
}) {
  return (
    <section aria-labelledby="members-heading">
      <h2
        id="members-heading"
        className="mb-2 text-sm font-semibold text-slate-700"
      >
        Members
      </h2>
      <ul className="flex flex-wrap gap-2">
        {members.map((m) => (
          <li
            key={m.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs"
          >
            <span className="font-medium text-slate-800">{m.displayName}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500">{m.role}</span>
            {m.verifiedAt && (
              <span className="ml-0.5 text-emerald-600" title="Verified">
                ✓
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PathwayRow({
  pathway,
  expanded,
  onToggle,
}: {
  pathway: PathwaysListResponse["items"][number];
  expanded: boolean;
  onToggle: () => void;
}) {
  const subject =
    pathway.subject ||
    pathway.deliberation.title ||
    `Pathway ${pathway.id.slice(0, 8)}`;
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50"
      >
        <span className="flex-1 min-w-0">
          <span className="block truncate text-sm font-medium text-slate-900">
            {subject}
          </span>
          <span className="block truncate text-xs text-slate-500">
            from{" "}
            <Link
              href={`/deliberation/${pathway.deliberationId}`}
              onClick={(e) => e.stopPropagation()}
              className="text-indigo-600 hover:underline"
            >
              {pathway.deliberation.title ?? pathway.deliberationId}
            </Link>
            {pathway.currentPacket && (
              <>
                {" · packet v"}
                {pathway.currentPacket.version}
                {" ("}
                {pathway.currentPacket.status}
                {")"}
              </>
            )}
          </span>
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_BADGE[pathway.status]}`}
        >
          {STATUS_LABELS[pathway.status]}
        </span>
        <span className="text-xs text-slate-400">
          opened {formatDate(pathway.openedAt)}
        </span>
        <span aria-hidden className="text-slate-400">
          {expanded ? "▴" : "▾"}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/40 px-3 py-3">
          <PathwayTimeline pathwayId={pathway.id} />
        </div>
      )}
    </li>
  );
}

export default InstitutionProfile;
