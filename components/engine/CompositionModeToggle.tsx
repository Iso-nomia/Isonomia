// components/ludics/engine/CompositionModeToggle.tsx
'use client';
import * as React from 'react';
import { MODE_LABEL, MODE_DESC, type Mode } from 'packages/ludics-react/modeLabels';

const ORDER: Mode[] = ['assoc', 'partial', 'spiritual'];

export function CompositionModeToggle({
  value,
  onChange,
  labelMap,
  descMap,
}: {
  value: Mode;
  onChange: (m: Mode) => void;
  labelMap?: Partial<Record<Mode, string>>;
  descMap?: Partial<Record<Mode, string>>;
}) {
  // Merge but keep only the canonical keys, in a fixed order
  const labels = {
    assoc: labelMap?.assoc ?? MODE_LABEL.assoc,
    partial: labelMap?.partial ?? MODE_LABEL.partial,
    spiritual: labelMap?.spiritual ?? MODE_LABEL.spiritual,
  } as Record<Mode, string>;

  const descs = {
    assoc: descMap?.assoc ?? MODE_DESC.assoc,
    partial: descMap?.partial ?? MODE_DESC.partial,
    spiritual: descMap?.spiritual ?? MODE_DESC.spiritual,
  } as Record<Mode, string>;

  return (
    <div className="inline-flex gap-1">
      {ORDER.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          title={descs[m]}
          aria-pressed={value === m}
          className={`px-2 py-1 text-xs rounded border ${
            value === m ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'
          }`}
        >
          {labels[m]}
        </button>
      ))}
    </div>
  );
}
