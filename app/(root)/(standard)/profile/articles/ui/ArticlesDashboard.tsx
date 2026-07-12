"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import useSWRInfinite from 'swr/infinite';
import { Input } from "@/components/ui/input";

type Item = {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  heroImageKey: string | null;
  template: string;
};

type PageData = { items: Item[]; total?: number };


type Props = {
  initialItems: Item[];
  initialNextCursor: { updatedAt: string; id: string } | null;
  pageSize: number;
};

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());


export default function ArticlesDashboard({
  initialItems,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initialItems);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"ALL" | "DRAFT" | "PUBLISHED">("ALL");
  const [view, setView] = useState<"active" | "trash">("active");
  const [template, setTemplate] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  // const [pageSize, setPageSize] = useState(20);
  const [isPending, startTransition] = useTransition();
  // const [total, setTotal] = useState<number | null>(null);

  const pageSize = 15;


  // SWR Infinite: build a key per page with your existing /api/articles params
  const getKey = (index: number, prev: PageData | null) => {
    // stop if previous page is empty (no more)
    if (prev && (!prev.items || prev.items.length === 0)) return null;
    const params = new URLSearchParams({
      page: String(index + 1),
      pageSize: String(pageSize),
      q,
      view,
      sort: "updatedAt:desc",
    });
    if (status !== "ALL") params.set("status", status);
    if (template !== "ALL") params.set("template", template);
    return `/api/articles?${params.toString()}`;
  };

  const {
    data,
    size,
    setSize,
    isValidating,
    mutate, // for optimistic updates
  } = useSWRInfinite<PageData>(getKey, fetcher, {
    revalidateFirstPage: true,
    persistSize: true,
    parallel: true, // fetch pages in parallel when increasing size
    fallbackData: [{ items: initialItems }],
  });

  // Current page items (fallback to empty)
  const current = data?.[page - 1]?.items ?? [];
  const total = data?.[0]?.total ?? null;

  // Derived: do we have a next page?
  const hasNext =
    (data && data[page - 1] && (data[page - 1]!.items?.length ?? 0) === pageSize) ||
    (size < page); // if user clicked "Next" quickly before fetch arrives

  // Prefetch the next page when page changes (if we don’t have it yet)
  useEffect(() => {
    if (page > size) setSize(page);
  }, [page, size, setSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
    // SWR will re-key automatically since getKey depends on these states
  }, [q, status, template, view]);

  // Actions
  async function createNew() {
    router.push("/article/new");
  }

  async function rename(id: string, title: string) {
    // optimistic: update in SWR cache
    mutate(
      (pages) =>
        pages?.map((p) => ({
          ...p,
          items: p.items.map((it) => (it.id === id ? { ...it, title } : it)),
        })) as PageData[],
      { revalidate: false }
    );
    toast.success("Title updated");
    await fetch(`/api/articles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).catch(() => {
      // rollback on error (optional)
      mutate();
    });
  }

  async function remove(id: string) {
    if (!confirm("Move to Trash?")) return;
    // optimistic: remove from all cached pages
    mutate(
      (pages) =>
        pages?.map((p) => ({
          ...p,
          items: p.items.filter((it) => it.id !== id),
        })) as PageData[],
      { revalidate: false }
    );
    toast.success("Moved to Trash");
    await fetch(`/api/articles/${id}`, { method: "DELETE" }).finally(() => {
      // revalidate current pages to keep counts in sync
      mutate();
    });
  }

  async function restore(id: string) {
    toast.loading("Restoring…", { id });
    await fetch(`/api/articles/${id}/restore`, { method: "POST" });
    toast.success("Restored", { id });
    // Revalidate first page (simplest)
    mutate();
  }

  function viewArticle(i: Item) {
    router.push(`/article/${i.slug}`);
  }
  function edit(i: Item) {
    router.push(`/article/by-id/${i.id}/edit`);
  }
  function copyLink(i: Item) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    navigator.clipboard.writeText(`${origin}/article/${i.slug}`);
    toast.success("Link copied");
  }

  // Pagination buttons
  function onPageChange(next: number) {
    if (next < 1) return;
    setPage(next);
  }


  return (
    <div className="mx-auto max-w-5xl p-4 space-y-6 mt-[-3rem] custom-scrollbar">
      <div className="flex items-center px-4 justify-between gap-3 ">
        <div className="text-[1.8rem] text-slate-800 font-semibold">Your Articles</div>
        <button
          onClick={createNew}
          className="px-3 py-1.5 rounded-xl bg-amber-300 lockbutton text-black text-sm"
        >
          New article
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center px-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search..."
          className="border-[1px] border-indigo-300/80 rounded-xl w-[40%] articlesearchfield px-2 py-[5px] text-sm"
        />

        <select
          className="border-[1px] border-indigo-300/80 rounded px-2 py-1.5 rounded-xl text-sm selectfield"
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
        >
          <option value="ALL">All</option>
          <option value="DRAFT">Drafts</option>
          <option value="PUBLISHED">Published</option>
        </select>

        <select
          className="border-[1px] border-indigo-300/80 rounded-xl px-2 py-1.5 text-sm selectfield"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
        >
          <option value="ALL">All Templates</option>
          <option value="standard">Standard</option>
          <option value="feature">Feature</option>
        </select>

        <div className="ml-auto flex items-center gap-3">
          {isValidating && <span className="text-sm text-neutral-500">Loading…</span>}
          <button
            className={`px-2 py-0 lockbutton rounded-xl text-[.9rem] ${
              view === "active" ? "border bg-neutral-100" : "border bg-neutral-50/30"
            }`}
            onClick={() => setView("active")}
          >
            Active
          </button>
          <button
            className={`px-2 py-0 lockbutton rounded-xl text-[.9rem] ${
              view === "trash" ? "border bg-neutral-100" : "border bg-neutral-50/30"
            }`}
            onClick={() => setView("trash")}
          >
            Archived
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl px-1 border-[1px] border-transparent bg-white/30 backdrop-blur-lg editor-shadow">
        <table className="min-w-full text-sm">
          <tbody>
            {current.map((i) => (
              <tr key={i.id} className="border-t-0 border-b-[1px] border-slate-400 rounded-xl">
                <td className="align-center py-4 px-4 my-auto text-[1.0rem] leading-none tracking-wide font-light">
                  <InlineTitle initial={i.title} onSave={(t) => rename(i.id, t)} />
                </td>

                <td className="px-1 text-center py-2">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      i.status === "PUBLISHED"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {i.status.toLowerCase()}
                  </span>
                </td>
                <td className="px-5 text-center py-2 text-neutral-600">
                  {new Date(i.updatedAt).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 justify-end px-2">
                    {view === "trash" ? (
                      <>
                        <button className="px-2 py-1 border rounded" onClick={() => restore(i.id)}>
                          Restore
                        </button>
                        <button
                          className="px-2 py-1 border rounded text-red-600"
                          onClick={() =>
                            fetch(`/api/articles/${i.id}?hard=1`, { method: "DELETE" }).then(() => {
                              toast.success("Deleted");
                              mutate();
                            })
                          }
                        >
                          Delete forever
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="px-2 py-.5 bg-white/30 rounded-xl savebutton" onClick={() => edit(i)}>
                          Edit
                        </button>
                        <button className="px-2 py-.5 bg-white/30 rounded-xl savebutton" onClick={() => viewArticle(i)}>
                          View
                        </button>
                        <button className="px-2 py-.5 bg-white/30 rounded-xl savebutton" onClick={() => copyLink(i)}>
                          Copy link
                        </button>
                        <button
  className="px-2 py-1 border rounded"
  onClick={async () => {
    const res = await fetch("/api/deliberations/spawn", {
      method: "POST", headers: {"content-type":"application/json"},
      body: JSON.stringify({ hostType: "article", hostId: i.id, tags: ["methodology"] }),
    });
    const j = await res.json();
    if (j.redirect) location.href = j.redirect;
  }}
>
  Open discussion
</button>
                        <button className="px-2 py-.5 bg-white/30 rounded-xl text-red-600 savebutton" onClick={() => remove(i.id)}>
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!current.length && (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-neutral-500">
                  No articles found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center px-4 justify-between text-sm">
        <div>{total !== null ? `Total: ${total}` : ""}</div>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 rounded bg-white/70 lockbutton disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Prev
          </button>
          <span>Page {page}</span>
          <button
            className="px-2 py-1 rounded bg-white/70 lockbutton disabled:opacity-50"
            disabled={!hasNext && !isValidating}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function InlineTitle({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (t: string) => void;
}) {
  const [val, setVal] = useState(initial);
  useEffect(() => setVal(initial), [initial]); // keep in sync when SWR updates
  return (
    <input
      className="w-full outline-none bg-transparent"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        const t = val.trim();
        if (t && t !== initial) onSave(t);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
      }}
    />
  );
}
