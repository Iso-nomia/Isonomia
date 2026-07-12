// components/chat/QuickPollModal.tsx
"use client";
import * as React from "react";

export default function QuickPollModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (args: { question: string; options: string[] }) => Promise<void> | void;
}) {
  const [question, setQuestion] = React.useState("");
  const [opts, setOpts] = React.useState<string[]>(["", ""]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setQuestion("");
      setOpts(["", ""]);
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  const canAdd = opts.length < 10;
  const cleanOpts = opts.map((o) => o.trim()).filter(Boolean);
  const canCreate = question.trim().length > 0 && cleanOpts.length >= 2;

  const update = (i: number, v: string) => {
    const next = [...opts];
    next[i] = v;
    setOpts(next);
  };
  const add = () => canAdd && setOpts((x) => [...x, ""]);
  const remove = (i: number) => {
    const next = [...opts];
    next.splice(i, 1);
    setOpts(next.length ? next : ["", ""]);
  };

  const submit = async () => {
    if (!canCreate || busy) return;
    setBusy(true);
    try {
      await onSubmit({ question: question.trim(), options: cleanOpts.slice(0, 10) });
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
          <div className="text-sm font-medium mb-2">📊 Create poll</div>

          <label className="text-[12px] text-slate-600">Question</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2 text-sm bg-white/95 outline-none"
            placeholder="What do you think we should ship first?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />

          <div className="mt-3">
            <div className="flex items-center justify-between">
              <label className="text-[12px] text-slate-600">Options (2–10)</label>
              <button
                onClick={add}
                disabled={!canAdd}
                className="text-[12px] rounded px-2 py-1 border bg-white/80 hover:bg-white disabled:opacity-50"
              >
                + Add option
              </button>
            </div>
            <div className="mt-2 space-y-2 max-h-64 overflow-auto pr-1">
              {opts.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded border px-3 py-2 text-sm bg-white/95 outline-none"
                    placeholder={`Option ${i + 1}`}
                    value={v}
                    onChange={(e) => update(i, e.target.value)}
                  />
                  {opts.length > 2 && (
                    <button
                      onClick={() => remove(i)}
                      className="rounded px-2 py-1 text-xs border bg-white/80 hover:bg-white"
                      title="Remove"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button onClick={onClose} className="rounded px-3 py-1 text-sm border bg-white/80 hover:bg-white">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!canCreate || busy}
              className="rounded px-3 py-1 text-sm border bg-indigo-600/10 hover:bg-indigo-600/20 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create poll"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
