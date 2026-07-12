
import { fetchMessages } from "@/lib/actions/message.actions";
import { fetchConversation } from "@/lib/actions/conversation.actions";
import { getUserFromCookies } from "@/lib/server/getUser";
import { redirect, notFound } from "next/navigation";
import ChatRoom from "@/components/chat/ChatRoom";
import MessageComposer from "@/components/chat/MessageComposer";
import MessengerPane from "@/components/chat/MessengerPane";
import ConversationHeader from "@/components/chat/ConversationHeader";


export default async function Page({ params, searchParams }: { params: { id: string }; searchParams: { mid?: string } }) {
  const user = await getUserFromCookies();
  if (!user?.userId) redirect("/login");

  const conversationId = BigInt(params.id);
  let conversation;
  try {
    conversation = await fetchConversation(conversationId, user.userId);
  } catch {
    notFound();
  }
  const isGroup = conversation.is_group;


  // Build a title for the header
  const title = (() => {
    if (conversation.is_group) {
      if (conversation.title?.trim()) return conversation.title!;
      const others = conversation.participants
        .filter((p) => p.user_id !== user.userId)
        .map((p) => p.user.name);
      const base = others.slice(0, 3).join(", ");
      const extra = others.length - 3;
      return extra > 0 ? `${base} +${extra}` : base || "Group";
    } else {
      const other = conversation.participants.find((p) => p.user_id !== user.userId)?.user;
      return other?.name ?? "Direct Message";
    }
  })();
  // Header avatar data
  const headerUsers = isGroup
    ? conversation.participants
        .filter((p) => p.user_id !== user.userId)
        .map((p) => p.user)
    : [
        conversation.participants.find((p) => p.user_id !== user.userId)?.user,
      ].filter(Boolean) as { name: string; image: string | null }[];


  const highlightMessageId = searchParams?.mid || null;
  
  // Fetch messages directly from database during SSR
  const rows = (await fetchMessages({ conversationId })).reverse();
  const initialMessages = rows.map(m => ({
    id: m.id.toString(),
    text: m.text ?? null,
    createdAt: m.created_at.toISOString(),
    senderId: m.sender_id.toString(),
    sender: { name: m.sender.name, image: m.sender.image },
    attachments: m.is_redacted ? [] : m.attachments.map(a => ({
      id: a.id.toString(),
      path: a.path,
      type: a.type,
      size: a.size,
    })),
    isRedacted: m.is_redacted,
    driftId: m.drift_id ? m.drift_id.toString() : null,
  }));
  return (
    <main className="p-4 mt-[-4rem] items-center justify-center">
      <ConversationHeader
        isGroup={isGroup}
        headerUsers={headerUsers}
        title={title}
      />
      <hr className="mt-3"/>



  <div className="mt-6 space-y-6">
  
  <ChatRoom
        conversationId={params.id}
        currentUserId={user.userId.toString()}
        currentUserName={user.username ?? ""}
 currentUserImage={user.photoURL ?? null}
        initialMessages={initialMessages}
        highlightMessageId={highlightMessageId ?? null}
      />
      <hr />
      <MessageComposer
        conversationId={String(conversationId)}
        currentUserId={user.userId.toString()}
        currentUserName={user.username ?? ""}
 currentUserImage={user.photoURL ?? null}
      />
    </div>
    <MessengerPane currentUserId={user.userId.toString()} />
  </main>
    );
}
