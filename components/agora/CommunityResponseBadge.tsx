// components/agora/CommunityResponseBadge.tsx
"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import useSWR from "swr";

// ============================================================================
// TYPES
// ============================================================================

export interface CommunityResponseBadgeProps {
  targetId: string;
  targetType: "argument" | "claim";
  variant?: "compact" | "full";
  className?: string;
  onClick?: () => void; // Optional: open responses panel/modal
}

// ============================================================================
// FETCHER
// ============================================================================

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

// ============================================================================
// COMPONENT
// ============================================================================

export function CommunityResponseBadge({
  targetId,
  targetType,
  variant = "compact",
  className,
  onClick,
}: CommunityResponseBadgeProps) {
  // ─── Fetch Community Response Count ────────────────────────
  const { data, isLoading } = useSWR(
    `/api/non-canonical/by-target?targetId=${targetId}&targetType=${targetType}&status=APPROVED,EXECUTED`,
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  );

  const count = data?.count || 0;

  // Don't render if no responses and not loading
  if (!isLoading && count === 0) {
    return null;
  }

  // ─── Loading State ──────────────────────────────────────────
  if (isLoading) {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "bg-slate-100 text-slate-500 cursor-default",
          className
        )}
      >
        <Loader2 className="w-3 h-3 animate-spin" />
      </Badge>
    );
  }

  // ─── Compact Variant (Just count) ──────────────────────────
  if (variant === "compact") {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "bg-sky-100 text-sky-800 hover:bg-sky-200 transition-colors",
          onClick && "cursor-pointer",
          className
        )}
        onClick={onClick}
      >
        <Users className="w-3 h-3 mr-1" />
        {count}
      </Badge>
    );
  }

  // ─── Full Variant (With label) ──────────────────────────────
  return (
    <Badge
      variant="secondary"
      className={cn(
        "bg-sky-100 text-sky-800 hover:bg-sky-200 transition-colors px-2 py-1",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <Users className="w-3.5 h-3.5 mr-1.5" />
      <span className="text-xs font-medium">
        {count} {count === 1 ? "Community Response" : "Community Responses"}
      </span>
    </Badge>
  );
}
