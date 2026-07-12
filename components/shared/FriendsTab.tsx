import Link from "next/link";
import { fetchFollowRelations, FriendEntry } from "@/lib/actions/follow.actions";

interface Props {
  currentUserId: bigint;
  accountId: bigint;
}

const FriendsTab = async ({ currentUserId, accountId }: Props) => {
  const relations: FriendEntry[] = await fetchFollowRelations({ userId: accountId });

  if (relations.length === 0) {
    return <p className="no-result">No connections</p>;
  }

  return (
    <ul className="mt-9 space-y-4">
      {relations.map((rel) => (
        <li key={rel.id.toString()} className="text-base-regular text-black">
          <Link href={`/profile/${rel.id}`} className="text-primary-500 hover:underline">
            {rel.name}
          </Link>{" "}
          <span className="text-light-3">- {rel.status}</span>
        </li>
      ))}
    </ul>
  );
};

export default FriendsTab;
