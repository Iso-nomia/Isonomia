"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SearchFollowButton from "../buttons/SearchFollowButton";
import { areFriends, isFollowing } from "@/lib/actions/follow.actions";
import { useAuth } from "@/lib/AuthContext";

interface Props {
  userId: bigint;
  name: string;
  username: string;
  imgUrl: string | null;
  personType: string;
}

const UserCard = ({ userId, name, username, imgUrl, personType }: Props) => {
  const router = useRouter();
  const { user } = useAuth();
  const [isFollowingState, setIsFollowingState] = useState(false);
  const [isFriendState, setIsFriendState] = useState(false);

  useEffect(() => {
    async function load() {
      if (user?.userId && user.userId !== userId) {
        const follow = await isFollowing({ followerId: user.userId, followingId: userId });
        const friend = await areFriends({ userId: user.userId, targetUserId: userId });
        setIsFollowingState(follow);
        setIsFriendState(friend);
      }
    }
    load();
  }, [user, userId]);

  return (
    <div className="grid justify-center items-center align-center rounded-none
     border-white border-[1px] w-1/4  p-4 bg-white bg-opacity-20 gap-4">
      <article className="flex ">
        <div className="user-card_avatar">
          <Image
            src={imgUrl || "/assets/user.svg"}
            alt="logo"
            width={48}
            height={48}
            className="rounded-full border-white border-[1px] p-1"
          />
          <div className="flex flex-col text-[1rem]">
            <p className="flex inline-block text-base-semibold text-black">{name}</p>
            <p className="text-small-medium text-gray-1">@{username}</p>
          </div>
        
        </div>
   
      </article>
      {user?.userId && user.userId !== userId && (
            <div className="grid w-full justify-center items-center">
            <SearchFollowButton
            
              targetUserId={userId}
              initialIsFollowing={isFollowingState}
              initialIsFriend={isFriendState}
            />
            </div>
          )}
    </div>
  );
};

export default UserCard;
