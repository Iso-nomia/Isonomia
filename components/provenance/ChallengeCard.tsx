"use client";

/**
 * ChallengeCard Component
 * 
 * Phase 3.1: Claim Provenance Tracking
 * 
 * Displays attack/challenge information with defenses:
 * - Attack type (Rebuts, Undercuts, Undermines)
 * - Attack status
 * - Attacker information
 * - Defense responses
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Swords,
  Shield,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AttackSummary,
  DefenseSummary,
  ChallengeReport,
} from "@/lib/provenance/types";
import type { AttackType, ClaimAttackStatus, ClaimDefenseOutcome } from "@prisma/client";

// ─────────────────────────────────────────────────────────
// Attack Type Configuration
// ─────────────────────────────────────────────────────────

const ATTACK_TYPE_CONFIG: Record<
  AttackType,
  {
    label: string;
    description: string;
    color: string;
    icon: React.ElementType;
  }
> = {
  REBUTS: {
    label: "Rebuttal",
    description: "Directly contradicts the claim's conclusion",
    color: "text-red-600 bg-red-100 dark:bg-red-900/30 border-red-200",
    icon: Swords,
  },
  UNDERCUTS: {
    label: "Undercut",
    description: "Attacks the connection between premises and conclusion",
    color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 border-orange-200",
    icon: Swords,
  },
  UNDERMINES: {
    label: "Undermine",
    description: "Attacks one or more premises of the argument",
    color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30 border-amber-200",
    icon: Swords,
  },
};

const ATTACK_STATUS_CONFIG: Record<
  ClaimAttackStatus,
  {
    label: string;
    color: string;
    icon: React.ElementType;
  }
> = {
  OPEN: {
    label: "Open",
    color: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30",
    icon: HelpCircle,
  },
  UNDER_REVIEW: {
    label: "Under Review",
    color: "text-red-600 bg-red-100 dark:bg-red-900/30",
    icon: AlertTriangle,
  },
  DEFENDED: {
    label: "Defended",
    color: "text-green-600 bg-green-100 dark:bg-green-900/30",
    icon: Shield,
  },
  PARTIALLY_DEFENDED: {
    label: "Partially Defended",
    color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30",
    icon: AlertTriangle,
  },
  CONCEDED: {
    label: "Conceded",
    color: "text-gray-600 bg-gray-100 dark:bg-gray-900/30",
    icon: CheckCircle2,
  },
  WITHDRAWN: {
    label: "Withdrawn",
    color: "text-slate-500 bg-slate-100 dark:bg-slate-900/30",
    icon: XCircle,
  },
  STALEMATE: {
    label: "Stalemate",
    color: "text-slate-600 bg-slate-100 dark:bg-slate-900/30",
    icon: HelpCircle,
  },
};

const DEFENSE_OUTCOME_CONFIG: Record<
  ClaimDefenseOutcome,
  {
    label: string;
    color: string;
    icon: React.ElementType;
  }
> = {
  PENDING: {
    label: "Pending",
    color: "text-yellow-600",
    icon: HelpCircle,
  },
  SUCCESSFUL: {
    label: "Successful",
    color: "text-green-600",
    icon: CheckCircle2,
  },
  PARTIAL: {
    label: "Partial",
    color: "text-amber-600",
    icon: AlertTriangle,
  },
  UNSUCCESSFUL: {
    label: "Unsuccessful",
    color: "text-red-600",
    icon: XCircle,
  },
};

// ─────────────────────────────────────────────────────────
// ChallengeCard Component
// ─────────────────────────────────────────────────────────

export interface ChallengeCardProps {
  attack: AttackSummary;
  defenses?: DefenseSummary[];
  showDefenses?: boolean;
  onAddDefense?: (attackId: string) => void;
  onViewDetails?: (attackId: string) => void;
  className?: string;
}

export function ChallengeCard({
  attack,
  defenses = [],
  showDefenses = true,
  onAddDefense,
  onViewDetails,
  className,
}: ChallengeCardProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const attackConfig = ATTACK_TYPE_CONFIG[attack.attackType];
  const statusConfig = ATTACK_STATUS_CONFIG[attack.status];
  const StatusIcon = statusConfig.icon;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {/* Attack type icon */}
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                  attackConfig.color
                )}
              >
                <Swords className="h-5 w-5" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    {attackConfig.label}
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="secondary"
                        className={cn("text-xs", statusConfig.color)}
                      >
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      Attack status: {statusConfig.label}
                    </TooltipContent>
                  </Tooltip>
                </div>

                <CardDescription className="text-xs">
                  {attackConfig.description}
                </CardDescription>
              </div>
            </div>

            {/* Expand button */}
            {showDefenses && defenses.length > 0 && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="shrink-0">
                  <span className="text-xs mr-1">{defenses.length} defense(s)</span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>

          {/* Attacker info */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {attack.argument?.authorName || "Unknown"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(attack.createdAt)}
            </span>
            {attack.argument?.id && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Has supporting argument
              </span>
            )}
          </div>
        </CardHeader>

        {/* Defenses section */}
        {showDefenses && (
          <CollapsibleContent>
            <CardContent className="pt-0 px-4 pb-4 border-t">
              <div className="space-y-3 mt-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  Defenses
                </h4>

                {defenses.length > 0 ? (
                  <div className="space-y-2">
                    {defenses.map((defense) => (
                      <DefenseItem key={defense.id} defense={defense} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No defenses submitted yet
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-2">
                  {onAddDefense && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAddDefense(attack.id)}
                      className="text-xs"
                    >
                      <Shield className="h-3 w-3 mr-1" />
                      Add Defense
                    </Button>
                  )}
                  {onViewDetails && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetails(attack.id)}
                      className="text-xs"
                    >
                      View Details
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        )}
      </Collapsible>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// DefenseItem Component
// ─────────────────────────────────────────────────────────

interface DefenseItemProps {
  defense: DefenseSummary;
  className?: string;
}

function DefenseItem({ defense, className }: DefenseItemProps) {
  const outcomeConfig = DEFENSE_OUTCOME_CONFIG[defense.outcome ?? "PENDING"];
  const OutcomeIcon = outcomeConfig.icon;

  return (
    <div
      className={cn(
        "p-2 bg-muted/50 rounded-md border text-xs",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs capitalize">
            {formatDefenseType(defense.defenseType)}
          </Badge>
          <span className={cn("flex items-center gap-1", outcomeConfig.color)}>
            <OutcomeIcon className="h-3 w-3" />
            {outcomeConfig.label}
          </span>
        </div>
        <span className="text-muted-foreground">
          {formatDate(defense.createdAt)}
        </span>
      </div>
      {defense.argument?.authorName && (
        <div className="flex items-center gap-1 mt-1 text-muted-foreground">
          <User className="h-3 w-3" />
          {defense.argument.authorName}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ChallengeReportCard Component
// ─────────────────────────────────────────────────────────

export interface ChallengeReportCardProps {
  report: ChallengeReport;
  onChallengeClick?: (attackId: string) => void;
  className?: string;
}

export function ChallengeReportCard({
  report,
  onChallengeClick,
  className,
}: ChallengeReportCardProps) {
  const allAttacks: AttackSummary[] = [
    ...report.challenges.rebuttals,
    ...report.challenges.undercuts,
    ...report.challenges.undermines,
  ];

  const summary = {
    totalAttacks: allAttacks.length,
    defended: allAttacks.filter(
      (a) => a.status === "DEFENDED" || a.status === "PARTIALLY_DEFENDED"
    ).length,
    conceded: allAttacks.filter((a) => a.status === "CONCEDED").length,
    active: allAttacks.filter(
      (a) => a.status === "OPEN" || a.status === "UNDER_REVIEW"
    ).length,
  };

  const attacksByType: Record<AttackType, number> = {
    REBUTS: report.challenges.rebuttals.length,
    UNDERCUTS: report.challenges.undercuts.length,
    UNDERMINES: report.challenges.undermines.length,
  };

  const activeAttacks = allAttacks.filter(
    (a) => a.status === "OPEN" || a.status === "UNDER_REVIEW"
  );
  const resolvedAttacks = allAttacks.filter(
    (a) =>
      a.status === "DEFENDED" ||
      a.status === "PARTIALLY_DEFENDED" ||
      a.status === "CONCEDED" ||
      a.status === "WITHDRAWN" ||
      a.status === "STALEMATE"
  );

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Swords className="h-5 w-5 text-red-600" />
          Challenge Report
        </CardTitle>
        <CardDescription>
          Overview of challenges and defenses for this claim
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Total Challenges"
            value={summary.totalAttacks}
            icon={Swords}
            color="text-red-600"
          />
          <StatCard
            label="Defended"
            value={summary.defended}
            icon={Shield}
            color="text-green-600"
          />
          <StatCard
            label="Conceded"
            value={summary.conceded}
            icon={CheckCircle2}
            color="text-amber-600"
          />
          <StatCard
            label="Active"
            value={summary.active}
            icon={AlertTriangle}
            color="text-red-600"
          />
        </div>

        {/* Attack type breakdown */}
        {Object.keys(attacksByType).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">By Attack Type</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(attacksByType).map(([type, count]) => {
                const config = ATTACK_TYPE_CONFIG[type as AttackType];
                return (
                  <Badge
                    key={type}
                    variant="outline"
                    className={cn("text-xs", config.color)}
                  >
                    {config.label}: {count}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Active attacks */}
        {activeAttacks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Active Challenges ({activeAttacks.length})
            </h4>
            <div className="space-y-2">
              {activeAttacks.slice(0, 3).map((attack) => (
                <ChallengeCardCompact
                  key={attack.id}
                  attack={attack}
                  onClick={onChallengeClick ? () => onChallengeClick(attack.id) : undefined}
                />
              ))}
              {activeAttacks.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{activeAttacks.length - 3} more active challenges
                </p>
              )}
            </div>
          </div>
        )}

        {/* Resolved attacks */}
        {resolvedAttacks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Resolved ({resolvedAttacks.length})
            </h4>
            <div className="space-y-1">
              {resolvedAttacks.slice(0, 2).map((attack) => (
                <ChallengeCardCompact
                  key={attack.id}
                  attack={attack}
                  onClick={onChallengeClick ? () => onChallengeClick(attack.id) : undefined}
                  compact
                />
              ))}
              {resolvedAttacks.length > 2 && (
                <p className="text-xs text-muted-foreground">
                  +{resolvedAttacks.length - 2} more resolved
                </p>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {summary.totalAttacks === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No challenges recorded</p>
            <p className="text-xs">This claim has not been formally challenged yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// ChallengeCardCompact Component
// ─────────────────────────────────────────────────────────

interface ChallengeCardCompactProps {
  attack: AttackSummary;
  onClick?: () => void;
  compact?: boolean;
  className?: string;
}

function ChallengeCardCompact({
  attack,
  onClick,
  compact = false,
  className,
}: ChallengeCardCompactProps) {
  const attackConfig = ATTACK_TYPE_CONFIG[attack.attackType];
  const statusConfig = ATTACK_STATUS_CONFIG[attack.status];

  return (
    <div
      className={cn(
        "p-2 rounded border bg-muted/30 text-sm",
        onClick && "cursor-pointer hover:bg-muted/50",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("text-xs", attackConfig.color)}>
            {attackConfig.label}
          </Badge>
          {!compact && (
            <Badge variant="secondary" className={cn("text-xs", statusConfig.color)}>
              {statusConfig.label}
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDate(attack.createdAt)}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// StatCard Component
// ─────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  return (
    <div className="p-3 rounded-lg bg-muted/50 border">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", color)} />
        <span className="text-xl font-bold">{value}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ChallengeCardSkeleton
// ─────────────────────────────────────────────────────────

export function ChallengeCardSkeleton() {
  return (
    <Card>
      <CardHeader className="p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-4 w-40 mt-3" />
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

function formatDefenseType(type: string): string {
  return type.toLowerCase().replace(/_/g, " ");
}

export default ChallengeCard;
