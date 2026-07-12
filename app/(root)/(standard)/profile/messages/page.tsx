import { fetchConversations } from "@/lib/actions/conversation.actions";
import { getUserFromCookies } from "@/lib/serverutils";
import { redirect } from "next/navigation";
import ConversationList from "@/components/chat/ConversationList";
import GroupCreationModal from "@/components/chat/GroupCreationModal";
import MessageUserModal from "@/components/chat/MessageUserModal";

export default async function Page() {
  const user = await getUserFromCookies();
  if (!user?.userId) redirect("/login");
  const rows = await fetchConversations(user.userId);
  const list = rows.map((c) => ({
    id: c.id.toString(),
    isGroup: c.is_group,
    title: c.title,
    participants: c.participants.map((p) => ({
      id: p.user_id.toString(),
      name: p.user.name,
      image: p.user.image,
    })),
    lastMessage: c.messages[0]?.text ?? null,
  }));
  return (
    <main className="p-4 mt-[-2rem]">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-[3rem] text-center">Messages</h1>
        <div className="flex gap-4">
        <GroupCreationModal />
        <MessageUserModal />
        </div>
      </div>
      <hr />
      <ConversationList
        conversations={list}
        currentUserId={user.userId.toString()}
      />
    </main>
  );
}
