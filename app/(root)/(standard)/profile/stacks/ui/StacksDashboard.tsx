"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import useSWRInfinite from "swr/infinite";
import CreateStackModal from "@/components/stack/CreateStackModal";

type Item = {
  id: string;
  name: string;
  slug: string;
  is_public: boolean;
  created_at: string;            // ISO
  description: string | null;
};

type PageData = { items: Item[]; total?: number };
const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then(r => r.json());

export default function StacksDashboard({ initialItems }: { initialItems: Item[] }) {
  const router = useRouter();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // filters that exist on Stack
  const [q, setQ] = useState("");
  const [vis, setVis] = useState<"ALL" | "PUBLIC" | "PRIVATE">("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const getKey = (index: number, prev: PageData | null) => {
    if (prev && (!prev.items || prev.items.length === 0)) return null;
    const params = new URLSearchParams({
      page: String(index + 1),
      pageSize: String(pageSize),
      q,
      vis,
      sort: "created_at:desc",
    });
    return `/api/stacks?${params.toString()}`;
  };

  const { data, size, setSize, isValidating, mutate } = useSWRInfinite<PageData>(getKey, fetcher, {
    revalidateFirstPage: true,
    persistSize: true,
    parallel: true,
    fallbackData: [{ items: initialItems }],
  });

  const current = data?.[page - 1]?.items ?? [];
  const total = data?.[0]?.total ?? null;
  const hasNext =
    (data && data[page - 1] && (data[page - 1]!.items?.length ?? 0) === pageSize) ||
    (size < page);

  useEffect(() => { if (page > size) setSize(page); }, [page, size, setSize]);
  useEffect(() => { setPage(1); }, [q, vis]);

  function handleCreateSuccess(stack: { id: string; slug?: string }) {
    mutate(); // refresh the list
    router.push(`/stacks/${stack.id}`);
  }
  
  function viewStack(i: Item) { router.push(`/stacks/${i.slug || i.id}`); }
  function edit(i: Item) { router.push(`/stacks/${i.slug || i.id}`); } // Navigate to stack page for editing
  function copyLink(i: Item) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    navigator.clipboard.writeText(`${origin}/stack/${i.slug}`);
    toast.success("Link copied");
  }

  async function rename(id: string, name: string) {
    // optimistic
    mutate(p => p?.map(pg => ({ ...pg, items: pg.items.map(it => it.id === id ? { ...it, name } : it) })), { revalidate: false });
    toast.success("Name updated");
    await fetch(`/api/stacks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => mutate()); // rollback on error
  }

  async function remove(id: string) {
    if (!confirm("Delete stack? This cannot be undone.")) return;
    mutate(p => p?.map(pg => ({ ...pg, items: pg.items.filter(it => it.id !== id) })), { revalidate: false });
    toast.success("Deleted");
    await fetch(`/api/stacks/${id}`, { method: "DELETE" }).finally(() => mutate());
  }

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-6 mt-[-3rem] custom-scrollbar">
      <div className="flex items-center px-4 justify-between gap-3 ">
        <div className="text-[1.8rem] text-slate-800 font-semibold">Your Stacks</div>
        <button onClick={() => setCreateModalOpen(true)} className="px-3 py-1.5 rounded-xl bg-amber-300 lockbutton text-black text-sm">
          New stack
        </button>
      </div>

      <CreateStackModal 
        open={createModalOpen} 
        onOpenChange={setCreateModalOpen}
        onSuccess={handleCreateSuccess}
      />

      <div className="flex flex-wrap gap-3 items-center px-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or slug…"
          className="border-[1px] border-indigo-300/80 rounded-xl w-[40%] articlesearchfield px-2 py-[5px] text-sm"
        />
        <select
          className="border-[1px] border-indigo-300/80 rounded px-2 py-1.5 rounded-xl text-sm selectfield"
          value={vis}
          onChange={(e) => setVis(e.target.value as any)}
        >
          <option value="ALL">All</option>
          <option value="PUBLIC">Public</option>
          <option value="PRIVATE">Private</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl px-1 border-[1px] border-transparent bg-white/30 backdrop-blur-lg editor-shadow">
        <table className="min-w-full text-sm">
          <tbody>
            {current.map((i) => (
              <tr key={i.id} className="border-t-0 border-b-[1px] border-slate-400 rounded-xl">
                <td className="align-center py-4 px-4 my-auto text-[1.0rem] leading-none tracking-wide font-light">
                  <InlineName initial={i.name} onSave={(t) => rename(i.id, t)} />
                  <div className="text-xs text-neutral-500 truncate">{i.slug}</div>
                </td>
                <td className="px-1 text-center py-2">
                  <span className={`px-2 py-1 rounded text-xs ${i.is_public ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {i.is_public ? "public" : "private"}
                  </span>
                </td>
                <td className="px-5 text-center py-2 text-neutral-600">
                  {new Date(i.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 justify-end px-2">
                    <button className="px-2 py-.5 bg-white/30 rounded-xl savebutton" onClick={() => edit(i)}>Edit</button>
                    <button className="px-2 py-.5 bg-white/30 rounded-xl savebutton" onClick={() => viewStack(i)}>View</button>
                    <button className="px-2 py-.5 bg-white/30 rounded-xl savebutton" onClick={() => copyLink(i)}>Copy link</button>
                    <button className="px-2 py-.5 bg-white/30 rounded-xl text-red-600 savebutton" onClick={() => remove(i.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {!current.length && (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-neutral-500">
                  No stacks found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center px-4 justify-between text-sm">
        <div>{total !== null ? `Total: ${total}` : ""}</div>
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 rounded bg-white/70 lockbutton disabled:opacity-50" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span>Page {page}</span>
          <button className="px-2 py-1 rounded bg-white/70 lockbutton disabled:opacity-50" disabled={!hasNext && !isValidating} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}

function InlineName({ initial, onSave }: { initial: string; onSave: (t: string) => void }) {
  const [val, setVal] = useState(initial);
  useEffect(() => setVal(initial), [initial]);
  return (
    <input
      className="w-full outline-none bg-transparent"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => { const t = val.trim(); if (t && t !== initial) onSave(t); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
    />
  );
}
