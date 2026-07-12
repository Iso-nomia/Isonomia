"use client";
import * as React from "react";

export function TextBlock({
  block,
  canEdit,
  onUpdate,
}: {
  block: any;
  canEdit?: boolean;
  onUpdate?: () => void;
}) {
  const initialMd = (block?.dataJson?.md ?? block?.dataJson?.text ?? "").toString();
  const [md, setMd] = React.useState(initialMd);
  const [preview, setPreview] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);

  // Auto-save after 1 second of no typing
  React.useEffect(() => {
    if (!canEdit || md === initialMd) return;
    
    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        const res = await fetch(`/api/kb/blocks/${block.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataJson: { md, text: md }, // support both paths
          }),
        });
        if (res.ok) {
          setLastSaved(new Date());
          onUpdate?.();
        }
      } catch (e) {
        console.error("Failed to auto-save:", e);
      } finally {
        setSaving(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [md, block.id, canEdit, initialMd, onUpdate]);

  if (!canEdit) {
    // Read-only mode
    return (
      <div className="rounded-lg border bg-white/80 p-4 prose prose-sm max-w-none">
        {md.trim() ? (
          <pre className="whitespace-pre-wrap font-sans">{md}</pre>
        ) : (
          <div className="text-slate-500 text-sm">Empty text block</div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white/80 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-slate-600">
          {saving && <span className="text-amber-600">Saving...</span>}
          {!saving && lastSaved && (
            <span className="text-emerald-600">
              Saved {new Date().getTime() - lastSaved.getTime() < 5000 ? "just now" : "recently"}
            </span>
          )}
          {!saving && !lastSaved && md !== initialMd && (
            <span className="text-slate-400">Typing...</span>
          )}
        </div>
        <button
          onClick={() => setPreview(!preview)}
          className="text-[11px] px-2 py-1 rounded border hover:bg-slate-50"
        >
          {preview ? "Edit" : "Preview"}
        </button>
      </div>

      {preview ? (
        <div className="prose prose-sm max-w-none min-h-[8rem] p-3 rounded border bg-slate-50">
          {md.trim() ? (
            <pre className="whitespace-pre-wrap font-sans">{md}</pre>
          ) : (
            <div className="text-slate-400 text-sm">No content to preview</div>
          )}
        </div>
      ) : (
        <textarea
          value={md}
          onChange={(e) => setMd(e.target.value)}
          placeholder="Write here... (supports markdown)"
          className="w-full min-h-[8rem] p-3 rounded border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono resize-y"
          style={{ fontFamily: "ui-monospace, monospace" }}
        />
      )}
    </div>
  );
}
