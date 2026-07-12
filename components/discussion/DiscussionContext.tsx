// components/discussion/DiscussionContext.tsx
"use client";
import * as React from "react";

export const DiscussionContext = React.createContext<{ id: string } | null>(null);

export function useDiscussionId(): string | null {
  const ctx = React.useContext(DiscussionContext);
  return ctx?.id ?? null;
}
