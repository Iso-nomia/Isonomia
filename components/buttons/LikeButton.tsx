"use client";

import {
  dislikePost,
  likePost,
  unlikePost,
  likeRealtimePost,
  unlikeRealtimePost,
  dislikeRealtimePost,
} from "@/lib/actions/like.actions";
import { useAuth } from "@/lib/AuthContext";
import { Like, RealtimeLike } from "@prisma/client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
interface Props {
  feedpostId?: string;
  realtimePostId?: string;
  likeCount: number;
  initialLikeState?: Like | RealtimeLike | null;
}

const LikeButton = ({ feedpostId, realtimePostId, likeCount, initialLikeState }: Props) => {
  const user = useAuth();
  const router = useRouter();
  const isUserSignedIn = !!user.user;
  const userObjectId = user?.user?.userId;
  const [currentLikeType, setCurrentLikeType] = useState(
    initialLikeState?.type || "NONE"
  );
  const [displayLikeCount, setDisplayLikeCount] = useState(likeCount);

  function likeButtonClicked() {
    if (!isUserSignedIn) {
      router.push("/login");
      return;
    }
    if (!userObjectId) {
      router.push("/onboarding");
      return;
    }
    if (currentLikeType === "LIKE") {
      if (feedpostId) {
        unlikePost({ userId: userObjectId, feedPostId: feedpostId });
      }
      if (realtimePostId) {
        unlikeRealtimePost({ userId: userObjectId, realtimePostId });
      }
      setCurrentLikeType("NONE");
      setDisplayLikeCount(displayLikeCount - 1);
    } else {
      if (feedpostId) {
        likePost({ userId: userObjectId, feedPostId: feedpostId });
      }
      if (realtimePostId) {
        likeRealtimePost({ userId: userObjectId, realtimePostId });
      }
      if (currentLikeType === "NONE") {
        setDisplayLikeCount(displayLikeCount + 1);
      } else if (currentLikeType === "DISLIKE") {
        setDisplayLikeCount(displayLikeCount + 2);
      }
      setCurrentLikeType("LIKE");
    }
  }

  function dislikeButtonClicked() {
    if (!isUserSignedIn) {
      router.push("/login");
      return;
    }
    if (!userObjectId) {
      router.push("/onboarding");
      return;
    }
    if (currentLikeType === "DISLIKE") {
      if (feedpostId) {
        unlikePost({ userId: userObjectId, feedPostId: feedpostId });
      }
      if (realtimePostId) {
        unlikeRealtimePost({ userId: userObjectId, realtimePostId });
      }
      setCurrentLikeType("NONE");
      setDisplayLikeCount(displayLikeCount + 1);
    } else {
      if (feedpostId) {
        dislikePost({ userId: userObjectId, feedPostId: feedpostId });
      }
      if (realtimePostId) {
        dislikeRealtimePost({ userId: userObjectId, realtimePostId });
      }
      if (currentLikeType === "NONE") {
        setDisplayLikeCount(displayLikeCount - 1);
      } else if (currentLikeType === "LIKE") {
        setDisplayLikeCount(displayLikeCount - 2);
      }
      setCurrentLikeType("DISLIKE");
    }
  }
  return (
    <div className="flex flex-row items-center gap-2 relative -left-3">
            <button         onClick={likeButtonClicked}>

        <Image
        src={
          currentLikeType === "LIKE"
            ? "/assets/triangle--solid.svg"
            : "/assets/triangle--outline.svg"
        }
        alt="smile"
        width={28}
        height={28}
        className="cursor-pointer object-contain likebutton"
      />
          </button>

      {/* Give this paragraph a fixed width (e.g. 24px or w-6) and text-center. */}
      <p className="w-2 text-center text-subtle-medium text-black">
        {displayLikeCount}
      </p>
  
      <button         onClick={dislikeButtonClicked}>
      <Image
        src={
          currentLikeType === "DISLIKE"
            ? "/assets/triangle--down--solid.svg"
            : "/assets/triangle--down--outline.svg"
        }
        alt="frown"
        width={28}
        height={28}
        className="cursor-pointer object-contain likebutton"
      />
        </button>
      
    </div>
  );
  
};

export default LikeButton;
