"use client";
import useSWR from "swr";

export default function EmbedBlock({ id }: { id: string }) {
  const { data, error } = useSWR(`/api/blocks/${id}`, (u) => fetch(u).then(r => r.json()));
  if (error) return <div className="text-xs text-red-600">Failed to load block.</div>;
  if (!data) return <div className="text-xs text-slate-400">Loading…</div>;

  return (
    <div data-block-id={id} className="text-xs text-slate-500">
      Block: {data.component}
    </div>
  );
}
