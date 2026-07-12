// hooks/useTheoryWorkChecklist.ts  (new or replace)
'use client';
import * as React from 'react';

type IntegrityRes = {
  ok: true;
  type: 'DN'|'IH'|'TC'|'OP';
  completion: number;
  checklist: { key:string; label:string; ok:boolean }[];
  has: any;
  structureOk: boolean;
  adequacyOk: boolean;
  valid: boolean;
};

export function useTheoryWorkChecklist(workId: string) {
  const [data, setData] = React.useState<any>(null);
  const [isLoading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const [wRes, integRes] = await Promise.all([
          fetch(`/api/works/${workId}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/works/${workId}/integrity`, { cache: 'no-store' }).then(r => r.json()),
        ]);
        if (!cancelled) {
          const integ = integRes as IntegrityRes;
          const open = (integ?.checklist ?? []).filter(i => !i.ok).map(i => i.label);
          setData({
            work: { ...(wRes?.work ?? {}), integrityValid: integ?.valid },
            integrity: integ,
            claims: { count: undefined, cq: { completeness: 0 } }, // decoupled default
            dialogue: {}, // decoupled default
          });
          setLoading(false);
        }
      } catch (e:any) {
        if (!cancelled) { setError(e?.message || 'Failed'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [workId]);

  const structureProgress = data?.integrity?.completion ?? 0;
  const activeOpen = (data?.integrity?.checklist ?? []).filter((i:any) => !i.ok).map((i:any) => i.label);
  const cqProgress = data?.claims?.cq?.completeness ?? 0;

  return { data, isLoading, error, structureProgress, activeOpen, cqProgress };
}
