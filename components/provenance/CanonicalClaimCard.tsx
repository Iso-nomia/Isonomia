"use client";

/**
 * CanonicalClaimCard Component
 * 
 * Phase 3.1: Claim Provenance Tracking
 * 
 * Displays canonical claim information across deliberations:
 * - Representative text
 * - Instance count across deliberations
 * - Global consensus status
 * - Challenge statistics
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Globe,
  Hash,
  MessageSquare,
  Users,
  ExternalLink,
  Clock,
  Swords,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import type { ConsensusStatus } from "@prisma/client";

const STATUS_CONFIG: Record<
  ConsensusStatus,
  {
    label: string;
    description: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  UNDETERMINED: {
    label: "Undetermined",
    description: "Not enough engagement to determine consensus",
    icon: Clock,
    color: "text-slate-500",
    bgColor: "bg-slate-100 dark:bg-slate-800",
    borderColor: "border-slate-300 dark:border-slate-600",
  },
  EMERGING: {
    label: "Emerging",
    description: "Building support, more defended than challenged",
    icon: MessageSquare,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-300 dark:border-blue-700",
  },
  ACCEPTED: {
    label: "Accepted",
    description: "Broad acceptance, all challenges defended",
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-900/20",
    borderColor: "border-green-300 dark:border-green-700",
  },
  CONTESTED: {
    label: "Contested",
    description: "Active disagreement with open challenges",
    icon: Swords,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    borderColor: "border-amber-300 dark:border-amber-700",
  },
  REJECTED: {
    label: "Rejected",
    description: "Broadly rejected, majority of challenges conceded",
    icon: Swords,
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-900/20",
    borderColor: "border-red-300 dark:border-red-700",
  },
  SUPERSEDED: {
    label: "Superseded",
    description: "Replaced by a refined version",
    icon: Clock,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
    borderColor: "border-purple-300 dark:border-purple-700",
  },
};

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface CanonicalClaimData {
  id: string;
  slug: string;
  representativeText: string;
  description?: string;
  totalInstances: number;
  totalChallenges: number;
  globalStatus: ConsensusStatus;
  lastActivityAt?: Date | string;
  instances?: CanonicalClaimInstance[];
}

export interface CanonicalClaimInstance {
  id: string;
  claimId: string;
  deliberationId: string;
  deliberationTitle?: string;
  localStatus?: ConsensusStatus;
  isPrimary: boolean;
}

// ─────────────────────────────────────────────────────────
// CanonicalClaimCard Component
// ─────────────────────────────────────────────────────────

export interface CanonicalClaimCardProps {
  canonical: CanonicalClaimData;
  showInstances?: boolean;
  maxInstances?: number;
  onViewDetails?: (canonicalId: string) => void;
  onViewInstance?: (claimId: string, deliberationId: string) => void;
  className?: string;
}

export function CanonicalClaimCard({
  canonical,
  showInstances = true,
  maxInstances = 3,
  onViewDetails,
  onViewInstance,
  className,
}: CanonicalClaimCardProps) {
  const statusConfig = STATUS_CONFIG[canonical.globalStatus];
  const StatusIcon = statusConfig.icon;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Canonical icon and info */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Globe className="h-5 w-5 text-primary" />
            </div>

            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base">Canonical Claim</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs gap-1",
                        statusConfig.bgColor,
                        statusConfig.color
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    Global status: {statusConfig.description}
                  </TooltipContent>
                </Tooltip>
              </div>

              <CardDescription className="text-xs">
                Cross-deliberation identity
              </CardDescription>
            </div>
          </div>

          {onViewDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewDetails(canonical.id)}
              className="shrink-0"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Representative text */}
        <div className="mt-3 p-2 bg-muted/50 rounded-md">
          <p className="text-sm line-clamp-3">{canonical.representativeText}</p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                {canonical.slug}
              </span>
            </TooltipTrigger>
            <TooltipContent>Canonical slug (unique identifier)</TooltipContent>
          </Tooltip>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {canonical.totalInstances} instance(s)
          </span>
          <span className="flex items-center gap-1">
            <Swords className="h-3 w-3" />
            {canonical.totalChallenges} challenge(s)
          </span>
          {canonical.lastActivityAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(canonical.lastActivityAt)}
            </span>
          )}
        </div>
      </CardHeader>

      {/* Instances section */}
      {showInstances && canonical.instances && canonical.instances.length > 0 && (
        <CardContent className="pt-0 px-4 pb-4 border-t">
          <div className="space-y-2 mt-3">
            <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              Instances across deliberations
            </h4>

            <div className="space-y-1">
              {canonical.instances.slice(0, maxInstances).map((instance) => (
                <InstanceItem
                  key={instance.id}
                  instance={instance}
                  onClick={
                    onViewInstance
                      ? () =>
                          onViewInstance(instance.claimId, instance.deliberationId)
                      : undefined
                  }
                />
              ))}
              {canonical.instances.length > maxInstances && (
                <p className="text-xs text-muted-foreground pl-2">
                  +{canonical.instances.length - maxInstances} more instances
                </p>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// InstanceItem Component
// ─────────────────────────────────────────────────────────

interface InstanceItemProps {
  instance: CanonicalClaimInstance;
  onClick?: () => void;
}

function InstanceItem({ instance, onClick }: InstanceItemProps) {
  const statusConfig = instance.localStatus
    ? STATUS_CONFIG[instance.localStatus]
    : null;

  return (
    <div
      className={cn(
        "p-2 rounded border bg-muted/30 text-xs flex items-center justify-between gap-2",
        onClick && "cursor-pointer hover:bg-muted/50"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 min-w-0">
        {instance.isPrimary && (
          <Tooltip>
            <TooltipTrigger asChild>
              <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
            </TooltipTrigger>
            <TooltipContent>Primary instance</TooltipContent>
          </Tooltip>
        )}
        <span className="truncate">
          {instance.deliberationTitle || `Deliberation ${instance.deliberationId.slice(0, 8)}`}
        </span>
      </div>

      {statusConfig && (
        <Badge
          variant="outline"
          className={cn("text-xs shrink-0", statusConfig.color)}
        >
          {statusConfig.label}
        </Badge>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// CanonicalClaimBadge Component
// ─────────────────────────────────────────────────────────

export interface CanonicalClaimBadgeProps {
  slug: string;
  instanceCount?: number;
  onClick?: () => void;
  className?: string;
}

export function CanonicalClaimBadge({
  slug,
  instanceCount,
  onClick,
  className,
}: CanonicalClaimBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "text-xs gap-1 cursor-pointer hover:bg-muted",
            className
          )}
          onClick={onClick}
        >
          <Globe className="h-3 w-3" />
          {slug}
          {instanceCount !== undefined && instanceCount > 1 && (
            <span className="text-muted-foreground">×{instanceCount}</span>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">Canonical Claim</p>
        <p className="text-xs text-muted-foreground">
          {instanceCount !== undefined
            ? `Appears in ${instanceCount} deliberation(s)`
            : "Cross-deliberation identity"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

// ─────────────────────────────────────────────────────────
// CanonicalClaimLink Component
// ─────────────────────────────────────────────────────────

export interface CanonicalClaimLinkProps {
  canonicalId: string;
  slug: string;
  representativeText?: string;
  href?: string;
  className?: string;
}

export function CanonicalClaimLink({
  canonicalId,
  slug,
  representativeText,
  href,
  className,
}: CanonicalClaimLinkProps) {
  const Component = href ? "a" : "span";
  const linkProps = href ? { href } : {};

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Component
          {...linkProps}
          className={cn(
            "inline-flex items-center gap-1 text-primary hover:underline",
            className
          )}
        >
          <Globe className="h-3 w-3" />
          <span>{slug}</span>
        </Component>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium">Canonical Claim</p>
        {representativeText && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {representativeText}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

// ─────────────────────────────────────────────────────────
// CanonicalClaimCardSkeleton
// ─────────────────────────────────────────────────────────

export function CanonicalClaimCardSkeleton() {
  return (
    <Card>
      <CardHeader className="p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-12 w-full mt-3" />
        <Skeleton className="h-4 w-48 mt-3" />
      </CardHeader>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes <= 1 ? "just now" : `${minutes}m ago`;
    }
    return `${hours}h ago`;
  }

  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;

  return d.toLocaleDateString();
}

export default CanonicalClaimCard;
