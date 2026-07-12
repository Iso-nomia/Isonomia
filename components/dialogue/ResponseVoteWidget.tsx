// components/dialogue/ResponseVoteWidget.tsx
"use client";
import * as React from "react";
import { ThumbsUp, ThumbsDown, Flag } from "lucide-react";

interface ResponseVoteWidgetProps {
  responseId: string;
  initialVotes?: {
    upvotes: number;
    downvotes: number;
    flags: number;
  };
}

/**
 * Displays aggregate response votes (upvote/downvote/flag counts).
 * Phase 3.1: Response quality visualization.
 */
export function ResponseVoteWidget({
  responseId,
  initialVotes,
}: ResponseVoteWidgetProps) {
  const [votes, setVotes] = React.useState(initialVotes || {
    upvotes: 0,
    downvotes: 0,
    flags: 0,
  });

  React.useEffect(() => {
    if (initialVotes) return;

    const fetchVotes = async () => {
      try {
        const res = await fetch(`/api/dialogue/moves/${responseId}/votes`);
        if (res.ok) {
          const data = await res.json();
          // Handle both response formats: { counts: {...} } or { upvotes, downvotes, flags }
          if (data.counts) {
            setVotes({
              upvotes: data.counts.UPVOTE || 0,
              downvotes: data.counts.DOWNVOTE || 0,
              flags: data.counts.FLAG || 0,
            });
          } else {
            setVotes({
              upvotes: data.upvotes || 0,
              downvotes: data.downvotes || 0,
              flags: data.flags || 0,
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch response votes:", err);
      }
    };

    fetchVotes();
  }, [responseId, initialVotes]);

  const netScore = votes.upvotes - votes.downvotes;

  return (
    <div className="inline-flex items-center gap-3 text-xs">
      {/* Upvotes */}
      <div className="flex items-center gap-1 text-green-600">
        <ThumbsUp className="w-3 h-3" />
        <span>{votes.upvotes}</span>
      </div>

      {/* Net Score */}
      <div className={`font-medium ${netScore >= 0 ? "text-green-600" : "text-red-600"}`}>
        {netScore >= 0 ? "+" : ""}{netScore}
      </div>

      {/* Downvotes */}
      <div className="flex items-center gap-1 text-red-600">
        <ThumbsDown className="w-3 h-3" />
        <span>{votes.downvotes}</span>
      </div>

      {/* Flags (if any) */}
      {votes.flags > 0 && (
        <div className="flex items-center gap-1 text-orange-600">
          <Flag className="w-3 h-3" />
          <span>{votes.flags}</span>
        </div>
      )}
    </div>
  );
}
