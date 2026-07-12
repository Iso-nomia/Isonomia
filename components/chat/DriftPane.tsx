"use client";

import * as React from "react";
import Image from "next/image";
import { ChatMessage, ChatMessageContent, ChatMessageAvatar } from "@/components/ui/chat-message";
import { SheafMessageBubble } from "@/components/sheaf/SheafMessageBubble";
import { useChatStore } from "@/contexts/useChatStore";
import MessageComposer from "@/components/chat/MessageComposer";


function Attachment({ a }: { a: { id: string; path: string; type: string; size: number } }) {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/messages/attachments/${a.id}/sign`);
        if (r.ok) {
          const { url } = await r.json();
          if (!cancelled) setUrl(url);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [a.id]);
  if (!url) return null;
  if (a.type.startsWith("image/")) {
    return (
      <Image
        src={url}
        alt="attachment"
        width={256}
        height={256}
        className="rounded-md max-h-64 object-cover"
      />
    );
  }
  const name = a.path.split("/").pop();
  return (
    <a href={url} download={name || undefined} className="flex items-center gap-2 text-blue-600 underline">
      <span>📎</span>
      <span>{(a.size / 1024).toFixed(1)} KB</span>
    </a>
  );
}

export function DriftPane({
  drift,
  conversationId,
  currentUserId,
  onClose,
  variant = "drift",          // "drift" | "thread" | "proposal"
  align = "center",           // "start" | "end" | "center"
}: {
  drift: {
    id: string;
    title: string;
    isClosed: boolean;
    isArchived: boolean;
  };
  conversationId: string;
  currentUserId: string;
  onClose: () => void;
  variant?: "drift" | "thread" | "proposal";
  align?: "start" | "end" | "center";
}) {
    const EMPTY: any[] = React.useMemo(() => [], []);
  const msgs = useChatStore(
    React.useCallback((s) => s.driftMessages[drift.id] ?? EMPTY, [drift.id, EMPTY])
  );
    const setDriftMessages = useChatStore((s) => s.setDriftMessages);
    const fetchedForRef = React.useRef<string | null>(null);
    const listRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
      let aborted = false;
      (async () => {
        // 🔎 debug so you can correlate requests in FF vs Chrome
        console.log("[DriftPane] fetch", { driftId: drift.id, as: currentUserId });
    
        const r = await fetch(
          `/api/drifts/${encodeURIComponent(drift.id)}/messages?userId=${encodeURIComponent(
            currentUserId
          )}&_t=${Date.now()}`, // cache buster for FF/proxies
          { cache: "no-store", headers: { "cache-control": "no-store" } }
        );
    
        if (!r.ok) {
          console.warn("[DriftPane] fetch failed", r.status, await r.text().catch(() => ""));
          return;
        }
        const data = await r.json();
        if (!aborted && Array.isArray(data?.messages)) {
          const asc = [...data.messages].sort(
            (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          setDriftMessages(drift.id, asc);
          console.log("[DriftPane] fetched", drift.id, asc.length);
        }
      })().catch((e) => console.warn("[DriftPane] fetch error", e));
    
      return () => { aborted = true; };
      // ⬇️ run on mount/when drift id or viewer changes
    }, [drift.id, currentUserId, setDriftMessages]);


   // Auto-scroll: jump to bottom on open
   React.useEffect(() => {
     const el = listRef.current;
     if (!el) return;
     el.scrollTo({ top: el.scrollHeight });
   }, [drift.id]);
 
   // Auto-scroll: smooth scroll on new message
   React.useEffect(() => {
     const el = listRef.current;
     if (!el) return;
     el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
   }, [msgs.length]);

   // (optional) debug log when msgs update
   React.useEffect(() => {
     console.log("[DriftPane] rows", drift.id, msgs.length);
   }, [drift.id, msgs.length]);


  return (
    <div   className={[
      "my-2 w-full px-3",             // base
      variant === "thread" ? "max-w-[500px]" : "max-w-[690px]",
      align === "start" ? "mr-auto" : align === "end" ? "ml-auto" : "mx-auto",
      "rounded-xl border bg-white/50 backdrop-blur py-2 shadow-sm",
    ].join(" ")}>
      {/* Header */}
      <div className="flex items-center justify-between py-1">
        <div className="flex items-center gap-2">
        <span className="flex tracking-wide ">
            {variant === "proposal" ? "🪄" : "𒈝"} {drift.title}
          </span>
          {drift.isClosed && <span className="ml-1 text-xs rounded bg-slate-200 px-2 py-0.5">closed</span>}
          {drift.isArchived && <span className="ml-1 text-xs rounded bg-slate-200 px-2 py-0.5">archived</span>}
        </div>
        <button onClick={onClose} className="text-xs px-4 py-1 rounded-xl bg-white/50 sendbutton hover:bg-slate-50">
          Close
        </button>
      </div>

      <hr className="my-2 border-slate-400/60 border-[.1px]" />

      {/* Body */}
      {/* <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto px-1 py-1"> */}
      <div ref={listRef} className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto px-1 py-1">
        {msgs.map((m: any) => {
          const isMine = String(m.senderId) === String(currentUserId);
          const redacted = !!m.isRedacted;
          return (
            <ChatMessage key={m.id} id={m.id} type={isMine ? "outgoing" : "incoming"} variant="bubble">
              {!isMine && <ChatMessageAvatar imageSrc={m.sender?.image || "/assets/user-helsinki.svg"} />}
              {redacted ? (
                <ChatMessageContent content="(redacted)" className="opacity-70 italic" />
              ) : Array.isArray(m.facets) && m.facets.length > 0 ? (
                <SheafMessageBubble
                  messageId={m.id}
                  conversationId={conversationId}
                  currentUserId={currentUserId}
                  facets={m.facets}
                  defaultFacetId={m.defaultFacetId}
                />
              ) : (
                <ChatMessageContent content={m.text ?? ""} />
              )}
              {m.attachments?.length ? (
                <div className="mt-2 space-y-2">
                  {m.attachments.map((a: any) => (
                    <Attachment key={a.id} a={a} />
                  ))}
                </div>
              ) : null}
              {isMine && <ChatMessageAvatar imageSrc={m.sender?.image || "/assets/user-helsinki.svg"} />}
            </ChatMessage>
          );
        })}
      </div>

      {/* Composer */}
      <div className="mt-2 ">
        {/* Disabled when closed/archived */}
        <fieldset disabled={drift.isClosed || drift.isArchived} className="disabled:opacity-60">
          <div className=" sheaf-bubble  rounded-xl p-2 bg-white/50">
            <div className="mt-1">
              <MessageComposer
                conversationId={conversationId}
                currentUserId={currentUserId}
                driftId={drift.id}
              />
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  );
}

