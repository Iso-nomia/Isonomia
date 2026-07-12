// components/rhetoric/MixBadge.tsx
'use client';

import * as React from 'react';
import type { Mix } from '@/lib/rhetoric/mlMini';

export function MixBadge({ mix, className }: { mix: Mix; className?: string }) {
  const toPct = (x: number) => Math.round(x * 100);
  const e = toPct(mix.ethos);
  const l = toPct(mix.logos);
  const p = toPct(mix.pathos);

  return (
    <div className={className ?? ''} title={`Ethos ${e}% • Logos ${l}% • Pathos ${p}%`}>
      <div className="flex  p-3 items-center mx-auto gap-1 h-4 w-28" aria-label="Ethos Logos Pathos mix">
        <div className="flex-1 bg-sky-200 dark:bg-sky-900" style={{ height: `${Math.max(2, e / 2)}px` }} />
        <div className="flex-1 bg-green-200 dark:bg-green-900" style={{ height: `${Math.max(2, l / 2)}px` }} />
        <div className="flex-1 bg-rose-200 dark:bg-rose-900" style={{ height: `${Math.max(2, p / 2)}px` }} />
      </div>
      <div className="flex justify-between text-[10px] text-neutral-600 mt-0.5">
        <span>E {e}%</span><span>L {l}%</span><span>P {p}%</span>
      </div>
    </div>
  );
}
