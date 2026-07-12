"use client";

import useSWR from "swr";

type Item = { userId: string; kind: "room" | "tag"; targetId: string; createdAt: string };

const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

export function useFollowing() {
  const { data, mutate } = useSWR<{ items: Item[] }>("/api/follow", fetcher, {
    revalidateOnFocus: false,
  });

  const items = data?.items ?? [];

  // Build quick lookup sets
  const roomSet = new Set(items.filter((i) => i.kind === "room").map((i) => i.targetId));
  const tagSet = new Set(items.filter((i) => i.kind === "tag").map((i) => i.targetId.toLowerCase()));

  async function follow(kind: "room" | "tag", targetId: string) {
    await fetch("/api/follow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, targetId }),
    });
    mutate();
  }
  async function unfollow(kind: "room" | "tag", targetId: string) {
    const p = new URLSearchParams({ kind, targetId });
    await fetch(`/api/follow?${p.toString()}`, { method: "DELETE" });
    mutate();
  }

  // Convenience helpers
  const isFollowingRoom = (deliberationId?: string | null) =>
    !!deliberationId && roomSet.has(deliberationId);
  const isFollowingTag = (tag?: string) => !!tag && tagSet.has(tag.toLowerCase());

  const followRoom = (id: string) => follow("room", id);
  const unfollowRoom = (id: string) => unfollow("room", id);
  const followTag = (tag: string) => follow("tag", tag);
  const unfollowTag = (tag: string) => unfollow("tag", tag);

  return {
    items,
    roomSet,
    tagSet,
    isFollowingRoom,
    isFollowingTag,
    followRoom,
    unfollowRoom,
    followTag,
    unfollowTag,
    mutate,
  };
}
