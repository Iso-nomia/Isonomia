// app/(kb)/kb/pages/[id]/edit/page.tsx
'use client';

import * as React from 'react';
import useSWR from 'swr';
import KbEditor from './ui/KbEditor';
import { Input } from '@/components/ui/input';

const fetcher = (u:string) => fetch(u, { cache:'no-store' }).then(r => r.json());

export default function EditPage({ params }: { params: { id: string } }) {
  const pageId = params.id;
  const { data: pageRes, mutate: refetchPage } =
    useSWR<{ ok: boolean; page: any }>(`/api/kb/pages/${pageId}`, fetcher);

  const page = pageRes?.page;
  const [title, setTitle] = React.useState('');

  React.useEffect(() => {
    if (page?.title) setTitle(page.title);
  }, [page?.title]);

  const saveTitle = useDebouncedCallback(async (value: string) => {
    await fetch(`/api/kb/pages/${pageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: value }),
    });
    refetchPage();
  }, 450);

  if (!pageRes) return <div className="p-4 text-sm text-slate-500">Loading…</div>;
  if (!page)     return <div className="p-4 text-sm text-rose-600">Not found</div>;

  return (
    <div className="py-8 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-4">
        <Input
          value={title}
          onChange={(e)=>{ const v = e.target.value; setTitle(v); saveTitle(v); }}
          placeholder="Title…"
          className="text-lg font-medium border-none rounded-lg tracking-wide px-4 py-1 articlesearchfield bg-white/80 w-full"
        />
        <a href={`/kb/pages/${pageId}/view`} target="_blank" className="flex text-xs rounded-full btnv2 px-4 bg-white/80 font-medium text-slate-900 "><span className="whitespace-nowrap flex">View Page</span></a>
      </div>

      {/* The whole editor lives here now */}
      <KbEditor pageId={pageId} spaceId={page.spaceId} />
    </div>
  );
}

function useDebouncedCallback(fn: (...a:any[])=>void, ms=400) {
  const t = React.useRef<any>();
  return React.useCallback((...args:any[]) => {
    clearTimeout(t.current);
    t.current = setTimeout(() => fn(...args), ms);
  }, [fn, ms]);
}
