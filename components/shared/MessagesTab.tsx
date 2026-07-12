import Link from "next/link";
import { fetchFollowRelations, FriendEntry } from "@/lib/actions/follow.actions";
import Image from "next/image";
interface Props {
  currentUserId: bigint;
  accountId: bigint;
}

const MessagesTab = async ({ currentUserId, accountId }: Props) => {
  const relations: FriendEntry[] = await fetchFollowRelations({ userId: accountId });

  if (relations.length === 0) {
    return <p className="no-result">No connections</p>;
  }
  if (BigInt(currentUserId) === BigInt(accountId)) {

  return (

    <div className="mt-9 space-y-4 justify-center items-center mx-auto">
        <Link href="/profile/messages" className="items-center flex gap-4 text-slate-900 hover:underline hover:underline-offset-4">
            <button className="likebutton flex  p-9 outline-indigo-500 w-fit h-fit text-[1.5    rem] font-light outline-1 ">
            <Image
                  src="/assets/message-queue.svg"
                  alt="inbox"
                  width={24}
                  height={24}
                  className="object-contain w-fit h-fit mr-4"
                />
          Your Messages
          </button>
        </Link>
     
    </div>
    
  );
      }
      return <main className="text-center">{ }</main>;

};

export default MessagesTab;
