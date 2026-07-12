"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { VersionDiff } from "./VersionBadge";
import {
  Plus,
  Minus,
  ArrowRight,
  Shield,
  AlertTriangle,
  CircleDot,
  MessageSquare,
  Check,
  X,
} from "lucide-react";

/**
 * ChangelogViewer - Display formatted changelog between releases
 * 
 * Phase 2.1: Debate Releases & Versioned Memory
 */

// Types matching lib/releases/types.ts
interface ChangelogSummary {
  claimsAdded: number;
  claimsRemoved: number;
  statusChanges: number;
  argumentsAdded: number;
  argumentsRemoved: number;
  netDefended: number;
}

interface ChangelogClaim {
  id: string;
  text: string;
  type: string | null;
  status: string;
}

interface ChangelogStatusChange {
  claimId: string;
  claimText: string;
  fromStatus: string;
  toStatus: string;
}

interface ChangelogArgument {
  id: string;
  type: string;
  conclusionText: string;
}

interface ChangelogAcceptabilityChange {
  argumentId: string;
  conclusionText: string;
  fromAcceptable: boolean;
  toAcceptable: boolean;
}

export interface Changelog {
  fromVersion: string;
  toVersion: string;
  generatedAt: string;
  claims: {
    added: ChangelogClaim[];
    removed: ChangelogClaim[];
    statusChanged: ChangelogStatusChange[];
    modified: { claimId: string; claimText: string; field: string; oldValue: string; newValue: string }[];
  };
  arguments: {
    added: ChangelogArgument[];
    removed: ChangelogArgument[];
    acceptabilityChanged: ChangelogAcceptabilityChange[];
  };
  summary: ChangelogSummary;
}

export interface ChangelogViewerProps {
  changelog: Changelog;
  className?: string;
  compact?: boolean;
}

export function ChangelogViewer({
  changelog,
  className,
  compact = false,
}: ChangelogViewerProps) {
  const hasChanges =
    changelog.claims.added.length > 0 ||
    changelog.claims.removed.length > 0 ||
    changelog.claims.statusChanged.length > 0 ||
    changelog.arguments.added.length > 0 ||
    changelog.arguments.removed.length > 0 ||
    changelog.arguments.acceptabilityChanged.length > 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <VersionDiff from={changelog.fromVersion} to={changelog.toVersion} size="md" />
        <span className="text-xs text-slate-400">
          {new Date(changelog.generatedAt).toLocaleDateString()}
        </span>
      </div>

      {/* Summary Stats */}
      <ChangelogSummaryBar summary={changelog.summary} />

      {!hasChanges && (
        <p className="text-sm text-slate-500 text-center py-4">
          No significant changes between these versions.
        </p>
      )}

      {/* Claims Added */}
      {changelog.claims.added.length > 0 && (
        <ChangelogSection
          title="New Claims"
          icon={<Plus className="w-4 h-4 text-emerald-500" />}
          count={changelog.claims.added.length}
          compact={compact}
        >
          {changelog.claims.added.map((claim) => (
            <ClaimChangeItem
              key={claim.id}
              text={claim.text}
              status={claim.status}
              variant="added"
            />
          ))}
        </ChangelogSection>
      )}

      {/* Claims Removed */}
      {changelog.claims.removed.length > 0 && (
        <ChangelogSection
          title="Removed Claims"
          icon={<Minus className="w-4 h-4 text-red-500" />}
          count={changelog.claims.removed.length}
          compact={compact}
        >
          {changelog.claims.removed.map((claim) => (
            <ClaimChangeItem
              key={claim.id}
              text={claim.text}
              status={claim.status}
              variant="removed"
            />
          ))}
        </ChangelogSection>
      )}

      {/* Status Changes */}
      {changelog.claims.statusChanged.length > 0 && (
        <ChangelogSection
          title="Status Changes"
          icon={<ArrowRight className="w-4 h-4 text-blue-500" />}
          count={changelog.claims.statusChanged.length}
          compact={compact}
        >
          {changelog.claims.statusChanged.map((change) => (
            <StatusChangeItem key={change.claimId} change={change} />
          ))}
        </ChangelogSection>
      )}

      {/* Arguments Added */}
      {changelog.arguments.added.length > 0 && (
        <ChangelogSection
          title="New Arguments"
          icon={<MessageSquare className="w-4 h-4 text-emerald-500" />}
          count={changelog.arguments.added.length}
          compact={compact}
        >
          {changelog.arguments.added.map((arg) => (
            <ArgumentChangeItem
              key={arg.id}
              type={arg.type}
              conclusion={arg.conclusionText}
              variant="added"
            />
          ))}
        </ChangelogSection>
      )}

      {/* Arguments Removed */}
      {changelog.arguments.removed.length > 0 && (
        <ChangelogSection
          title="Removed Arguments"
          icon={<MessageSquare className="w-4 h-4 text-red-500" />}
          count={changelog.arguments.removed.length}
          compact={compact}
        >
          {changelog.arguments.removed.map((arg) => (
            <ArgumentChangeItem
              key={arg.id}
              type={arg.type}
              conclusion={arg.conclusionText}
              variant="removed"
            />
          ))}
        </ChangelogSection>
      )}

      {/* Acceptability Changes */}
      {changelog.arguments.acceptabilityChanged.length > 0 && (
        <ChangelogSection
          title="Acceptability Changes"
          icon={<Shield className="w-4 h-4 text-amber-500" />}
          count={changelog.arguments.acceptabilityChanged.length}
          compact={compact}
        >
          {changelog.arguments.acceptabilityChanged.map((change) => (
            <AcceptabilityChangeItem key={change.argumentId} change={change} />
          ))}
        </ChangelogSection>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────

function ChangelogSummaryBar({ summary }: { summary: ChangelogSummary }) {
  const netSign = summary.netDefended >= 0 ? "+" : "";

  return (
    <div className="flex flex-wrap gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs">
      <SummaryItem
        label="Claims"
        value={`+${summary.claimsAdded} / -${summary.claimsRemoved}`}
        positive={summary.claimsAdded > summary.claimsRemoved}
      />
      <SummaryItem label="Status Changes" value={summary.statusChanges} />
      <SummaryItem
        label="Arguments"
        value={`+${summary.argumentsAdded} / -${summary.argumentsRemoved}`}
        positive={summary.argumentsAdded > summary.argumentsRemoved}
      />
      <SummaryItem
        label="Net Defended"
        value={`${netSign}${summary.netDefended}`}
        positive={summary.netDefended > 0}
        negative={summary.netDefended < 0}
      />
    </div>
  );
}

function SummaryItem({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: string | number;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-500">{label}:</span>
      <span
        className={cn(
          "font-medium",
          positive && "text-emerald-600 dark:text-emerald-400",
          negative && "text-red-600 dark:text-red-400",
          !positive && !negative && "text-slate-700 dark:text-slate-300"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ChangelogSection({
  title,
  icon,
  count,
  compact,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  compact: boolean;
  children: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = React.useState(!compact || count <= 3);

  const displayChildren = compact && !isExpanded
    ? React.Children.toArray(children).slice(0, 3)
    : children;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {title}
        </span>
        <span className="text-xs text-slate-400">({count})</span>
      </div>
      <div className="space-y-1 pl-6">{displayChildren}</div>
      {compact && count > 3 && !isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="ml-6 text-xs text-blue-500 hover:text-blue-600"
        >
          Show {count - 3} more...
        </button>
      )}
    </div>
  );
}

function ClaimChangeItem({
  text,
  status,
  variant,
}: {
  text: string;
  status: string;
  variant: "added" | "removed";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 text-sm p-2 rounded",
        variant === "added" && "bg-emerald-50 dark:bg-emerald-900/20",
        variant === "removed" && "bg-red-50 dark:bg-red-900/20 line-through opacity-70"
      )}
    >
      <StatusBadge status={status} />
      <span className="text-slate-700 dark:text-slate-300 line-clamp-2">{text}</span>
    </div>
  );
}

function StatusChangeItem({ change }: { change: ChangelogStatusChange }) {
  return (
    <div className="flex items-start gap-2 text-sm p-2 rounded bg-blue-50 dark:bg-blue-900/20">
      <div className="flex items-center gap-1 shrink-0">
        <StatusBadge status={change.fromStatus} />
        <ArrowRight className="w-3 h-3 text-slate-400" />
        <StatusBadge status={change.toStatus} />
      </div>
      <span className="text-slate-700 dark:text-slate-300 line-clamp-1">
        {change.claimText}
      </span>
    </div>
  );
}

function ArgumentChangeItem({
  type,
  conclusion,
  variant,
}: {
  type: string;
  conclusion: string;
  variant: "added" | "removed";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 text-sm p-2 rounded",
        variant === "added" && "bg-emerald-50 dark:bg-emerald-900/20",
        variant === "removed" && "bg-red-50 dark:bg-red-900/20 line-through opacity-70"
      )}
    >
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 shrink-0">
        {type}
      </span>
      <span className="text-slate-700 dark:text-slate-300 line-clamp-1">
        → {conclusion}
      </span>
    </div>
  );
}

function AcceptabilityChangeItem({ change }: { change: ChangelogAcceptabilityChange }) {
  return (
    <div className="flex items-start gap-2 text-sm p-2 rounded bg-amber-50 dark:bg-amber-900/20">
      <div className="flex items-center gap-1 shrink-0">
        {change.fromAcceptable ? (
          <Check className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <X className="w-3.5 h-3.5 text-red-500" />
        )}
        <ArrowRight className="w-3 h-3 text-slate-400" />
        {change.toAcceptable ? (
          <Check className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <X className="w-3.5 h-3.5 text-red-500" />
        )}
      </div>
      <span className="text-slate-700 dark:text-slate-300 line-clamp-1">
        → {change.conclusionText}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ReactNode; className: string }> = {
    DEFENDED: {
      icon: <Shield className="w-3 h-3" />,
      className: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30",
    },
    CONTESTED: {
      icon: <AlertTriangle className="w-3 h-3" />,
      className: "text-amber-600 bg-amber-100 dark:bg-amber-900/30",
    },
    UNRESOLVED: {
      icon: <CircleDot className="w-3 h-3" />,
      className: "text-slate-500 bg-slate-100 dark:bg-slate-700",
    },
    WITHDRAWN: {
      icon: <X className="w-3 h-3" />,
      className: "text-red-600 bg-red-100 dark:bg-red-900/30",
    },
    ACCEPTED: {
      icon: <Check className="w-3 h-3" />,
      className: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
    },
  };

  const { icon, className } = config[status] || config.UNRESOLVED;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0",
        className
      )}
    >
      {icon}
      <span className="hidden sm:inline">{status}</span>
    </span>
  );
}
