"use client";

/**
 * PacketBuilder — A3.3
 *
 * Authoring surface for `RecommendationPacket` drafts. Wires:
 *   - GET  /api/pathways/[id]                         → current draft + items
 *   - POST /api/pathways/[id]/packets                 → create draft (title, summary)
 *   - POST /api/packets/[packetId]/items              → add CLAIM/ARGUMENT/CITATION/NOTE
 *   - PATCH /api/packets/[packetId]/items/[itemId]    → reorder / re-commentary
 *   - DELETE /api/packets/[packetId]/items/[itemId]   → remove
 *   - POST /api/packets/[packetId]/submit             → finalize + submit (snapshot)
 *
 * Submit step opens a confirmation modal with a snapshot summary (item counts,
 * recipient institution, channel) per roadmap §5.A3.1.
 */

import * as React from "react";
import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(
        (json?.error?.message as string) || `HTTP ${r.status}`,
      );
    }
    return json;
  });

type ItemKind = "CLAIM" | "ARGUMENT" | "CITATION" | "NOTE";
type SubmissionChannel = "in_platform" | "email" | "formal_intake" | "api";

interface PacketItem {
  id: string;
  kind: ItemKind;
  targetType: string;
  targetId: string;
  orderIndex: number;
  commentary: string | null;
  snapshotJson?: Record<string, unknown> | null;
}

interface Packet {
  id: string;
  pathwayId: string;
  title: string;
  summary: string | null;
  status: "DRAFT" | "SUBMITTED" | "RESPONDED" | "REVISED" | "CLOSED";
  version: number;
  items: PacketItem[];
}

interface PathwayDetail {
  pathway: {
    id: string;
    deliberationId: string;
    institutionId: string;
    isPublic: boolean;
    status: string;
    subject: string;
    currentPacketId: string | null;
  };
  currentPacket: Packet | null;
  latestSubmission: unknown;
  latestResponse: unknown;
}

const KIND_LABELS: Record<ItemKind, string> = {
  CLAIM: "Claim",
  ARGUMENT: "Argument",
  CITATION: "Citation",
  NOTE: "Note",
};

const CHANNEL_LABELS: Record<SubmissionChannel, string> = {
  in_platform: "In-platform",
  email: "Email",
  formal_intake: "Formal intake",
  api: "API",
};

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

async function patchJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json?.error?.message as string) || `HTTP ${res.status}`);
  }
  return json;
}

async function del(url: string) {
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json?.error?.message as string) || `HTTP ${res.status}`);
  }
}

export interface PacketBuilderProps {
  pathwayId: string;
  className?: string;
}

export function PacketBuilder({ pathwayId, className }: PacketBuilderProps) {
  const { data, error, isLoading, mutate } = useSWR<PathwayDetail>(
    pathwayId ? `/api/pathways/${pathwayId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const [busy, setBusy] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = React.useState(false);

  if (isLoading) {
    return (
      <div className={`text-sm text-slate-500 ${className ?? ""}`}>
        Loading pathway…
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

  const packet = data.currentPacket;
  const isReadOnly = !!packet && packet.status !== "DRAFT";

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      {errorMsg && (
        <div
          className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          role="alert"
        >
          {errorMsg}
        </div>
      )}

      {!packet ? (
        <CreateDraftCard
          pathwayId={pathwayId}
          busy={busy}
          onCreate={async (input) => {
            setErrorMsg(null);
            setBusy(true);
            try {
              await postJson(`/api/pathways/${pathwayId}/packets`, input);
              await mutate();
            } catch (e) {
              setErrorMsg((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : (
        <>
          <PacketHeader packet={packet} />
          <ItemList
            packet={packet}
            readOnly={isReadOnly}
            busy={busy}
            onChange={async () => {
              await mutate();
            }}
            onError={setErrorMsg}
            setBusy={setBusy}
          />
          {!isReadOnly && (
            <AddItemForm
              packetId={packet.id}
              busy={busy}
              setBusy={setBusy}
              onError={setErrorMsg}
              onAdded={async () => {
                await mutate();
              }}
            />
          )}
          {!isReadOnly && (
            <div className="flex items-center gap-2 border-t border-slate-200 pt-3">
              <span className="text-xs text-slate-500">
                {packet.items.length} item{packet.items.length === 1 ? "" : "s"}{" "}
                ready
              </span>
              <button
                type="button"
                disabled={busy || packet.items.length === 0}
                onClick={() => setSubmitOpen(true)}
                className="ml-auto rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Review &amp; submit
              </button>
            </div>
          )}
        </>
      )}

      {submitOpen && packet && (
        <SubmitModal
          packet={packet}
          pathway={data.pathway}
          busy={busy}
          onClose={() => setSubmitOpen(false)}
          onSubmit={async (input) => {
            setErrorMsg(null);
            setBusy(true);
            try {
              await postJson(`/api/packets/${packet.id}/submit`, input);
              setSubmitOpen(false);
              await mutate();
            } catch (e) {
              setErrorMsg((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

function CreateDraftCard({
  pathwayId: _pathwayId,
  busy,
  onCreate,
}: {
  pathwayId: string;
  busy: boolean;
  onCreate: (input: { title: string; summary: string | null }) => Promise<void>;
}) {
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        void onCreate({
          title: title.trim(),
          summary: summary.trim() || null,
        });
      }}
      className="space-y-3 rounded border border-slate-200 bg-white p-4"
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Create recommendation packet
        </h3>
        <p className="text-xs text-slate-500">
          A draft packet bundles the claims, arguments, and citations to send to
          the institution. You can edit the draft until you submit.
        </p>
      </div>
      <label className="block">
        <span className="block text-xs font-medium text-slate-700">Title</span>
        <input
          required
          maxLength={512}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-slate-700">
          Summary (optional)
        </span>
        <textarea
          rows={3}
          maxLength={4096}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Create draft
        </button>
      </div>
    </form>
  );
}

function PacketHeader({ packet }: { packet: Packet }) {
  return (
    <header className="flex flex-wrap items-baseline gap-2 border-b border-slate-200 pb-2">
      <h3 className="text-sm font-semibold text-slate-900">{packet.title}</h3>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
        v{packet.version} · {packet.status}
      </span>
      {packet.summary && (
        <p className="basis-full text-xs text-slate-600">{packet.summary}</p>
      )}
    </header>
  );
}

function ItemList({
  packet,
  readOnly,
  busy,
  onChange,
  onError,
  setBusy,
}: {
  packet: Packet;
  readOnly: boolean;
  busy: boolean;
  onChange: () => Promise<void>;
  onError: (msg: string) => void;
  setBusy: (b: boolean) => void;
}) {
  if (packet.items.length === 0) {
    return (
      <div className="rounded border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
        No items yet. Add a claim, argument, citation, or note below.
      </div>
    );
  }
  return (
    <ol className="space-y-2">
      {packet.items.map((item, idx) => (
        <ItemRow
          key={item.id}
          packetId={packet.id}
          item={item}
          index={idx}
          isFirst={idx === 0}
          isLast={idx === packet.items.length - 1}
          readOnly={readOnly}
          busy={busy}
          onChange={onChange}
          onError={onError}
          setBusy={setBusy}
        />
      ))}
    </ol>
  );
}

function ItemRow({
  packetId,
  item,
  index,
  isFirst,
  isLast,
  readOnly,
  busy,
  onChange,
  onError,
  setBusy,
}: {
  packetId: string;
  item: PacketItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  readOnly: boolean;
  busy: boolean;
  onChange: () => Promise<void>;
  onError: (msg: string) => void;
  setBusy: (b: boolean) => void;
}) {
  const [commentary, setCommentary] = React.useState(item.commentary ?? "");
  const [editing, setEditing] = React.useState(false);

  const move = async (direction: -1 | 1) => {
    setBusy(true);
    try {
      await patchJson(`/api/packets/${packetId}/items/${item.id}`, {
        orderIndex: Math.max(0, index + direction),
      });
      await onChange();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await patchJson(`/api/packets/${packetId}/items/${item.id}`, {
        commentary: commentary.trim() || null,
      });
      setEditing(false);
      await onChange();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Remove this item from the packet?")) return;
    setBusy(true);
    try {
      await del(`/api/packets/${packetId}/items/${item.id}`);
      await onChange();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
          {KIND_LABELS[item.kind]}
        </span>
        <span className="font-mono text-xs text-slate-500">
          {item.targetType}/{item.targetId}
        </span>
        {!readOnly && (
          <span className="ml-auto flex items-center gap-1">
            <button
              type="button"
              disabled={busy || isFirst}
              onClick={() => move(-1)}
              className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600 hover:border-slate-400 disabled:opacity-30"
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              disabled={busy || isLast}
              onClick={() => move(1)}
              className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600 hover:border-slate-400 disabled:opacity-30"
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing((v) => !v)}
              className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600 hover:border-slate-400"
            >
              {editing ? "Cancel" : "Edit"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="rounded border border-rose-200 px-1.5 py-0.5 text-xs text-rose-600 hover:bg-rose-50"
            >
              Remove
            </button>
          </span>
        )}
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            rows={2}
            maxLength={4096}
            value={commentary}
            onChange={(e) => setCommentary(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="Optional commentary"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="rounded bg-slate-900 px-2 py-1 text-xs text-white hover:bg-slate-800 disabled:bg-slate-300"
            >
              Save commentary
            </button>
          </div>
        </div>
      ) : item.commentary ? (
        <p className="mt-1 text-sm text-slate-700">{item.commentary}</p>
      ) : null}
    </li>
  );
}

function AddItemForm({
  packetId,
  busy,
  setBusy,
  onError,
  onAdded,
}: {
  packetId: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onError: (msg: string) => void;
  onAdded: () => Promise<void>;
}) {
  const [kind, setKind] = React.useState<ItemKind>("CLAIM");
  const [targetType, setTargetType] = React.useState("claim");
  const [targetId, setTargetId] = React.useState("");
  const [commentary, setCommentary] = React.useState("");

  // Auto-default targetType to lowercased kind for convenience.
  React.useEffect(() => {
    setTargetType(kind.toLowerCase());
  }, [kind]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let body: {
      kind: ItemKind;
      targetType: string;
      targetId: string;
      commentary: string | null;
    };
    if (kind === "NOTE") {
      // Notes are freeform; we synthesize a stable ID from time so the schema
      // (targetType+targetId required) is satisfied without a real referent.
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `note-${Date.now()}`;
      body = {
        kind,
        targetType: "note",
        targetId: id,
        commentary: commentary.trim() || null,
      };
    } else {
      if (!targetId.trim()) return;
      body = {
        kind,
        targetType: targetType.trim() || kind.toLowerCase(),
        targetId: targetId.trim(),
        commentary: commentary.trim() || null,
      };
    }
    setBusy(true);
    try {
      await postJson(`/api/packets/${packetId}/items`, body);
      setTargetId("");
      setCommentary("");
      await onAdded();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3"
    >
      <div className="flex flex-wrap gap-2">
        <label className="text-xs">
          <span className="block text-slate-700">Kind</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ItemKind)}
            className="mt-0.5 rounded border border-slate-300 px-1.5 py-1 text-sm"
          >
            {(Object.keys(KIND_LABELS) as ItemKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        {kind !== "NOTE" && (
          <>
            <label className="text-xs">
              <span className="block text-slate-700">Target type</span>
              <input
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                maxLength={64}
                className="mt-0.5 rounded border border-slate-300 px-1.5 py-1 text-sm"
              />
            </label>
            <label className="flex-1 text-xs">
              <span className="block text-slate-700">Target ID</span>
              <input
                required
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                maxLength={128}
                placeholder="claim/argument/citation ID"
                className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1 text-sm font-mono"
              />
            </label>
          </>
        )}
      </div>
      <label className="block text-xs">
        <span className="block text-slate-700">Commentary (optional)</span>
        <textarea
          rows={2}
          maxLength={4096}
          value={commentary}
          onChange={(e) => setCommentary(e.target.value)}
          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder={
            kind === "NOTE"
              ? "Note text (will be the snapshot body)"
              : "Why this item is included"
          }
        />
      </label>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || (kind !== "NOTE" && !targetId.trim())}
          className="rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
        >
          Add item
        </button>
      </div>
    </form>
  );
}

function SubmitModal({
  packet,
  pathway,
  busy,
  onClose,
  onSubmit,
}: {
  packet: Packet;
  pathway: PathwayDetail["pathway"];
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: {
    channel?: SubmissionChannel;
    externalReference?: string | null;
  }) => Promise<void>;
}) {
  const [channel, setChannel] = React.useState<SubmissionChannel>("in_platform");
  const [externalReference, setExternalReference] = React.useState("");

  const counts = packet.items.reduce<Record<ItemKind, number>>(
    (acc, item) => {
      acc[item.kind] = (acc[item.kind] ?? 0) + 1;
      return acc;
    },
    { CLAIM: 0, ARGUMENT: 0, CITATION: 0, NOTE: 0 },
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <h3
          id="submit-modal-title"
          className="text-base font-semibold text-slate-900"
        >
          Submit packet to institution
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Submitting freezes this packet. Subsequent changes require opening a
          revision round.
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-slate-500">Pathway subject</dt>
          <dd className="text-right text-slate-900">{pathway.subject}</dd>
          <dt className="text-slate-500">Recipient institution</dt>
          <dd
            className="text-right font-mono text-xs text-slate-700"
            title={pathway.institutionId}
          >
            {pathway.institutionId.slice(0, 8)}…
          </dd>
          <dt className="text-slate-500">Packet</dt>
          <dd className="text-right text-slate-900">
            {packet.title} (v{packet.version})
          </dd>
        </dl>

        <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Snapshot summary
          </div>
          <ul className="mt-1 grid grid-cols-2 gap-1 text-sm text-slate-700">
            {(Object.keys(counts) as ItemKind[]).map((k) => (
              <li key={k} className="flex justify-between">
                <span>{KIND_LABELS[k]}s</span>
                <span className="font-medium">{counts[k]}</span>
              </li>
            ))}
            <li className="col-span-2 mt-1 flex justify-between border-t border-slate-200 pt-1 text-xs text-slate-500">
              <span>Total items</span>
              <span>{packet.items.length}</span>
            </li>
          </ul>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="block text-xs font-medium text-slate-700">
              Channel
            </span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as SubmissionChannel)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            >
              {(Object.keys(CHANNEL_LABELS) as SubmissionChannel[]).map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          {channel !== "in_platform" && (
            <label className="block text-sm">
              <span className="block text-xs font-medium text-slate-700">
                External reference (optional)
              </span>
              <input
                maxLength={512}
                value={externalReference}
                onChange={(e) => setExternalReference(e.target.value)}
                placeholder="e.g., intake ticket #, email subject"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void onSubmit({
                channel,
                externalReference:
                  channel !== "in_platform" && externalReference.trim()
                    ? externalReference.trim()
                    : null,
              })
            }
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:bg-slate-300"
          >
            Confirm &amp; submit
          </button>
        </div>
      </div>
    </div>
  );
}

export default PacketBuilder;
