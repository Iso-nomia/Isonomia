// components/discourse/shared/VoteCard.tsx
"use client";

import * as React from "react";
import { ThumbsUp, ThumbsDown, Flag, MessageSquare } from "lucide-react";

interface VoteCardProps {
  id: string;
  voteType: "UPVOTE" | "DOWNVOTE" | "FLAG";
  createdAt: string;
  dialogueMoveKind: string;
  dialogueMoveText?: string;
  actorName: string;
  targetType: string;
  targetText: string;
}

const voteTypeConfig = {
  UPVOTE: {
    icon: ThumbsUp,
    label: "Upvoted",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    iconColor: "text-green-600",
    labelColor: "text-green-700",
  },
  DOWNVOTE: {
    icon: ThumbsDown,
    label: "Downvoted",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    iconColor: "text-red-600",
    labelColor: "text-red-700",
  },
  FLAG: {
    icon: Flag,
    label: "Flagged",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    iconColor: "text-amber-600",
    labelColor: "text-amber-700",
  },
};

export function VoteCard({
  voteType,
  createdAt,
  dialogueMoveKind,
  dialogueMoveText,
  actorName,
  targetType,
  targetText,
}: VoteCardProps) {
  const config = voteTypeConfig[voteType];
  const VoteIcon = config.icon;

  return (
    <article
      className={`p-4 border rounded-lg ${config.bgColor} ${config.borderColor} hover:shadow-sm transition-shadow`}
      role="article"
      aria-label={`${config.label} a ${dialogueMoveKind} move by ${actorName}`}
    >
      <div className="flex items-start gap-3">
        {/* Vote Icon */}
        <div
          className={`flex-shrink-0 p-2 rounded-full ${config.bgColor}`}
          aria-hidden="true"
        >
          <VoteIcon className={`w-4 h-4 ${config.iconColor}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${config.labelColor}`}>
              {config.label}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-xs text-slate-500 capitalize">
              {dialogueMoveKind} by {actorName}
            </span>
          </div>

          {/* Move text if available */}
          {dialogueMoveText && (
            <p className="mt-1 text-sm text-slate-700 line-clamp-2">
              "{dialogueMoveText}"
            </p>
          )}

          {/* Target info */}
          {targetText && (
            <div className="mt-2 flex items-start gap-2 text-xs text-slate-500">
              <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span>
                On {targetType}: "{targetText}"
              </span>
            </div>
          )}

          {/* Timestamp */}
          <time
            className="block mt-2 text-xs text-slate-400"
            dateTime={createdAt}
          >
            {new Date(createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </time>
        </div>
      </div>
    </article>
  );
}
