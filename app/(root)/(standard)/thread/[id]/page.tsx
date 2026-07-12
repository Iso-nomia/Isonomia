import Comment from "@/components/forms/Comment";
import { fetchPostTreeById } from "@/lib/actions/thread.actions";
import CommentTree from "@/components/shared/CommentTree";
import { redirect, notFound } from "next/navigation";
import { getUserFromCookies } from "@/lib/serverutils";
import PostCard from "@/components/cards/PostCard";
import { fetchLikeForCurrentUser } from "@/lib/actions/like.actions";
import Modal from "@/components/modals/Modal";
import { mapFeedPost } from "@/lib/transform/post";
const Page = async ({ params }: { params: { id: string } }) => {
  if (!params?.id && params?.id?.length !== 1) return notFound();
  const user = await getUserFromCookies();
  if (!user?.onboarded) redirect("/onboarding");
  const post = await fetchPostTreeById(BigInt(params.id));
  if (!post) notFound();
  const currentUserLike = user?.userId
    ? await fetchLikeForCurrentUser({ feedPostId: post.id, userId: user.userId })
    : null;
  const mappedPost = mapFeedPost(post);
  
  return (
    <section className="sticky ">
                <main className=" bg-transparent">
                  
      <Modal />

      <div className="flex flex-row">
        <PostCard
          key={post.id.toString()}
          currentUserId={user?.userId}
          currentUserLike={currentUserLike}
          {...mappedPost}
        />
      </div>
      

      <div className="flex-1 flex-row w-full  mt-6 ">

        <Comment
          postId={post.id}
          currentUserImg={user.photoURL!}
          currentUserId={user.userId!}
        />
      </div >

      <div className="flex-1 flex-row w-full mt-4 ">

      <CommentTree
      
        comments={(post as any).children}
        currentUserId={user.userId!}
        currentUserImg={user.photoURL!}
        depth={1}
      />
      </div>

          </main>

    </section>
  );
};

export default Page;
