// components/discussion/DeliberateButton.tsx
"use client";
import * as React from "react";

type Props = {
  discussionId: string;
  conversationId?: string | null;  // if your Discussion has a chat thread
  seedClaimText?: string;          // optional
  /**
   * Phase 4: when provided, clicking opens a small dialog prefilled with this
   * topic so the upgrader can name the deliberation before creating it.
   * Omit to keep the original one-click behavior.
   */
  defaultTitle?: string | null;
};

export default function DeliberateButton({
  discussionId,
  conversationId,
  seedClaimText,
  defaultTitle,
}: Props) {
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const promptForName = defaultTitle != null;

  React.useEffect(() => {
    if (open) {
      setName((defaultTitle ?? "").trim());
      // focus after paint
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open, defaultTitle]);

  async function create(title?: string | null) {
    if (busy) return;
    setBusy(true);
    try {
      const hostType = conversationId ? "inbox_thread" : "discussion";
      const hostId = conversationId ? String(conversationId) : discussionId;

      const trimmed = typeof title === "string" ? title.trim() : null;

      const r = await fetch("/api/deliberations/ensure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hostType,
          hostId,
          ...(trimmed ? { title: trimmed } : {}),
        }),
      });

      const j: any = await r.json().catch(() => ({}));
      if (!r.ok || !j?.id) {
        alert(j?.error || `Failed to open deliberation (HTTP ${r.status})`);
        return;
      }
      const deliberationId = j.id;

      // optional: seed a first claim
      if (seedClaimText) {
        await fetch("/api/dialogue/move", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deliberationId,
            targetType: "claim",
            kind: "ASSERT",
            payload: { text: seedClaimText },
          }),
        }).catch(() => {});
      }

      // optional: link back to the discussion (if you have this API)
      await fetch(`/api/discussions/${discussionId}/deliberations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deliberationId }),
      }).catch(() => {});

      location.href = `/deliberation/${deliberationId}`;
    } finally {
      setBusy(false);
    }
  }

  function onClick() {
    if (promptForName) setOpen(true);
    else void create();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void create(name);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <>
      <button
        className="btnv2 btnv2--sm text-xs px-3 py-1.5 "
        onClick={onClick}
        disabled={busy}
      >
        {busy ? "Opening…" : "Deliberate"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-[min(440px,92vw)] rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-slate-800">
              Name this deliberation
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              You can rename it later from the deliberation header.
            </p>
            <input
              ref={inputRef}
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={busy}
              placeholder="Name this deliberation"
              className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="btnv2 btnv2--sm text-xs px-3 py-1.5"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                className="btnv2 btnv2--sm text-xs px-3 py-1.5 bg-indigo-300/50"
                onClick={() => void create(name)}
                disabled={busy}
              >
                {busy ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
