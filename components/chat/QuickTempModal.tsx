// components/chat/QuickTempModal.tsx
"use client";
import * as React from "react";

export default function QuickTempModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (args: { question: string }) => Promise<void> | void;
}) {
  const [question, setQuestion] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setQuestion("");
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  const canCreate = question.trim().length > 0;

  const submit = async () => {
    if (!canCreate || busy) return;
    setBusy(true);
    try {
      await onSubmit({ question: question.trim() });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-xl border bg-white/80 backdrop-blur shadow-xl p-4">
          <div className="text-sm font-medium mb-2">🌡 Temperature check</div>
          <label className="text-[12px] text-slate-600">Prompt</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2 text-sm bg-white/95 outline-none"
            placeholder="How confident are we to ship on Friday?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <div className="mt-4 flex items-center justify-end gap-2">
            <button onClick={onClose} className="rounded px-3 py-1 text-sm border bg-white/80 hover:bg-white">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!canCreate || busy}
              className="rounded px-3 py-1 text-sm border bg-indigo-600/10 hover:bg-indigo-600/20 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create check"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
