// components/common/OpenInDiscussionsButton.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type Mode = "ensure" | "create";

type Props = {
  attachedToType: string;
  attachedToId: string;
  title?: string;
  description?: string | null;
  createConversation?: boolean;
  mode?: Mode;                 // default "ensure"
  onCreated?: (id: string) => void;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;

  /** if true, when multiple discussions exist show a chooser; else open latest */
  selectExisting?: boolean;
};
export default function OpenInDiscussionsButton({
  attachedToType,
  attachedToId,
  title = "Discussion",
  description = null,
  createConversation = true,
  mode = "ensure",
  onCreated,
  className = "btnv2 btnv2--sm text-xs px-3 py-1.5 ml-2",
  children = "Open in discussions",
  disabled,
  selectExisting = false,
}: Props) {
  const [busy, setBusy] = React.useState(false);
  const [choices, setChoices] = React.useState<{ id: string; title?: string | null }[] | null>(null);
  const router = useRouter();

  async function go() {
    if (busy || disabled) return;
    setBusy(true);
    try {
      if (mode === "create") {
        // always create a new one
        const r = await fetch("/api/discussions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title, description, attachedToType, attachedToId, createConversation }),
        });
        const j: any = await r.json().catch(() => ({}));
        if (r.ok && j?.discussion?.id) {
          onCreated?.(j.discussion.id);
          router.push(`/discussions/${j.discussion.id}`);
          return;
        }
        alert(j?.error || `Failed (HTTP ${r.status})`);
        return;
      }

      // mode === "ensure"
      if (selectExisting) {
        // Look up all discussions for this object; if 0 → create; if 1 → open; if >1 → chooser
        const listRes = await fetch(`/api/discussions/list?type=${encodeURIComponent(attachedToType)}&id=${encodeURIComponent(attachedToId)}`, { cache: "no-store" });
        if (listRes.ok) {
          const lj: any = await listRes.json().catch(() => ({}));
          const items: any[] = Array.isArray(lj?.items) ? lj.items : [];
          if (items.length === 1) {
            router.push(`/discussions/${items[0].id}`);
            return;
          }
          if (items.length > 1) {
            setChoices(items);
            return;
          }
        }
      }

      // fallback → ensure endpoint (open latest or create)
      const r = await fetch("/api/discussions/ensure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description, attachedToType, attachedToId, createConversation, forceNew: false }),
      });
      const j: any = await r.json().catch(() => ({}));
      if (r.ok && j?.discussion?.id) {
        onCreated?.(j.discussion.id);
        router.push(`/discussions/${j.discussion.id}`);
      } else {
        alert(j?.error || `Failed (HTTP ${r.status})`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={go} className={className} disabled={busy || disabled} title="Create / open a discussion">
        {busy ? "Opening…" : children}
      </button>

      {/* simple chooser modal (only appears when selectExisting=true and multiple exist) */}
      {choices && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30">
          <div className="w-[360px] rounded border bg-white p-3 shadow-xl">
            <div className="text-sm font-medium mb-2">Choose a discussion</div>
            <ul className="space-y-1 max-h-60 overflow-auto">
              {choices.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <div className="text-sm truncate">{c.title || `Discussion ${c.id.slice(0,6)}…`}</div>
                  <button
                    className="text-xs px-2 py-0.5 rounded border bg-white hover:bg-slate-50"
                    onClick={() => router.push(`/discussions/${c.id}`)}
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between">
              <button
                className="text-xs underline"
                onClick={() => {
                  setChoices(null);
                }}
              >
                Cancel
              </button>
              <button
                className="text-xs px-2 py-0.5 rounded border bg-white hover:bg-slate-50"
                onClick={async () => {
                  setChoices(null);
                  // force a fresh one
                  setBusy(true);
                  try {
                    const r = await fetch("/api/discussions/ensure", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ title, description, attachedToType, attachedToId, createConversation, forceNew: true }),
                    });
                    const j: any = await r.json().catch(() => ({}));
                    if (r.ok && j?.discussion?.id) {
                      onCreated?.(j.discussion.id);
                      router.push(`/discussions/${j.discussion.id}`);
                    } else {
                      alert(j?.error || `Failed (HTTP ${r.status})`);
                    }
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Start new
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
