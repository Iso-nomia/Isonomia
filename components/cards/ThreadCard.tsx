import { fetchLikeForCurrentUser, fetchRealtimeLikeForCurrentUser } from "@/lib/actions/like.actions";
import type { Like, RealtimeLike } from "@prisma/client";
import PostCard from "./PostCard";
import type { BasePost } from "@/lib/types/post";

interface Props {
  post: BasePost;
  currentUserId?: bigint | null;
  isRealtimePost?: boolean;
  isFeedPost?: boolean;
}

const ThreadCard = async ({
  post,
  currentUserId,
  isRealtimePost = false,
  isFeedPost = false,
}: Props) => {
  const currentUserLike: Like | RealtimeLike | null = currentUserId
    ? isRealtimePost
      ? await fetchRealtimeLikeForCurrentUser({
          realtimePostId: post.id,
          userId: currentUserId,
        })
      : await fetchLikeForCurrentUser({ postId: post.id, userId: currentUserId })
    : null;

  return (
    <PostCard
      {...post}
      currentUserId={currentUserId}
      currentUserLike={currentUserLike}
      {...(isRealtimePost ? { isRealtimePost: true } : {})}
      {...(isFeedPost ? { isFeedPost: true } : {})}
    />
  );
};

export default ThreadCard;
