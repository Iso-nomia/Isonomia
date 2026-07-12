// components/discussion/DiscussionView.tsx
"use client";
import * as React from "react";
import ChatRoom from "@/components/chat/ChatRoom";
import ForumPane from "./ForumPane";
import DeliberateButton from "../common/DeliberationButton";
import { useChatStore } from "@/contexts/useChatStore";
import { useAuth } from "@/lib/AuthContext";
import MessageComposer from "../chat/MessageComposer";
import MessengerPane from "../chat/MessengerPane";
import ThreadListSidebar from "./ThreadListSidebar";
import ForumRulesCard from "./ForumRulesCard";
import DiscussionDescriptionEditor from './DiscussionDescriptionEditor';

export const isdemo = false;



// import { GridBG } from "./FX";
import { GridBG } from "../ui/GridBG";
import DiscussionTitleEditor from "./DiscussionTitleEditor";
import { SubscribeButton } from '@/components/discussion/SubscribeButton';


export default function DiscussionView({
  discussion,
  conversationId,
  initialMessages = [],         // 👈 NEW
  initialForumComments,          // 👈 NEW: Accept forum comments for demo/SSR
}: {
  discussion: any;
  conversationId: string | null;   // ⬅️ string | null now
  initialMessages?: any[];
  initialForumComments?: any[];    // 👈 NEW

}) {
  const [tab, setTab] = React.useState<"chat" | "forum">("forum");
  const setMessages = useChatStore((s) => s.setMessages);
  const { user } = useAuth();
  const me = user?.userId ? String(user.userId) : null; // real DB userId as string
  const currentUserName = user?.username ?? user?.displayName ?? "";
  const currentUserImage = user?.photoURL ?? null;


// const displayTitle = discussion.title && discussion.title.trim()
//   ? discussion.title
//   : "Discussion"; // or compute a fallback if you also fetch the attached comment text

const canEditTitle = me && discussion?.createdById && String(discussion.createdById) === String(me);


  // Seed the store with server-hydrated messages once
  React.useEffect(() => {
    if (!conversationId || !initialMessages.length) return;
    const existing = useChatStore.getState().messages[conversationId] ?? [];
    if (existing.length) return;
    setMessages(conversationId, initialMessages);
  }, [conversationId, initialMessages, setMessages]);

  // Ensure membership once when Chat is active (safe/idempotent)
  React.useEffect(() => {
    if (tab !== "chat" || !conversationId) return;
    let ran = false;
    (async () => {
      if (ran) return;
      ran = true;
      await fetch(`/api/conversations/${conversationId}/ensure-member`, { method: "POST" }).catch(() => {});
    })();
  }, [tab, conversationId]);


// Optional client hydration (fallback) if server didn’t seed
React.useEffect(() => {
    if (tab !== "chat" || !conversationId) return;

    const existing = useChatStore.getState().messages[conversationId] ?? [];
    if (existing.length) return; // already seeded

    let cancelled = false;
    (async () => {
      const url = new URL(`/api/sheaf/messages`, window.location.origin);
      url.searchParams.set("conversationId", conversationId);
      url.searchParams.set("limit", "50");
      if (me) url.searchParams.set("userId", me);
      const r = await fetch(url.toString(), { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json().catch(() => null);
      const arr = j?.messages ?? j?.items ?? [];
      if (!cancelled && Array.isArray(arr)) setMessages(conversationId, arr);
    })();
    return () => { cancelled = true; };
  }, [tab, conversationId, me, setMessages]);

  // Flip to Chat when forum triggers a quote
  React.useEffect(() => {
    const onQuote = () => setTab("chat");
    window.addEventListener("discussion:quote-for-chat", onQuote as any);
    return () => window.removeEventListener("discussion:quote-for-chat", onQuote as any);
  }, []);

  return (

    <div className="relative isolate w-full ">
  
      <div className="relative z-10 mx-auto  p-0 space-y-3 w-full">
      <header className=" panel-edge  rounded-2xl border bg-white/50 px-4 py-3 
      shadow-[0_10px_40px_-10px_rgba(2,6,23,0.12)]">
      <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 gap-5">
              <DiscussionTitleEditor
                id={discussion.id}
                title={discussion.title ?? ''}
                canEdit={!!canEditTitle}
                onUpdated={(t) => { (discussion.title = t); /* local mutate ok */ }}
                className="px-1"
              />
              <div className="flex items-center h-5 border-l border-slate-400" />
              <DiscussionDescriptionEditor
        id={discussion.id}
        description={discussion.description ?? null}
        canEdit={!!canEditTitle}
        onUpdated={(desc) => { discussion.description = desc; }}
      />
           
                      {/* {discussion.description && (
                <p className="mt-0.5 text-sm text-slate-600">{discussion.description}</p>
              )} */}
            </div>
            <div className="flex items-center gap-2">
                    <SubscribeButton variant="text-only" discussionId={discussion.id}  />
              <div className="h-6 border-l border-slate-400" />

              <button
                onClick={() => setTab("chat")}
                className={`btnv2 btnv2--sm text-xs px-3 py-1.5  ${tab === "chat" ? "bg-indigo-300/50" : "btnv2 "}`}
                aria-pressed={tab === "chat"}
              >
                Chat
              </button>
              <button
                onClick={() => setTab("forum")}
                className={`btnv2 btnv2--sm text-xs px-3 py-1.5  ${tab === "forum" ? "bg-indigo-300/50" : "btnv2 "}`}
                aria-pressed={tab === "forum"}
              >
                Forum
              </button>
              <div className="h-6 border-l border-slate-400" />
              <DeliberateButton discussionId={discussion.id} defaultTitle={discussion.title} />
            </div>
          </div>
        </header>
 {/* Body */}
 {tab === "chat" ? (
          conversationId ? (
            me ? (
              <div className={isdemo 
                ? "rounded-2xl border-2 border-purple-400 bg-gradient-to-br from-purple-50/90 to-pink-50/90 px-4 py-3 shadow-lg" 
                : "glass-surface rounded-2xl panel-edge border bg-white/70 px-3 py-2"
              }>
                <div className="space-y-6 ">
                  <div className={isdemo 
                    ? "max-h-screen overflow-y-auto pl-3 pt-3 pr-2 custom-scrollbar" 
                    : "max-h-[70vh]  overflow-y-auto pl-2 pt-3 pr-2 pb-2 custom-scrollbar"
                  }>
                  {isdemo ? (
                    <ChatRoom
                      conversationId={conversationId}
                      currentUserId={me}
                      currentUserName={currentUserName}
                      currentUserImage={currentUserImage}
                      initialMessages={initialMessages}
                    />
                  ) : (
                    <ChatRoom
                      conversationId={conversationId}
                      currentUserId={me}
                      currentUserName={currentUserName}
                      currentUserImage={currentUserImage}
                      initialMessages={[]}
                    />
                  )}
                  </div>
                  <hr className="border-slate-400/60 " />
                  <MessageComposer
                    conversationId={String(conversationId)}
                    currentUserId={me}
                    currentUserName={currentUserName}
                    currentUserImage={currentUserImage}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border bg-white/70 p-4 text-sm text-slate-600">
                Sign in to view this chat.
              </div>
            )
          ) : (
            <div className="rounded-xl border bg-white/70 p-4 text-sm text-slate-600">
              This discussion has no chat yet.
            </div>
          )
        ) : (
          <div className="glass-surface rounded-2xl panel-edge border bg-white/70 p-3">
            <ForumPane
              discussionId={discussion.id}
              conversationId={conversationId}
              initialComments={initialForumComments}
            />
          </div>
        )}
      </div>
    </div>
  );
}

