// components/citations/SourcesSidebar.tsx
"use client";
import useSWR from "swr";

const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

export default function SourcesSidebar({
  targetType,
  targetIds,
}: {
  targetType: "claim" | "card" | "argument";
  targetIds: string[];
}) {
  const idsCsv = [...new Set(targetIds)].join(",");
  const { data } = useSWR(
    targetIds.length ? `/api/citations/batch?targetType=${targetType}&targetIds=${encodeURIComponent(idsCsv)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (!targetIds.length) return null;
  const items = data?.items || {};
  const flat = Object.values(items).flat() as any[];

  if (!flat.length) return null;

  return (
    <div className="rounded-md border bg-white/70 p-2">
      <div className="text-xs font-medium mb-1">Sources</div>
      <div className="space-y-1">
        {flat.slice(0, 12).map((c) => (
          <div key={c.id} className="text-[11px]">
            <a className="underline" href={c.source.url ?? "#"} target="_blank" rel="noreferrer">
              {c.source.title || c.source.url?.replace(/^https?:\/\//, "")}
            </a>
            {c.locator && <span className="ml-1 text-slate-600">· {c.locator}</span>}
          </div>
        ))}
      </div>
      {/* Optional: "Copy as MLA" button calls /api/citations/format?style=mla&ids=… */}
    </div>
  );
}
