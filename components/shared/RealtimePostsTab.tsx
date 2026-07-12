import PostCard from "@/components/cards/PostCard";
import { fetchUserRealtimePosts } from "@/lib/actions/realtimepost.actions";
import { fetchRealtimeLikeForCurrentUser } from "@/lib/actions/like.actions";
import { redirect } from "next/navigation";
import { mapRealtimePost } from "@/lib/transform/post";

interface Props {
  currentUserId: bigint;
  accountId: bigint;
}

const RealtimePostsTab = async ({ currentUserId, accountId }: Props) => {
  const posts = await fetchUserRealtimePosts({
    realtimeRoomId: "global",
    userId: accountId,
    postTypes: ["TEXT", "VIDEO", "IMAGE", "IMAGE_COMPUTE", "GALLERY", "DRAW"],
  });

  if (!posts) redirect("/");

  const postsWithLikes = await Promise.all(
    posts.map(async (post) => {
      const like = currentUserId
        ? await fetchRealtimeLikeForCurrentUser({
            realtimePostId: post.id,
            userId: currentUserId,
          })
        : null;
      return { post: mapRealtimePost(post), like };
    })
  );

  return (
    <section className="mt-[3rem] flex flex-col gap-12">
      {postsWithLikes.length === 0 ? (
        <p className="no-result">Nothing found</p>
      ) : (
        <>
          {postsWithLikes.map(({ post, like }) => (
            <PostCard
              key={post.id.toString()}
              currentUserId={currentUserId}
              currentUserLike={like}
              {...post}
              isRealtimePost
            />
          ))}
        </>
      )}
    </section>
  );
};

export default RealtimePostsTab;
