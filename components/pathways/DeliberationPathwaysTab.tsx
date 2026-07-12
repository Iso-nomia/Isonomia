"use client";

import * as React from "react";
import useSWR from "swr";
import clsx from "clsx";
import { PathwayTimeline } from "./PathwayTimeline";
import { PacketBuilder } from "./PacketBuilder";
import { RemainingDisagreementsPanel } from "@/components/typology/RemainingDisagreementsPanel";

/**
 * A3.6 — "Pathways" tab for the deliberation room.
 *
 * Lists all institutional pathways opened from this deliberation, lets
 * facilitators open a new one, and lets contributors expand a row to
 * inspect/edit the current packet and inspect the event timeline.
 */

type PathwayStatus =
  | "OPEN"
  | "DRAFT"
  | "AWAITING_RESPONSE"
  | "IN_REVISION"
  | "CLOSED";

type PathwaySummary = {
  id: string;
  subject: string;
  status: PathwayStatus;
  isPublic: boolean;
  openedAt: string;
  currentPacketVersion: number | null;
  institution: { id: string; name: string; kind: string };
};

type Institution = {
  id: string;
  name: string;
  kind: string;
  jurisdiction?: string | null;
};

const STATUS_BADGE: Record<PathwayStatus, string> = {
  OPEN: "bg-sky-100 text-sky-800 border-sky-200",
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  AWAITING_RESPONSE: "bg-amber-100 text-amber-800 border-amber-200",
  IN_REVISION: "bg-violet-100 text-violet-800 border-violet-200",
  CLOSED: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const fetcher = (u: string) =>
  fetch(u, { cache: "no-store" }).then(async (r) => {
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
    }
    return j;
  });

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
  return j as T;
}

export interface DeliberationPathwaysTabProps {
  deliberationId: string;
  className?: string;
}

export function DeliberationPathwaysTab({
  deliberationId,
  className,
}: DeliberationPathwaysTabProps) {
  const { data, error, isLoading, mutate } = useSWR<{ items: PathwaySummary[] }>(
    deliberationId ? `/api/deliberations/${deliberationId}/pathways` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const [statusFilter, setStatusFilter] = React.useState<"ALL" | PathwayStatus>(
    "ALL",
  );
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [showOpenForm, setShowOpenForm] = React.useState(false);

  const items = data?.items ?? [];
  const filtered = React.useMemo(
    () =>
      statusFilter === "ALL"
        ? items
        : items.filter((p) => p.status === statusFilter),
    [items, statusFilter],
  );

  return (
    <section className={clsx("w-full space-y-4", className)}>
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Institutional pathways</h2>
          <p className="text-xs text-neutral-600">
            Forward this deliberation&apos;s recommendations to an institution
            and track their response.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowOpenForm((v) => !v)}
          className="px-3 py-1.5 text-xs rounded border bg-white hover:bg-slate-50"
          aria-expanded={showOpenForm}
        >
          {showOpenForm ? "Cancel" : "Open new pathway"}
        </button>
      </header>

      {/* B3.7: Latest published meta-consensus summary as report context */}
      <RemainingDisagreementsPanel deliberationId={deliberationId} defaultOpen={false} />

      {showOpenForm && (
        <OpenPathwayForm
          deliberationId={deliberationId}
          onCreated={() => {
            setShowOpenForm(false);
            mutate();
          }}
        />
      )}

      <div className="flex items-center gap-1 flex-wrap text-[11px]">
        {(["ALL", "OPEN", "AWAITING_RESPONSE", "IN_REVISION", "CLOSED"] as const).map(
          (s) => {
            const active = statusFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                aria-pressed={active}
                className={clsx(
                  "px-2 py-0.5 rounded-full border",
                  active
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                {s.replace("_", " ").toLowerCase()}
              </button>
            );
          },
        )}
        <span className="ml-2 text-neutral-500">
          {filtered.length} of {items.length}
        </span>
      </div>

      {isLoading && (
        <div className="text-xs text-neutral-500">Loading pathways…</div>
      )}
      {error && (
        <div className="text-xs text-rose-600">
          Failed to load pathways: {(error as Error).message}
        </div>
      )}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="text-xs text-neutral-500 italic border rounded p-4 bg-slate-50">
          No pathways yet. Use “Open new pathway” to forward recommendations to
          an institution.
        </div>
      )}

      <ul className="space-y-2">
        {filtered.map((p) => (
          <PathwayRow
            key={p.id}
            pathway={p}
            expanded={expanded === p.id}
            onToggle={() => setExpanded((cur) => (cur === p.id ? null : p.id))}
          />
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
  pathway: PathwaySummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="border rounded-lg bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">
              {pathway.subject}
            </span>
            <span
              className={clsx(
                "px-1.5 py-0.5 rounded-full border text-[10px] uppercase tracking-wide",
                STATUS_BADGE[pathway.status],
              )}
            >
              {pathway.status.replace("_", " ").toLowerCase()}
            </span>
            {!pathway.isPublic && (
              <span className="px-1.5 py-0.5 rounded-full border text-[10px] bg-slate-100 text-slate-600 border-slate-200">
                private
              </span>
            )}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <a
              href={`/institutions/${pathway.institution.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-700 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {pathway.institution.name}
            </a>
            <span>· {pathway.institution.kind}</span>
            {pathway.currentPacketVersion != null && (
              <span>· packet v{pathway.currentPacketVersion}</span>
            )}
            <span>
              · opened{" "}
              {new Date(pathway.openedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>
        <span aria-hidden className="text-neutral-400 text-xs">
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {expanded && (
        <div className="border-t px-3 py-3 space-y-4 bg-slate-50/50">
          <PacketBuilder pathwayId={pathway.id} />
          <details className="rounded border bg-white">
            <summary className="cursor-pointer px-3 py-1.5 text-xs font-medium text-slate-700 select-none">
              Event timeline
            </summary>
            <div className="px-3 py-2">
              <PathwayTimeline pathwayId={pathway.id} />
            </div>
          </details>
        </div>
      )}
    </li>
  );
}

function OpenPathwayForm({
  deliberationId,
  onCreated,
}: {
  deliberationId: string;
  onCreated: () => void;
}) {
  const { data: institutionsData } = useSWR<{ items: Institution[] }>(
    "/api/institutions?limit=50",
    fetcher,
    { revalidateOnFocus: false },
  );

  const [institutionId, setInstitutionId] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [isPublic, setIsPublic] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const institutions = institutionsData?.items ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!institutionId || subject.trim().length < 3) return;
    setBusy(true);
    setErr(null);
    try {
      await postJson(`/api/deliberations/${deliberationId}/pathways`, {
        institutionId,
        subject: subject.trim(),
        isPublic,
      });
      setInstitutionId("");
      setSubject("");
      setIsPublic(false);
      onCreated();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border rounded-lg p-3 bg-white space-y-3"
    >
      <div className="text-xs font-medium text-slate-700">Open a new pathway</div>
      <label className="block text-[11px] text-slate-600">
        Institution
        <select
          value={institutionId}
          onChange={(e) => setInstitutionId(e.target.value)}
          required
          className="mt-1 block w-full border rounded px-2 py-1 text-sm bg-white"
        >
          <option value="">Select an institution…</option>
          {institutions.map((inst) => (
            <option key={inst.id} value={inst.id}>
              {inst.name} ({inst.kind})
            </option>
          ))}
        </select>
        {institutions.length === 0 && (
          <span className="text-[10px] text-neutral-500 italic">
            No institutions registered yet — ask a platform admin.
          </span>
        )}
      </label>

      <label className="block text-[11px] text-slate-600">
        Subject
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          minLength={3}
          maxLength={240}
          placeholder="e.g. Recommendations on transit equity policy"
          className="mt-1 block w-full border rounded px-2 py-1 text-sm"
        />
      </label>

      <label className="inline-flex items-center gap-2 text-[11px] text-slate-700">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        Public — show this pathway and its events to non-members
      </label>

      {err && <div className="text-[11px] text-rose-600">{err}</div>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || !institutionId || subject.trim().length < 3}
          className="px-3 py-1.5 text-xs rounded bg-slate-800 text-white disabled:opacity-50"
        >
          {busy ? "Opening…" : "Open pathway"}
        </button>
      </div>
    </form>
  );
}

export default DeliberationPathwaysTab;
