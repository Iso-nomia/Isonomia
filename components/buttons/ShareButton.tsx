"use client";


import Image from "next/image";

import { useModalStore } from "@/lib/stores/modalStore";
import SharePostModal from "../modals/SharePostModal";

interface Props {
  feedpostId?: bigint;
  realtimePostId?: string;
}

const ShareButton = ({ feedpostId, realtimePostId }: Props) => {
  const { openModal } = useModalStore();
  return (

  <button>
  <Image
    src="/assets/send--alt.svg"
    alt="share"
    width={28}
    height={28}
    className="cursor-pointer object-contain likebutton"
    onClick={() =>
      openModal(
        <SharePostModal feedpostId={feedpostId} realtimePostId={realtimePostId} />
      )
    }
  />
</button>
    );

};


export default ShareButton;
