import { fetchUserThreads } from "@/lib/actions/user.actions";
import { redirect } from "next/navigation";
import ThreadCard from "@/components/cards/ThreadCard";
import { mapFeedPost } from "@/lib/transform/post";
interface Props {
  currentUserId: bigint;
  accountId: bigint;
}
const ThreadsTab = async ({ currentUserId, accountId }: Props) => {
  let result = await fetchUserThreads(accountId);

  if (!result) redirect("/");

  return (
    <section className="mt-9 flex flex-col gap-10">
      {result.posts.map((post: any) => (
        <ThreadCard
          key={post.id.toString()}
          post={mapFeedPost(post)}
          currentUserId={currentUserId}
        />
      ))}
    </section>
  );
};

export default ThreadsTab;

