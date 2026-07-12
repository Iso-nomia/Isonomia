"use client";

import React from "react";
import { Globe, Link2, ExternalLink, Loader2 } from "lucide-react";
import { useClaimCrossRoomStatus } from "@/lib/crossDeliberation/hooks";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface CanonicalClaimBadgeProps {
  claimId: string;
  compact?: boolean;
  showTooltip?: boolean;
  className?: string;
}

/**
 * Badge component that shows if a claim is part of the canonical registry
 * and how many other deliberations discuss similar claims.
 * 
 * Phase 3.3: Cross-Deliberation Claim Mapping
 */
export function CanonicalClaimBadge({
  claimId,
  compact = true,
  showTooltip = true,
  className = "",
}: CanonicalClaimBadgeProps) {
  const { data: status, isLoading } = useClaimCrossRoomStatus(claimId);

  if (isLoading) {
    return (
      <Badge variant="outline" className={`gap-1 ${className}`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        {!compact && <span className="text-xs">Checking...</span>}
      </Badge>
    );
  }

  if (!status || !status.isCanonical) {
    // Claim not in canonical registry - optionally show nothing or a subtle indicator
    return null;
  }

  const {
    canonicalId,
    totalInstances,
    globalStatus,
    otherDeliberations = [],
  } = status;

  const badge = (
    <Badge
      variant="outline"
      className={`gap-1.5 cursor-help border-blue-300 bg-blue-50/50 text-blue-700 hover:bg-blue-100 transition-colors ${className}`}
    >
      <Globe className="w-3 h-3" />
      {compact ? (
        <span className="text-xs font-medium">{totalInstances}</span>
      ) : (
        <span className="text-xs">
          {totalInstances} deliberation{totalInstances !== 1 ? "s" : ""}
        </span>
      )}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs p-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-sm">Canonical Claim</span>
          </div>
          
          <p className="text-xs text-gray-600">
            This claim appears in <strong>{totalInstances}</strong> deliberation
            {totalInstances !== 1 ? "s" : ""} across the network.
          </p>

          {globalStatus && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Global status:</span>
              <StatusBadge status={globalStatus} />
            </div>
          )}

          {otherDeliberations.length > 0 && (
            <div className="border-t border-gray-200 pt-2 mt-2">
              <p className="text-xs text-gray-500 mb-1">Also discussed in:</p>
              <ul className="space-y-1">
                {otherDeliberations.slice(0, 3).map((delib: { id: string; title: string }) => (
                  <li key={delib.id} className="flex items-center gap-1 text-xs">
                    <Link2 className="w-3 h-3 text-gray-400" />
                    <span className="truncate max-w-[180px]">{delib.title}</span>
                  </li>
                ))}
                {otherDeliberations.length > 3 && (
                  <li className="text-xs text-gray-400 italic">
                    +{otherDeliberations.length - 3} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    ACCEPTED: "bg-green-100 text-green-700",
    EMERGING: "bg-blue-100 text-blue-600",
    CONTESTED: "bg-amber-100 text-amber-700",
    REJECTED: "bg-red-100 text-red-700",
    UNDETERMINED: "bg-gray-100 text-gray-600",
    SUPERSEDED: "bg-purple-100 text-purple-600",
  };

  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
        statusColors[status] || statusColors.UNDETERMINED
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

/**
 * Compact inline version for use in lists
 */
export function CanonicalClaimIndicator({
  claimId,
}: {
  claimId: string;
}) {
  const { data: status } = useClaimCrossRoomStatus(claimId);

  if (!status?.isCanonical) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-0.5 text-blue-600 cursor-help">
          <Globe className="w-3 h-3" />
          <span className="text-[10px] font-medium">{status.totalInstances}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">
          Discussed in {status.totalInstances} deliberation
          {status.totalInstances !== 1 ? "s" : ""}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export default CanonicalClaimBadge;
