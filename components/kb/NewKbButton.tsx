'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';

export function NewKbButton() {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch('/api/kb/pages/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled' }),
      });
      
      if (!res.ok) throw new Error('Failed to create');
      
      const data = await res.json();
      router.push(`/kb/pages/${data.id}/edit`);
    } catch (err) {
      console.error('Create failed:', err);
      setCreating(false);
    }
  }
  
  return (
    <button
      onClick={() => router.push('/kb/new')}
      disabled={creating}
      className="btnv2 bg-white/50 flex items-center gap-2 text-[12px] px-3 py-3 rounded-xl"
    >
      {creating ? (
        <>
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Creating…
        </>
      ) : (
        <>
        
          ⊕ New Knowledge Base
        </>
      )}
    </button>
  );
}