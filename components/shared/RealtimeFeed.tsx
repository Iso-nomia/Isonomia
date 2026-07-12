"use client";

import PostCard from "@/components/cards/PostCard";
import { useInfiniteRealtimePosts } from "@/lib/hooks/useInfiniteRealtimePosts";
import Spinner from "@/components/ui/spinner";
import { realtime_post_type } from "@prisma/client";
import { useMemo } from "react";
import ScrollList from "./ScrollList";
import { mapFeedPost, mapRealtimePost } from "@/lib/transform/post";

interface Props {
  initialPosts: any[];
  initialIsNext: boolean;
  roomId?: string;
  postTypes?: realtime_post_type[];
  currentUserId?: bigint;
  animated?: boolean;
}

export default function RealtimeFeed({
  initialPosts,
  initialIsNext,
  roomId,
  postTypes,
  currentUserId,
  animated = false,
}: Props) {
  const fetchPage = useMemo(() => {
    if (roomId && postTypes && postTypes.length > 0) {
      return async (page: number) => {
        const params = new URLSearchParams({
          roomId,
          page: page.toString(),
          types: postTypes.join(","),
        });
        const res = await fetch(`/api/realtime-posts?${params.toString()}`);
        return res.json();
      };
    }
    return async (_page: number) => {
      const res = await fetch(`/api/feed`);
      return { posts: await res.json(), isNext: false };
    };
  }, [roomId, postTypes]);

  const isRealtime = Boolean(roomId && postTypes && postTypes.length > 0);
  const isFeed = roomId === "global" && (!postTypes || postTypes.length === 0);

  const { posts, loaderRef, loading } = useInfiniteRealtimePosts(
    fetchPage,
    initialPosts,
    initialIsNext
  );

  const mapper = isRealtime ? mapRealtimePost : mapFeedPost;

  const items = posts.map((realtimePost) => {
    const mapped = mapper(realtimePost);
    return (
      <div
        key={realtimePost.id.toString()}
        className={animated ? "scroll-list__item js-scroll-list-item" : ""}
      >
        <PostCard
          {...mapped}
          currentUserId={currentUserId}
          currentUserLike={mapped.currentUserLike}
          {...(isRealtime ? { isRealtimePost: true } : {})}
          {...(isFeed ? { isFeedPost: true } : {})}
        />
      </div>
    );
  });

  const content = (
    <>
      {items}
      <div ref={loaderRef} className="h-1" />
      {loading && (
        <div className="flex justify-center mt-0 mb-4">
          <Spinner className="w-[3rem] h-[3rem]" />
        </div>
      )}
    </>
  );

  return animated ? (
    <ScrollList>{[content]}</ScrollList>
  ) : (
    <section className="mt-[0rem] flex flex-col gap-8">{content}</section>
  );
}
