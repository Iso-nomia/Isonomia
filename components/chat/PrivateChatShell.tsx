"use client";
import { PrivateChatProvider } from "@/contexts/PrivateChatManager";

export default function PrivateChatShell({
  meId,
  children,
}: {
  meId: string | null;
  children: React.ReactNode;
}) {
  return <PrivateChatProvider meId={meId}>{children}</PrivateChatProvider>;
}
