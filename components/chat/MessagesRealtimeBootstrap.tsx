// components/chat/MessagesRealtimeBootstrap.tsx
"use client";
import { useUserInbox } from "@/hooks/useUserInbox";
import { useEffect } from "react";
export default function MessagesRealtimeBootstrap({ me }: { me: string }) {
  useUserInbox(me);
  useEffect(() => {
    console.log("[inbox bootstrap] me:", me);
  }, [me]);
  return null;
}
