import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseclient";
import { usePrivateChatManager } from "@/contexts/PrivateChatManager";

export function useUserInbox(me: string) {
  const { state, dispatch } = usePrivateChatManager();

  // Keep a live pointer to state to read synchronously inside handlers
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Guard StrictMode / remounts in dev
  const didInit = useRef(false);

  useEffect(() => {
    if (!me) return;
    if (didInit.current) return;
    didInit.current = true;

    console.log("[INBOX] mount for", me);
    const inbox = supabase.channel(`inbox:${me}`, { config: { broadcast: { self: false } } });

    inbox.subscribe((status) => {
      console.log("[INBOX] status:", status, `inbox:${me}`);
    });

    inbox.on("broadcast", { event: "priv_open" }, ({ payload }) => {
      console.log("[INBOX] priv_open payload:", payload);
      const { roomId, from, fromName, fromImage, conversationId } = payload || {};
      if (!roomId || !from || !conversationId) return;
      if (String(from) === String(me)) return;

      dispatch({
        type: "OPEN_OR_INCREMENT",
        pane: {
          id: String(roomId),
          conversationId: String(conversationId),
          peerId: String(from),
          peerName: fromName ?? "User",
          peerImage: fromImage ?? null,
          pos: { x: 420, y: 24 },
        },
      });

      queueMicrotask(() => {
        console.log("[INBOX] after OPEN_OR_INCREMENT:", stateRef.current.panes[String(roomId)]);
      });
    });

    inbox.on("broadcast", { event: "priv_message" }, ({ payload }) => {
      console.log("[INBOX] priv_message payload:", payload);
      const { roomId, from, body, ts, conversationId, fromName, fromImage } = payload || {};
      if (!roomId || !from || !conversationId || !body) return;
      if (String(from) === String(me)) return;

      const rid = String(roomId);
      const pane = stateRef.current.panes[rid];
      const isPaneOpen = !!pane && pane.minimised === false;

      // Always ensure/bump the dock tab
      dispatch({
        type: "OPEN_OR_INCREMENT",
        pane: {
          id: rid,
          conversationId: String(conversationId),
          peerId: String(from),
          peerName: fromName ?? "User",
          peerImage: fromImage ?? null,
          pos: { x: 420, y: 24 },
        },
      });

      // If a floating pane is open, the room channel will append this message.
      // Avoid double-append from inbox.
      if (isPaneOpen) {
        console.log("[INBOX] pane is open → skip ADD_MSG (room will append)");
        return;
      }

      // Pane not open (either minimized or not created yet) → append now
      dispatch({
        type: "ADD_MSG",
        id: rid,
        msg: { paneId: rid, from: String(from), body, ts: ts ?? Date.now() },
      });

      queueMicrotask(() => {
        console.log("[INBOX] after ADD_MSG:", stateRef.current.panes[rid]);
      });
    });

    return () => {
      console.log("[INBOX] unmount", me);
      supabase.removeChannel(inbox);
      didInit.current = false; // optional; dev HMR friendliness
    };
  }, [me, dispatch]);
}
