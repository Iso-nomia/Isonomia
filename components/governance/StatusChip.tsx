export default function StatusChip({ status }:{ status: string }) {
    const map: Record<string, string> = {
      OK: 'bg-green-50 text-slate-700 border-green-200',
      NEEDS_SOURCES: 'bg-amber-50 text-amber-700 border-amber-200',
      WORKSHOP: 'bg-blue-50 text-blue-700 border-blue-200',
      DISPUTED: 'bg-rose-50 text-rose-700 border-rose-200',
      OFF_TOPIC_REDIRECT: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
      DUPLICATE_MERGE: 'bg-teal-50 text-teal-700 border-teal-200',
      OUT_OF_BOUNDS: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    };
    const cls = map[status] ?? map.OK;
    return <span className={`inline-block text-[11px]  px-1.5 py-1 rounded border ${cls}`}>{status}</span>;
  }
  