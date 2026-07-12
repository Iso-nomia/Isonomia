// /discussions/new/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function NewDiscussionPage() {
  const router = useRouter();
  const q = useSearchParams();
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return; ran.current = true;

    (async () => {
      try {
        const payload = {
          title: q?.get('title') || 'Discussion',
          description: q?.get('description') || null,
          attachedToType: q?.get('attachedToType') || null,
          attachedToId: q?.get('attachedToId') || null,
          createConversation: (q?.get('createConversation') ?? '1') !== '0',
        };

        const res = await fetch('/api/discussions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.status === 401) { router.replace('/login'); return; }
        if (!res.ok) throw new Error(await res.text().catch(()=>'Failed to create discussion'));

        const { discussion } = await res.json();
        if (!discussion?.id) throw new Error('Malformed response');
        router.replace(`/discussions/${discussion.id}`);
      } catch (e: any) {
        setError(e?.message || 'Failed to create discussion.');
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
              <a href="/discussions" className="border rounded px-3 py-1 text-sm">Dashboard</a>
            </div>
          </>
        ) : (
          <div className="text-sm text-slate-700">Creating your discussion…</div>
        )}
      </div>
    </div>
  );
}
