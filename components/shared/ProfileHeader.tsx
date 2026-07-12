import Image from "next/image";

import FollowButton from "../buttons/FollowButton";
import MessageButton from "../buttons/MessageButton";
interface Props {
  accountId: bigint;
  name: string;
  username: string;
  imgUrl: string | null;
  bio: string | null;
  currentUserId: bigint | null;
  isFollowing: boolean;
  isFriend: boolean;
}
const ProfileHeader = ({
  accountId,
  name,
  username,
  imgUrl,
  bio,
  currentUserId,
  isFollowing,
  isFriend,
}: Props) => {
  return (
    <div className="flex w-full flex-col justify-start">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative h-16 w-16 objects-cover">
            <Image
              src={imgUrl || "/assets/user-helsinki.svg"}
              alt="Profile Image"
              fill
              className="rounded-md object-cover  shadow-2xl"
            />
          </div>
          <div className="flex">
            <div className="flex flex-col">
            <h2 className="text-left text-heading3-bold text-black">
              {name}
            </h2>
            <p className="text-base-light ml-1 text-black">@{username}</p>
            </div>
            {currentUserId && currentUserId !== accountId && (
              <div className="flex  ml-12  gap-6">
              <FollowButton
                targetUserId={accountId}
                initialIsFollowing={isFollowing}
                initialIsFriend={isFriend}
                
              />
              <MessageButton
                targetUserId={accountId}
                initialIsFollowing={isFollowing}
                initialIsFriend={isFriend}
                
              />
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="mt-4 ml-1 max-w-lg text-[1rem] text-black">{bio}</p>
      <div className="mt-2 h-[1px] w-full bg-slate-500 bg-opacity-50"></div>
    </div>
  );
};
export default ProfileHeader;
