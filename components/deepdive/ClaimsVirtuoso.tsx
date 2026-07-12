'use client';
import useSWRInfinite from 'swr/infinite';
import { Virtuoso } from 'react-virtuoso';

const PAGE = 50;
const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

type ClaimFilters = {
  authorId?: string;
  since?: string; // ISO
  until?: string; // ISO
  sort?: 'createdAt:desc' | 'createdAt:asc';
};

function qs(base: string, params: Record<string, string | number | undefined>) {
  const url = new URL(base, 'http://x');
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') url.searchParams.set(k, String(v)); });
  return url.pathname + url.search + url.hash;
}

export default function ClaimsVirtuoso({
  deliberationId,
  filters = {},
}: {
  deliberationId: string;
  filters?: ClaimFilters;
}) {
  const { authorId, since, until, sort = 'createdAt:desc' } = filters;

  const getKey = (index: number, prev: any) => {
    if (prev && !prev.nextCursor) return null;
    const cursor = index === 0 ? undefined : prev.nextCursor;
    return qs(`/api/deliberations/${deliberationId}/claims`, {
      authorId,
      since,
      until,
      sort,
      limit: PAGE,
      cursor,
    });
  };

  const { data, size, setSize, isValidating, error, mutate } = useSWRInfinite(getKey, fetcher, {
    revalidateFirstPage: false,
    keepPreviousData: true,
  });

  const items = (data ?? []).flatMap((d) => d.items ?? []);
  const nextCursor = data?.[data.length - 1]?.nextCursor ?? null;

  if (error) return <div className="text-xs text-rose-600">Failed to load claims. <button className="underline" onClick={() => mutate()}>Retry</button></div>;
  if (!data && isValidating) return <div className="text-xs text-neutral-500">Loading claims…</div>;
  if (!items.length) return <div className="text-xs text-neutral-500">No claims.</div>;

  return (
    <Virtuoso
      style={{ height: 520 }}
      data={items}
      endReached={() => !isValidating && nextCursor && setSize((s) => s + 1)}
      itemContent={(i, c: any) => (
        <div className="border rounded p-3 space-y-1 mb-2">
          <div className="text-xs text-neutral-500">
            {new Date(c.createdAt).toLocaleString()} · by {c.createdById}
          </div>
          <div className="text-sm whitespace-pre-wrap line-clamp-3">{c.text}</div>
        </div>
      )}
      components={{
        Footer: () => (
          <div className="py-3 text-center text-xs text-neutral-500">
            {isValidating ? 'Loading…' : nextCursor ? 'Scroll to load more' : 'End'}
          </div>
        ),
      }}
    />
  );
}
