"use client"

import clsx from "clsx"
import { CommentThread } from "@/types/comments"

interface CommentSidebarProps {
  threads: CommentThread[]
  activeThreadId: string | null
  onSubmit?: (threadId: string, body: string) => void
  onResolve?: (threadId: string) => void
  onVote?: (commentId: string, delta: number) => void
  currentUser?: unknown
}

export default function CommentSidebar({
  threads,
  activeThreadId,
}: CommentSidebarProps) {
  return (
    <aside className="fixed right-0 top-0 h-full w-80 overflow-y-auto border-l bg-white">
      {threads.map((thread) => (
        <div
          key={thread.id}
          className={clsx(
            "p-4",
            activeThreadId === thread.id && "bg-gray-100"
          )}
        >
          {thread.comments.map((comment) => (
            <p key={comment.id} className="mb-2 text-sm">
              {comment.body}
            </p>
          ))}
        </div>
      ))}
    </aside>
  )
}
