// app/agora/ui/StackSummaryCard.tsx
"use client";
import useSWR from 'swr';

const fetcher = (u: string) => fetch(u).then(r => r.json());

export function StackSummaryCard({ stackId }: { stackId: string }) {
  const { data, error } = useSWR<{ id:string; name:string; slug:string|null; is_public:boolean; subscriberCount:number }>(
    stackId ? `/api/stacks/${encodeURIComponent(stackId)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (error) return null;
  if (!data) return <div className="rounded border bg-white/70 p-2 text-xs">Loading…</div>;

  const href = data.slug ? `/stacks/${data.slug}` : `/stacks/${data.id}`;
  return (
    <div className="rounded-xl border bg-white/70 p-3 text-sm">
      <div className="font-semibold">{data.name}</div>
      <div className="text-[11px] text-slate-600 mt-1">
        Visibility: {data.is_public ? 'Public' : 'Private'} · Subscribers: {data.subscriberCount}
      </div>
      <a href={href} className="inline-block mt-2 text-xs px-2 py-1 rounded border bg-white hover:bg-slate-50">
        Open stack
      </a>
    </div>
  );
}
