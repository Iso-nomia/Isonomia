// components/discussion/NewDiscussionButton.tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

export function NewDiscussionButton({
  title,
  description,
  attachedToType,
  attachedToId,
  createConversation = true,
}: {
  title?: string;
  description?: string | null;
  attachedToType?: string | null;
  attachedToId?: string | null;
  createConversation?: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  // 1. Initialize href state with a placeholder
  const [href, setHref] = React.useState("");

  // 2. Use useEffect to build the URL only on the client-side
  React.useEffect(() => {
    // This code only runs in the browser, where 'window' is available
    const u = new URL("/discussions/new", window.location.origin);
    if (title) u.searchParams.set("title", title);
    if (description) u.searchParams.set("description", description);
    if (attachedToType) u.searchParams.set("attachedToType", attachedToType);
    if (attachedToId) u.searchParams.set("attachedToId", attachedToId);
    if (!createConversation) u.searchParams.set("createConversation", "0");

    setHref(u.toString());
  }, [title, description, attachedToType, attachedToId, createConversation]);

  // Disable the button until the href is generated
  const isDisabled = creating || !href;

  return (
    <button
      type="button"
      onClick={() => {
        if (href) router.push(href);
      }}
      className="btnv2 bg-white/50 flex items-center gap-2 text-sm px-3 py-3 rounded-xl"
      title="Create a new discussion"
      disabled={isDisabled}
    >
       ⨁ New Discussion
    </button>
  );
}