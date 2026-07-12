"use client";
import React, { createContext, useContext, useMemo, useReducer, useCallback, useEffect, useRef } from "react";

export type Msg = { paneId: string; from: string; body: string; ts: number };


export type PaneAnchor = {
  messageId: string;
  messageText?: string | null;
  authorId: string;
  authorName?: string | null;
  conversationId: string;
};


export type Pane = {
  id: string;                 // roomId
  conversationId: string;
  peerId: string;
  peerName: string;
  peerImage?: string | null;
  msgs: Msg[];
  minimised: boolean;
  unread?: number;
  pos: { x: number; y: number };
  anchor?: PaneAnchor;
};

type State = { panes: Record<string, Pane> };

// ---- actions
type Action =
  | { type: "HYDRATE"; state: State }
  | { type: "OPEN"; pane: Omit<Pane, "msgs" | "minimised" | "unread"> }
  | { type: "OPEN_OR_INCREMENT"; pane: Omit<Pane, "msgs" | "minimised" | "unread"> }
  | { type: "ENSURE_PANE"; pane: Omit<Pane, "msgs" | "minimised" | "unread"> } // <— NEW
  | { type: "CLOSE"; id: string }
  | { type: "MINIMISE"; id: string }
  | { type: "RESTORE"; id: string }
  | { type: "MARK_READ"; id: string }
  | { type: "SET_POS"; id: string; pos: { x: number; y: number } }
  | { type: "ADD_MSG"; id: string; msg: Msg };

  const DEBUG = false;

function debug(action: Action, next: State) {
  if (!DEBUG) return;
  console.log("[REDUCER]", action.type, action, "→ panes:", Object.keys(next.panes));
  if ("pane" in action) console.log("[REDUCER] pane after:", next.panes[action.pane.id]);
  if (action.type === "ADD_MSG") console.log("[REDUCER] msgs after:", next.panes[action.id]?.msgs?.length, "unread:", next.panes[action.id]?.unread);
}

// ---- reducer
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return action.state;

    case "OPEN": {
      const p = state.panes[action.pane.id];
      if (p) {
        return {
          ...state,
          panes: {
            ...state.panes,
            [p.id]: { ...p, minimised: false, unread: 0, anchor: action.pane.anchor ?? p.anchor },
          },
        };
      }
      const offset = Object.keys(state.panes).length * 40;
      return {
        ...state,
        panes: {
          ...state.panes,
          [action.pane.id]: {
            ...action.pane,
            msgs: [],
            minimised: false,
            unread: 0,
            pos: action.pane.pos ?? { x: 420 + offset, y: 24 + offset },
          },
        },
      };
    }

    // case "OPEN_OR_INCREMENT": {
    //   const p = state.panes[action.pane.id];
    //   if (p) {
    //     const unread = p.minimised ? (p.unread ?? 0) + 1 : p.unread ?? 0;
    //     return {
    //       ...state,
    //       panes: {
    //         ...state.panes,
    //         [p.id]: {
    //           ...p,
    //           // refresh name/image in case we previously had "User"
    //           peerName: action.pane.peerName || p.peerName,
    //           peerImage: action.pane.peerImage ?? p.peerImage,
    //           unread,
    //         },
    //       },
    //     };
    //   }
    //   return {
    //     ...state,
    //     panes: {
    //       ...state.panes,
    //       [action.pane.id]: {
    //         ...action.pane,
    //         msgs: [],
    //         minimised: true,   // start minimised on receiver
    //         unread: 1,
    //         pos: action.pane.pos ?? { x: 420, y: 24 },
    //       },
    //     },
    //   };
    // }
    case "OPEN_OR_INCREMENT": {
      const p = state.panes[action.pane.id];
      const next = p
      ? {
        ...state,
        panes: {
          ...state.panes,
          [p.id]: {
            ...p,
            peerName: action.pane.peerName || p.peerName,
            peerImage: action.pane.peerImage ?? p.peerImage,
            unread: p.minimised ? (p.unread ?? 0) + 1 : p.unread ?? 0,
            anchor: action.pane.anchor ?? p.anchor,
          },
        },
      }
    : {
        ...state,
        panes: {
          ...state.panes,
          [action.pane.id]: {
            ...action.pane,
            msgs: [],
            minimised: true,
            unread: 1,
            pos: action.pane.pos ?? { x: 420, y: 24 },
          },
        },
      };
      debug(action, next);
      return next;
    }
    case "ENSURE_PANE": {
      const p = state.panes[action.pane.id];
      if (p) {
        // update name/image if we learned better values; DO NOT change unread
        return {
          ...state,
          panes: { ...state.panes, [p.id]: { ...p, peerName: action.pane.peerName || p.peerName, peerImage: action.pane.peerImage ?? p.peerImage } }
        };
      }
      // create minimized with unread 0; we'll bump on ADD_MSG
      return {
        ...state,
        panes: {
          ...state.panes,
          [action.pane.id]: {
            ...action.pane,
            msgs: [],
            minimised: true,
            unread: 0,
            pos: action.pane.pos ?? { x: 420, y: 24 },
          },
        },
      };
    }
    

    case "CLOSE": {
      const { [action.id]: _, ...rest } = state.panes;
      return { ...state, panes: rest };
    }
    case "MINIMISE": {
      const p = state.panes[action.id];
      if (!p) return state;
      return { ...state, panes: { ...state.panes, [p.id]: { ...p, minimised: true } } };
    }
    case "RESTORE": {
      const p = state.panes[action.id];
      if (!p) return state;
      return { ...state, panes: { ...state.panes, [p.id]: { ...p, minimised: false, unread: 0 } } };
    }
    case "MARK_READ": {
      const p = state.panes[action.id];
      if (!p) return state;
      return { ...state, panes: { ...state.panes, [p.id]: { ...p, unread: 0 } } };
    }
    case "SET_POS": {
      const p = state.panes[action.id];
      if (!p) return state;
      return { ...state, panes: { ...state.panes, [p.id]: { ...p, pos: action.pos } } };
    }
    // case "ADD_MSG": {
    //   const p = state.panes[action.id];
    //   if (!p) return state;
    //   const isIncoming = String(action.msg.from) === p.peerId;
    //   const unread = p.minimised && isIncoming ? (p.unread ?? 0) + 1 : p.unread ?? 0;
    //   return {
    //     ...state,
    //     panes: { ...state.panes, [p.id]: { ...p, msgs: [...p.msgs, action.msg].slice(-50), unread } },
    //   };
    // }

case "ADD_MSG": {
  const p = state.panes[action.id];
  if (!p) return state;
  const isIncoming = String(action.msg.from) === p.peerId;
  const unread = p.minimised && isIncoming ? (p.unread ?? 0) + 1 : p.unread ?? 0;
  const next = { ...state, panes: { ...state.panes, [p.id]: { ...p, msgs: [...p.msgs, action.msg].slice(-50), unread } } };
  debug(action, next);
  return next;
}

    default:
      return state;
  }
}

// ---- persistence helpers (sessionStorage)
type Persisted = {
  v: 2;
  panes: Record<string, {
    id: string;
    conversationId: string;
    peerId: string;
    peerName: string;
    peerImage?: string | null;
    minimised: boolean;
    unread?: number;
    pos: { x: number; y: number };
    msgs?: Msg[];
    anchor?: PaneAnchor;
  }>;
};

function serialize(state: State): Persisted {
  const panes = Object.fromEntries(
    Object.entries(state.panes).map(([id, p]) => [
      id,
      {
        id: p.id,
        conversationId: p.conversationId,
        peerId: p.peerId,
        peerName: p.peerName,
        peerImage: p.peerImage ?? null,
        minimised: p.minimised,
        unread: p.unread ?? 0,
        pos: p.pos,
        // keep the last 25 msgs for lightweight restore
        msgs: p.msgs.slice(-25),
        anchor: p.anchor ?? undefined,
      },
    ])
  );
  return { v: 2, panes };
}

function mergeLocalPrefs(p: Persisted["panes"][string]): Persisted["panes"][string] {
  // merge pos/minimised from localStorage (so those survive across sessions)
  try {
    const raw = localStorage.getItem(`pcp:prefs:${p.id}`);
    if (!raw) return p;
    const { pos, minimised } = JSON.parse(raw) || {};
    return { ...p, pos: pos ?? p.pos, minimised: typeof minimised === "boolean" ? minimised : p.minimised };
  } catch {
    return p;
  }
}

function deserialize(raw: string): State {
  try {
    const data: Persisted = JSON.parse(raw);
    if (!data?.panes) return { panes: {} };
    const panes: Record<string, Pane> = {};
    for (const [id, p] of Object.entries(data.panes)) {
      const merged = mergeLocalPrefs(p);
      panes[id] = {
        id: merged.id,
        conversationId: merged.conversationId,
        peerId: merged.peerId,
        peerName: merged.peerName,
        peerImage: merged.peerImage ?? null,
        msgs: merged.msgs ?? [],
        minimised: !!merged.minimised,
        unread: merged.unread ?? 0,
        pos: merged.pos ?? { x: 420, y: 24 },
        anchor: merged.anchor,
      };
    }
    return { panes };
  } catch {
    return { panes: {} };
  }
}

// ---- context
type OpenOptions = {
  peerImage?: string | null;
  roomId?: string;
  pos?: { x: number; y: number };
  anchor?: PaneAnchor;
};

type Ctx = {
  state: State;
  dispatch: React.Dispatch<Action>;
  open: (peerId: string, peerName: string, conversationId: string, opts?: OpenOptions) => void;
};

const C = createContext<Ctx | null>(null);

export function PrivateChatProvider(
  props: { children: React.ReactNode; meId?: string | null }
) {
  const { children } = props; // don't pull out meId
  const key = "pcp:v1";

  // lazy init from sessionStorage
  const [state, dispatch] = useReducer(
    reducer,
    undefined as unknown as State,
    () => {
      if (typeof window === "undefined") return { panes: {} };
      const raw = sessionStorage.getItem(key);
      return raw ? deserialize(raw) : { panes: {} };
    }
  );

  // persist on any state change
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(serialize(state)));
    } catch {}
  }, [state, key]);

  // if meId changes, rehydrate under the new key (rare)
  const lastKeyRef = useRef(key);
  useEffect(() => {
    if (lastKeyRef.current === key) return;
    try {
      const raw = sessionStorage.getItem(key);
      dispatch({ type: "HYDRATE", state: raw ? deserialize(raw) : { panes: {} } });
      lastKeyRef.current = key;
    } catch {}
  }, [key]);

  // write per-pane pos/minimised to localStorage (cross-session preference)
  useEffect(() => {
    try {
      for (const p of Object.values(state.panes)) {
        localStorage.setItem(`pcp:prefs:${p.id}`, JSON.stringify({ pos: p.pos, minimised: p.minimised }));
      }
    } catch {}
  }, [state.panes]);

  const open = useCallback<Ctx["open"]>((peerId, peerName, conversationId, opts) => {
    const roomId = opts?.roomId ?? `dm:${conversationId}:${peerId}`;
    dispatch({
      type: "OPEN",
      pane: {
        id: roomId,
        conversationId,
        peerId,
        peerName,
        peerImage: opts?.peerImage ?? null,
        pos: opts?.pos ?? { x: 420, y: 24 },
        anchor: opts?.anchor,
      },
    });
  }, []);

  const value = useMemo(() => ({ state, dispatch, open }), [state, open]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function usePrivateChatManager() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("PrivateChatProvider missing");
  return ctx;
}
