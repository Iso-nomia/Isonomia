import * as React from 'react';
import { legalAttacksFor } from '@/lib/dialogue/legalAttackCuesFor';

export function SuggestedAttacks(
  { text, onInsert }: { text: string; onInsert: (tmpl: string) => void }
) {
  const { shape, options } = React.useMemo(() => legalAttacksFor(text), [text]);

  if (!options?.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
      {options.map((o) => (
        <button
          key={o.key}
          className="px-2 py-0.5 border rounded bg-white hover:bg-slate-50"
          title={`Shape: ${shape}`}
          onClick={() => onInsert(o.template)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
