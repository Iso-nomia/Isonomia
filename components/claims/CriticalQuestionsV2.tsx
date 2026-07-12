"use client";

import * as React from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { suggestionForCQ } from "@/lib/argumentation/cqSuggestions";
import { NLCommitPopover } from "@/components/dialogue/NLCommitPopover";
import { LegalMoveChips } from "@/components/dialogue/LegalMoveChips";
import { useBusEffect } from "@/lib/client/useBusEffect";
import { SchemeComposerPicker } from "@/components/SchemeComposerPicker";

type RebutScope = "premise" | "inference" | "conclusion";
type Suggestion = {
  type: "undercut" | "rebut";
  scope?: RebutScope;
  options?: Array<{
    key: string;
    label: string;
    template: string;
    shape?: string;
  }>;
} | null;

type CQ = {
  key: string;
  text: string;
  satisfied: boolean;
  groundsText?: string; // Stored response/grounds for this CQ
  suggestion?: Suggestion;
};

type Scheme = { 
  key: string; 
  title: string; 
  cqs: CQ[];
};

type CQsResponse = { 
  targetType: "claim" | "argument"; 
  targetId: string; 
  schemes: Scheme[];
};

const fetcher = (u: string) =>
  fetch(u, { cache: "no-store" }).then((r) => r.json());

// Cache keys for data endpoints
const CQS_KEY = (type: "claim" | "argument", id: string, scheme?: string) =>
  `/api/cqs?targetType=${type}&targetId=${id}${scheme ? `&scheme=${scheme}` : ""}`;
const TOULMIN_KEY = (id: string) => `/api/claims/${id}/toulmin`;
const GRAPH_KEY = (roomId: string, lens: string, audienceId?: string) =>
  `graph:${roomId}:${lens}:${audienceId ?? "none"}`;
const ATTACH_KEY = (type: "claim" | "argument", id: string) =>
  `/api/cqs/attachments?targetType=${type}&targetId=${id}`;
const MOVES_KEY = (deliberationId: string) =>
  `/api/deliberations/${deliberationId}/moves?limit=500`;
const EDGES_KEY = (deliberationId: string) =>
  `/api/claims/edges?deliberationId=${deliberationId}`;

// OPTIONAL: search endpoint for attaching existing claims
async function trySearchClaims(
  q: string
): Promise<Array<{ id: string; text: string }>> {
  try {
    const r = await fetch(`/api/claims/search?q=${encodeURIComponent(q)}`, {
      cache: "no-store",
    });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j.items) ? j.items.slice(0, 10) : [];
  } catch {
    return [];
  }
}

export default function CriticalQuestions({
  targetType,
  targetId,
  createdById,
  deliberationId,
  roomId,
  currentLens,
  currentAudienceId,
  selectedAttackerClaimId,
  prefilterKeys,
}: {
  targetType: "claim" | "argument";
  targetId: string;
  createdById?: string;
  deliberationId: string;
  roomId?: string;
  currentLens?: string;
  currentAudienceId?: string;
  selectedAttackerClaimId?: string;
  prefilterKeys?: Array<{ schemeKey: string; cqKey: string }>;
}) {
  // ----- UI state -----
  const [blockedMsg, setBlockedMsg] = React.useState<Record<string, string>>({});
  const [commitOpen, setCommitOpen] = React.useState(false);
  const [commitCtx, setCommitCtx] = React.useState<{
    locus: string;
    owner: "Proponent" | "Opponent";
    targetType: "claim";
    targetId: string;
  } | null>(null);
  const [locus, setLocus] = React.useState("0");
  const [lingerKeys, setLingerKeys] = useState<Set<string>>(new Set());
  const [justGrounded, setJustGrounded] = useState<Set<string>>(new Set());
  const [postingKey, setPostingKey] = useState<string | null>(null);
  const [okKey, setOkKey] = useState<string | null>(null);

  // compose new attacker (quick-create)
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeText, setComposeText] = useState("");
  const [composeLoading, setComposeLoading] = useState(false);
  const [pendingAttach, setPendingAttach] = useState<{
    schemeKey: string;
    cqKey: string;
    suggestion?: Suggestion;
  } | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);

  // attach existing claim popover
  const [attachExistingFor, setAttachExistingFor] = useState<{
    schemeKey: string;
    cqKey: string;
  } | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchRes, setSearchRes] = useState<Array<{ id: string; text: string }>>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [showLegalMoves, setShowLegalMoves] = useState<string | null>(null);
  const [groundsDraft, setGroundsDraft] = useState<Record<string, string>>({});

  // ----- Data fetching with SWR -----
  const { data, error, isLoading, mutate: mutateCQs } = useSWR<CQsResponse>(
    CQS_KEY(targetType, targetId),
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 2000 }
  );

  const { data: attachData, mutate: mutateAttach } = useSWR<{
    attached: Record<string, boolean>;
  }>(ATTACH_KEY(targetType, targetId), fetcher, { revalidateOnFocus: false });

  const { data: movesData, mutate: mutateMoves } = useSWR(
    deliberationId ? MOVES_KEY(deliberationId) : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: edgesData, mutate: mutateEdges } = useSWR(
    deliberationId ? EDGES_KEY(deliberationId) : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // ----- Event-driven cache invalidation via bus -----
  useBusEffect(
    [
      "cqs:changed",
      "dialogue:moves:refresh",
      "arguments:changed",
      "claims:changed",
      "claims:edges:changed",
    ] as any,
    () => {
      mutateCQs();
      mutateAttach();
      mutateMoves();
      mutateEdges();
    },
    { retry: true }
  );

  // Legacy event listeners for backwards compatibility
  React.useEffect(() => {
    const h = () => {
      mutateCQs();
      mutateAttach();
      mutateMoves();
      mutateEdges();
    };
    window.addEventListener("claims:changed", h);
    window.addEventListener("dialogue:moves:refresh", h);
    window.addEventListener("arguments:changed", h);
    return () => {
      window.removeEventListener("claims:changed", h);
      window.removeEventListener("dialogue:moves:refresh", h);
      window.removeEventListener("arguments:changed", h);
    };
  }, [mutateCQs, mutateAttach, mutateMoves, mutateEdges]);

  // ----- Helper functions -----
  function sigOf(schemeKey: string, cqKey: string) {
    return `${schemeKey}:${cqKey}`;
  }

  async function revalidateAll(schemeKey?: string) {
    await Promise.all([
      mutateCQs(),
      mutateAttach(),
      mutateMoves(),
      mutateEdges(),
      globalMutate(TOULMIN_KEY(targetId)),
      roomId && currentLens
        ? globalMutate(GRAPH_KEY(roomId, currentLens, currentAudienceId))
        : Promise.resolve(),
    ]);
  }

  function flashOk(sig: string) {
    setOkKey(sig);
    setTimeout(() => setOkKey((k) => (k === sig ? null : k)), 1000);
  }

  function canMarkAddressed(sig: string, satisfied: boolean) {
    if (satisfied) return true;
    const attachedSpecific = !!attachData?.attached?.[sig];
    const attachedAny = !!attachData?.attached?.["__ANY__"];
    return attachedSpecific || attachedAny;
  }

  // ----- Toggle CQ status (main action) -----
  async function toggleCQ(
    schemeKey: string,
    cqKey: string,
    next: boolean,
    attackerClaimId?: string
  ) {
    const sig = sigOf(schemeKey, cqKey);
    setBlockedMsg((m) => ({ ...m, [sig]: "" }));

    if (next) {
      setOkKey(sig);
      setTimeout(() => setOkKey((k) => (k === sig ? null : k)), 1000);
    }

    // Optimistic update
    globalMutate(
      CQS_KEY(targetType, targetId),
      (cur: CQsResponse | undefined) => {
        if (!cur) return cur;
        return {
          ...cur,
          schemes: cur.schemes.map((s) =>
            s.key !== schemeKey
              ? s
              : {
                  ...s,
                  cqs: s.cqs.map((cq) =>
                    cq.key === cqKey ? { ...cq, satisfied: next } : cq
                  ),
                }
          ),
        };
      },
      { revalidate: false }
    );

    try {
      const res = await fetch("/api/cqs/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          schemeKey,
          cqKey,
          satisfied: next,
          deliberationId,
          attackerClaimId,
        }),
      });

      if (res.status === 409) {
        const j = await res.json().catch(() => null);
        const req = j?.guard?.requiredAttack as "rebut" | "undercut" | null;
        const msg = req
          ? `Needs a ${req} attached (or strong NLI for rebut).`
          : `Needs an attached counter (rebut/undercut).`;
        setBlockedMsg((m) => ({ ...m, [sig]: msg }));
      }

      if (!res.ok && res.status !== 409) {
        let msg = "Failed to toggle";
        try {
          const t = await res.text();
          if (t) msg = t;
        } catch {}
        setBlockedMsg((m) => ({ ...m, [sig]: msg }));
      }
    } finally {
      await revalidateAll(schemeKey);
    }
  }

  // ----- Resolve via GROUNDS (simplified: just mark satisfied without posting dialogue moves) -----
  // Note: Formal WHY/GROUNDS moves should be posted via LegalMoveChips/CommandCard instead.
  // This function is for quick CQ satisfaction tracking in the UI.
  async function resolveViaGrounds(
    schemeKey: string,
    cqId: string,
    brief: string,
    alsoMark = false
  ) {
    const sig = sigOf(schemeKey, cqId);
    const text = (brief || "").trim();
    if (!text) return;

    try {
      setPostingKey(sig);
      
      // Mark CQ as satisfied and store grounds text
      await fetch("/api/cqs/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          schemeKey,
          cqKey: cqId,
          satisfied: true,
          deliberationId,
          attachSuggestion: false,
          groundsText: text, // Store the grounds text response
        }),
      });

      window.dispatchEvent(new CustomEvent("dialogue:moves:refresh"));
      window.dispatchEvent(new CustomEvent("claims:changed"));
      flashOk(sig);
    } catch (err) {
      console.error("Error marking CQ satisfied:", err);
      alert(`Failed to update CQ: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPostingKey(null);
      setGroundsDraft((g) => ({ ...g, [sig]: "" }));
      await revalidateAll(schemeKey);
    }
  }

  // ----- Attach suggestion with attacker claim -----
  async function attachWithAttacker(
    schemeKey: string,
    cqKey: string,
    attackerClaimId: string,
    suggestion?: Suggestion
  ) {
    const sig = sigOf(schemeKey, cqKey);
    try {
      setPostingKey(sig);
      await fetch("/api/cqs/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          schemeKey,
          cqKey,
          satisfied: false,
          attachSuggestion: true,
          attackerClaimId,
          suggestion,
          deliberationId,
        }),
      });
      window.dispatchEvent(new CustomEvent("dialogue:moves:refresh"));
      flashOk(sig);
    } finally {
      setPostingKey(null);
      await revalidateAll(schemeKey);
    }
  }

  async function onAttachClick(
    schemeKey: string,
    cqKey: string,
    rowSuggestion?: Suggestion
  ) {
    setAttachError(null);
    if (selectedAttackerClaimId) {
      await attachWithAttacker(
        schemeKey,
        cqKey,
        selectedAttackerClaimId,
        rowSuggestion
      );
      return;
    }
    setPendingAttach({ schemeKey, cqKey, suggestion: rowSuggestion });
    setComposeText("");
    setComposeOpen(true);
  }

  // Quick-create a counter and attach
  async function handleComposeSubmit() {
    if (!pendingAttach) return;
    const { schemeKey, cqKey, suggestion } = pendingAttach;
    try {
      setComposeLoading(true);
      setAttachError(null);
      const ccRes = await fetch("/api/claims/quick-create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetClaimId: targetId,
          text: composeText.trim(),
        }),
      });
      if (!ccRes.ok) throw new Error(await ccRes.text());
      const { claimId: attackerClaimId } = (await ccRes.json()) as {
        claimId: string;
      };
      await attachWithAttacker(schemeKey, cqKey, attackerClaimId, suggestion);
      setComposeOpen(false);
      setPendingAttach(null);
      setComposeText("");
    } catch (e: any) {
      setAttachError(e?.message || "Failed to attach");
    } finally {
      setComposeLoading(false);
    }
  }

  // Attach existing (paste/search)
  async function onSearch() {
    if (!searchQ.trim()) {
      setSearchRes([]);
      return;
    }
    setSearchBusy(true);
    try {
      setSearchRes(await trySearchClaims(searchQ.trim()));
    } finally {
      setSearchBusy(false);
    }
  }

  async function panelConfirmClaim(claimId: string) {
    const af = await fetch(
      `/api/claims/labels?deliberationId=${deliberationId}`
    )
      .then((r) => r.json())
      .catch(() => null);

    await fetch("/api/dialogue/panel/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deliberationId,
        kind: "epistemic",
        subject: { type: "claim", id: claimId },
        rationale: "CQ satisfied, AF=IN",
        inputs: {
          cq: await fetch(`/api/claims/${claimId}/cq/summary`)
            .then((r) => r.json())
            .catch(() => ({})),
          af,
        },
      }),
    });
  }

  // ----- Filtered schemes view -----
  const filtered = useMemo(() => {
    if (!data || !prefilterKeys?.length) return data || null;
    const wanted = new Set(
      prefilterKeys.map((k) => `${k.schemeKey}:${k.cqKey}`)
    );
    const schemes = data.schemes
      .map((s) => ({
        ...s,
        cqs: s.cqs.filter((cq) => {
          const sig = `${s.key}:${cq.key}`;
          return wanted.has(sig) && (!cq.satisfied || lingerKeys.has(sig));
        }),
      }))
      .filter((s) => s.cqs.length);
    return { ...data, schemes };
  }, [data, prefilterKeys, lingerKeys]);

  const view =
    filtered ?? data ?? { targetType: "claim", targetId, schemes: [] as Scheme[] };
  const schemes: Scheme[] = Array.isArray(view.schemes) ? view.schemes : [];

  // ----- Rendering -----
  if (isLoading)
    return <div className="text-xs text-neutral-500">Loading CQs…</div>;
  if (error)
    return <div className="text-xs text-red-600">Failed to load CQs.</div>;
  if (!schemes.length)
    return (
      <div className="text-xs text-neutral-500">No critical questions yet.</div>
    );

  return (
    <>
      <div className="space-y-3 overflow-y-auto max-h-96">
        {schemes.map((s) => (
          <div key={s.key} className="rounded border bg-white p-2">
            <div className="text-sm font-semibold">{s.title}</div>
            <ul className="mt-1 space-y-2">
              {s.cqs.map((cq) => {
                const sig = sigOf(s.key, cq.key);
                const isAttached = !!attachData?.attached?.[sig];
                const satisfied = cq.satisfied;
                const canAddress = canMarkAddressed(sig, satisfied);
                const posting = postingKey === sig;
                const ok = okKey === sig;
                const rowSug: Suggestion =
                  cq.suggestion ?? suggestionForCQ(s.key, cq.key);
                const groundsVal = groundsDraft[sig] ?? "";

                return (
                  <li
                    key={cq.key}
                    className="text-sm p-2 border-[1px] border-slate-200 rounded-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      {/* Left: Checkbox + text */}
                      <label className="flex-1 flex items-start gap-2 cursor-pointer">
                        <Checkbox
                          className="flex mt-1"
                          checked={cq.satisfied}
                          onCheckedChange={(val) =>
                            toggleCQ(s.key, cq.key, Boolean(val))
                          }
                          disabled={!canAddress || posting}
                        />
                        <div className="flex-1">
                          <span
                            className={`${
                              cq.satisfied ? "opacity-70 line-through" : ""
                            }`}
                          >
                            {cq.text}
                          </span>
                          {ok && (
                            <span className="text-[10px] text-emerald-700 ml-1">
                              ✓
                            </span>
                          )}
                          {!cq.satisfied && !canAddress && (
                            <span className="text-[10px] text-neutral-500 ml-2">
                              (add)
                            </span>
                          )}
                          {/* Display stored grounds text when satisfied */}
                          {cq.satisfied && cq.groundsText && (
                            <div className="mt-1 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1">
                              <strong>Response:</strong> {cq.groundsText}
                            </div>
                          )}
                        </div>
                      </label>

                      {/* Right: Action buttons */}
                      <div className="flex flex-col items-end gap-1">
                        {/* Locus control */}
                        <div className="flex items-center gap-2 mb-1">
                          <label className="text-[11px]">Locus</label>
                          <input
                            className="text-[11px] border rounded px-1 py-0.5 w-20"
                            value={locus}
                            onChange={(e) => setLocus(e.target.value)}
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            className="text-[11px] px-2 py-0.5 border rounded"
                            title="Confirm CQ/AF state"
                            onClick={() => panelConfirmClaim(targetId)}
                          >
                            Confirm (panel)
                          </button>

                          <button
                            className="text-[11px] px-2 py-0.5 border rounded"
                            onClick={() =>
                              setShowLegalMoves(
                                showLegalMoves === sig ? null : sig
                              )
                            }
                          >
                            {showLegalMoves === sig
                              ? "Hide Moves"
                              : "Show Moves"}
                          </button>

                          {!satisfied && rowSug && (
                            <button
                              className="text-[11px] px-2 py-0 border rounded-md"
                              disabled={posting}
                              onClick={() => onAttachClick(s.key, cq.key, rowSug)}
                              title={
                                rowSug.type === "undercut"
                                  ? "Attach undercut"
                                  : `Attach rebut (${rowSug.scope ?? "conclusion"})`
                              }
                            >
                              {posting ? "Attaching…" : "Attach"}
                            </button>
                          )}
                        </div>

                        {blockedMsg[sig] && (
                          <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
                            {blockedMsg[sig]}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Legal moves panel */}
                    {showLegalMoves === sig && (
                      <div className="mt-2 pl-6 border-l-2 border-indigo-200 bg-indigo-50/30 p-2 rounded">
                        <div className="text-xs font-semibold mb-1 text-slate-700">
                          Legal Dialogical Moves:
                        </div>
                        <LegalMoveChips
                          deliberationId={deliberationId}
                          targetType="claim"
                          targetId={targetId}
                          locusPath={locus}
                          onPosted={() => {
                            window.dispatchEvent(
                              new CustomEvent("claims:changed")
                            );
                            window.dispatchEvent(
                              new CustomEvent("dialogue:moves:refresh")
                            );
                          }}
                        />
                      </div>
                    )}

                    {/* Inline grounds input */}
                    {!satisfied && (
                      <div className="mt-1 pl-6 flex items-center gap-2">
                        <Input
                          className="h-8 text-[12px]"
                          placeholder="Reply with grounds…"
                          value={groundsVal}
                          onChange={(e) =>
                            setGroundsDraft((g) => ({
                              ...g,
                              [sig]: e.target.value,
                            }))
                          }
                          onKeyDown={async (e) => {
                            if (
                              e.key === "Enter" &&
                              groundsVal.trim() &&
                              !posting
                            ) {
                              await resolveViaGrounds(
                                s.key,
                                cq.key,
                                groundsVal.trim(),
                                true
                              );
                            }
                          }}
                          disabled={posting}
                        />
                        <Button
                          size="sm"
                          className="h-8 text-[12px]"
                          disabled={!groundsVal.trim() || posting}
                          onClick={() =>
                            resolveViaGrounds(
                              s.key,
                              cq.key,
                              groundsVal.trim(),
                              true
                            )
                          }
                          title="Post grounds and mark addressed"
                        >
                          {posting ? "Posting…" : "Post grounds"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-[12px]"
                          onClick={() =>
                            setGroundsDraft((g) => ({ ...g, [sig]: "" }))
                          }
                        >
                          Clear
                        </Button>
                      </div>
                    )}

                    {/* Suggestion quick templates */}
                    {!satisfied && rowSug?.options?.length ? (
                      <div className="mt-1 pl-6 flex flex-wrap gap-1">
                        {rowSug.options.map((o) => (
                          <button
                            key={o.key}
                            className="px-2 py-0.5 border rounded text-[11px] bg-white hover:bg-slate-50"
                            onClick={() =>
                              window.dispatchEvent(
                                new CustomEvent("mesh:composer:insert", {
                                  detail: { template: o.template },
                                })
                              )
                            }
                            title={`Shape: ${o.shape ?? rowSug.type}`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {/* Attach existing counter */}
                    {!satisfied && (
                      <div className="pl-6 mt-1">
                        <button
                          className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium hover:underline transition-colors"
                          onClick={() =>
                            setAttachExistingFor({
                              schemeKey: s.key,
                              cqKey: cq.key,
                            })
                          }
                        >
                          🔍 Search & attach counter-claim…
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Commit popover */}
      {commitCtx && (
        <NLCommitPopover
          open={commitOpen}
          onOpenChange={setCommitOpen}
          deliberationId={deliberationId}
          targetType={commitCtx.targetType}
          targetId={commitCtx.targetId}
          locusPath={commitCtx.locus}
          defaultOwner={commitCtx.owner}
          onDone={() => {
            window.dispatchEvent(
              new CustomEvent("dialogue:cs:refresh", {
                detail: {
                  dialogueId: deliberationId,
                  ownerId: commitCtx.owner,
                },
              } as any)
            );
            window.dispatchEvent(new CustomEvent("dialogue:moves:refresh"));
          }}
        />
      )}

      {/* Quick-compose dialog (new counter) */}
      <Dialog
        open={composeOpen}
        onOpenChange={(o) => !composeLoading && setComposeOpen(o)}
      >
        <DialogContent className="bg-slate-200 rounded-xl sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add a counter-claim</DialogTitle>
            <DialogDescription>
              Write a concise counter-claim to attach as an undercut/rebut for
              the unmet CQ.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-xs font-medium">Counter-claim text</label>
            <Textarea
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              placeholder="e.g., The cited expert's field is unrelated to the claim under discussion."
              disabled={composeLoading}
              rows={5}
            />
            {attachError && (
              <div className="text-xs text-red-600">{attachError}</div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setComposeOpen(false)}
              disabled={composeLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleComposeSubmit}
              disabled={composeLoading || composeText.trim().length < 3}
            >
              {composeLoading ? "Attaching…" : "Create & Attach"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attach existing (using SchemeComposerPicker for better UX) */}
      <SchemeComposerPicker
        kind="claim"
        open={!!attachExistingFor}
        onClose={() => setAttachExistingFor(null)}
        onPick={(claim) => {
          if (!attachExistingFor) return;
          attachWithAttacker(
            attachExistingFor.schemeKey,
            attachExistingFor.cqKey,
            claim.id
          );
          setAttachExistingFor(null);
        }}
      />
    </>
  );
}
