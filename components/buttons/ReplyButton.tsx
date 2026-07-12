"use client";

import { dislikePost, likePost, unlikePost } from "@/lib/actions/like.actions";
import { useAuth } from "@/lib/AuthContext";
import { Like } from "@prisma/client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  feedpostId?: bigint;
  realtimePostId?: string;
}

const ReplyButton = ({ feedpostId }: Props) => {
  const user = useAuth();
  const router = useRouter();
  const isUserSignedIn = !!user.user;
  const userObjectId = user?.user?.userId;


 
  return (
<button>
    <Image
                  src="/assets/reply.svg"
                  alt="share"
                  width={28}
                  height={28}
                  className="cursor-pointer object-contain likebutton"
                />
</button>
  );
  
};


export default ReplyButton;
