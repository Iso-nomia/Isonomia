// app/(kb)/kb/new/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewKbPage() {
  const router = useRouter();
  const ran = useRef(false);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    if (ran.current) return; ran.current = true;
    (async () => {
      try {
        const res = await fetch('/api/kb/pages', { method: 'POST' });
        if (res.status === 401) { router.replace('/login'); return; }
        if (!res.ok) throw new Error(await res.text());
        const { id } = (await res.json()) as { id: string };
        router.replace(`/kb/pages/${id}/edit`);
      } catch (e:any) {
        setError(e?.message || 'Failed to create KB page.');
      }
    })();
  }, [router]);

  return (
    <div className="fixed inset-0 grid place-items-center bg-gradient-to-b from-indigo-50 via-rose-50 to-slate-50">
      <div className="rounded-xl border bg-white/80 p-6 shadow">
        {error ? (
          <>
            <div className="text-rose-600 text-sm mb-2">✖ {error}</div>
            <div className="flex gap-2">
              <button onClick={()=>location.reload()} className="border rounded px-3 py-1 text-sm">Retry</button>
              <a href="/kb/pages" className="border rounded px-3 py-1 text-sm">Dashboard</a>
            </div>
          </>
        ) : (
          <div className="text-sm text-slate-700">Creating your page…</div>
        )}
      </div>
    </div>
  );
}
