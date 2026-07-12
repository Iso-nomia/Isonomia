// components/work/WorksRail.tsx
'use client';
import * as React from 'react';

type Work = { id:string; title:string; theoryType:'DN'|'IH'|'TC'|'OP' };

export default function WorksRail({ deliberationId }:{ deliberationId?: string }) {
  const [works, setWorks] = React.useState<Work[]>([]);

  React.useEffect(() => {
    if (!deliberationId) return; // ✅ guard undefined
    (async () => {
      const res = await fetch(`/api/works?deliberationId=${encodeURIComponent(deliberationId)}`, { cache: 'no-store' });
      const json = await res.json();
      setWorks(json.works ?? []);
    })();
  }, [deliberationId]);

  if (!deliberationId || !works.length) return null;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {works.map(w => (
        <a key={w.id} href={`/works/${w.id}`} className="px-2 py-1 rounded border text-xs bg-white hover:bg-neutral-50">
          <span className="mr-1 inline-block px-1 rounded bg-neutral-100">{w.theoryType}</span>
          <span className="font-medium">{w.title}</span>
        </a>
      ))}
    </div>
  );
}
