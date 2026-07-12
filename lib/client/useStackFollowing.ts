"use client";
import useSWR from "swr";
const fetcher = (u: string) => fetch(u).then(r => r.json());

export function useStackFollowing() {
  const { data } = useSWR<{ items: string[] }>("/api/stacks/subscriptions", fetcher, { revalidateOnFocus: false });
  const set = new Set((data?.items ?? []).map(String));
  const isFollowingStack = (id?: string) => !!(id && set.has(id));
  return { stackSet: set, isFollowingStack };
}
