// components/chat/ChatRoom.tsx
"use client";

import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseclient";
import type { DriftUI, Message, PollUI } from "@/contexts/useChatStore";
import { useChatStore } from "@/contexts/useChatStore";
import {
  ChatMessage,
  ChatMessageContent,
  ChatMessageAvatar,
} from "@/components/ui/chat-message";
import { SheafMessageBubble } from "@/components/sheaf/SheafMessageBubble";
import { usePrivateChatManager } from "@/contexts/PrivateChatManager";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { roomKey } from "@/lib/chat/roomKey";
import PollChip from "@/components/chat/PollChip";
// import QuickPollComposer from "@/components/chat/QuickPollComposer"; // (unused)
import type { PollStateDTO } from "@/types/poll";
// import { ReactionSummary } from "@/components/reactions/ReactionSummary"; // (unused)
/* import { ReactionBar } from "@/components/reactions/ReactionBar";
import { ReactionTrigger } from "@/components/reactions/ReactionTrigger"; */
import { DriftChip } from "@/components/chat/DriftChip";
import { DriftPane } from "@/components/chat/DriftPane";
import { QuoteBlock } from "@/components/chat/QuoteBlock";
import { LinkCard } from "@/components/chat/LinkCard";
import { useConversationRealtime } from "@/hooks/useConversationRealtime";
import { useStars } from "@/hooks/useStars";
import StarToggle from "@/components/chat/StarToggle";
import StarredFilterToggle from "@/components/chat/StarredFilterToggle";
import { useSearchParams } from "next/navigation";
import { useBookmarks } from "@/hooks/useBookmarks";
import ProposalsCompareModal from "@/components/proposals/ProposalsCompareModal";
import { useReceipts } from "@/hooks/useReceipts";
import ReceiptChip from "@/components/gitchat/ReceiptChip";
import { mutate as swrMutate } from "swr";

import { useDiscussionId } from "@/components/discussion/DiscussionContext";
import OpenInDiscussionsButton from "../common/OpenInDiscussionsButton";

const ENABLE_REACTIONS = false;
const scalesTextSymbol = "⚖\uFE0E";

type Props = {
  conversationId: string;
  currentUserId: string;
  initialMessages: Message[];
  highlightMessageId?: string | null;
  currentUserName?: string;
  currentUserImage?: string | null;
  onQuote?: (qr: { messageId: string; facetId?: string }) => void;
};

function excerpt(text?: string | null, len = 100) {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > len ? t.slice(0, len - 1) + "…" : t;
}

function textFromTipTap(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textFromTipTap).join("");
  if (typeof node === "object") {
    if (node.text) return String(node.text);
    if (Array.isArray(node.content))
      return node.content.map(textFromTipTap).join("");
    return textFromTipTap(node.content);
  }
  return "";
}
function toSnippet(raw: string, max = 48) {
  const s = raw.replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// Threshold in milliseconds to determine if messages should be grouped (5 minutes)
const MESSAGE_GROUP_TIME_THRESHOLD = 5 * 60 * 1000;

/**
 * Determines if a message should show the sender name/avatar.
 * Returns true if:
 * - It's the first message in the conversation
 * - The sender is different from the previous message
 * - More than MESSAGE_GROUP_TIME_THRESHOLD has passed since the previous message
 */
function shouldShowSenderInfo(
  currentMessage: Message,
  previousMessage: Message | null
): boolean {
  if (!previousMessage) return true;

  // Different sender
  if (currentMessage.senderId !== previousMessage.senderId) return true;

  // Time gap too large
  const currentTime = new Date(currentMessage.createdAt).getTime();
  const previousTime = new Date(previousMessage.createdAt).getTime();

  if (currentTime - previousTime > MESSAGE_GROUP_TIME_THRESHOLD) return true;

  return false;
}

/**
 * Determines spacing for a message based on grouping.
 * Returns appropriate margin-top class.
 */
function getMessageSpacing(showSenderInfo: boolean): string {
  // New message group (sender info shown)
  if (showSenderInfo) return "py-.5";

  // Same group, tight spacing
  return "mt-0";
}

function PromoteToForumMenuItem({ messageId }: { messageId: string | number }) {
  const discussionId = useDiscussionId();
  if (!discussionId) return null; // Only show inside a Discussion page
  return (
    <DropdownMenuItem
      onClick={async () => {
        const r = await fetch(
          `/api/discussions/${discussionId}/bridge/promote`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Idempotency-Key": `${discussionId}:${messageId}`,
            },
            body: JSON.stringify({ messageId }),
          }
        );
        if (!r.ok) {
          const t = await r.text().catch(() => r.statusText);
          console.warn("[promote] failed", t);
        }
      }}
    >
      Promote to forum
    </DropdownMenuItem>
  );
}

// --- Merge / Edit summary chip (expandable), safe hook usage ---
function MergeHistorySummary({
  messageId,
  isMine,
  edited,
}: {
  messageId: string;
  isMine: boolean;
  edited?: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  // Guard against invalid messageId (e.g., "undefined" from optimistic updates)
  const validMessageId = messageId && messageId !== "undefined" && messageId !== "null" ? messageId : null;
  const { list, latest, isLoading } = useReceipts(validMessageId);
  const hasReceipts = Array.isArray(list) && list.length > 0;
  const hasEditsOnly = !!edited && !hasReceipts;

  if (!hasReceipts && !hasEditsOnly) return null;

  // label summary (like your thread chip)
  const label = hasReceipts ? (
    `v${latest?.v ?? list.length} • merged ${new Date(
      (latest as any)?.mergedAt ?? (latest as any)?.merged_at ?? Date.now()
    ).toLocaleString()}`
  ) : (
    <div className=" mt-2">(edited)</div>
  );

  return (
    <div
      className={[
        "mx-[3%] px-3 mt-0 mb-0",
        isMine ? "text-right" : "text-left",
      ].join(" ")}
    >
      <button
        type="button"
        className={[
          "mt-1 text-[12px] transition-opacity",
          "text-slate-800 hover:underline hover:underline-offset-4",
        ].join(" ")}
        onClick={() => setOpen((o) => !o)}
        title={hasReceipts ? "Show merge history" : "Show edit info"}
      >
        <div className="flex inline-block gap-2 items-center">
          {isMine ? (
            <>
              <span className="text-[.8rem] inline-block  hover:underline hover:underline-offset-4">
                {label}
              </span>
              <div className=" mr-4 w-8 h-3 border-b-[1px] border-r-[1px] border-slate-600"></div>
            </>
          ) : (
            <>
              <div className=" ml-4 w-8 h-3 border-b-[1px] border-l-[1px] border-slate-600"></div>

              <span className="text-[.8rem] inline-block  hover:underline hover:underline-offset-4">
                {label}
              </span>
            </>
          )}
        </div>
      </button>

      {/* expanded panel */}
      {open && (
        <div
          className={[
            "mt-2 inline-block max-w-[92%] rounded-xl border bg-white/70 backdrop-blur px-3 py-2",
            isMine ? "text-right" : "text-left",
          ].join(" ")}
        >
          {isLoading ? (
            <div className="text-[12px] text-slate-600">Loading…</div>
          ) : hasReceipts ? (
            <div className="space-y-1 ">
              {/* show newest first */}
              {[...list]
                .reverse()
                .slice(0, 6)
                .map((r: any) => {
                  const mergedAt = r.mergedAt ?? r.merged_at;
                  const v = r.v ?? "(?)";
                  return (
                    <div
                      key={`${messageId}-v-${v}`}
                      className="text-[12px] text-slate-700"
                    >
                      <span className="mr-2 font-medium">v{v}</span>
                      <span className="mr-2 opacity-80">
                        {mergedAt ? new Date(mergedAt).toLocaleString() : ""}
                      </span>
                      <a
                        href={`/m/${encodeURIComponent(
                          messageId
                        )}/compare?v=${v}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        view
                      </a>
                    </div>
                  );
                })}
              {list.length > 6 && (
                <div className="text-[12px] text-slate-500">
                  … {list.length - 6} more
                </div>
              )}
            </div>
          ) : (
            <div className="text-[.75rem]">edited @</div>
          )}
        </div>
      )}
    </div>
  );
}

function ThreadSummary({
  threadEntry,
  messageId,
  isMine,
  onOpen,
}: {
  threadEntry?: DriftUI;
  messageId: string;
  isMine: boolean;
  onOpen: (driftId: string) => void;
}) {
  const count = Math.max(0, threadEntry?.drift?.messageCount ?? 0);
  const hasReplies = count > 0;
  return (
    <div
      className={[
        "mx-[3%] px-3 mt-0 mb-0",
        isMine ? "text-right" : "text-left",
      ].join(" ")}
    >
      <button
        type="button"
        className={[
          "mt-1 text-[12px] transition-opacity",
          hasReplies ? "text-slate-800 " : "hidden",
        ].join(" ")}
        onClick={() =>
          hasReplies && threadEntry && onOpen(threadEntry.drift.id)
        }
        title="Open thread"
      >
        <div className="flex inline-block gap-2">
          {isMine ? (
            <>
              <span className="text-[.8rem] inline-block mt-[5px] hover:underline hover:underline-offset-4">
                {count === 0
                  ? "reply"
                  : `${count} ${count === 1 ? "reply" : "replies"}`}
              </span>

              <div className=" mr-4 w-12 h-4 border-b-[1px] border-r-[1px] border-slate-600"></div>
            </>
          ) : (
            <>
              <div className=" ml-4 w-12 h-4 border-b-[1px] border-l-[1px] border-slate-600"></div>
              <span className="text-[.8rem] inline-block mt-[5px] hover:underline hover:underline-offset-4">
                {count === 0
                  ? "reply"
                  : `${count} ${count === 1 ? "reply" : "replies"}`}
              </span>
            </>
          )}
        </div>
      </button>
    </div>
  );
}

function Attachment({
  a,
}: {
  a: { id: string; path: string; type: string; size: number };
}) {
  const [url, setUrl] = useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function signWithRetry() {
      for (let i = 0; i < 4; i++) {
        try {
          const r = await fetch(`/api/messages/attachments/${a.id}/sign`);
          if (r.ok) {
            const { url } = await r.json();
            if (!cancelled) setUrl(url);
            return;
          } else {
            const txt = await r.text();
            console.warn(
              `[attachment] sign ${a.id} try ${i + 1} failed:`,
              r.status,
              txt
            );
          }
        } catch (e) {
          console.warn(
            `[attachment] sign ${a.id} network error try ${i + 1}`,
            e
          );
        }
        await new Promise((res) => setTimeout(res, 150 * (i + 1)));
      }
      if (!cancelled) setUrl(null);
    }
    signWithRetry();
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
    <a
      href={url}
      download={name || undefined}
      className="flex items-center gap-2 text-blue-600 underline"
    >
      <span>📎</span>
      <span>{(a.size / 1024).toFixed(1)} KB</span>
    </a>
  );
}

function ReceiptRow({
  messageId,
  isMine,
}: {
  messageId: string;
  isMine: boolean;
}) {
  const { latest } = useReceipts(messageId);
  if (!latest) return null;
  const mergedAt = (latest as any).mergedAt ?? (latest as any).merged_at;
  return (
    <div
      className={[
        "mt-1 text-[11px] text-slate-500 italic",
        isMine
          ? "text-right flex flex-col pr-3"
          : "text-left flex flex-col pl-3",
      ].join(" ")}
    >
      v{latest.v} merge at {mergedAt ? new Date(mergedAt).toLocaleString() : ""}{" "}
      <a
        className="underline"
        href={`/m/${encodeURIComponent(messageId)}/compare?v=${latest.v}`}
        target="_blank"
        rel="noreferrer"
      >
        View
      </a>
    </div>
  );
}

const MessageRow = memo(function MessageRow({
  m,
  currentUserId,
  conversationId,
  onOpen,
  onPrivateReply,
  onCreateOptions,
  onCreateTemp,
  onReplyInThread,
  onProposeAlternative,
  onCompareProposals,
  onMergeProposal,
  onDelete,
}: {
  m: Message;
  currentUserId: string;
  conversationId: string;
  onOpen: (peerId: string, peerName: string, peerImage?: string | null) => void;
  onPrivateReply?: (m: Message) => void;
  onCreateOptions: (m: Message) => void;
  onCreateTemp: (m: Message) => void;
  onReplyInThread: (messageId: string) => void; // NEW
  onProposeAlternative: (rootMessageId: string) => void;
  onCompareProposals: (rootMessageId: string) => void;
  onMergeProposal: (rootMessageId: string) => void;
  onDelete: (id: string) => void;
}) {
  const setQuoteDraft = useChatStore((s) => s.setQuoteDraft);
  const isMine = String(m.senderId) === String(currentUserId);
  const isRedacted = Boolean((m as any).isRedacted || (m as any).is_redacted);
  // ★ Stars
  const { isStarred, toggleStar } = useStars(conversationId);
  const starred = isStarred(m.id);
  // 🔖 Bookmarks
  const { isBookmarked, toggleBookmark, labelFor } =
    useBookmarks(conversationId);
  const bookmarked = isBookmarked(m.id);
  return (
    <ChatMessage
      type={isMine ? "outgoing" : "incoming"}
      id={m.id}
      variant="bubble"
      data-msg-id={m.id}
    >
      {!isMine && (
        <DropdownMenu>
          <DropdownMenuTrigger className="cursor-pointer">
            <ChatMessageAvatar
            variant="self"
              imageSrc={m.sender?.image || "/assets/user.svg"}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="flex mt-[-10px] ml-8 flex-col btnv2 bg-white/30 border-none backdrop-blur-xl rounded-xl max-w-[400px] py-2"
            align="start"
            sideOffset={0}
          >
            <DropdownMenuItem
              onClick={() =>
                onOpen(
                  String(m.senderId),
                  m.sender?.name ?? "User",
                  m.sender?.image ?? null
                )
              }
            >
              𒆿 Temporary Chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onPrivateReply?.(m)}>
              𒇆 Private Message
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {isRedacted ? (
        <div
          className={[
            "relative group w-full",
            isMine ? "flex justify-end" : "flex justify-start",
          ].join(" ")}
        >
          <ChatMessageContent
            content="(redacted)"
            className="opacity-70 italic"
          />
        </div>
      ) : Array.isArray(m.facets) && m.facets.length > 0 ? (
        <>
          <div
            className={[
              "relative group w-full",
              isMine ? "flex justify-end" : "flex justify-start",
            ].join(" ")}
          >
            <SheafMessageBubble
              messageId={m.id}
              conversationId={conversationId}
              currentUserId={currentUserId}
              facets={m.facets as any}
              defaultFacetId={m.defaultFacetId}
            />
            {(m as any).edited ? (
              <div
                className={[
                  "mt-1 text-[11px] text-slate-500 italic",
                  isMine ? "text-right" : "text-left",
                ].join(" ")}
              >
                (edited)
              </div>
            ) : null}

            {/* ✅ Receipt row lives OUTSIDE the bubble container */}
            <div
              className={
                isMine
                  ? "mt-1 w-full flex justify-end pr-3"
                  : "mt-1 w-full flex justify-start pl-3"
              }
            >
              <ReceiptRow messageId={String(m.id)} isMine={isMine} />
            </div>
            {/* Merge receipt chip (safe hook usage in child) */}

            <div
              className={[
                "absolute top-1 z-20 flex",
                isMine ? "-right-0" : "left-0",
                "invisible opacity-0 pointer-events-none",
                "group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto",
                "transition-opacity duration-150",
              ].join(" ")}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="py-0 px-0 bg-transparent align-center my-auto  rounded-md text-xs focus:outline-none"
                    title="Message actions"
                    type="button"
                  >
                    ᳀
                    {/* <Image
                      src="/assets/dot-mark.svg"
                      alt="actions"
                      width={32}
                      height={32}
                      className="cursor-pointer object-fill w-[10px]"
                    /> */}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align={isMine ? "end" : "start"}
                  sideOffset={6}
                  className="flex flex-col bg-white/50 border-none backdrop-blur-xl rounded-xl max-w-[400px] py-2"
                >
                  {isMine ? (
                    <>
                      <DropdownMenuItem
                        onClick={() => onProposeAlternative(m.id)}
                      >
                        ሗ New Fork
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onCompareProposals(m.id)}
                      >
                        𐂶 Compare Forks
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onMergeProposal(m.id)}>
                        ✓ Approve Merge
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => alert("Edit is coming soon.")}
                      >
                        ✎ Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onReplyInThread(m.id)}>
                        🧵 Reply
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => {
                          const facetId =
                            (m as any).defaultFacetId ??
                            (Array.isArray(m.facets) && m.facets[0]?.id) ??
                            undefined;
                          useChatStore
                            .getState()
                            .setQuoteDraft(conversationId, {
                              messageId: m.id,
                              facetId,
                            });
                        }}
                      >
                        ❝ Quote
                      </DropdownMenuItem>
                      <PromoteToForumMenuItem messageId={m.id} />
                      <DropdownMenuItem
                        onClick={() => {
                          if (bookmarked) {
                            // remove
                            toggleBookmark(m.id);
                          } else {
                            // prompt optional label on add
                            const label = (
                              typeof window !== "undefined"
                                ? window.prompt("Add a label (optional)", "")
                                : ""
                            )?.trim();
                            toggleBookmark(m.id, {
                              label: label ? label : null,
                            });
                          }
                        }}
                      >
                        {bookmarked ? "⛉ Remove Bookmark" : "⛉ Bookmark…"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleStar(m.id)}>
                        {starred ? "★ Unstar" : "☆ Star"}
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => onDelete(m.id)}
                      >
                        ⛝ Delete
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem
                        onClick={() => {
                          const facetId =
                            (m as any).defaultFacetId ??
                            (Array.isArray(m.facets) && m.facets[0]?.id) ??
                            undefined;
                          useChatStore
                            .getState()
                            .setQuoteDraft(conversationId, {
                              messageId: m.id,
                              facetId,
                            });
                        }}
                      >
                        ❝ Quote
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onProposeAlternative(m.id)}
                      >
                        ሗ New Fork
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onCompareProposals(m.id)}
                      >
                        𐂶 Compare Forks
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onPrivateReply?.(m)}>
                        {"↪\uFE0E"} Reply in DMs
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onReplyInThread(m.id)}>
                        ⏚ Thread Reply
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          if (bookmarked) {
                            toggleBookmark(m.id);
                          } else {
                            const label = (
                              typeof window !== "undefined"
                                ? window.prompt("Add a label (optional)", "")
                                : ""
                            )?.trim();
                            toggleBookmark(m.id, {
                              label: label ? label : null,
                            });
                          }
                        }}
                      >
                        {bookmarked ? "⛉ Remove Bookmark" : "⛉ Bookmark…"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleStar(m.id)}>
                        {starred ? "★ Unstar" : "☆ Star"}
                      </DropdownMenuItem>
                      <PromoteToForumMenuItem messageId={m.id} />
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </>
      ) : (
        <>
          <div
            className={[
              "relative  group w-full",
              isMine ? "flex justify-end" : "flex justify-start",
            ].join(" ")}
          >
            {/* Button before content for outgoing messages */}
            {isMine && (
              <div
                className={[
                  "relative mx-3 z-20 flex",
                  "invisible opacity-0 pointer-events-none",
                  "group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto",
                  "transition-opacity duration-150",
                ].join(" ")}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="btnv2--sunset align-center  my-auto rounded-full text-[12px] p-3 w-fit h-fit 
                      hover:bg-rose-100/50 focus:outline-none "
                      title="Message actions"
                      type="button"
                    ></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align={isMine ? "end" : "start"}
                    sideOffset={6}
                    className="flex flex-col bg-white/30 btnv2--sunset border border-rose-300 backdrop-blur-md rounded-xl max-w-[400px] py-2"
                  >
                    {isMine ? (
                      <>
                        <DropdownMenuItem
                          variant="sunset"
                          onClick={() => onProposeAlternative(m.id)}
                        >
                          ሗ New Fork
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="sunset"
                          onClick={() => onCompareProposals(m.id)}
                        >
                          𐂶 Compare Forks
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          variant="sunset"
                          onClick={() => onMergeProposal(m.id)}
                        >
                          ✓ Approve Merge
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="sunset"
                          onClick={() => onReplyInThread(m.id)}
                        >
                          ⏚ Thread Reply
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="sunset"
                          onClick={() => {
                            if (bookmarked) {
                              toggleBookmark(m.id);
                            } else {
                              const label = (
                                typeof window !== "undefined"
                                  ? window.prompt("Add a label (optional)", "")
                                  : ""
                              )?.trim();
                              toggleBookmark(m.id, {
                                label: label ? label : null,
                              });
                            }
                          }}
                        >
                          {bookmarked ? "⛉ Remove Bookmark" : "⛉ Bookmark"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="sunset"
                          onClick={() => {
                            const facetId =
                              (m as any).defaultFacetId ??
                              (Array.isArray(m.facets) && m.facets[0]?.id) ??
                              undefined;
                            useChatStore
                              .getState()
                              .setQuoteDraft(conversationId, {
                                messageId: m.id,
                                facetId,
                              });
                          }}
                        >
                          ❝ Quote
                        </DropdownMenuItem>
                        <DropdownMenuItem
                                                variant="sunset"

                          onClick={() => alert("Edit is coming soon.")}
                        >
                          ✎ Edit
                        </DropdownMenuItem>
                        <PromoteToForumMenuItem messageId={m.id} />

                        <DropdownMenuItem
                          variant="sunset"
                          onClick={() => toggleStar(m.id)}
                        >
                          {starred ? "★ Unstar" : "☆ Star"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                                                  variant="sunset"

                          className="text-red-600"
                          onClick={() => onDelete(m.id)}
                        >
                          ⛝ Delete
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuItem
                          variant="blue"
                          onClick={() => onProposeAlternative(m.id)}
                        >
                          ⇵ Propose Alternative
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="blue"
                          onClick={() => onCompareProposals(m.id)}
                        >
                          𓐒 Compare Proposals
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          variant="blue"
                          onClick={() => onReplyInThread(m.id)}
                        >
                          ⏚ Create Reply Thread
                        </DropdownMenuItem>
                        <PromoteToForumMenuItem messageId={m.id} />

                        <DropdownMenuItem
                          variant="blue"
                          onClick={() => onPrivateReply?.(m)}
                        >
                          {"↪\uFE0E"} Reply in DMs
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="blue"
                          onClick={() => {
                            if (bookmarked) {
                              toggleBookmark(m.id);
                            } else {
                              const label = (
                                typeof window !== "undefined"
                                  ? window.prompt("Add a label (optional)", "")
                                  : ""
                              )?.trim();
                              toggleBookmark(m.id, {
                                label: label ? label : null,
                              });
                            }
                          }}
                        >
                          {bookmarked ? "⛉ Remove Bookmark" : "⛉ Bookmark"}
                        </DropdownMenuItem>

                        <DropdownMenuItem
                        variant="blue"
                          onClick={() => {
                            const facetId =
                              (m as any).defaultFacetId ??
                              (Array.isArray(m.facets) && m.facets[0]?.id) ??
                              undefined;
                            useChatStore
                              .getState()
                              .setQuoteDraft(conversationId, {
                                messageId: m.id,
                                facetId,
                              });
                          }}
                        >
                          ❝ Quote
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="blue"
                          onClick={() => toggleStar(m.id)}
                        >
                          {starred ? "★ Unstar" : "☆ Star"}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {m.text ? (
              <ChatMessageContent content={m.text} />
            ) : (
              <ChatMessageContent content="" className="min-h-6" />
            )}

            {/* Button after content for incoming messages */}
            {!isMine && (
              <div
                className={[
                  "relative mx-3 z-20 flex",
                  "invisible opacity-0 pointer-events-none",
                  "group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto",
                  "transition-opacity duration-150",
                ].join(" ")}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>

                    <button
                      className="btnv2 align-center my-auto rounded-full text-[12px] p-3 w-fit h-fit hover:bg-indigo-100/50 focus:outline-none  "
                      title="Message actions"
                      type="button"
                    ></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={6}
                    className="flex flex-col bg-white/30 btnv2 border border-indigo-300 backdrop-blur-md rounded-xl max-w-[400px] py-2"
                  >
                    <>
                      <DropdownMenuItem
                                              variant="blue"

                        onClick={() => onProposeAlternative(m.id)}
                      >
                        ⇵ Propose Alternative
                      </DropdownMenuItem>
                      <DropdownMenuItem
                                              variant="blue"

                        onClick={() => onCompareProposals(m.id)}
                      >
                        𓐒 Compare Proposals
                      </DropdownMenuItem>

                      <DropdownMenuItem 
                                              variant="blue"

                      onClick={() => onReplyInThread(m.id)}>
                        ⏚ Create Reply Thread
                      </DropdownMenuItem>
                      <PromoteToForumMenuItem messageId={m.id} />

                      <DropdownMenuItem 
                                              variant="blue"

                      onClick={() => onPrivateReply?.(m)}>
                        {"↪\uFE0E"} Reply in DMs
                      </DropdownMenuItem>
                      <DropdownMenuItem
                                              variant="blue"

                        onClick={() => {
                          if (bookmarked) {
                            toggleBookmark(m.id);
                          } else {
                            const label = (
                              typeof window !== "undefined"
                                ? window.prompt("Add a label (optional)", "")
                                : ""
                            )?.trim();
                            toggleBookmark(m.id, {
                              label: label ? label : null,
                            });
                          }
                        }}
                      >
                        {bookmarked ? "⛉ Remove Bookmark" : "⛉ Bookmark"}
                      </DropdownMenuItem>

                      <DropdownMenuItem
                                              variant="blue"

                        onClick={() => {
                          const facetId =
                            (m as any).defaultFacetId ??
                            (Array.isArray(m.facets) && m.facets[0]?.id) ??
                            undefined;
                          useChatStore
                            .getState()
                            .setQuoteDraft(conversationId, {
                              messageId: m.id,
                              facetId,
                            });
                        }}
                      >
                        ❝ Quote
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                                              variant="blue"

                      onClick={() => toggleStar(m.id)}>
                        {starred ? "★ Unstar" : "☆ Star"}
                      </DropdownMenuItem>
                    </>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </>
      )}

      {isMine && (
        <ChatMessageAvatar  imageSrc={m.sender?.image || "/assets/user.svg"} />
      )}
    </ChatMessage>
  );
});

export default function ChatRoom({
  conversationId,
  currentUserId,
  initialMessages,
  highlightMessageId,
  currentUserName = "",
  currentUserImage = null,
}: Props) {
  const { open, state } = usePrivateChatManager();

  const driftsByAnchorId = useChatStore((s) => s.driftsByAnchorId);
  const driftsByRoot = useChatStore((s) => s.driftsByRootMessageId);
  const setDrifts = useChatStore((s) => s.setDrifts);
  const upsertDrift = useChatStore((s) => s.upsertDrift);
  const setDriftMessages = useChatStore((s) => s.setDriftMessages);
  const appendDriftMessage = useChatStore((s) => s.appendDriftMessage);
  const [compareFor, setCompareFor] = useState<string | null>(null);

  const [openDrifts, setOpenDrifts] = useState<Record<string, boolean>>({});
  const openDrift = React.useCallback(
    (driftId: string) => {
      setOpenDrifts((prev) => ({ ...prev, [driftId]: true }));
      // fire-and-forget refresh (debounced naturally by user behavior)
      fetch(
        `/api/drifts/${encodeURIComponent(
          driftId
        )}/messages?userId=${encodeURIComponent(
          currentUserId
        )}&_t=${Date.now()}`,
        { cache: "no-store" }
      )
        .then((r) => (r.ok ? r.json() : null))
        .then(
          (d) =>
            Array.isArray(d?.messages) &&
            useChatStore.getState().setDriftMessages(driftId, d.messages)
        )
        .catch(() => {});
    },
    [currentUserId]
  );

  const closeDrift = React.useCallback(
    (driftId: string) => setOpenDrifts((p) => ({ ...p, [driftId]: false })),
    []
  );

  const handleOpen = useCallback(
    (peerId: string, peerName: string, peerImage?: string | null) => {
      const rid = roomKey(conversationId, currentUserId, peerId);
      open(peerId, peerName, conversationId, {
        roomId: rid,
        peerImage: peerImage ?? null,
      });
    },
    [open, conversationId, currentUserId]
  );

  const allMessages = useChatStore((s) => s.messages);
  const messages = React.useMemo(
    () => allMessages[conversationId] ?? [],
    [allMessages, conversationId]
  );
  const setMessages = useChatStore((s) => s.setMessages);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const pollsByMessageId = useChatStore((s) => s.pollsByMessageId);
  const upsertPoll = useChatStore((s) => s.upsertPoll);
  const applyPollState = useChatStore((s) => s.applyPollState);
  const setMyVote = useChatStore((s) => s.setMyVote);

  const { online, typing } = useConversationRealtime(conversationId, {
    id: String(currentUserId),
    name: currentUserName,
    image: currentUserImage,
  });

  const [readers, setReaders] = useState<
    { userId: string; lastReadAt: string }[]
  >([]);
  const chRef = useRef<any>(null);

  const lastReadSentAtRef = useRef(0);
  const markRead = useCallback((convId: string) => {
    const now = Date.now();
    if (now - lastReadSentAtRef.current < 1500) return;
    lastReadSentAtRef.current = now;
    fetch(`/api/conversations/${encodeURIComponent(convId)}/read`, {
      method: "POST",
    }).catch(() => {});
  }, []);

  const lastMsg = messages[messages.length - 1];

  const othersTypingIds = React.useMemo(
    () =>
      Object.keys(typing || {}).filter((uid) => uid !== String(currentUserId)),
    [typing, currentUserId]
  );

  const getTypingName = useCallback(
    (uid: string) => {
      const nameFromTyping = (typing as any)?.[uid]?.name;
      if (nameFromTyping && nameFromTyping.trim()) return nameFromTyping;
      const nameFromOnline = (online as any)?.[uid]?.name;
      if (nameFromOnline && nameFromOnline.trim()) return nameFromOnline;
      const msg = messages.find((mm) => String(mm.senderId) === String(uid));
      const nameFromMsg = msg?.sender?.name;
      if (nameFromMsg && nameFromMsg.trim()) return nameFromMsg;
      return "Someone";
    },
    [typing, online, messages]
  );
  // ↓ anchor & state
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [showScrollDownDelayed, setShowScrollDownDelayed] = useState(false);

  // fade-in delay
  useEffect(() => {
    let t: any;
    if (showScrollDown) {
      t = setTimeout(() => setShowScrollDownDelayed(true), 500);
    } else {
      setShowScrollDownDelayed(false);
    }
    return () => t && clearTimeout(t);
  }, [showScrollDown]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, []);

  // Find nearest scroll container for [data-chat-root] (or fall back to window)
  function getScrollContainer(node: HTMLElement | null): HTMLElement | null {
    let n: HTMLElement | null = node;
    while (n) {
      const style = getComputedStyle(n);
      const oy = style.overflowY;
      if (oy === "auto" || oy === "scroll") return n;
      n = n.parentElement;
    }
    return null;
  }
  // IntersectionObserver on the bottom anchor, but with the right root
  useEffect(() => {
    const sentinel = bottomRef.current;
    if (!sentinel) return;

    const rootEl = document.querySelector(
      "[data-chat-root]"
    ) as HTMLElement | null;
    const scroller = getScrollContainer(rootEl) || null;

    const io = new IntersectionObserver(
      (entries) => {
        const inView = entries.some((e) => e.isIntersecting);
        setShowScrollDown(!inView);
      },
      {
        root: scroller, // if null, uses viewport
        threshold: 0.01,
        rootMargin: "0px 0px -15% 0px", // treat “near bottom” as visible
      }
    );

    io.observe(sentinel);
    return () => io.disconnect();
  }, [messages.length]); // rerun when list size changes

  // Scroll/resize fallback for environments where IO is finicky
  useEffect(() => {
    const rootEl = document.querySelector(
      "[data-chat-root]"
    ) as HTMLElement | null;
    const scroller = getScrollContainer(rootEl);
    const target: any = scroller || window;

    const getMetrics = () => {
      if (scroller) {
        const gap =
          scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
        setShowScrollDown(gap > 160);
      } else {
        const doc = document.scrollingElement || document.documentElement;
        const gap = doc.scrollHeight - doc.clientHeight - doc.scrollTop;
        setShowScrollDown(gap > 160);
      }
    };

    getMetrics();
    target.addEventListener("scroll", getMetrics, { passive: true });
    window.addEventListener("resize", getMetrics);
    return () => {
      target.removeEventListener("scroll", getMetrics);
      window.removeEventListener("resize", getMetrics);
    };
  }, [messages.length]);
  const appendRef = useRef(appendMessage);
  useEffect(() => {
    appendRef.current = appendMessage;
  }, [appendMessage]);

  const markAsRedacted = useCallback(
    (mid: string) => {
      const list = useChatStore.getState().messages[conversationId] ?? [];
      setMessages(
        conversationId,
        list.map((row) =>
          String(row.id) === String(mid)
            ? {
                ...row,
                isRedacted: true,
                is_redacted: true,
                text: null,
                attachments: [],
                facets: [],
              }
            : row
        )
      );
    },
    [conversationId, setMessages]
  );

  const handleDelete = useCallback(
    async (mid: string) => {
      markAsRedacted(mid);
      try {
        const res = await fetch(
          `/api/messages/item/${encodeURIComponent(mid)}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error(await res.text());
      } catch (e) {
        console.warn("[delete] failed; consider refetch or revert", e);
      }
    },
    [markAsRedacted]
  );

  const initRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);
  const driftsListHydratedRef = useRef(false);

  useEffect(() => {
    if (initRef.current === conversationId) return;
    setMessages(conversationId, initialMessages);
    initRef.current = conversationId;
  }, [conversationId, setMessages, initialMessages]);

  useEffect(() => {
    if (hydratedRef.current) return;
    const list = allMessages[conversationId] ?? [];
    if (!list.length) return;
    hydratedRef.current = true;
    const ids = list.map((m) => m.id);

    fetch("/api/polls/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageIds: ids }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.items)) {
          data.items.forEach((it: any) => upsertPoll(it.poll, it.state, it.my));
        }
      })
      .catch((e) => console.warn("[polls] hydrate failed:", e));
  }, [allMessages, conversationId, upsertPoll]);

  const reactionsHydratedKeyRef = useRef<string>("");
  useEffect(() => {
    if (!ENABLE_REACTIONS) return;
    const idsKey = messages.map((m) => m.id).join(",");
    if (!idsKey || idsKey === reactionsHydratedKeyRef.current) return;
    reactionsHydratedKeyRef.current = idsKey;

    const setReactionsNow = useChatStore.getState().setReactions;
    fetch(
      `/api/reactions?userId=${encodeURIComponent(
        currentUserId
      )}&messageIds=${encodeURIComponent(idsKey)}`,
      { cache: "no-store" }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.items) return;
        data.items.forEach((row: { messageId: string; reactions: any[] }) => {
          setReactionsNow(row.messageId, row.reactions);
        });
      })
      .catch((e) => console.warn("[reactions] hydrate failed:", e));
  }, [messages, currentUserId]);

  const hydratedAnchorIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const unseen = messages
      .filter((m) => (m as any).meta?.kind === "DRIFT_ANCHOR")
      .map((m) => m.id)
      .filter(
        (id) => !driftsByAnchorId[id] && !hydratedAnchorIdsRef.current.has(id)
      );

    if (unseen.length === 0) return;

    unseen.forEach((id) => hydratedAnchorIdsRef.current.add(id));

    fetch("/api/drifts/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anchorMessageIds: unseen }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.ok || !Array.isArray(data.items)) return;
        setDrifts(
          data.items.map((it: any) => ({ drift: it.drift, my: it.my }))
        );
      })
      .catch((e) => console.warn("[drifts] hydrate failed:", e));
  }, [messages, driftsByAnchorId, setDrifts]);

  useEffect(() => {
    if (driftsListHydratedRef.current) return;
    driftsListHydratedRef.current = true;

    fetch(
      `/api/drifts/list?conversationId=${encodeURIComponent(conversationId)}`,
      { cache: "no-store" }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.ok || !Array.isArray(data.items)) return;
        setDrifts(
          data.items.map((it: any) => ({ drift: it.drift, my: it.my }))
        );
      })
      .catch((e) => console.warn("[drifts] list hydrate failed:", e));
  }, [conversationId, setDrifts]);

  // 👉 Debug effect: log drifts after reload
  useEffect(() => {
    fetch(
      `/api/drifts/list?conversationId=${encodeURIComponent(conversationId)}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((d) =>
        console.log(
          "[drifts/list]",
          d.items.map((x: any) => x.drift)
        )
      )
      .catch((e) => console.warn("[drifts/list] debug failed:", e));
  }, [conversationId]);

  useEffect(() => {
    const root = document.querySelector("[data-chat-root]");
    if (!root) return;

    const nodes = root.querySelectorAll("[data-msg-id]");
    const last = nodes[nodes.length - 1] as HTMLElement | null;
    if (!last) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && document.visibilityState === "visible") {
            markRead(conversationId);
          }
        }
      },
      { root: null, threshold: 0.8 }
    );

    io.observe(last);
    return () => io.disconnect();
  }, [conversationId, messages.length, markRead]);

  useEffect(() => {
    const onFocus = () => markRead(conversationId);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [conversationId, markRead]);

  useEffect(() => {
    if (!lastMsg) return;
    fetch(`/api/conversations/${encodeURIComponent(conversationId)}/readers`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.items) setReaders(data.items);
      })
      .catch(() => {});
  }, [conversationId, lastMsg?.id]);

  // Keep a ref mirror of openDrifts for handlers
  const openDriftsRef = useRef(openDrifts);
  useEffect(() => {
    openDriftsRef.current = openDrifts;
  }, [openDrifts]);

  // Helper: unwrap payloads sometimes wrapped as { payload: {...} }
  function unwrap<T extends object>(raw: any): any {
    if (!raw) return null;
    if (typeof raw === "object" && ("poll" in raw || "pollId" in raw))
      return raw;
    if (typeof raw === "object" && "payload" in raw)
      return (raw as any).payload;
    return raw;
  }

  // === REALTIME CHANNEL EFFECT ===
  useEffect(() => {
    const topic = `conversation-${conversationId}`;
    const channel = supabase.channel(topic, {
      config: { broadcast: { self: true } },
    });
    chRef.current = channel;

    const msgHandler = ({ payload }: any) => {
      const mid = String(payload?.id ?? payload?.message?.id ?? "");
      const payloadDriftId = String(
        payload?.driftId ?? payload?.message?.driftId ?? ""
      );
      const from = String(
        payload?.senderId ?? payload?.message?.senderId ?? ""
      );
      console.log("[rt] new_message payload", { mid, payloadDriftId, from });
      if (!mid) {
        appendRef.current(conversationId, payload as any);
        return;
      }

      fetch(
        `/api/sheaf/messages?userId=${encodeURIComponent(
          currentUserId
        )}&messageId=${encodeURIComponent(mid)}`
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const hydrated = data?.messages?.[0] ?? data?.message ?? null;
          const hydratedDriftId = hydrated?.driftId
            ? String(hydrated.driftId)
            : "";
          const driftKey = hydratedDriftId || payloadDriftId || "";
          console.log("[rt] hydrated", mid, {
            hydratedDriftId,
            payloadDriftId,
          });
          if (hydrated) {
            if (driftKey) appendDriftMessage(driftKey, hydrated);
            else appendRef.current(conversationId, hydrated);
            return;
          }
          if (payloadDriftId) {
            appendDriftMessage(payloadDriftId, {
              id: mid,
              text: payload?.text ?? null,
              createdAt: payload?.createdAt ?? new Date().toISOString(),
              senderId: from,
              driftId: payloadDriftId,
              sender: payload?.sender ?? undefined,
              attachments: Array.isArray(payload?.attachments)
                ? payload.attachments
                : [],
            });
          } else {
            appendRef.current(conversationId, payload as any);
          }
        })
        .catch(() => {
          if (payloadDriftId) {
            appendDriftMessage(payloadDriftId, {
              id: mid,
              text: payload?.text ?? null,
              createdAt: payload?.createdAt ?? new Date().toISOString(),
              senderId: from,
              driftId: payloadDriftId,
              sender: payload?.sender ?? undefined,
              attachments: Array.isArray(payload?.attachments)
                ? payload.attachments
                : [],
            });
          } else {
            appendRef.current(conversationId, payload as any);
          }
        });
    };

    const linkPreviewHandler = async ({ payload }: any) => {
      const mid = String(payload?.messageId ?? "");
      if (!mid) return;
      try {
        const r = await fetch(
          `/api/sheaf/messages?userId=${encodeURIComponent(
            currentUserId
          )}&messageId=${encodeURIComponent(mid)}`,
          { cache: "no-store" }
        );
        const data = await r.json();
        const hydrated = data?.messages?.[0] ?? data?.message ?? null;
        if (!hydrated) return;

        // Replace where it lives (main or drift) — requires store helper
        useChatStore
          .getState()
          .replaceMessageInConversation(conversationId, hydrated);
      } catch {}
    };

    const pollCreateHandler = ({ payload }: any) => {
      const data = unwrap(payload);
      if (!data?.poll) {
        console.warn("[polls] poll_create missing poll:", payload);
        return;
      }
      upsertPoll(data.poll, data.state ?? null, data.my ?? null);
    };

    const pollStateHandler = ({ payload }: any) => {
      const data = unwrap(payload);
      if (!data) return;
      applyPollState(data as PollStateDTO);
    };

    const applyReactionDeltaNow = (
      messageId: string,
      emoji: string,
      op: "add" | "remove",
      byMe: boolean
    ) => useChatStore.getState().applyReactionDelta(messageId, emoji, op, byMe);

    const reactionAdd = ({ payload }: any) => {
      const { messageId, emoji, userId } = payload || {};
      if (!messageId || !emoji) return;
      applyReactionDeltaNow(
        messageId,
        emoji,
        "add",
        String(userId) === String(currentUserId)
      );
    };

    const reactionRemove = ({ payload }: any) => {
      const { messageId, emoji, userId } = payload || {};
      if (!messageId || !emoji) return;
      applyReactionDeltaNow(
        messageId,
        emoji,
        "remove",
        String(userId) === String(currentUserId)
      );
    };

    const driftCreateHandler = ({ payload }: any) => {
      const { anchor, drift } = payload || {};
      if (!drift) return;
      if (anchor) appendRef.current(conversationId, anchor); // only classic drifts have anchors
      setDrifts([
        {
          drift,
          my: {
            collapsed: true,
            pinned: false,
            muted: false,
            lastReadAt: null,
          },
        },
      ]);
    };

    const driftCountersHandler = ({ payload }: any) => {
      const { driftId, messageCount, lastMessageAt } = payload || {};
      if (!driftId) return;
      useChatStore
        .getState()
        .updateDriftCounters?.(driftId, { messageCount, lastMessageAt });

      const have = (useChatStore.getState().driftMessages[driftId] ?? [])
        .length;
      const paneOpen = !!openDriftsRef.current?.[driftId];

      if (paneOpen || have < (messageCount ?? 0)) {
        fetch(
          `/api/drifts/${encodeURIComponent(
            driftId
          )}/messages?userId=${encodeURIComponent(currentUserId)}`,
          { cache: "no-store" }
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (Array.isArray(d?.messages)) {
              useChatStore.getState().setDriftMessages(driftId, d.messages);
            }
          })
          .catch(() => {});
      }
    };

    const redactedHandler = ({ payload }: any) => {
      const mid = String(payload?.id ?? payload?.messageId ?? "");
      if (!mid) return;
      markAsRedacted(mid);
    };

    const readHandler = ({ payload }: any) => {
      const { userId, ts } = payload || {};
      if (!userId || !ts) return;
      setReaders((prev) => {
        const i = prev.findIndex((p) => p.userId === String(userId));
        if (i >= 0) {
          const next = prev.slice();
          next[i] = { userId: String(userId), lastReadAt: ts };
          return next;
        }
        return [...prev, { userId: String(userId), lastReadAt: ts }];
      });
    };

    // --- Refresh merged message   invalidate SWR keys on merge ---
    const proposalMergeHandler = ({ payload }: any) => {
      const rootId = String(payload?.rootMessageId ?? payload?.messageId ?? "");
      const versionHash = String(payload?.versionHash ?? "");
      if (!rootId) return;

      fetch(
        `/api/sheaf/messages?userId=${encodeURIComponent(
          currentUserId
        )}&messageId=${encodeURIComponent(rootId)}`,
        { cache: "no-store" }
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const hydrated = data?.messages?.[0] ?? data?.message ?? null;
          if (hydrated) {
            useChatStore
              .getState()
              .replaceMessageInConversation(conversationId, hydrated);
          }
        })
        .catch(() => {});

      // SWR invalidations: receipts chip   candidates   counts
      swrMutate(
        `/api/messages/${encodeURIComponent(rootId)}/receipts?latest=1`
      );
      swrMutate(
        `/api/proposals/candidates?rootMessageId=${encodeURIComponent(rootId)}`
      );
      swrMutate(
        `/api/proposals/list?rootMessageId=${encodeURIComponent(rootId)}`
      );

      console.log("[rt] proposal_merge received", { rootId, versionHash });
    };

    // --- Refresh proposal counts/candidates when someone approves/blocks ---
    const proposalSignalHandler = ({ payload }: any) => {
      const rootId = String(payload?.rootMessageId ?? "");
      if (!rootId) return;
      swrMutate(
        `/api/proposals/list?rootMessageId=${encodeURIComponent(rootId)}`
      );
      swrMutate(
        `/api/proposals/candidates?rootMessageId=${encodeURIComponent(rootId)}`
      );
      console.log("[rt] proposal_signal refresh", {
        rootId,
        facetId: payload?.facetId,
        kind: payload?.kind,
      });
    };

    channel.on("broadcast", { event: "new_message" }, msgHandler);
    channel.on(
      "broadcast",
      { event: "link_preview_update" },
      linkPreviewHandler
    );
    channel.on("broadcast", { event: "poll_create" }, pollCreateHandler);
    channel.on("broadcast", { event: "poll_state" }, pollStateHandler);
    channel.on("broadcast", { event: "drift_create" }, driftCreateHandler);
    channel.on("broadcast", { event: "drift_counters" }, driftCountersHandler);
    channel.on("broadcast", { event: "message_redacted" }, redactedHandler);
    channel.on("broadcast", { event: "read" }, readHandler);
    channel.on("broadcast", { event: "proposal_merge" }, proposalMergeHandler); // ← added
    channel.on(
      "broadcast",
      { event: "proposal_signal" },
      proposalSignalHandler
    );

    let pingTimer: any = null;
    channel.on("broadcast", { event: "debug_ping" }, () => {});
    console.log(`[rt:${topic}] subscribing`);
    channel.subscribe((status) => {
      console.log(`[rt:${topic}] status`, status);
      if (status === "SUBSCRIBED") {
        channel.send({
          type: "broadcast",
          event: "debug_ping",
          payload: { from: "ChatRoom", at: Date.now() },
        });
        pingTimer = setInterval(() => {
          channel.send({
            type: "broadcast",
            event: "debug_ping",
            payload: { from: "ChatRoom/heartbeat", at: Date.now() },
          });
        }, 15000);
      }
    });

    return () => {
      console.log(`[rt:${topic}] cleanup`);
      if (pingTimer) clearInterval(pingTimer);
      chRef.current = null;
      try {
        channel.unsubscribe?.();
      } catch {}
      supabase.removeChannel?.(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, currentUserId]);

  // Voting handlers
  const onCreateOptions = useCallback((_m: Message) => {}, []);
  const onCreateTemp = useCallback(async (_m: Message) => {}, []);

  const onVote = useCallback(
    async (poll: PollUI, body: any) => {
      const { state } = await fetch(`/api/polls/${poll.poll.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: poll.kind, ...body }),
      }).then((r) => r.json());
      applyPollState(state);
      if (poll.kind === "OPTIONS") {
        setMyVote({
          kind: "OPTIONS",
          pollId: poll.poll.id,
          optionIdx: body.optionIdx,
        });
      } else {
        setMyVote({ kind: "TEMP", pollId: poll.poll.id, value: body.value });
      }
      chRef.current?.send({
        type: "broadcast",
        event: "poll_state",
        payload: state,
      });
    },
    [applyPollState, setMyVote, conversationId]
  );

  // Ensure thread drift and open its pane
  const ensureAndOpenThread = useCallback(
    async (rootMessageId: string) => {
      const have = useChatStore.getState().driftsByRootMessageId[rootMessageId];
      if (have?.drift?.id) {
        setOpenDrifts((prev) => ({ ...prev, [have.drift.id]: true }));
        return;
      }
      const r = await fetch("/api/threads/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootMessageId }),
      });
      const data = await r.json();
      if (!r.ok || !data?.drift) {
        console.warn("[thread] ensure failed:", data);
        alert(data?.error ?? "Failed to start thread");
        return;
      }
      upsertDrift({
        drift: data.drift,
        my: { collapsed: false, pinned: false, muted: false, lastReadAt: null },
      });
      setOpenDrifts((prev) => ({ ...prev, [data.drift.id]: true }));
    },
    [upsertDrift]
  );

  // Proposals: ensure and open
  const ensureAndOpenProposal = useCallback(
    async (rootMessageId: string) => {
      try {
        const r = await fetch("/api/proposals/ensure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rootMessageId }),
        });
        // Parse JSON safely even on non-2xx
        const raw = await r.text();
        let data: any = null;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch {}
        if (!r.ok || !data?.drift?.id) {
          console.warn("[proposal/ensure] server said:", raw);
          alert(data?.error || raw || "Failed to start proposal");
          return;
        }
        // Place into store with all required fields so UI can render immediately
        upsertDrift({
          drift: {
            id: data.drift.id,
            conversationId: data.drift.conversationId ?? String(conversationId),
            title: data.drift.title || "Proposal",
            isClosed: Boolean(data.drift.isClosed),
            isArchived: Boolean(data.drift.isArchived),
            messageCount: Number(data.drift.messageCount ?? 0),
            lastMessageAt: data.drift.lastMessageAt ?? null,
            // IMPORTANT: proposals are rooted, not anchored
            rootMessageId: data.drift.rootMessageId ?? rootMessageId,
            // Force them down the thread rendering path; variant will relabel it as a proposal
            kind: "THREAD",
            // DO NOT set anchorMessageId here
          },
          my: {
            collapsed: false,
            pinned: false,
            muted: false,
            lastReadAt: null,
          },
        });

        setOpenDrifts((prev) => ({ ...prev, [data.drift.id]: true }));
      } catch (e) {
        console.warn("[proposal] ensure failed", e);
      }
    },
    [upsertDrift, conversationId]
  );

  const onCompareProposals = useCallback((rootMessageId: string) => {
    setCompareFor(rootMessageId);
  }, []);

  const onMergeProposal = useCallback((rootMessageId: string) => {
    // Open the compare modal; merging is actioned from there (choosing a proposal)
    setCompareFor(rootMessageId);
  }, []);

  useEffect(() => {
    if (!highlightMessageId) return;
    const el = document.querySelector(
      `[data-msg-id="${highlightMessageId}"]`
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add("ring-2", "ring-indigo-400", "ring-offset-2");
      setTimeout(
        () => el.classList.remove("ring-2", "ring-indigo-400", "ring-offset-2"),
        2000
      );
    }
  }, [highlightMessageId, messages.length]);

  return (
    <div className="space-y-4" data-chat-root>
      <ProposalsCompareModal
        open={!!compareFor}
        onClose={() => setCompareFor(null)}
        rootMessageId={String(compareFor || "")}
        conversationId={String(conversationId)}
        currentUserId={currentUserId}
        onOpenDrift={(driftId) =>
          setOpenDrifts((prev) => ({ ...prev, [driftId]: true }))
        }
        onMerged={() => {
          // Optionally: refresh the root message; your existing hydration often handles it.
        }}
      />
      {messages.map((m, idx) => {
        const isMine = String(m.senderId) === String(currentUserId);
        const panes = Object.values(state.panes);
        const anchored = panes.find(
          (p) => p.anchor?.messageId === m.id && p.peerId === String(m.senderId)
        );
        const driftEntry = driftsByAnchorId[m.id];
        const isDriftAnchor =
          !!driftEntry && driftEntry.drift.kind !== "THREAD"; // hide chip for threads
        const threadEntry = driftsByRoot[m.id];

        const isProposal =
          !!threadEntry?.drift?.title &&
          threadEntry.drift.title.toLowerCase().startsWith("proposal:");

        // Calculate message grouping
        const previousMessage = idx > 0 ? messages[idx - 1] : null;
        const showSenderInfo = shouldShowSenderInfo(m, previousMessage);
        const messageSpacing = getMessageSpacing(showSenderInfo);

        return (
          <div key={m.id} className={messageSpacing} data-msg-id={m.id}>
            {/* Sender name and avatar - only shown at start of message group */}
            {showSenderInfo && !isMine && (
              <div className="flex items-center ml-8 px-3 pb-1">
                <span className="text-[10px] font-light text-slate-600">
                  {m.sender?.name || "Unknown"}
                </span>
              </div>
            )}

            {!isDriftAnchor && (
              <MessageRow
                m={m}
                currentUserId={currentUserId}
                conversationId={conversationId}
                onOpen={handleOpen}
                onPrivateReply={() => {}}
                onCreateOptions={onCreateOptions}
                onCreateTemp={onCreateTemp}
                onReplyInThread={ensureAndOpenThread}
                onProposeAlternative={ensureAndOpenProposal}
                onCompareProposals={onCompareProposals}
                onMergeProposal={onMergeProposal}
                onDelete={handleDelete}
              />
            )}

            {/* {!isDriftAnchor &&
            !(m as any).isRedacted &&
            m.attachments?.length ? (
              <div
                className={[
                  "mt-1 flex flex-col gap-2 px-3",
                  isMine ? "items-end" : "items-start",
                ].join(" ")}
              >
                {m.attachments.map((a) => (
                  <Attachment key={a.id} a={a as any} />
                ))}
              </div>
            ) : null} */}

            {/* Attachments (outside bubble) */}
            {!isDriftAnchor &&
            !(m as any).isRedacted &&
            m.attachments?.length ? (
              <div
                className={[
                  "mt-1 flex flex-col gap-2 px-3",
                  isMine ? "items-end" : "items-start",
                ].join(" ")}
              >
                {m.attachments.map((a) => (
                  <Attachment key={a.id} a={a as any} />
                ))}
              </div>
            ) : null}

            {/* Quotes */}
            {Array.isArray((m as any).quotes) &&
              (m as any).quotes.length > 0 &&
              (() => {
                const q0 = (m as any).quotes[0];
                const textRaw =
                  typeof q0?.body === "string"
                    ? q0.body
                    : q0?.body
                    ? textFromTipTap(q0.body)
                    : "";
                const inlineLabel =
                  q0?.sourceAuthor?.name || toSnippet(textRaw, 48);
                return (
                  <div
                    className={[
                      "px-3 mt-2 flex",
                      isMine ? "justify-end" : "justify-start",
                    ].join(" ")}
                  >
                    <div className="max-w-[60%]">
                      <div className="text-slate-500 flex  items-center gap-1">
                        <span className="flex mr-1 h-2 w-2 mb-1 justify-center items-center align-center  rounded-full bg-slate-600" />
                        <span className="text-xs pb-1 align-center  my-auto">
                          Replying to&nbsp;{inlineLabel}
                        </span>
                      </div>
                      <div
                        className={[
                          "mt-1 h-fit  pl-3 border-l-[1px]",
                          isMine
                            ? "border-rose-400 ml-1"
                            : "border-indigo-400 mx-auto px-auto",
                        ].join(" ")}
                      >
                        {(m as any).quotes.map((q: any, i: number) => (
                          <QuoteBlock key={`${m.id}-q-${i}`} q={q} compact />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

            {/* Plain message link previews */}
            {!Array.isArray((m as any).facets) &&
              Array.isArray((m as any).linkPreviews) &&
              (m as any).linkPreviews.length > 0 && (
                <div
                  className={[
                    "mt-2 flex flex-col gap-2 px-3",
                    isMine ? "items-end" : "items-start",
                  ].join(" ")}
                >
                  {(m as any).linkPreviews.slice(0, 3).map((p: any) => (
                    <LinkCard key={p.urlHash} p={p} />
                  ))}
                </div>
              )}

            {/* Sheaf (default facet) link previews */}
            {Array.isArray((m as any).facets) &&
              (m as any).facets.length > 0 &&
              (() => {
                const defId =
                  (m as any).defaultFacetId ?? (m as any).facets[0]?.id;
                const def =
                  (m as any).facets.find((f: any) => f.id === defId) ??
                  (m as any).facets[0];
                if (!def?.linkPreviews?.length) return null;
                return (
                  <div
                    className={[
                      "mt-2 flex flex-col gap-2 px-3",
                      isMine ? "items-end" : "items-start",
                    ].join(" ")}
                  >
                    {def.linkPreviews.slice(0, 3).map((p: any) => (
                      <LinkCard key={p.urlHash} p={p} />
                    ))}
                  </div>
                );
              })()}

            {/* Poll chip */}
            {pollsByMessageId[m.id] && (
              <PollChip
                poll={pollsByMessageId[m.id]}
                onVote={(body) => onVote(pollsByMessageId[m.id], body)}
              />
            )}
            <MergeHistorySummary
              messageId={String(m.id)}
              isMine={isMine}
              edited={Boolean((m as any).edited)}
            />

            <ThreadSummary
              threadEntry={threadEntry}
              messageId={m.id}
              isMine={isMine}
              onOpen={(driftId) =>
                setOpenDrifts((prev) => ({ ...prev, [driftId]: true }))
              }
            />
            {/* Classic Drift anchor chip + pane */}
            {isDriftAnchor && driftEntry && (
              <>
                <DriftChip
                  title={driftEntry.drift.title}
                  count={driftEntry.drift.messageCount}
                  onOpen={() => openDrift(driftEntry.drift.id)}
                />
                {openDrifts[driftEntry.drift.id] && (
                  <>
                    <hr />
                    <DriftPane
                      key={driftEntry.drift.id}
                      drift={{
                        id: driftEntry.drift.id,
                        title: driftEntry.drift.title,
                        isClosed: driftEntry.drift.isClosed,
                        isArchived: driftEntry.drift.isArchived,
                      }}
                      conversationId={String(conversationId)}
                      currentUserId={currentUserId}
                      onClose={() => closeDrift(driftEntry.drift.id)}
                    />
                  </>
                )}
              </>
            )}

            {threadEntry && openDrifts[threadEntry.drift.id] && (
              <>
                <hr />
                <DriftPane
                  key={threadEntry.drift.id}
                  drift={{
                    id: threadEntry.drift.id,
                    title:
                      threadEntry.drift.title ||
                      (isProposal ? "Proposal" : "Thread"),
                    isClosed: threadEntry.drift.isClosed,
                    isArchived: threadEntry.drift.isArchived,
                  }}
                  conversationId={String(conversationId)}
                  currentUserId={currentUserId}
                  variant={isProposal ? "proposal" : "thread"} // 👈 show the 🪄 header
                  align={isMine ? "end" : "start"} // right for my root, left for others
                  onClose={() =>
                    setOpenDrifts((prev) => ({
                      ...prev,
                      [threadEntry.drift.id]: false,
                    }))
                  }
                />
              </>
            )}
            <div ref={bottomRef} data-bottom-anchor />
          </div>
        );
      })}
      {showScrollDownDelayed && (
        <button
          type="button"
          onClick={scrollToBottom}
          className={[
            "fixed z-[70]  bottom-32", // position
            "h-10 w-10 rounded-full shadow-md ", // shape
            "bg-white/50 backdrop-blur-sm likebutton", // look
            "flex items-center justify-center", // center icon
            "transition-transform hover:translate-y-[1px]", // tiny nudge
          ].join(" ")}
          title="Scroll to composer"
          aria-label="Scroll to composer"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 4v14m0 0l-6-6m6 6l6-6"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      {othersTypingIds.length > 0 && (
        <div className="px-3 text-[12px] text-slate-500 italic">
          {othersTypingIds.length === 1
            ? `${getTypingName(othersTypingIds[0])} is typing…`
            : "Several people are typing…"}
        </div>
      )}
    </div>
  );
}
