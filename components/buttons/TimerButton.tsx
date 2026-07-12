"use client";

import Image from "next/image";
import { useModalStore } from "@/lib/stores/modalStore";
import TimerModal from "../modals/TimerModal";

interface Props {
  realtimePostId?: string;
  feedPostId?: bigint;
  isOwned: boolean;
  expirationDate?: string | null;
}

const TimerButton = ({
  realtimePostId,
  feedPostId,
  isOwned,
  expirationDate,
}: Props) => {
  const { openModal } = useModalStore();

  return (
    <button>
    <Image
      src="/assets/time.svg"
      alt="clock"
      width={28}
                  height={28}
      className="cursor-pointer object-contain likebutton"
      onClick={() =>
        openModal(
          <TimerModal
            realtimePostId={realtimePostId}
            feedPostId={feedPostId}
            isOwned={isOwned}
            expirationDate={expirationDate}
          />
        )
      }
    />
    </button>
  );
};

export default TimerButton;
