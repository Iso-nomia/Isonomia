import { useEffect, useRef, useState } from "react";

type FetchPage = (page: number) => Promise<{ posts: any[]; isNext: boolean }>;

export function useInfiniteRealtimePosts(
  fetchPage: FetchPage,
  initialPosts: any[],
  initialIsNext: boolean
) {
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState(initialPosts);
  const [hasMore, setHasMore] = useState(initialIsNext);
  const [loading, setLoading] = useState(false);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (page === 1) return;
    setLoading(true);
    fetchPage(page)
      .then((data) => {
        setPosts((prev) => [...prev, ...data.posts]);
        setHasMore(data.isNext);
      })
      .finally(() => setLoading(false));
  }, [page, fetchPage]);

  useEffect(() => {
    const node = loaderRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        setPage((p) => p + 1);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loaderRef, hasMore]);

  return { posts, loaderRef, loading };
}
