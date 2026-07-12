import Modal from "@/components/modals/Modal";
import RealtimeFeed from "@/components/shared/RealtimeFeed";
import { fetchRealtimePosts } from "@/lib/actions/realtimepost.actions";
import { fetchRealtimeRoom } from "@/lib/actions/realtimeroom.actions";
import { getUserFromCookies } from "@/lib/serverutils";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { id: string } }) {
  const lounge = await fetchRealtimeRoom({ realtimeRoomId: params.id });
  if (!lounge || !lounge.isLounge) notFound();
  const user = await getUserFromCookies();
  if (!lounge.isPublic) {
    if (!user) redirect("/login");
    if (
      !lounge.members
        .map((m) => m.user_id)
        .filter((id): id is bigint => id !== null)
        .includes(user.userId as bigint)
    ) {
      notFound();
    }
  }
  const result = await fetchRealtimePosts({
    realtimeRoomId: params.id,
    postTypes: [
      "TEXT",
      "VIDEO",
      "IMAGE",
      "IMAGE_COMPUTE",
      "GALLERY",
      "DRAW",
      "LIVECHAT",
      "MUSIC",
      "ENTROPY",
      "PLUGIN",
      "PRODUCT_REVIEW",
      "ROOM_CANVAS",
    ],
  });
  return (
    <div>
      <Modal />
      {result.posts.length === 0 ? (
        <p className="no-result">Nothing found</p>
      ) : (
        <RealtimeFeed
          initialPosts={result.posts}
          initialIsNext={result.isNext}
          roomId={params.id}
          postTypes={[
            "TEXT",
            "VIDEO",
            "IMAGE",
            "IMAGE_COMPUTE",
            "GALLERY",
            "DRAW",
            "LIVECHAT",
            "MUSIC",
            "ENTROPY",
          "PLUGIN",
          "PRODUCT_REVIEW",
          "PREDICTION",
          "ROOM_CANVAS",
        ]}
        currentUserId={user?.userId ?? undefined}
      />
      )}
    </div>
  );
}
