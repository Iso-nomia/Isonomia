"use client";
import { useEffect, useState } from "react";

export type DecentraliseProgress = {
  ts: number;
  step: "copy-db" | "verify" | "copy-media" | "done" | string;
  status?: "start" | "done";
  table?: string;
  src?: number;
  dst?: number;
  ok?: boolean;
  receiptKey?: string;
  bucket?: string;
};

export function useDecentraliseStatus(roomId: string) {
  const [state, setState] = useState<DecentraliseProgress | null>(null);
  useEffect(() => {
    if (!roomId) return;
    const es = new EventSource(`/api/rooms/${roomId}/decentralise/status`);
    es.onmessage = (e) => { try { setState(JSON.parse(e.data)); } catch {} };
    es.onerror = () => es.close();
    return () => es.close();
  }, [roomId]);
  return state;
}
