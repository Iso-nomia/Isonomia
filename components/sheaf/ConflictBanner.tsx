'use client';
import * as React from 'react';

export function ConflictBanner({
  conflicts,
  onJumpToFacetIndex,
}: {
  conflicts: Array<{ aFacetId: string; bFacetId: string; severity: 'WARN'|'HIGH'|'INFO'; note: string }> | undefined;
  onJumpToFacetIndex: (idx: number) => void;
}) {
  if (!conflicts || conflicts.length === 0) return null;
  const issues = conflicts.filter(c => c.severity !== 'INFO');
  if (issues.length === 0) return null;

  return (
    <div className="rounded-lg border px-3 py-2 bg-amber-50 text-amber-900 text-xs">
      <div className="font-medium mb-1">Potential facet conflicts</div>
      <ul className="space-y-1">
        {issues.map((c, i) => {
          // IDs are "draft_f_<index>" from the preview builder
          const ai = Number(c.aFacetId.replace('draft_f_', ''));
          const bi = Number(c.bFacetId.replace('draft_f_', ''));
          return (
            <li key={i} className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded ${c.severity === 'HIGH' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                {c.severity}
              </span>
              <span className="truncate">{c.note}</span>
              <button className="ml-auto underline" onClick={() => onJumpToFacetIndex(ai)}>Go to A</button>
              <button className="underline" onClick={() => onJumpToFacetIndex(bi)}>Go to B</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
