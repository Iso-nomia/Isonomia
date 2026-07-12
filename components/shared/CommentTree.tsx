import ThreadCard from "@/components/cards/ThreadCard";
import Comment from "@/components/forms/Comment";
import { mapFeedPost, mapRealtimePost } from "@/lib/transform/post";

interface CommentTreeProps {
  comments: any[];
  currentUserId: bigint;
  currentUserImg: string;
  depth?: number;
  isRealtimePost?: boolean;
  isFeedPost?: boolean;
}

const MAX_DEPTH = 5;
const INDENT_PX = 24;

const CommentTree = ({ comments, currentUserId, currentUserImg, depth = 0, isRealtimePost, isFeedPost=true }: CommentTreeProps) => {
  return (
    
    <div className="flex flex-col gap-3">
      
      {comments.map((comment) => {
        const indent = Math.min(depth, MAX_DEPTH) * INDENT_PX;
        const mapped = isRealtimePost
          ? mapRealtimePost(comment)
          : mapFeedPost(comment);
        return (
          <div
            key={comment.id.toString()}
            className="mt-0"
            style={{ marginLeft: indent, width: `calc(100% - ${indent}px)` }}
          >
            <ThreadCard
              post={comment}
              currentUserId={currentUserId}
              {...(isRealtimePost ? { isRealtimePost: true } : {})}
            />

            <div
              className="mt-4"
              style={{ marginLeft: indent, width: `calc(100% - ${indent}px)` }}
            >
              <Comment
                {...(isRealtimePost
                  ? { realtimePostId: comment.id.toString() }
                  : { postId: comment.id })}
                currentUserImg={currentUserImg}
                currentUserId={currentUserId}
              />
              <hr className="mt-4 mb-3 w-full h-px border-t-0 bg-transparent bg-gradient-to-r from-transparent via-slate-500 to-transparent opacity-75" />

              {comment.children && comment.children.length > 0 && (
                <CommentTree
                  comments={comment.children}
                  currentUserId={currentUserId}
                  currentUserImg={currentUserImg}
                  depth={depth + 1}
                  isRealtimePost={isRealtimePost}
                  isFeedPost={isFeedPost}

                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CommentTree;
