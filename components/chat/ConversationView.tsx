"use client";

import React from "react";
import ChatRoom from "@/components/chat/ChatRoom";
import MessageComposer from "@/components/chat/MessageComposer";
import MessengerPane from "@/components/chat/MessengerPane";

type QuoteRef = { messageId: string; facetId?: string };

export default function ConversationView({
  conversationId,
  currentUserId,
  initialMessages,
  highlightMessageId,
}: {
  conversationId: string;
  currentUserId: string;
  initialMessages: any[];
  highlightMessageId?: string | null;
}) {
  const [quoteRef, setQuoteRef] = React.useState<QuoteRef | undefined>(undefined);

  // Optional: expose a handler to ChatRoom so message actions can set quote
  const handleQuote = React.useCallback((qr: QuoteRef) => setQuoteRef(qr), []);

  return (
    <div className="mt-6 space-y-6">
      <ChatRoom
        conversationId={conversationId}
        currentUserId={currentUserId}
        initialMessages={initialMessages}
        highlightMessageId={highlightMessageId ?? null}
        // onQuote={handleQuote} // ← add this prop in ChatRoom to trigger quoting from a message menu
      />
      <hr />
      {/* Show quote pill if present */}
      {quoteRef && (
        <div className="mx-auto max-w-[720px] text-xs text-slate-600 flex items-center gap-2 px-2">
          <span>Quoting #{quoteRef.messageId}{quoteRef.facetId ? ` · facet ${quoteRef.facetId}` : ""}</span>
          <button
            className="ml-2 px-2 py-1 border rounded bg-white hover:bg-slate-50"
            onClick={() => setQuoteRef(undefined)}
          >
            Clear
          </button>
        </div>
      )}
      <MessageComposer
        conversationId={conversationId}
        currentUserId={currentUserId}
        // driftId can be provided if you mount a composer in a drift pane
      />
      <MessengerPane currentUserId={currentUserId} />
    </div>
  );
}
