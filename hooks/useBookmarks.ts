 "use client";
 import useSWR from "swr";
 import { useMemo } from "react";
 import { useAuth } from "@/lib/AuthContext";
 
 const fetcher = (url: string) => fetch(url).then((r) => r.json());
 type IdLike = string | number | bigint;
 const toStr = (v: IdLike) => (typeof v === "bigint" ? v.toString() : String(v));
 
 export function useBookmarks(conversationId?: IdLike) {
   const { user } = useAuth();
   const conv = conversationId != null ? toStr(conversationId) : undefined;
   const { data, mutate } = useSWR<{ items: { message_id: string; label: string | null }[] }>(
     user && conv ? `/api/conversations/${conv}/bookmark` : null,
     fetcher,
     { refreshInterval: 30000 }
   );
 
   const items = data?.items ?? [];
   const map = useMemo(() => {
     const m = new Map<string, string | null>();
     for (const it of items) m.set(String(it.message_id), it.label ?? null);
     return m;
   }, [items]);
 
   function isBookmarked(messageId: IdLike) {
     return map.has(toStr(messageId));
   }
   function labelFor(messageId: IdLike) {
     return map.get(toStr(messageId)) ?? null;
   }
 
   async function toggleBookmark(messageId: IdLike, opts?: { label?: string | null }) {
     const idStr = toStr(messageId);
     const has = map.has(idStr);
     if (has && opts?.label === undefined) {
       // optimistic remove
       await mutate(
         (prev) => ({
           items: (prev?.items ?? []).filter((it) => String(it.message_id) !== idStr),
         }),
         { revalidate: false }
       );
       await fetch(`/api/messages/${idStr}/bookmark`, { method: "DELETE" });
       mutate();
       return;
     }
     // create or update label
     const label = opts?.label ?? null;
     await mutate(
       (prev) => {
         const rest = (prev?.items ?? []).filter((it) => String(it.message_id) !== idStr);
         return { items: [{ message_id: idStr, label, created_at: new Date().toISOString() }, ...rest] };
       },
       { revalidate: false }
     );
     await fetch(`/api/messages/${idStr}/bookmark`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ label }),
     });
     mutate();
   }
 
   function filterBookmarked<T extends { id: IdLike }>(messages: T[], label?: string | null) {
     if (!label) return messages.filter((m) => isBookmarked(m.id));
     return messages.filter((m) => map.get(toStr(m.id)) === label);
   }
 
   const labels = useMemo(() => {
     return Array.from(new Set(items.map((it) => it.label).filter(Boolean) as string[])).sort();
   }, [items]);
 
   return {
     isBookmarked,
     labelFor,
     toggleBookmark,          // toggle; supply {label} to add/update, no label to remove
     filterBookmarked,
     labels,
     refreshBookmarks: () => mutate(),
   };
 }