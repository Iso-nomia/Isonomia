"use client";
import { create } from "zustand";
import type { PollDTO, PollStateDTO, MyVoteDTO } from "@/types/poll";

export interface Attachment {
  id: string;
  path: string;
  type: string;
  size: number;
}

export type ReactionAgg = { emoji: string; count: number; mine: boolean };

// ---- Sheaf-aware Message type (you already had this; kept here for clarity)
export interface Message {
  id: string;
  text: string | null;
  createdAt: string;
  senderId: string;
  sender?: { name: string; image: string | null };
  attachments?: Attachment[];

  facets?: {
    id: string;
    audience: any; // or AudienceSelector
    sharePolicy: "ALLOW" | "REDACT" | "FORBID";
    expiresAt: string | null;
    body: any;
    attachments?: any[];
    priorityRank: number;
    createdAt: string;
  }[];
  defaultFacetId?: string | null;
  isRedacted?: boolean;
   meta?: any;           // 👈 allow anchors to carry drift info
    driftId?: string | null;
    mentionsMe?: boolean;
}

interface Conversation {
  id: string;
  title?: string | null;
}
export type DriftUI = {
  drift: {
    id: string;
    conversationId: string;
    title: string;
    isClosed: boolean;
    isArchived: boolean;
    messageCount: number;
    lastMessageAt: string | null;
    anchorMessageId?: string | null; // may be null for THREAD
    kind?: "DRIFT" | "THREAD";
    rootMessageId?: string | null;   // set for THREAD
  };
  my?: { collapsed: boolean; pinned: boolean; muted: boolean; lastReadAt: string | null };
};

// Types
type QuoteRef = { messageId: string; facetId?: string };



export type PollUI =
  | { kind: "OPTIONS"; poll: PollDTO; totals: number[]; count: number; myVote: number | null }
  | { kind: "TEMP"; poll: PollDTO; avg: number; count: number; myValue: number | null };

  function normalizeDriftMessage(incoming: any): Message {
    const raw = incoming?.message ?? incoming;
  
    // Coerce to the same shape your UI expects
    const base: Message = {
      id: String(raw.id),
      text: raw.text ?? null,
      createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
      senderId: String(raw.senderId ?? raw.sender_id ?? ""),
      sender: raw.sender ?? undefined,
      attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
      defaultFacetId: raw.defaultFacetId ?? null,
  
      // pass-throughs you already handle elsewhere
      // @ts-ignore
      driftId: raw.driftId ?? raw.drift_id ?? null,
      mentionsMe: typeof raw.mentionsMe === "boolean" ? raw.mentionsMe : undefined,
      // @ts-ignore
      isRedacted: raw.isRedacted ?? raw.is_redacted ?? false,
      // @ts-ignore
      meta: raw.meta ?? undefined,
      // @ts-ignore
      edited: raw.edited ?? false,
      // @ts-ignore
      quotes: Array.isArray(raw.quotes) ? raw.quotes : undefined,
      // @ts-ignore
      linkPreviews: Array.isArray(raw.linkPreviews) ? raw.linkPreviews : undefined,
    };
  
    if (Array.isArray(raw.facets)) {
      base.facets = raw.facets.map((f: any) => ({
        id: String(f.id),
        audience: f.audience,
        sharePolicy: f.sharePolicy,
        expiresAt: f.expiresAt ?? null,
        body: f.body,
        attachments: Array.isArray(f.attachments) ? f.attachments : [],
        priorityRank: typeof f.priorityRank === "number" ? f.priorityRank : 999,
        createdAt: f.createdAt ?? base.createdAt,
        // @ts-ignore
        isEdited: f.isEdited ?? false,
        // @ts-ignore
        updatedAt: f.updatedAt ?? null,
        // @ts-ignore
        linkPreviews: Array.isArray(f.linkPreviews) ? f.linkPreviews : undefined,
      }))
      .sort((a: { priorityRank: number }, b: { priorityRank: number }) => a.priorityRank - b.priorityRank);
    }
  
    return base;
  }

function normalizeMessage(incoming: any): Message {
  // tolerate both envelope {message:{...}} and bare message {...}
  const raw = incoming?.message ?? incoming;

  const base: Message = {
    id: String(raw.id),
    text: raw.text ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    senderId: String(raw.senderId ?? raw.sender_id ?? ""),
    sender: raw.sender ?? undefined,
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    defaultFacetId: raw.defaultFacetId ?? null,
   // 🔽 pass-throughs (new)
   driftId: raw.driftId ?? raw.drift_id ?? null,
   isRedacted: raw.isRedacted ?? raw.is_redacted ?? false,
   meta: raw.meta ?? undefined,
    // @ts-ignore to avoid widening your Message type if you prefer
   linkPreviews: Array.isArray(raw.linkPreviews) ? raw.linkPreviews : undefined,
   // If you want, add `edited?: boolean` to the Message interface too.
   // @ts-ignore
   edited: raw.edited ?? false,
   // @ts-ignore — keep quotes on the object, UI reads via (m as any).quotes
   quotes: Array.isArray(raw.quotes) ? raw.quotes : undefined,
 };

  if (Array.isArray(raw.facets)) {
    base.facets = raw.facets
      .map((f: any) => ({
        id: String(f.id),
        audience: f.audience,
        sharePolicy: f.sharePolicy,
        expiresAt: f.expiresAt ?? null,
        body: f.body,
        attachments: Array.isArray(f.attachments) ? f.attachments : [],
        priorityRank:
          typeof f.priorityRank === "number"
            ? f.priorityRank
            : 999, // last if unspecified
        createdAt: f.createdAt ?? base.createdAt,
      // Facet-level edited info (UI reads via (facet as any).isEdited)
        // @ts-ignore
        isEdited: f.isEdited ?? (f.updatedAt ? new Date(f.updatedAt).getTime() > new Date(f.createdAt ?? base.createdAt).getTime() : false),
        // keep updatedAt if present (some UIs display it)
        // @ts-ignore
        updatedAt: f.updatedAt ?? null,
        // optional: link previews if you add them later
        // @ts-ignore
        linkPreviews: Array.isArray(f.linkPreviews) ? f.linkPreviews : undefined,
      }))
      .sort((a: { priorityRank: number }, b: { priorityRank: number }) => a.priorityRank - b.priorityRank);
  }

  return base;
}

interface ChatState {
  conversations: Record<string, Conversation>;
  currentConversation?: string;
  messages: Record<string, Message[]>;
  pollsByMessageId: Record<string, PollUI>;
  setCurrentConversation: (id: string) => void;
  setConversations: (list: Conversation[]) => void;
  setMessages: (id: string, msgs: Message[] | any[]) => void;
  appendMessage: (id: string, msg: Message | any) => void;
  setPolls: (conversationId: string, polls: PollUI[]) => void;
  upsertPoll: (poll: PollDTO, initState: PollStateDTO | null, myVote: MyVoteDTO | null) => void;
  applyPollState: (state: PollStateDTO) => void;
  setMyVote: (my: MyVoteDTO) => void;
  sendMessage: (id: string, data: FormData) => Promise<void>;
  reactionsByMessageId: Record<string, ReactionAgg[]>;
  setReactions: (messageId: string, items: ReactionAgg[]) => void;
  applyReactionDelta: (messageId: string, emoji: string, op: 'add'|'remove', byMe: boolean) => void;
  driftsByAnchorId: Record<string, DriftUI>;
  driftsByRootMessageId: Record<string, DriftUI>; // NEW
  driftMessages: Record<string /*driftId*/, any[]>;
  setDrifts: (items: DriftUI[]) => void;
  upsertDrift: (item: DriftUI) => void;
  updateDriftCounters: (driftId: string, patch: { messageCount?: number; lastMessageAt?: string | null }) => void;
  setDriftMessages: (driftId: string, rows: any[]) => void;
  appendDriftMessage: (driftId: string, msg: any) => void;
  quoteDraftByConversationId: Record<string, QuoteRef | undefined>;
  setQuoteDraft: (conversationId: string, ref?: QuoteRef) => void;
  clearQuoteDraft: (conversationId: string) => void;
  replaceMessageInConversation: (conversationId: string, msg: Message | any) => void;
  markMessageRedacted: (conversationId: string, messageId: string) => void;
  appendManyDriftMessages: (driftId: string, rows: any[]) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: {},
  messages: {},
  pollsByMessageId: {},
  reactionsByMessageId: {},
  setCurrentConversation: (id) => set({ currentConversation: id }),
  // State
  quoteDraftByConversationId: {},
  driftsByAnchorId: {},
  driftsByRootMessageId: {},


  setConversations: (list) =>
    set({ conversations: Object.fromEntries(list.map((c) => [c.id, c])) }),

  setMessages: (id, msgs) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [id]: (msgs ?? []).map((m) => {
          const normalized = normalizeMessage(m);
          return { ...normalized, attachments: normalized.attachments ?? [] };
        }),
      },
    })),
    replaceMessageInConversation: (conversationId, msg) => {
      const normalized = normalizeMessage(msg);
      set((state) => {
        const list = state.messages[conversationId] ?? [];
        const i = list.findIndex((m) => String(m.id) === String(normalized.id));
        if (i === -1) return { messages: state.messages }; // not found: no op
        const next = list.slice();
        next[i] = { ...normalized, attachments: normalized.attachments ?? [] };
        return { messages: { ...state.messages, [conversationId]: next } };
      });
    },
    setReactions: (messageId, items) =>
    set((state) => ({
      reactionsByMessageId: { ...state.reactionsByMessageId, [messageId]: items },
    })),
    markMessageRedacted: (conversationId, messageId) =>
    set((state) => {
      const list = state.messages[conversationId] ?? [];
      const next = list.map((row) =>
        String(row.id) === String(messageId)
          ? {
              ...row,
              isRedacted: true,
              // keep parity with server tombstone semantics
              text: null,
              attachments: [],
              facets: [],
            }
          : row
      );
      return { messages: { ...state.messages, [conversationId]: next } };
    }),
    applyReactionDelta: (messageId, emoji, op, byMe) =>
    set((state) => {
      const current = state.reactionsByMessageId[messageId] ?? [];
      const idx = current.findIndex((r) => r.emoji === emoji);
      if (idx === -1) {
        if (op === 'add') {
          const next = [...current, { emoji, count: 1, mine: byMe }];
          return { reactionsByMessageId: { ...state.reactionsByMessageId, [messageId]: next } };
        }
        return {}; // removing a non-existent agg: ignore
      }
      const row = { ...current[idx] };
      row.count += (op === 'add' ? 1 : -1);
      if (row.count < 0) row.count = 0;
      if (byMe) row.mine = (op === 'add');
      const next = current.slice();
      if (row.count === 0) next.splice(idx, 1);
      else next[idx] = row;
      return { reactionsByMessageId: { ...state.reactionsByMessageId, [messageId]: next } };
    }),
    appendManyDriftMessages: (driftId, rows) =>
    set((s) => {
      const existing = s.driftMessages[driftId] ?? [];
      const add = rows.map((m) => normalizeDriftMessage(m));
      // de-dupe by id
      const seen = new Set(existing.map((m) => String(m.id)));
      const merged = existing.concat(add.filter((m) => !seen.has(String(m.id))));
      merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return { driftMessages: { ...s.driftMessages, [driftId]: merged } };
    }),
  appendMessage: (id, msg) =>
    set((state) => {
      const list = state.messages[id] || [];
      const normalized = normalizeMessage(msg);
      if (list.some((m) => m.id === normalized.id)) {
        return { messages: state.messages };
      }
      return {
        messages: {
          ...state.messages,
          [id]: [...list, { ...normalized, attachments: normalized.attachments ?? [] }],
        },
      };
    }),

  setPolls: (_cid, polls) =>
    set((state) => ({
      pollsByMessageId: {
        ...state.pollsByMessageId,
        ...Object.fromEntries(polls.map((p) => [p.poll.messageId, p])),
      },
    })),

  upsertPoll: (poll, initState, myVote) =>
    set((state) => {
      if (!poll) {
        console.warn("[polls] upsertPoll called without poll", { initState, myVote });
        return {};
      }
      let ui: PollUI;
      if (poll.kind === "OPTIONS") {
        const totals =
          initState && initState.kind === "OPTIONS"
            ? initState.totals
            : new Array(poll.options?.length ?? 0).fill(0);
        const count =
          initState && initState.kind === "OPTIONS" ? initState.count : 0;
        const my =
          myVote && myVote.kind === "OPTIONS" ? myVote.optionIdx : null;
        ui = { kind: "OPTIONS", poll, totals, count, myVote: my };
      } else {
        const avg =
          initState && initState.kind === "TEMP" ? initState.avg : 0;
        const count =
          initState && initState.kind === "TEMP" ? initState.count : 0;
        const my = myVote && myVote.kind === "TEMP" ? myVote.value : null;
        ui = { kind: "TEMP", poll, avg, count, myValue: my };
      }
      return {
        pollsByMessageId: {
          ...state.pollsByMessageId,
          [poll.messageId]: ui,
        },
      };
    }),

  applyPollState: (incoming) =>
    set((state) => {
      const entryKey = Object.keys(state.pollsByMessageId).find(
        (k) => state.pollsByMessageId[k].poll.id === incoming.pollId
      );
      if (!entryKey) return {};
      const existing = state.pollsByMessageId[entryKey];
      let updated: PollUI | undefined;
      if (incoming.kind === "OPTIONS" && existing.kind === "OPTIONS") {
        updated = { ...existing, totals: incoming.totals, count: incoming.count };
      } else if (incoming.kind === "TEMP" && existing.kind === "TEMP") {
        updated = { ...existing, avg: incoming.avg, count: incoming.count };
      }
      if (!updated) return {};
      return {
        pollsByMessageId: { ...state.pollsByMessageId, [entryKey]: updated },
      };
    }),

  setMyVote: (my) =>
    set((state) => {
      const entryKey = Object.keys(state.pollsByMessageId).find(
        (k) => state.pollsByMessageId[k].poll.id === my.pollId
      );
      if (!entryKey) return {};
      const existing = state.pollsByMessageId[entryKey];
      let updated: PollUI | undefined;
      if (my.kind === "OPTIONS" && existing.kind === "OPTIONS") {
        updated = { ...existing, myVote: my.optionIdx };
      } else if (my.kind === "TEMP" && existing.kind === "TEMP") {
        updated = { ...existing, myValue: my.value };
      }
      if (!updated) return {};
      return {
        pollsByMessageId: { ...state.pollsByMessageId, [entryKey]: updated },
      };
    }),

    setQuoteDraft: (conversationId, ref) =>
    set((state) => ({
      quoteDraftByConversationId: {
        ...state.quoteDraftByConversationId,
        [conversationId]: ref,
      },
    })),

  clearQuoteDraft: (conversationId) =>
    set((state) => {
      const next = { ...state.quoteDraftByConversationId };
      delete next[conversationId];
      return { quoteDraftByConversationId: next };
    }),

  sendMessage: async (id, data) => {
    const res = await fetch(`/api/messages/${id}`, { method: "POST", body: data });
    if (!res.ok) throw new Error("Failed to send message");
    const msg = await res.json();
    get().appendMessage(id, msg);
  },

  driftMessages: {},
  // in initial state:
  setDrifts: (items) =>
  set((s) => {
    const byAnchor = { ...s.driftsByAnchorId };
    const byRoot   = { ...s.driftsByRootMessageId };
    for (const it of items) {
      const d = (it as any).drift ?? it;
      // Only index anchors for classic DRIFT (not THREAD)
      if (d.anchorMessageId && (d.kind ?? "DRIFT") === "DRIFT") {
        byAnchor[d.anchorMessageId] = it as DriftUI;
      }
      if (d.rootMessageId) {
        byRoot[d.rootMessageId] = it as DriftUI;
      }
    }
    return { driftsByAnchorId: byAnchor, driftsByRootMessageId: byRoot };
  }),

upsertDrift: (item) =>
  set((s) => {
    const d = (item as any).drift ?? item;
    const byAnchor = { ...s.driftsByAnchorId };
    const byRoot   = { ...s.driftsByRootMessageId };
    if (d.anchorMessageId && (d.kind ?? "DRIFT") === "DRIFT") {
      byAnchor[d.anchorMessageId] = item as DriftUI;
    }
    if (d.rootMessageId) {
      byRoot[d.rootMessageId] = item as DriftUI;
    }
    return { driftsByAnchorId: byAnchor, driftsByRootMessageId: byRoot };
  }),
// Make counters update no matter which index the drift sits in:
updateDriftCounters: (driftId, patch) =>
  set((s) => {
    let touched = false;
    const touch = (v: DriftUI) => ({
      ...v,
      drift: {
        ...v.drift,
        messageCount: patch.messageCount ?? v.drift.messageCount,
        lastMessageAt: patch.lastMessageAt ?? v.drift.lastMessageAt,
      },
    });

    const byAnchor = { ...s.driftsByAnchorId };
    for (const [k, v] of Object.entries(byAnchor)) {
      if (v.drift.id === driftId) {
        byAnchor[k] = touch(v);
        touched = true;
        break;
      }
    }
    const byRoot = { ...s.driftsByRootMessageId };
    for (const [k, v] of Object.entries(byRoot)) {
      if (v.drift.id === driftId) {
        byRoot[k] = touch(v);
        touched = true;
        break;
      }
    }
    return touched ? { driftsByAnchorId: byAnchor, driftsByRootMessageId: byRoot } : {};
  }),
  setDriftMessages: (driftId, rows) =>
    set((s) => ({
        driftMessages: {
          ...s.driftMessages,
          [driftId]: (rows ?? []).map((m: any) => normalizeDriftMessage(m)),
        },
      })),  
      appendDriftMessage: (driftId, msg) =>
      set((s) => {
        const list = s.driftMessages[driftId] ?? [];
        const normalized = normalizeDriftMessage(msg);
        if (list.some((m) => String(m.id) === String(normalized.id))) {
          return {};
        }
        const next = [...list, normalized].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        return {
          driftMessages: {
            ...s.driftMessages,
            [driftId]: next,
          },
        };
      }),
    
  
  
}));
