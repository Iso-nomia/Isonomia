"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWRInfinite from "swr/infinite";
import { useFollowing } from "@/lib/client/useFollowing";


type Item = {
  id: string;
  hostType: string;      // 'article' | 'post' | 'room' ...
  hostId: string;
  createdAt: string;     // ISO
  title?: string | null; // optional, if you derive from host
  tags?: string[] | null;
};

type PageData = { items: Item[]; total?: number };
const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then(r => r.json());

export default function DelibsDashboard({ initialItems }: { initialItems: Item[] }) {
  const router = useRouter();
  const pageSize = 15;

  // filters
  const [q, setQ] = useState("");
  const [host, setHost] = useState<"ALL" | "article" | "post" | "room">("ALL");
  const [page, setPage] = useState(1);
  const { isFollowingRoom, followRoom, unfollowRoom } = useFollowing();


  const getKey = (index: number, prev: PageData | null) => {
    if (prev && (!prev.items || prev.items.length === 0)) return null;
    const params = new URLSearchParams({
      mine: "1",
      page: String(index + 1),
      pageSize: String(pageSize),
      q,
      host: host === "ALL" ? "" : host,
      sort: "createdAt:desc",
    });
    return `/api/profile/deliberations?${params.toString()}`;
  };

  const { data, size, setSize, isValidating, mutate } =
    useSWRInfinite<PageData>(getKey, fetcher, {
      revalidateFirstPage: true,
      persistSize: true,
      parallel: true,
      fallbackData: [{ items: initialItems }],
    });

  const current = data?.[page - 1]?.items ?? [];
  const total = data?.[0]?.total ?? null;
  const hasNext =
    (data && data[page - 1] && (data[page - 1]!.items?.length ?? 0) === pageSize) || (size < page);

  useEffect(() => { if (page > size) setSize(page); }, [page, size, setSize]);
  useEffect(() => { setPage(1); }, [q, host]);

  function open(d: Item)   { router.push(`/deliberation/${d.id}`); }
  function copyLink(d: Item) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    navigator.clipboard.writeText(`${origin}/deliberation/${d.id}`);
  }

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-6 mt-[-3rem]">
      <div className="flex items-center px-4 justify-between gap-3 ">
        <div className="text-[1.8rem] text-slate-800 font-semibold">Your Deliberations</div>
        <button
          onClick={() => router.push("/agora")}
          className="px-3 py-1.5 rounded-xl bg-amber-300 lockbutton text-black text-sm"
        >
          Open Agora
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center px-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title/host…"
          className="border-[1px] border-indigo-300/80 rounded-xl w-[40%] px-2 py-[5px] text-sm"
        />
        <select
          className="border-[1px] border-indigo-300/80 rounded px-2 py-1.5 rounded-xl text-sm"
          value={host}
          onChange={(e) => setHost(e.target.value as any)}
        >
          <option value="ALL">All hosts</option>
          <option value="article">Article</option>
          <option value="post">Post</option>
          <option value="room">Room</option>
        </select>
        <div className="ml-auto">{isValidating && <span className="text-sm text-neutral-500">Loading…</span>}</div>
      </div>

      <div className="overflow-x-auto rounded-xl px-1 border bg-white/30 backdrop-blur-lg">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="px-4 py-2">Title</th>
              <th className="px-2 py-2">Host</th>
              <th className="px-2 py-2">Created</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {current.map((i) => (
              <tr key={i.id} className="border-t-0 border-b-[1px] border-slate-300/60">
                <td className="px-4 py-3">
                  <div className="text-[1.0rem] leading-tight">{i.title || i.id}</div>
                  {!!i.tags?.length && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {i.tags!.map((t) => (
                        <span key={t} className="text-[11px] px-1.5 py-0.5 rounded border bg-white/80">{t}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-2 py-3 text-center">{i.hostType}</td>
                <td className="px-2 py-3 text-neutral-600">
                  {new Date(i.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2 justify-end px-2">
                    <button className="px-2 py-.5 bg-white/30 rounded-xl savebutton" onClick={() => open(i)}>
                      Open
                    </button>
                    <button className="px-2 py-.5 bg-white/30 rounded-xl savebutton" onClick={() => copyLink(i)}>
                      Copy link
                    </button>
                    {isFollowingRoom(i.id) ? (
  <button className="px-2 py-.5 bg-emerald-50 border-emerald-200 rounded-xl" onClick={() => unfollowRoom(i.id)}>Following ✓</button>
) : (
  <button className="px-2 py-.5 bg-white/30 rounded-xl" onClick={() => followRoom(i.id)}>Follow</button>
)}
                  </div>
                </td>
              </tr>
            ))}
            {!current.length && (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-neutral-500">
                  No deliberations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center px-4 justify-between text-sm">
        <div>{total != null ? `Total: ${total}` : ""}</div>
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 rounded bg-white/70 lockbutton disabled:opacity-50" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span>Page {page}</span>
          <button className="px-2 py-1 rounded bg-white/70 lockbutton disabled:opacity-50" disabled={!hasNext && !isValidating} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
