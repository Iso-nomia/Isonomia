import Image from "next/image";
import Link from "next/link";

interface Participant {
  id: string;
  name: string;
  image: string | null;
}

interface Conversation {
  id: string;
  isGroup: boolean;
  title?: string | null;
  participants: Participant[];
  lastMessage?: string | null;
}

interface Props {
  conversations: Conversation[];
  currentUserId: string;
}

function GroupAvatar({ participants }: { participants: Participant[] }) {
  const imgs = participants.slice(0, 1);
  return (
    // <div className="grid grid-cols-2 grid-rows-2 w-[3.1rem] h-[3.1rem] rounded-full overflow-hidden profile-shadow">
    <>
    {imgs.map((p) => (
        <Image
          key={p.id}
          src={ p.image|| "/assets/user-helsinki.svg"}
          alt={p.name}
          width={54}
          height={54}
                className="object-cover flex-1 border-[.05rem] rounded-full border-indigo-300 profile-shadow "
          />
      ))}
    </>
  );
}

export default function ConversationList({
  conversations,
  currentUserId,
}: Props) {
  return (
    <div className="flex flex-1 gap-4 mt-6 ">
    <ul className="flex flex-wrap gap-5 h-fit w-fit ">
      {conversations.map((c) => {
        const last = c.lastMessage;
        if (c.isGroup) {
          const title =
            c.title ||
            c.participants
              .map((p) => p.name)
              .slice(0, 3)
              .join(", ");
          return (
            <li
            key={c.id}
            className="flex flex-1 flex-wrap w-fit sheaf-bubble bg-white/20 items-center gap-3  px-1 py-1 rounded-xl "
              >
                <hr className="w-full  border-[1px] border-transparent"></hr>
                <div className="flex w-full h-full align-center px-2 gap-2 ml-2">
                <button className="flex w-[3.7rem] h-[3.7rem]  border-2 border-transparent">

              <GroupAvatar participants={c.participants} />
              </button>
              <button className="flex text-start h-full align-center border-2 border-transparent ml-2">

              <Link href={`/messages/${c.id}`} className="flex flex-col align-center  flex-1 py-1 ">
                <p className="font-bold tracking-wider text-[1.1rem] whitespace-nowrap hover:underline hover:underline-offset-4">{title}</p>
                {last && (
                  <p className="text-[1rem] tracking-wide text-gray-700 truncate max-w-xs">{last}</p>
                )}
              </Link>
              </button>

</div>
<hr className="w-full  border-[1px] border-transparent"></hr>
</li>
          );
        }
        const other = c.participants.find((p) => p.id !== currentUserId);
        if (!other) return null;
        return (
          <li
            key={c.id}
            className="flex flex-1 flex-wrap w-fit sheaf-bubble bg-white/20 items-center gap-3  px-1 py-1 rounded-xl "
            >            <hr className="w-full  border-[1px] border-transparent"></hr>

                          <div className="flex w-full h-full align-center px-2 gap-2 ml-2">
            <button className="flex w-[3.7rem] h-[3.7rem]  border-2 border-transparent ">
            {/* <div className="flex h-[3.1rem] w-[3.1rem]"> */}
              <Image
                src={other.image || "/assets/user-helsinki.svg"}
                alt={other.name}
                width={54}
                height={54}
                className="object-cover flex-1 border-[.05rem] rounded-full border-indigo-300 profile-shadow "
              />
            
            {/* </div> */}
            </button>
            <button className="flex flex-1 text-start w-full h-full align-center border-2 border-transparent ml-2">

            <Link href={`/messages/${c.id}`} className="flex flex-col align-center  flex-1 py-1 ">
            
              <p className="font-bold tracking-wider text-[1.1rem] whitespace-nowrap hover:underline hover:underline-offset-4">{other.name}</p>
              {last && (
                <p className="text-[1rem] tracking-wide text-gray-700 truncate max-w-[10rem]">{last}</p>
              )}
            </Link>
            </button>

            </div>
            <hr className="w-full  border-[1px] border-transparent"></hr>

          </li>
        );
      })}
    </ul>
    </div>
  );
}
