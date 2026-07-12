//This is a legacy, obselete file kept for reference. Please do not edit or use this file.

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
  suggestion?: Suggestion;
};
type Scheme = { key: string; title: string; cqs: CQ[] };
type CQsResponse = { targetType: "claim"; targetId: string; schemes: Scheme[] };

const fetcher = (u: string) =>
  fetch(u, { cache: "no-store" }).then((r) => r.json());

// const fetcher = async (u: string) => {
//   const res = await fetch(u, { cache: 'no-store' });
//     if (!res.ok) {
//         let msg = 'Failed to toggle';
//         try { const j = await res.json(); msg = j?.message || j?.error || msg; } catch { msg = await res.text().catch(()=>msg); }
//         setBlockedMsg(m => ({ ...m, [sig]: msg }));
//         return;
//       }
//   return res.json();
// };

// Cache keys for data endpoints
const CQS_KEY = (id: string, scheme?: string) =>
  `/api/cqs?targetType=claim&targetId=${id}${
    scheme ? `&scheme=${scheme}` : ""
  }`;
const TOULMIN_KEY = (id: string) => `/api/claims/${id}/toulmin`;
const GRAPH_KEY = (roomId: string, lens: string, audienceId?: string) =>
  `graph:${roomId}:${lens}:${audienceId ?? "none"}`;
const ATTACH_KEY = (id: string) =>
  `/api/cqs/attachments?targetType=claim&targetId=${id}`;
const MOVES_KEY = (deliberationId: string) =>
  `/api/deliberations/${deliberationId}/moves?limit=500`;
const EDGES_KEY = (deliberationId: string) =>
  `/api/claims/edges?deliberationId=${deliberationId}`;

// OPTIONAL: if you have a search endpoint; component degrades gracefully if not present.
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
  createdById, // kept for parity; not used here directly
  deliberationId,
  roomId,
  currentLens,
  currentAudienceId,
  selectedAttackerClaimId, // when the user preselected a counter-claim elsewhere
  prefilterKeys, // [{schemeKey,cqKey}]
}: {
  targetType: "claim";
  targetId: string;
  createdById?: string;
  deliberationId: string;
  roomId?: string;
  currentLens?: string;
  currentAudienceId?: string;
  selectedAttackerClaimId?: string;
  prefilterKeys?: Array<{ schemeKey: string; cqKey: string }>;
}) {
  const [blockedMsg, setBlockedMsg] = React.useState<Record<string, string>>(
    {}
  );
  const [commitOpen, setCommitOpen] = React.useState(false);
  const [commitCtx, setCommitCtx] = React.useState<{
    locus: string;
    owner: "Proponent" | "Opponent";
    targetType: "claim";
    targetId: string;
  } | null>(null);
  const [locus, setLocus] = React.useState("0"); // default locus for WHY/GROUNDS

  // Modal state for GROUNDS brief entry
  const [groundsModalOpen, setGroundsModalOpen] = React.useState(false);
  const [groundsBrief, setGroundsBrief] = React.useState("");
  const [pendingGroundsContext, setPendingGroundsContext] = React.useState<{
    schemeKey: string;
    cqKey: string;
  } | null>(null);

  // ----- data -----
  const { data, error, isLoading } = useSWR<CQsResponse>(
    CQS_KEY(targetId),
    fetcher
  );
  const { data: attachData } = useSWR<{ attached: Record<string, boolean> }>(
    ATTACH_KEY(targetId),
    fetcher
  );

  // ----- local ui state -----
  const [lingerKeys, setLingerKeys] = useState<Set<string>>(new Set()); // “Addressed ✓” ephemeral
  const [justGrounded, setJustGrounded] = useState<Set<string>>(new Set()); // client-side permission to mark satisfied
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

  // attach existing claim popover (lightweight)
  const [attachExistingFor, setAttachExistingFor] = useState<{
    schemeKey: string;
    cqKey: string;
  } | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchRes, setSearchRes] = useState<
    Array<{ id: string; text: string }>
  >([]);
  const [searchBusy, setSearchBusy] = useState(false);
  // const [blockedMsg, setBlockedMsg] = useState<Record<string,string>>({});

  async function postMove(kind: "WHY" | "GROUNDS", payload: any = {}) {
    await fetch("/api/dialogue/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deliberationId,
        targetType: "claim",
        targetId,
        kind,
        payload: { locusPath: locus, ...payload },
        autoCompile: true,
        autoStep: true,
        phase: "neutral",
      }),
    })
      .then((r) => r.json())
      .catch(() => null);
    window.dispatchEvent(new CustomEvent("dialogue:moves:refresh"));
  }

  function sigOf(schemeKey: string, cqKey: string) {
    return `${schemeKey}:${cqKey}`;
  }

  async function handleGroundsSubmit() {
    if (!pendingGroundsContext || !groundsBrief.trim()) return;
    
    await postMove("GROUNDS", {
      brief: groundsBrief.trim(),
      schemeKey: pendingGroundsContext.schemeKey,
      cqId: pendingGroundsContext.cqKey,
    });

    // Optional: open commit popover
    setCommitCtx({
      locus,
      owner: "Proponent",
      targetType: "claim",
      targetId,
    });
    setCommitOpen(true);
    
    // Close modal and reset state
    setGroundsModalOpen(false);
    setGroundsBrief("");
    setPendingGroundsContext(null);
  }

  async function toggleCQ(
    schemeKey: string,
    cqKey: string,
    next: boolean,
    attackerClaimId?: string
  ) {
    const sig = sigOf(schemeKey, cqKey);
    setBlockedMsg((m) => ({ ...m, [sig]: "" }));

    // small “✓” linger when setting true
    if (next) {
      setOkKey(sig);
      setTimeout(() => setOkKey((k) => (k === sig ? null : k)), 1000);
    }

    // optimistic local flip
    globalMutate(
      CQS_KEY(targetId),
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
        // generic failure
        let msg = "Failed to toggle";
        try {
          const t = await res.text();
          if (t) msg = t;
        } catch {}
        setBlockedMsg((m) => ({ ...m, [sig]: msg }));
      }
    } finally {
      // re-sync caches no matter what
      await Promise.all([
        globalMutate(CQS_KEY(targetId)),
        globalMutate(ATTACH_KEY(targetId)),
        globalMutate(TOULMIN_KEY(targetId)),
      ]);
    }
  }

  // inline grounds map: sig → text
  const [groundsDraft, setGroundsDraft] = useState<Record<string, string>>({});

  // Filtered schemes view (stable hooks → compute via memo)
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

  const view = filtered ??
    data ?? { targetType: "claim", targetId, schemes: [] as Scheme[] };
  const schemes: Scheme[] = Array.isArray(view.schemes) ? view.schemes : [];

  // ----- helpers -----
  // function sigOf(schemeKey: string, cqKey: string) { return `${schemeKey}:${cqKey}`; }

  async function panelConfirmClaim(claimId: string) {
    // fetch AF labels if you don’t already have them
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
          cq: await await fetch(`/api/claims/${claimId}/cq/summary`)
            .then((r) => r.json())
            .catch(() => ({})),
          af,
        },
      }),
    });
  }

  async function revalidateAll(schemeKey?: string) {
    await Promise.all([
      globalMutate(CQS_KEY(targetId, schemeKey)),
      globalMutate(TOULMIN_KEY(targetId)),
      globalMutate(ATTACH_KEY(targetId)),
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
    const attachedAny = !!attachData?.attached?.["__ANY__"]; // fallback: any inbound rebut/undercut found
    // Note: posting grounds alone does not satisfy the guard; keep checkbox disabled until there is an attachment.
    return attachedSpecific || attachedAny;
  }

  // ----- actions -----

  // // Toggle satisfied (with linger ✓)
  // async function toggleCQ(schemeKey: string, cqKey: string, next: boolean) {
  //   const sig = sigOf(schemeKey, cqKey);
  //   if (next) {
  //     setLingerKeys(p => new Set(p).add(sig));
  //     setTimeout(() => setLingerKeys(p => { const n = new Set(p); n.delete(sig); return n; }), 1000);
  //   }

  //   // optimistic CQ cache
  //   globalMutate(
  //     CQS_KEY(targetId),
  //     (cur: CQsResponse | undefined) => {
  //       if (!cur) return cur;
  //       return {
  //         ...cur,
  //         schemes: cur.schemes.map(s => s.key !== schemeKey ? s : {
  //           ...s, cqs: s.cqs.map(cq => cq.key === cqKey ? { ...cq, satisfied: next } : cq),
  //         })
  //       };
  //     },
  //     { revalidate: false }
  //   );

  //   try {
  //     setPostingKey(sig);
  //     const res = await fetch('/api/cqs/toggle', {
  //       method: 'POST',
  //       headers: { 'content-type': 'application/json' },
  //       body: JSON.stringify({ targetType, targetId, schemeKey, cqKey, satisfied: next, deliberationId }),
  //     });

  //     if (res.status === 409) {
  //       const j = await res.json().catch(()=>null);
  //       const req = j?.guard?.requiredAttack as ('rebut'|'undercut'|null);
  //       const msg = req
  //         ? `Needs a ${req} attached (or strong NLI for rebut).`
  //         : `Needs an attached counter (rebut/undercut).`;
  //       setBlockedMsg(m => ({ ...m, [sig]: msg }));
  //       // Re-sync from server
  //       await revalidateAll(schemeKey);
  //       return;
  //     }

  //     if (!res.ok) throw new Error(await res.text());

  //     setBlockedMsg(m => { const c = { ...m }; delete c[sig]; return c; });
  //     window.dispatchEvent(new CustomEvent('dialogue:moves:refresh'));
  //     flashOk(sig);
  //   } finally {
  //     setPostingKey(null);
  //     await revalidateAll(schemeKey);
  //   }
  // }

  // Resolve via grounds: post GROUNDS move (and optionally tick satisfied)
  // async function resolveViaGrounds(schemeKey: string, cqKey: string, brief: string, alsoMark = true) {
  //   const sig = sigOf(schemeKey, cqKey);
  //   if (!brief.trim()) return;
  //   try {
  //     setPostingKey(sig);
  //     await fetch('/api/dialogue/move', {
  //       method: 'POST', headers: { 'content-type':'application/json' },
  //       body: JSON.stringify({
  //         deliberationId,
  //         targetType: 'claim',
  //         targetId,
  //         kind: 'GROUNDS',
  //         payload: { schemeKey, cqKey, brief },
  //         autoCompile: true,
  //         autoStep: true,
  //       }),
  //     });
  //     setJustGrounded(p => new Set(p).add(sig));
  //     window.dispatchEvent(new CustomEvent('dialogue:moves:refresh'));
  //     if (alsoMark) await toggleCQ(schemeKey, cqKey, true);
  //     flashOk(sig);
  //   } finally {
  //     setPostingKey(null);
  //     setGroundsDraft(g => ({ ...g, [sig]: '' }));
  //   }
  // }
  async function resolveViaGrounds(
  schemeKey: string,
  cqId: string,
  brief: string,
  alsoMark = false
) {
  const sig = sigOf(schemeKey, cqId);
  const text = (brief || '').trim();
  if (!text) return;

  try {
    setPostingKey(sig);
    const res = await fetch('/api/dialogue/move', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deliberationId,
        targetType: 'claim',
        targetId,
        kind: 'GROUNDS',
        payload: {
          schemeKey,           // optional, good for analytics/labels
          cqId,                // ✅ the key the server pairs with WHY
          locusPath: locus,    // ensure `const [locus,setLocus] = useState('0')`
          expression: text,    // ✅ grounds go here
          original: text       // optional copy for UI
        },
        autoCompile: true,
        autoStep: true,
      }),
    });
    if (!res.ok) throw new Error(await res.text());

    // optional: mark satisfied after a successful GROUNDS
    if (alsoMark) {
      await fetch('/api/cqs/toggle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetId,
          schemeKey,
          cqKey: cqId,         // the toggle API uses cqKey
          satisfied: true,
          deliberationId,
          attachSuggestion: false,
        }),
      });
    }

    window.dispatchEvent(new CustomEvent('dialogue:moves:refresh'));
    flashOk(sig);
  } finally {
    setPostingKey(null);
    setGroundsDraft((g) => ({ ...g, [sig]: '' }));
    await revalidateAll(schemeKey);
  }
}

  // Attach suggestion (existing selectedAttackerClaimId, or quick-create)
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

  // quick-create a counter and attach
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

  // ----- rendering -----
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
      <div className="space-y-3">
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
                      {/* left: text + checkbox */}

                      <label className="flex-1 flex items-start gap-2 cursor-pointer">
                        <Checkbox
                          className="flex mt-1"
                          checked={cq.satisfied}
                          onCheckedChange={(val) =>
                            toggleCQ(s.key, cq.key, Boolean(val))
                          }
                          disabled={
                            !canMarkAddressed(
                              sigOf(s.key, cq.key),
                              cq.satisfied
                            ) || postingKey === sigOf(s.key, cq.key)
                          }
                        />
                        <span
                          className={`${
                            cq.satisfied ? "opacity-70 line-through" : ""
                          }`}
                        >
                          {cq.text}
                        </span>
                        {okKey === sigOf(s.key, cq.key) && (
                          <span className="text-[10px] text-emerald-700 ml-1">
                            ✓
                          </span>
                        )}
                        {!cq.satisfied &&
                          !canMarkAddressed(
                            sigOf(s.key, cq.key),
                            cq.satisfied
                          ) && (
                            <span className="text-[10px] text-neutral-500 ml-2">
                              (add)
                            </span>
                          )}
                      </label>

                      {/* actions */}
                      <div className="flex flex-col items-end gap-1">
                        {/* locus control
                        <div className="flex items-center gap-2">
                          <label className="text-[11px]">Locus</label>
                          <input
                            className="text-[11px] border rounded px-1 py-0.5 w-20"
                            value={locus}
                            onChange={(e) => setLocus(e.target.value)}
                          />
                        </div> */}

                        {/* locus + owner strip */}
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
  onClick={async () => {
    await fetch('/api/dialogue/move', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deliberationId,
        targetType,
        targetId,
        kind: 'WHY',
        payload: { locusPath: locus, schemeKey: s.key, cqId: cq.key }, // ✅
      }),
    });
    window.dispatchEvent(new CustomEvent('dialogue:moves:refresh'));
  }}
>
  Ask WHY
</button>
                          <button
                            className="text-[11px] px-2 py-0.5 border rounded"
                            onClick={() => {
                              setPendingGroundsContext({ schemeKey: s.key, cqKey: cq.key });
                              setGroundsBrief("");
                              setGroundsModalOpen(true);
                            }}
                          >
                            Supply GROUNDS
                          </button>
                          <button
                            className="text-[11px] px-2 py-0.5 border rounded"
                            onClick={() => toggleCQ(s.key, cq.key, true)}
                          >
                            Mark satisfied
                          </button>
                          <button
                            className="text-[11px] px-2 py-0.5 border rounded"
                            onClick={() => toggleCQ(s.key, cq.key, false)}
                          >
                            Mark unsatisfied
                          </button>
                        </div>

                        {blockedMsg[`${s.key}:${cq.key}`] && (
                          <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
                            {blockedMsg[`${s.key}:${cq.key}`]}
                          </div>
                        )}
                      </div>
                      <button
                        className="text-[11px] border rounded px-2 py-0.5"
                        onClick={async () => {
                          await fetch("/api/dialogue/move", {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({
                              deliberationId,
                              targetType,
                              targetId,
                              kind: "WHY",
        payload: { locusPath: locus, schemeKey: s.key, cqId: cq.key }, // ✅
                            }),
                          });
                          window.dispatchEvent(
                            new CustomEvent("dialogue:moves:refresh")
                          );
                        }}
                      >
                        Ask WHY on this CQ
                      </button>
                      <button
                        className="text-[11px] px-2 py-0.5 border rounded"
                        onClick={() => panelConfirmClaim(targetId)}
                        title="Record a receipt confirming current CQ/AF state"
                      >
                        Confirm (panel)
                      </button>

                      {/* right: attach suggestion */}
                      {!satisfied && rowSug && (
                        <button
                          className="text-[11px] px-2 py-0 border rounded-md lockbutton"
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

                    {/* inline grounds */}
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
                        {/* (optional) just post grounds without marking satisfied */}
       <Button
  variant="ghost"
  size="sm"
  className="h-8 text-[12px]"
  onClick={() => setGroundsDraft((g) => ({ ...g, [sig]: '' }))} // just clear
>
  Clear
</Button>
                      </div>
                    )}

                    {/* suggestion quick templates */}
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

                    {/* attach existing (tiny inline) */}
                    {!satisfied && (
                      <div className="pl-6 mt-1">
                        <button
                          className="text-[11px] underline"
                          onClick={() =>
                            setAttachExistingFor({
                              schemeKey: s.key,
                              cqKey: cq.key,
                            })
                          }
                        >
                          Attach existing counter…
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
              placeholder="e.g., The cited expert’s field is unrelated to the claim under discussion."
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

      {/* Attach existing (paste / search) */}
      <Dialog
        open={!!attachExistingFor}
        onOpenChange={(o) => !o && setAttachExistingFor(null)}
      >
        <DialogContent className="bg-slate-200 rounded-xl sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Attach existing counter-claim</DialogTitle>
            <DialogDescription>
              Paste a claim ID, or search if available.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search text or paste a claim ID…"
              />
              <Button
                variant="outline"
                onClick={onSearch}
                disabled={searchBusy}
              >
                {searchBusy ? "Searching…" : "Search"}
              </Button>
            </div>
            {!!searchRes.length && (
              <div className="max-h-48 overflow-y-auto border rounded bg-white">
                {searchRes.map((r) => (
                  <div
                    key={r.id}
                    className="px-2 py-1 text-sm border-b last:border-0 flex items-center justify-between"
                  >
                    <span className="truncate mr-2">{r.text}</span>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!attachExistingFor) return;
                        attachWithAttacker(
                          attachExistingFor.schemeKey,
                          attachExistingFor.cqKey,
                          r.id
                        );
                        setAttachExistingFor(null);
                      }}
                    >
                      Attach
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {/* Paste-only fallback */}
            <div className="text-[11px] text-neutral-600">
              Or paste a claim ID below and press Attach:
            </div>
            <div className="flex gap-2">
              <Input id="attach-paste" placeholder="claim_…" />
              <Button
                onClick={() => {
                  const el = document.getElementById(
                    "attach-paste"
                  ) as HTMLInputElement | null;
                  const id = el?.value.trim();
                  if (!id || !attachExistingFor) return;
                  attachWithAttacker(
                    attachExistingFor.schemeKey,
                    attachExistingFor.cqKey,
                    id
                  );
                  setAttachExistingFor(null);
                }}
              >
                Attach
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAttachExistingFor(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GROUNDS Brief Entry Modal */}
      <Dialog open={groundsModalOpen} onOpenChange={setGroundsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Supply GROUNDS</DialogTitle>
            <DialogDescription>
              Provide a brief statement of the grounds (evidence/reason) that answers this critical question.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="grounds-brief" className="text-sm font-medium">
                Brief description
              </label>
              <Input
                id="grounds-brief"
                placeholder="e.g., According to the 2023 study by Smith et al..."
                value={groundsBrief}
                onChange={(e) => setGroundsBrief(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey && groundsBrief.trim()) {
                    handleGroundsSubmit();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Press <kbd className="px-1 py-0.5 text-xs border rounded">⌘</kbd>+
                <kbd className="px-1 py-0.5 text-xs border rounded">Enter</kbd> to submit
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGroundsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGroundsSubmit}
              disabled={!groundsBrief.trim()}
            >
              Submit GROUNDS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
