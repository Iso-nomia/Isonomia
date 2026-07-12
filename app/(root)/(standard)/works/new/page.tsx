// app/works/new/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type TheoryType = 'DN' | 'IH' | 'TC' | 'OP';

export default function NewWorkPage() {
  const router = useRouter();
  const q = useSearchParams();
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const title         = q?.get('title') || 'Untitled Work';
        const deliberationId= q?.get('deliberationId') || null;
        const standardOutput= q?.get('standardOutput') || null;
        const tt = (q?.get('theoryType') || 'IH').toUpperCase();
        const theoryType: TheoryType = (['DN','IH','TC','OP'] as const).includes(tt as TheoryType)
          ? (tt as TheoryType)
          : 'IH';

        const res = await fetch('/api/works', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title, deliberationId, standardOutput, theoryType }),
        });

        if (res.status === 401) { router.replace('/login'); return; }
        if (!res.ok) throw new Error(await res.text().catch(()=>'Failed to create work'));

        const { work } = await res.json();
        if (!work?.id) throw new Error('Malformed response');
        router.replace(`/works/${work.id}`);
      } catch (e: any) {
        setError(e?.message || 'Failed to create theory work.');
      }
    })();
  }, [router, q]);

  return (
    <div className="fixed inset-0 grid place-items-center bg-gradient-to-b from-indigo-50 via-rose-50 to-slate-50">
      <div className="rounded-xl border bg-white/80 p-6 shadow">
        {error ? (
          <>
            <div className="text-rose-600 text-sm mb-2">✖ {error}</div>
            <div className="flex gap-2">
              <button onClick={() => location.reload()} className="border rounded px-3 py-1 text-sm">Retry</button>
              <a href="/works" className="border rounded px-3 py-1 text-sm">Works</a>
            </div>
          </>
        ) : (
          <div className="text-sm text-slate-700">Creating your work…</div>
        )}
      </div>
    </div>
  );
}
