// components/forum/ForumTab.tsx
"use client";
import { useBusEffect } from "@/components/hooks/useBusEffect";
import useSWR from "swr";
import { useEffect } from "react";

const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

export default function ForumTab({ deliberationId }: { deliberationId: string }) {
  const { data, mutate, isLoading } = useSWR<{ roots: any[] }>(`/api/dialogue/forum?deliberationId=${deliberationId}`, fetcher);

  useBusEffect(
    ["dialogue:changed", "comments:changed", "votes:changed", "decision:changed"],
    (detail) => {
      // if the event carried a deliberationId, ignore others
      if (detail?.deliberationId && detail.deliberationId !== deliberationId) return;
      mutate();
    },
    150 // throttle
  );
  // Hot-refresh on bus topics your shell dispatches
  useEffect(() => {
    const bump = () => mutate();
    const topics = ["dialogue:changed", "comments:changed", "votes:changed", "decision:changed", "citations:changed"];
    topics.forEach((t) => window.addEventListener(t, bump as any));
    return () => topics.forEach((t) => window.removeEventListener(t, bump as any));
  }, [mutate]);

  return (
    <div className="space-y-4">
      <ReplyBox deliberationId={deliberationId} />
      {isLoading ? <div className="text-sm text-slate-500">Loading…</div> : (
        <div className="space-y-4">
          {(data?.roots ?? []).map((r) => <Post key={r.id} node={r} deliberationId={deliberationId} />)}
        </div>
      )}
    </div>
  );
}

function Post({ node, deliberationId }: { node: any; deliberationId: string }) {
  return (
    <div className="border rounded p-3 bg-white">
      <div className="text-sm whitespace-pre-wrap">{node.text || <em>(no text)</em>}</div>
      <div className="mt-2">
        <ReplyBox deliberationId={deliberationId} locusId={node.locusId ?? node.id} parentKind={node.kind} />
      </div>
      {node.replies?.length > 0 && (
        <div className="mt-3 ml-4 border-l pl-3 space-y-3">
          {node.replies.map((ch: any) => <Post key={ch.id} node={ch} deliberationId={deliberationId} />)}
        </div>
      )}
    </div>
  );
}

function ReplyBox({ deliberationId, locusId, parentKind }: { deliberationId: string; locusId?: string; parentKind?: string }) {
  async function submit(e: any) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = String(form.get("text") || "").trim();
    const kind = String(form.get("kind") || "WHY");
    if (!text) return;
    await fetch("/api/dialogue/move", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deliberationId, kind, text, locusId }) });
    (e.currentTarget as HTMLFormElement).reset();
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <select name="kind" className="text-xs border rounded px-1 py-0.5">
        <option value="WHY">Reply (WHY)</option>
        <option value="GROUNDS">Add GROUNDS</option>
        <option value="ASSERT">{parentKind ? "New Thread (ASSERT)" : "ASSERT"}</option>
      </select>
      <input name="text" className="flex-1 border rounded px-2 py-1 text-sm" placeholder="Write a reply…" />
      <button className="text-xs px-2 py-1 rounded bg-emerald-600 text-white">Post</button>
    </form>
  );
}
