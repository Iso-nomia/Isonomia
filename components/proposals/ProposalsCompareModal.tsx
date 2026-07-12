"use client";
import * as React from "react";
import useSWR from "swr";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function ProposalsCompareModal({
  open,
  onClose,
  rootMessageId,
  conversationId,    // required for signals
  currentUserId,
  onOpenDrift,       // not used yet, but keep for future
  onMerged,
}: {
  open: boolean;
  onClose: () => void;
  rootMessageId: string;
  conversationId: string;
  currentUserId: string;
  onOpenDrift: (driftId: string) => void;
  onMerged?: () => void;
}) {
  // ---- Counts (✅/⛔) via SWR; non-blocking
  const { data: listData, mutate: mutateCounts } = useSWR(
    open ? `/api/proposals/list?rootMessageId=${encodeURIComponent(rootMessageId)}` : null,
    fetcher
  );
  const counts = listData?.counts ?? {};

  // ---- Candidates (what you render)
  const [candidates, setCandidates] = React.useState<any[]>([]);
  const [candLoading, setCandLoading] = React.useState(false);
  const [candErr, setCandErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setCandLoading(true);
    setCandErr(null);
    fetch(`/api/proposals/candidates?rootMessageId=${encodeURIComponent(rootMessageId)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : r.text().then((t) => Promise.reject(new Error(t)))))
      .then((d) => setCandidates(Array.isArray(d?.items) ? d.items : []))
      .catch((e) => setCandErr(e?.message || "Failed to load proposals"))
      .finally(() => setCandLoading(false));
  }, [open, rootMessageId]);

  // ✅ signals for Approve/Block/Clear
  async function signal(facetId: string, kind: "APPROVE" | "BLOCK" | "CLEAR") {
    try {
      await fetch(`/api/proposals/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: rootMessageId, conversationId, facetId, kind }),
      });
      mutateCounts(); // refresh counts; candidates list can stay as-is
    } catch {
      // non-blocking; counts will refresh on broadcast too
    }
  }

  async function mergeFacet(facetId: string) {
    const resp = await fetch(`/api/proposals/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rootMessageId, facetId }),
    });
    if (!resp.ok) {
      alert(await resp.text());
      return;
    }
    onMerged?.();
    onClose();
  }

  async function mergeMessage(messageId: string) {
    const resp = await fetch(`/api/proposals/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rootMessageId, proposalMessageId: messageId }),
    });
    if (!resp.ok) {
      alert(await resp.text());
      return;
    }
    onMerged?.();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40">
      <div className="w-[720px] max-w-[95vw] rounded-xl bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Compare Proposals</h2>
          <button className="text-sm px-2 py-1 rounded bg-slate-100" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-3">
          {candLoading ? (
            <div className="text-sm text-slate-600">Loading…</div>
          ) : candErr ? (
            <div className="text-sm text-red-600">{candErr}</div>
          ) : candidates.length === 0 ? (
            <div className="text-sm text-slate-600">No proposals yet.</div>
          ) : (
            <div className="space-y-2">
              {candidates.map((c) => {
                const key = c.kind === "FACET" ? `f:${c.facetId}` : `m:${c.messageId}`;
                // counts only for facets; for TEXT candidates we don’t render counts
                const ctn = c.kind === "FACET" ? counts[c.facetId as string] || { approve: 0, block: 0 } : null;

                return (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.previewTitle || c.authorName}</div>
                      <div className="text-xs text-slate-500">
                        {c.authorName} • {new Date(c.createdAt).toLocaleString()}
                      </div>
                      <div className="text-sm mt-1 line-clamp-3">{c.preview}</div>
                      {c.kind === "FACET" && (
                        <div className="mt-1 text-xs text-slate-600">
                          ✅ {ctn!.approve} · ⛔ {ctn!.block}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {c.kind === "FACET" ? (
                        <>
                          <button
                            className="text-xs rounded-md border px-2 py-1 bg-white hover:bg-slate-100"
                            onClick={() => signal(c.facetId, "APPROVE")}
                          >
                            Approve
                          </button>
                          <button
                            className="text-xs rounded-md border px-2 py-1 bg-white hover:bg-slate-100"
                            onClick={() => signal(c.facetId, "BLOCK")}
                          >
                            Request changes
                          </button>
                          <button
                            className="text-xs rounded-md border px-2 py-1 bg-white/60 hover:bg-slate-100"
                            onClick={() => signal(c.facetId, "CLEAR")}
                          >
                            Clear
                          </button>
                          <button
                            className="text-xs rounded-md border px-2 py-1 bg-emerald-50 hover:bg-emerald-100"
                            onClick={() => mergeFacet(c.facetId)}
                          >
                            ✅ Merge facet
                          </button>
                        </>
                      ) : (
                        <button
                          className="text-xs rounded-md border px-2 py-1 bg-emerald-50 hover:bg-emerald-100"
                          onClick={() => mergeMessage(c.messageId)}
                        >
                          ✅ Merge
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Tip: Merging updates the original message. Receipts keep a signed history (vN).
        </p>
      </div>
    </div>
  );
}
