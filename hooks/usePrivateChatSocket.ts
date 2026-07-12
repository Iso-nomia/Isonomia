import { supabase } from "@/lib/supabaseclient";
import { useCallback, useEffect, useRef } from "react";

type OpenPayload = {
  kind: "open";
  roomId: string;
  conversationId: string;
  from: string;
  to: string;
  ts: number;
  fromName?: string | null;
  fromImage?: string | null;
};
type MessagePayload = {
  kind: "message";
  roomId: string;
  conversationId: string;
  from: string;
  to: string;
  body: string;
  ts: number;
  fromName?: string | null;
  fromImage?: string | null;
};
type Event = OpenPayload | MessagePayload;

export function usePrivateChatSocket(
  ids: {
    roomId: string;
    conversationId: string;
    meId: string;
    peerId: string;
    meName?: string | null;
    meImage?: string | null;
  },
  onEvent: (e: Event) => void
) {
  const { roomId, conversationId, meId, peerId, meName, meImage } = ids;

  const roomRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const roomReady = useRef(false);

  const inboxRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const inboxReady = useRef(false);

  const handlerRef = useRef(onEvent);
  useEffect(() => { handlerRef.current = onEvent; }, [onEvent]);

  // --- ROOM (receive) ---
  // useEffect(() => {
  //   const ch = supabase.channel(roomId, { config: { broadcast: { self: false } } });
  //   roomReady.current = false;
  //   roomRef.current = ch;

  //   ch.on("broadcast", { event: "priv" }, ({ payload }) => {
  //     if (payload?.roomId === roomId) handlerRef.current(payload as Event);
  //   });

  //   ch.subscribe((status) => {
  //     roomReady.current = (status === "SUBSCRIBED");
  //     // console.log("[room status]", status, roomId);
  //   });

  //   return () => {
  //     roomReady.current = false;
  //     roomRef.current = null;
  //     supabase.removeChannel(ch);
  //   };
  // }, [roomId]);
  // room subscribe
useEffect(() => {
  const ch = supabase.channel(roomId, { config: { broadcast: { self: false } } });
  console.log("[SOCKET] subscribe room:", roomId);
  roomRef.current = ch;
  ch.on("broadcast", { event: "priv" }, ({ payload }) => {
    console.log("[SOCKET] room recv", roomId, payload);
    if (payload?.roomId === roomId) handlerRef.current(payload as Event);
  });
  ch.subscribe((status) => console.log("[SOCKET] room status", status, roomId));
  return () => { console.log("[SOCKET] room cleanup", roomId); supabase.removeChannel(ch); roomRef.current = null; };
}, [roomId]);

  // --- INBOX (send) — exactly once per peerId ---
  // useEffect(() => {
  //   const inbox = supabase.channel(`inbox:${peerId}`, { config: { broadcast: { self: false } } });
  //   inboxReady.current = false;
  //   inboxRef.current = inbox;

  //   inbox.subscribe((status) => {
  //     inboxReady.current = (status === "SUBSCRIBED");
  //     // console.log("[inbox sender status]", status, `inbox:${peerId}`);
  //   });

  //   return () => {
  //     inboxReady.current = false;
  //     inboxRef.current = null;
  //     supabase.removeChannel(inbox);
  //   };
  // }, [peerId]);
  useEffect(() => {
    const inbox = supabase.channel(`inbox:${peerId}`, { config: { broadcast: { self: false } } });
    console.log("[SOCKET] subscribe peer inbox:", `inbox:${peerId}`);
    inboxRef.current = inbox;
    inbox.subscribe((status) => console.log("[SOCKET] peer inbox status", status, `inbox:${peerId}`));
    return () => { console.log("[SOCKET] peer inbox cleanup", `inbox:${peerId}`); supabase.removeChannel(inbox); inboxRef.current = null; };
  }, [peerId]);
  

  const sendVia = (ch: NonNullable<typeof inboxRef.current>, event: "priv_open" | "priv_message" | "priv", payload: Event) =>
    ch.send({ type: "broadcast", event, payload });

  // Safe notify helper + one-shot fallback
  // const notifyPeerInbox = useCallback((event: "priv_open" | "priv_message", payload: Event) => {
  //   if (inboxReady.current && inboxRef.current) {
  //     sendVia(inboxRef.current, event, payload);
  //     return;
  //   }
  //   // one-shot fallback if persistent inbox channel isn't ready yet
  //   const tmp = supabase.channel(`inbox:${peerId}`, { config: { broadcast: { self: false } } });
  //   tmp.subscribe((status) => {
  //     if (status === "SUBSCRIBED") {
  //       sendVia(tmp, event, payload).finally(() => supabase.removeChannel(tmp));
  //     }
  //   });
  // }, [peerId]);
  const notifyPeerInbox = useCallback((event: "priv_open" | "priv_message", payload: Event) => {
    const ready = !!inboxRef.current;
    console.log("[SOCKET] notifyPeerInbox", event, "ready?", ready, "topic:", `inbox:${peerId}`, payload);
    if (inboxRef.current) {
      inboxRef.current.send({ type: "broadcast", event, payload });
    }
  }, [peerId]);
  const sendOpen = useCallback(() => {
    const payload: OpenPayload = { kind: "open", roomId, conversationId, from: meId, to: peerId, ts: Date.now(), fromName: meName ?? null, fromImage: meImage ?? null };
    console.log("[SOCKET] sendOpen", payload);
    roomRef.current?.send({ type: "broadcast", event: "priv", payload });
    notifyPeerInbox("priv_open", payload);
  }, [roomId, conversationId, meId, peerId, meName, meImage, notifyPeerInbox]);
  
  const sendMessage = useCallback((body: string) => {
    const payload: MessagePayload = { kind: "message", roomId, conversationId, from: meId, to: peerId, body, ts: Date.now(), fromName: meName ?? null, fromImage: meImage ?? null };
    console.log("[SOCKET] sendMessage", payload);
    roomRef.current?.send({ type: "broadcast", event: "priv", payload });
    notifyPeerInbox("priv_message", payload);
  }, [roomId, conversationId, meId, peerId, meName, meImage, notifyPeerInbox]);

  // Also guard room sends (first send after mount can beat SUBSCRIBED)
  const sendToRoom = useCallback((payload: Event) => {
    if (roomReady.current && roomRef.current) {
      sendVia(roomRef.current, "priv", payload);
      return;
    }
    // one-shot fallback
    const tmp = supabase.channel(roomId, { config: { broadcast: { self: false } } });
    tmp.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        sendVia(tmp, "priv", payload).finally(() => supabase.removeChannel(tmp));
      }
    });
  }, [roomId]);

  // const sendOpen = useCallback(() => {
  //   const payload: OpenPayload = {
  //     kind: "open",
  //     roomId,
  //     conversationId,
  //     from: meId,
  //     to: peerId,
  //     ts: Date.now(),
  //     fromName: meName ?? null,
  //     fromImage: meImage ?? null,
  //   };
  //   sendToRoom(payload);
  //   notifyPeerInbox("priv_open", payload);
  // }, [roomId, conversationId, meId, peerId, meName, meImage, sendToRoom, notifyPeerInbox]);

  // const sendMessage = useCallback((body: string) => {
  //   const payload: MessagePayload = {
  //     kind: "message",
  //     roomId,
  //     conversationId,
  //     from: meId,
  //     to: peerId,
  //     body,
  //     ts: Date.now(),
  //     fromName: meName ?? null,
  //     fromImage: meImage ?? null,
  //   };
  //   sendToRoom(payload);
  //   notifyPeerInbox("priv_message", payload);
  // }, [roomId, conversationId, meId, peerId, meName, meImage, sendToRoom, notifyPeerInbox]);

  return { sendOpen, sendMessage };
}
