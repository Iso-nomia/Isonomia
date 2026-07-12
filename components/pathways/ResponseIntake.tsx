"use client";

/**
 * ResponseIntake — A3.4
 *
 * Institution-side authoring (and facilitator-assisted intake) for an
 * `InstitutionalSubmission`. Wires:
 *   - GET  /api/pathways/[id]                              → pathway, packet items, latest submission/response
 *   - POST /api/submissions/[submissionId]/acknowledge     → mark acknowledged
 *   - POST /api/submissions/[submissionId]/responses       → create the response shell
 *   - POST /api/responses/[responseId]/items               → batch dispositions
 *
 * Off-platform intake is supported via the `channelHint` field on
 * `RecordResponseSchema`; UI surfaces a "facilitator-assisted intake"
 * affordance per roadmap §5.A3.4.
 */

import * as React from "react";
import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error((json?.error?.message as string) || `HTTP ${r.status}`);
    }
    return json;
  });

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json?.error?.message as string) || `HTTP ${res.status}`);
  }
  return json;
}

type Disposition =
  | "ACCEPTED"
  | "REJECTED"
  | "MODIFIED"
  | "DEFERRED"
  | "NO_RESPONSE";

type ResponseStatus = "PENDING" | "RECEIVED" | "PARTIAL" | "COMPLETE";

type SubmissionChannel = "in_platform" | "email" | "formal_intake" | "api";

interface PacketItem {
  id: string;
  kind: "CLAIM" | "ARGUMENT" | "CITATION" | "NOTE";
  targetType: string;
  targetId: string;
  orderIndex: number;
  commentary: string | null;
}

interface Packet {
  id: string;
  title: string;
  version: number;
  status: string;
  items: PacketItem[];
}

interface Submission {
  id: string;
  packetId: string;
  institutionId: string;
  submittedAt: string;
  acknowledgedAt: string | null;
  channel: SubmissionChannel;
  externalReference: string | null;
}

interface Response {
  id: string;
  submissionId: string;
  respondedAt: string;
  dispositionSummary: string | null;
  status: ResponseStatus;
}

interface PathwayDetail {
  pathway: {
    id: string;
    deliberationId: string;
    institutionId: string;
    isPublic: boolean;
    status: string;
    subject: string;
  };
  currentPacket: Packet | null;
  latestSubmission: Submission | null;
  latestResponse: Response | null;
}

const DISPOSITION_LABELS: Record<Disposition, string> = {
  ACCEPTED: "Accept",
  REJECTED: "Reject",
  MODIFIED: "Modify",
  DEFERRED: "Defer",
  NO_RESPONSE: "No response",
};

const DISPOSITION_COLORS: Record<Disposition, string> = {
  ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-300",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-300",
  MODIFIED: "bg-amber-50 text-amber-700 border-amber-300",
  DEFERRED: "bg-slate-50 text-slate-700 border-slate-300",
  NO_RESPONSE: "bg-slate-100 text-slate-500 border-slate-300",
};

const RESPONSE_STATUS_LABELS: Record<ResponseStatus, string> = {
  PENDING: "Pending",
  RECEIVED: "Received",
  PARTIAL: "Partial",
  COMPLETE: "Complete",
};

const CHANNEL_LABELS: Record<SubmissionChannel, string> = {
  in_platform: "In-platform",
  email: "Email",
  formal_intake: "Formal intake",
  api: "API",
};

interface DraftItem {
  packetItemId: string;
  disposition: Disposition;
  rationaleText: string;
}

export interface ResponseIntakeProps {
  pathwayId: string;
  className?: string;
  /** When true, surface the off-platform / facilitator-assisted controls. */
  facilitatorMode?: boolean;
}

export function ResponseIntake({
  pathwayId,
  className,
  facilitatorMode = false,
}: ResponseIntakeProps) {
  const { data, error, isLoading, mutate } = useSWR<PathwayDetail>(
    pathwayId ? `/api/pathways/${pathwayId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const [busy, setBusy] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, DraftItem>>({});
  const [dispositionSummary, setDispositionSummary] = React.useState("");
  const [responseStatus, setResponseStatus] =
    React.useState<ResponseStatus>("PARTIAL");
  const [channelHint, setChannelHint] =
    React.useState<SubmissionChannel>("in_platform");

  if (isLoading) {
    return (
      <div className={`text-sm text-slate-500 ${className ?? ""}`}>
        Loading submission…
      </div>
    );
  }
  if (error) {
    return (
      <div className={`text-sm text-rose-600 ${className ?? ""}`} role="alert">
        Could not load pathway: {(error as Error).message}
      </div>
    );
  }
  if (!data) return null;

  const submission = data.latestSubmission;
  const packet = data.currentPacket;
  const response = data.latestResponse;

  if (!submission || !packet) {
    return (
      <div
        className={`rounded border border-dashed border-slate-200 p-4 text-sm text-slate-500 ${className ?? ""}`}
      >
        Nothing has been submitted on this pathway yet. Once a packet is
        submitted, the response intake will appear here.
      </div>
    );
  }

  const updateDraft = (
    packetItemId: string,
    patch: Partial<DraftItem>,
  ) => {
    setDrafts((prev) => {
      const existing: DraftItem = prev[packetItemId] ?? {
        packetItemId,
        disposition: "ACCEPTED",
        rationaleText: "",
      };
      return { ...prev, [packetItemId]: { ...existing, ...patch } };
    });
  };

  const draftEntries = Object.values(drafts);

  const acknowledge = async () => {
    setErrorMsg(null);
    setBusy(true);
    try {
      await postJson(`/api/submissions/${submission.id}/acknowledge`, {});
      await mutate();
    } catch (e) {
      setErrorMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitResponse = async () => {
    if (draftEntries.length === 0) {
      setErrorMsg("Add at least one disposition before submitting.");
      return;
    }
    setErrorMsg(null);
    setBusy(true);
    try {
      let respId = response?.id;
      if (!respId) {
        const { response: created } = await postJson(
          `/api/submissions/${submission.id}/responses`,
          {
            dispositionSummary: dispositionSummary.trim() || null,
            responseStatus,
            channelHint: facilitatorMode ? channelHint : undefined,
          },
        );
        respId = created.id;
      }
      await postJson(`/api/responses/${respId}/items`, {
        items: draftEntries.map((d) => ({
          packetItemId: d.packetItemId,
          disposition: d.disposition,
          rationaleText: d.rationaleText.trim() || null,
        })),
      });
      setDrafts({});
      setDispositionSummary("");
      await mutate();
    } catch (e) {
      setErrorMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const coverage = packet.items.length
    ? Math.round((draftEntries.length / packet.items.length) * 100)
    : 0;

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      {errorMsg && (
        <div
          role="alert"
          className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {errorMsg}
        </div>
      )}

      <SubmissionHeader
        submission={submission}
        packet={packet}
        response={response}
        onAcknowledge={acknowledge}
        busy={busy}
      />

      <section aria-labelledby="dispositions-heading">
        <div className="mb-2 flex flex-wrap items-baseline gap-2">
          <h3
            id="dispositions-heading"
            className="text-sm font-semibold text-slate-900"
          >
            Item dispositions
          </h3>
          <span className="text-xs text-slate-500">
            {draftEntries.length} of {packet.items.length} items dispositioned
            ({coverage}%)
          </span>
        </div>
        {packet.items.length === 0 ? (
          <div className="text-sm text-slate-500">
            The submitted packet has no items.
          </div>
        ) : (
          <ol className="space-y-2">
            {packet.items.map((item) => (
              <DispositionRow
                key={item.id}
                item={item}
                draft={drafts[item.id]}
                onUpdate={(patch) => updateDraft(item.id, patch)}
                onClear={() =>
                  setDrafts((prev) => {
                    const next = { ...prev };
                    delete next[item.id];
                    return next;
                  })
                }
              />
            ))}
          </ol>
        )}
      </section>

      <section
        aria-labelledby="summary-heading"
        className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3"
      >
        <h3
          id="summary-heading"
          className="text-sm font-semibold text-slate-900"
        >
          Response summary
        </h3>
        <label className="block text-xs">
          <span className="block text-slate-700">
            Overall disposition summary (optional)
          </span>
          <textarea
            rows={3}
            maxLength={4096}
            value={dispositionSummary}
            onChange={(e) => setDispositionSummary(e.target.value)}
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="Plain-language rationale that applies across items"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <label className="text-xs">
            <span className="block text-slate-700">Response status</span>
            <select
              value={responseStatus}
              onChange={(e) =>
                setResponseStatus(e.target.value as ResponseStatus)
              }
              className="mt-0.5 rounded border border-slate-300 px-1.5 py-1 text-sm"
            >
              {(Object.keys(RESPONSE_STATUS_LABELS) as ResponseStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {RESPONSE_STATUS_LABELS[s]}
                  </option>
                ),
              )}
            </select>
          </label>
          {facilitatorMode && (
            <label className="text-xs">
              <span className="block text-slate-700">
                Intake channel{" "}
                <span className="text-slate-400">(off-platform)</span>
              </span>
              <select
                value={channelHint}
                onChange={(e) =>
                  setChannelHint(e.target.value as SubmissionChannel)
                }
                className="mt-0.5 rounded border border-slate-300 px-1.5 py-1 text-sm"
              >
                {(Object.keys(CHANNEL_LABELS) as SubmissionChannel[]).map(
                  (c) => (
                    <option key={c} value={c}>
                      {CHANNEL_LABELS[c]}
                    </option>
                  ),
                )}
              </select>
            </label>
          )}
        </div>
        {facilitatorMode && (
          <p className="text-[11px] text-slate-500">
            Facilitator-assisted intake records this response on behalf of the
            institution. The originating channel is captured in the pathway
            event log.
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            disabled={busy || draftEntries.length === 0}
            onClick={submitResponse}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {response ? "Append dispositions" : "Submit response"}
          </button>
        </div>
      </section>
    </div>
  );
}

function SubmissionHeader({
  submission,
  packet,
  response,
  onAcknowledge,
  busy,
}: {
  submission: Submission;
  packet: Packet;
  response: Response | null;
  onAcknowledge: () => Promise<void>;
  busy: boolean;
}) {
  const acknowledged = !!submission.acknowledgedAt;
  return (
    <header className="flex flex-wrap items-baseline gap-2 border-b border-slate-200 pb-2">
      <h3 className="text-sm font-semibold text-slate-900">
        {packet.title}{" "}
        <span className="font-normal text-slate-500">
          (v{packet.version})
        </span>
      </h3>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
        {CHANNEL_LABELS[submission.channel]}
      </span>
      {submission.externalReference && (
        <span
          className="text-xs text-slate-500"
          title="External reference recorded at intake"
        >
          ref: {submission.externalReference}
        </span>
      )}
      <span className="text-xs text-slate-400">
        submitted {new Date(submission.submittedAt).toLocaleString()}
      </span>
      <span className="ml-auto flex items-center gap-2">
        {acknowledged ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
            ✓ Acknowledged
          </span>
        ) : (
          <button
            type="button"
            onClick={onAcknowledge}
            disabled={busy}
            className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            Mark acknowledged
          </button>
        )}
        {response && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
            Response: {RESPONSE_STATUS_LABELS[response.status]}
          </span>
        )}
      </span>
    </header>
  );
}

function DispositionRow({
  item,
  draft,
  onUpdate,
  onClear,
}: {
  item: PacketItem;
  draft: DraftItem | undefined;
  onUpdate: (patch: Partial<DraftItem>) => void;
  onClear: () => void;
}) {
  const selected = draft?.disposition;
  return (
    <li className="rounded border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
          {item.kind}
        </span>
        <span className="font-mono text-xs text-slate-500">
          {item.targetType}/{item.targetId}
        </span>
        {selected && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto text-xs text-slate-500 hover:text-slate-800"
          >
            Clear
          </button>
        )}
      </div>
      {item.commentary && (
        <p className="mt-1 text-sm text-slate-700">{item.commentary}</p>
      )}
      <div
        className="mt-2 flex flex-wrap gap-1"
        role="radiogroup"
        aria-label="Disposition"
      >
        {(Object.keys(DISPOSITION_LABELS) as Disposition[]).map((d) => {
          const active = selected === d;
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onUpdate({ disposition: d })}
              className={[
                "rounded-full border px-2 py-0.5 text-xs transition",
                active
                  ? DISPOSITION_COLORS[d]
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-400",
              ].join(" ")}
            >
              {DISPOSITION_LABELS[d]}
            </button>
          );
        })}
      </div>
      {selected && (
        <textarea
          rows={2}
          maxLength={8192}
          value={draft?.rationaleText ?? ""}
          onChange={(e) => onUpdate({ rationaleText: e.target.value })}
          placeholder="Rationale (optional)"
          className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
      )}
    </li>
  );
}

export default ResponseIntake;
