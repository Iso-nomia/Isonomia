// components/discussion/DeliberateButton.tsx
"use client";
import * as React from "react";

type Props = {
  discussionId: string;
  conversationId?: string | null;  // if your Discussion has a chat thread
  seedClaimText?: string;          // optional
};

export default function DeliberateButton({
  discussionId,
  conversationId,
  seedClaimText,
}: Props) {
  const [busy, setBusy] = React.useState(false);

  async function go() {
    if (busy) return;
    setBusy(true);
    try {
      const hostType = conversationId ? "inbox_thread" : "discussion";
      const hostId = String(conversationId ?? discussionId);

      const r = await fetch("/api/deliberations/ensure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hostType, hostId }),
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

  return (
    <button className="btn" onClick={go} disabled={busy}>
      {busy ? "Opening…" : "Deliberate"}
    </button>
  );
}
