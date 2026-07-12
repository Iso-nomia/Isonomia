// components/sources/VerificationBadge.tsx
// Phase 3.1: Source Verification Status Badge

"use client";

import React from "react";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Lock,
  RefreshCw,
  HelpCircle,
  Shield,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Define type locally to avoid Prisma client cache issues
export type SourceVerificationStatus = 
  | "unverified"
  | "verified"
  | "redirected"
  | "unavailable"
  | "broken"
  | "paywalled";

interface VerificationBadgeProps {
  status: SourceVerificationStatus;
  lastCheckedAt?: Date | string | null;
  canonicalUrl?: string | null;
  onVerifyNow?: () => void;
  loading?: boolean;
  compact?: boolean;
}

const statusConfig: Record<
  SourceVerificationStatus,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description: string;
    color: string;
    hoverColor: string;
  }
> = {
  unverified: {
    icon: Shield,
    label: "Unverified",
    description: "This source has not been verified yet",
    color: "text-muted-foreground/50",
    hoverColor: "hover:text-muted-foreground",
  },
  verified: {
    icon: CheckCircle,
    label: "Verified",
    description: "URL resolves and content is accessible",
    color: "text-green-500",
    hoverColor: "hover:text-green-600",
  },
  redirected: {
    icon: ExternalLink,
    label: "Redirected",
    description: "URL redirects to a different location",
    color: "text-blue-500",
    hoverColor: "hover:text-blue-600",
  },
  unavailable: {
    icon: AlertTriangle,
    label: "Unavailable",
    description: "Source is temporarily unavailable",
    color: "text-amber-500",
    hoverColor: "hover:text-amber-600",
  },
  broken: {
    icon: XCircle,
    label: "Broken",
    description: "Source URL no longer works",
    color: "text-red-500",
    hoverColor: "hover:text-red-600",
  },
  paywalled: {
    icon: Lock,
    label: "Paywalled",
    description: "Source is behind a paywall",
    color: "text-purple-500",
    hoverColor: "hover:text-purple-600",
  },
};

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString();
}

export function VerificationBadge({
  status,
  lastCheckedAt,
  canonicalUrl,
  onVerifyNow,
  loading = false,
  compact = false,
}: VerificationBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const badge = (
    <button
      onClick={onVerifyNow ? (e) => {
        e.stopPropagation();
        if (!loading) onVerifyNow();
      } : undefined}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-1 transition-colors",
        config.color,
        config.hoverColor,
        onVerifyNow && "cursor-pointer",
        !onVerifyNow && "cursor-default"
      )}
    >
      {loading ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
    </button>
  );

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent sideOffset={2} side="bottom" className="ml-4 bg-white border border-indigo-200 max-w-xs">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Icon className={cn("h-3.5 w-3.5", config.color)} />
              <span className="font-medium text-sm">{config.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            {lastCheckedAt && (
              <p className="text-xs text-muted-foreground">
                Last checked {formatDate(lastCheckedAt)}
              </p>
            )}
            {status === "redirected" && canonicalUrl && (
              <p className="text-xs text-muted-foreground">
                Redirects to{" "}
                <a
                  href={canonicalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  {(() => {
                    try {
                      return new URL(canonicalUrl).hostname;
                    } catch {
                      return canonicalUrl;
                    }
                  })()}
                </a>
              </p>
            )}
            {onVerifyNow && (
              <p className="text-xs text-primary">
                {loading ? "Verifying..." : "Click to verify"}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default VerificationBadge;
