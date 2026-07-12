// components/dialogue/useLudicsPhase.ts
'use client';
import * as React from 'react';

export function useLudicsPhase(defaultPhase: 'neutral'|'focus-P'|'focus-O' = 'neutral') {
  const [phase, setPhase] = React.useState<'neutral'|'focus-P'|'focus-O'>(defaultPhase);

  React.useEffect(() => {
    const h = (e: any) => setPhase(e?.detail?.phase ?? 'neutral');
    window.addEventListener('ludics:phase', h as any);
    return () => window.removeEventListener('ludics:phase', h as any);
  }, []);

  return phase;
}
