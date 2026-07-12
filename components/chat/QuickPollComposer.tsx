// components/chat/QuickPollComposer.tsx
"use client";
import React from "react";

export default function QuickPollComposer({
  onSubmit,
  onCancel,
}: {
  onSubmit: (options: string[]) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [opts, setOpts] = React.useState<string[]>(["", ""]);
  const [submitting, setSubmitting] = React.useState(false);

  const canAdd = opts.length < 4;
  const sanitized = opts.map((o) => o.trim()).filter(Boolean);
  const canCreate = sanitized.length >= 2;

  const update = (i: number, v: string) => {
    const next = [...opts];
    next[i] = v;
    setOpts(next);
  };

  const add = () => {
    if (!canAdd) return;
    setOpts((o) => [...o, ""]);
  };

  const remove = (i: number) => {
    const next = [...opts];
    next.splice(i, 1);
    setOpts(next.length ? next : ["", ""]);
  };

  const submit = async () => {
    if (!canCreate || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(sanitized.slice(0, 4));
      onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-md border bg-white/70 px-3 py-3 max-w-[34rem] backdrop-blur">
      <div className="text-[12px] text-slate-700 mb-2">📊 Create a quick poll</div>

      <div className="space-y-1.5">
        {opts.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="flex-1 rounded border px-2 py-1 text-sm bg-white/90 outline-none"
              placeholder={`Option ${i + 1}`}
              value={v}
              onChange={(e) => update(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
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

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-slate-600">
          <label className="inline-flex items-center gap-1 opacity-60 cursor-not-allowed">
            <input type="checkbox" disabled /> Allow multiple <span className="opacity-70">(soon)</span>
          </label>
          <label className="inline-flex items-center gap-1 opacity-60 cursor-not-allowed">
            <input type="checkbox" disabled /> Anonymous <span className="opacity-70">(soon)</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="rounded px-3 py-1 text-xs border bg-white/80 hover:bg-white"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canCreate || submitting}
            className="rounded px-3 py-1 text-xs border bg-indigo-600/10 hover:bg-indigo-600/20 disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
