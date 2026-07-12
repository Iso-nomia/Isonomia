 "use client";
 import useSWR from "swr";
 import { useMemo } from "react";
 import { useAuth } from "@/lib/AuthContext";
 
 const fetcher = (url: string) => fetch(url).then((r) => r.json());
 
 type IdLike = string | number | bigint;
 const toStr = (v: IdLike) => (typeof v === "bigint" ? v.toString() : String(v));
 
 export function useStars(conversationId?: IdLike) {
   const { user } = useAuth();
   const conv = conversationId != null ? toStr(conversationId) : undefined;
 
   const { data, mutate } = useSWR<{ ids: string[]; count: number }>(
     user && conv ? `/api/conversations/${conv}/stars` : null,
     fetcher,
     { refreshInterval: 30000 }
   );
 
   const ids = (data?.ids ?? []).map(String);
   const set = useMemo(() => new Set(ids), [ids]);
 
   function isStarred(messageId: IdLike) {
     return set.has(toStr(messageId));
   }
 
   async function toggleStar(messageId: IdLike) {
     const idStr = toStr(messageId);
     // optimistic
     await mutate(
       (prev) => {
         const cur = new Set((prev?.ids ?? []).map(String));
         if (cur.has(idStr)) cur.delete(idStr);
         else cur.add(idStr);
         return { ids: Array.from(cur), count: cur.size };
       },
       { revalidate: false }
     );
     // server
     await fetch(`/api/messages/${idStr}/star`, { method: "POST" });
     // re-sync
     mutate();
   }
 
   function filterStarred<T extends { id: IdLike }>(messages: T[]) {
     return messages.filter((m) => isStarred(m.id));
   }
 
   return {
     starredIds: ids,
     isStarred,
     toggleStar,
     filterStarred,
     refreshStars: () => mutate(),
   };
 }
 