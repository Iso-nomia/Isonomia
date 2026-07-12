// components/dialogue/InlineEvidencePicker.tsx
//
// Phase 3d (dialogue-UI polish) — minimal local evidence-ref collector
// for embedding inside the WHY / GROUNDS composer flow. Emits
// `string[]` (URLs / DOIs) up to its parent, which forwards them as
// `payload.evidenceRefs` on the dialogue/move POST.
//
// Intentionally minimal: a URL/DOI input + add + remove. A unified
// EvidencePicker (merging `AttachEvidenceQuick` and
// `AttachEvidenceUnpromoted` from ToulminBox) is out of scope and
// flagged in spec §11.

"use client";

import { useState } from "react";

export interface InlineEvidencePickerProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** When true, the picker shows the "required" tint and helper line. */
  required?: boolean;
  /** Optional helper copy shown below the input (e.g. burden guidance). */
  helperText?: string | null;
  /** Optional max items; defaults to 10. */
  maxItems?: number;
}

function isLikelyRef(s: string): boolean {
  const v = s.trim();
  if (!v) return false;
  // Accept URLs and DOI-ish strings; the server normalises further.
  if (/^https?:\/\//i.test(v)) return true;
  if (/^doi:/i.test(v)) return true;
  if (/^10\.\d{4,}\//.test(v)) return true; // bare DOI
  return false;
}

export function InlineEvidencePicker({
  value,
  onChange,
  required = false,
  helperText,
  maxItems = 10,
}: InlineEvidencePickerProps) {
  const [draft, setDraft] = useState("");
  const atCap = value.length >= maxItems;
  const canAdd = !atCap && isLikelyRef(draft) && !value.includes(draft.trim());

  function add() {
    if (!canAdd) return;
    onChange([...value, draft.trim()]);
    setDraft("");
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div
      className={
        "rounded border p-2 space-y-2 " +
        (required && value.length === 0
          ? "border-amber-300 bg-amber-50/30"
          : "border-slate-200 bg-white")
      }
      data-testid="inline-evidence-picker"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-700">
          Evidence{required ? " (required)" : ""}
        </span>
        <span className="text-[10px] text-slate-500">
          {value.length}/{maxItems}
        </span>
      </div>

      {helperText ? (
        <div className="text-[11px] text-slate-500">{helperText}</div>
      ) : null}

      {value.length > 0 ? (
        <ul className="space-y-1">
          {value.map((ref, i) => (
            <li
              key={`${ref}-${i}`}
              className="flex items-center justify-between gap-2 rounded bg-slate-50 px-2 py-1 text-[11px]"
            >
              <span className="font-mono truncate" title={ref}>
                {ref}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-[10px] text-slate-500 hover:text-rose-600"
                aria-label={`Remove ${ref}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          type="text"
          className="flex-1 border rounded px-2 py-1 text-[12px]"
          placeholder="DOI or URL…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          disabled={atCap}
        />
        <button
          type="button"
          onClick={add}
          disabled={!canAdd}
          className="px-2 py-1 border rounded text-[11px] disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
