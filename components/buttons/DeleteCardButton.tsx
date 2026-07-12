"use client";

import Image from "next/image";
import { deletePost } from "@/lib/actions/thread.actions";
import { deleteFeedPost } from "@/lib/actions/feed.client";
import { deleteRealtimePost } from "@/lib/actions/realtimepost.actions";
import { useRouter, usePathname } from "next/navigation";

interface Props {
  realtimePostId?: string;
  feedPostId?: bigint;
}

const DeleteCardButton = ({  realtimePostId, feedPostId }: Props) => {
  const router = useRouter();
  const pathname = usePathname();

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    if (realtimePostId) {
      await deleteRealtimePost({ id: realtimePostId, path: pathname ?? undefined });
    } else if (feedPostId) {
      await deleteFeedPost({ id: feedPostId, path: pathname ?? "" });
    } 
    router.refresh();
  };

  return (
    <button onClick={handleDelete}>
      <Image
        src="/assets/trash-can.svg"
        alt="trash"
        width={28}
        height={28}
        className="cursor-pointer object-contain likebutton"
      />
    </button>
  );
};
  

export default DeleteCardButton;
