"use client";

import * as React from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { VersionBadge } from "./VersionBadge";
import { ChangelogViewer, Changelog } from "./ChangelogViewer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  MessageSquare,
  Shield,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  BarChart3,
  History,
  X,
} from "lucide-react";

/**
 * ReleaseDetailPanel - Full panel showing release details
 * 
 * Phase 2.1: Debate Releases & Versioned Memory
 */

interface ClaimStats {
  total: number;
  defended: number;
  contested: number;
  unresolved: number;
  withdrawn: number;
  accepted: number;
}

interface ArgumentStats {
  total: number;
  acceptable: number;
  defeated: number;
  attackEdges: number;
  supportEdges: number;
}

interface ReleaseDetail {
  id: string;
  deliberationId: string;
  version: string;
  versionMajor: number;
  versionMinor: number;
  versionPatch: number;
  title: string | null;
  description: string | null;
  citationUri: string;
  bibtex: string | null;
  createdAt: string;
  createdById: string;
  stats: {
    claims: ClaimStats;
    arguments: ArgumentStats;
  };
  changelog?: {
    summary: Changelog["summary"];
    text: string;
    details: Changelog;
  };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface ReleaseDetailPanelProps {
  deliberationId: string;
  releaseId: string;
  onClose?: () => void;
  className?: string;
}

export function ReleaseDetailPanel({
  deliberationId,
  releaseId,
  onClose,
  className,
}: ReleaseDetailPanelProps) {
  const { data: release, error, isLoading } = useSWR<ReleaseDetail>(
    `/api/deliberations/${deliberationId}/releases/${releaseId}?includeChangelog=true`,
    fetcher
  );

  const [copiedBibtex, setCopiedBibtex] = React.useState(false);
  const [copiedUri, setCopiedUri] = React.useState(false);

  const handleCopyBibtex = async () => {
    if (release?.bibtex) {
      await navigator.clipboard.writeText(release.bibtex);
      setCopiedBibtex(true);
      setTimeout(() => setCopiedBibtex(false), 2000);
    }
  };

  const handleCopyUri = async () => {
    if (release?.citationUri) {
      await navigator.clipboard.writeText(release.citationUri);
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 2000);
    }
  };

  if (isLoading) {
    return <ReleaseDetailSkeleton className={className} />;
  }

  if (error || !release) {
    return (
      <div className={cn("p-6 text-center", className)}>
        <p className="text-sm text-red-500">Failed to load release details</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <VersionBadge version={release.version} size="lg" />
            {release.title && (
              <span className="text-lg font-medium text-slate-800 dark:text-slate-200">
                {release.title}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Created {new Date(release.createdAt).toLocaleDateString()}
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="px-4 pt-2 justify-start bg-transparent border-b border-slate-200 dark:border-slate-700 rounded-none">
          <TabsTrigger value="overview" className="text-xs">
            <BarChart3 className="w-3.5 h-3.5 mr-1" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="changelog" className="text-xs">
            <History className="w-3.5 h-3.5 mr-1" />
            Changelog
          </TabsTrigger>
          <TabsTrigger value="citation" className="text-xs">
            <BookOpen className="w-3.5 h-3.5 mr-1" />
            Citation
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="flex-1 overflow-y-auto p-4 space-y-4">
          {release.description && (
            <div>
              <h4 className="text-xs font-medium text-slate-500 mb-1">Description</h4>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {release.description}
              </p>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<FileText className="w-4 h-4" />}
              label="Claims"
              value={release.stats.claims.total}
            />
            <StatCard
              icon={<MessageSquare className="w-4 h-4" />}
              label="Arguments"
              value={release.stats.arguments.total}
            />
            <StatCard
              icon={<Shield className="w-4 h-4 text-emerald-500" />}
              label="Defended"
              value={release.stats.claims.defended}
              variant="success"
            />
            <StatCard
              icon={<Shield className="w-4 h-4 text-emerald-500" />}
              label="Acceptable"
              value={release.stats.arguments.acceptable}
              variant="success"
            />
          </div>

          {/* Claim Status Breakdown */}
          <div>
            <h4 className="text-xs font-medium text-slate-500 mb-2">Claim Status Breakdown</h4>
            <div className="space-y-1.5">
              <StatusBar label="Defended" value={release.stats.claims.defended} total={release.stats.claims.total} color="emerald" />
              <StatusBar label="Contested" value={release.stats.claims.contested} total={release.stats.claims.total} color="amber" />
              <StatusBar label="Unresolved" value={release.stats.claims.unresolved} total={release.stats.claims.total} color="slate" />
              <StatusBar label="Accepted" value={release.stats.claims.accepted} total={release.stats.claims.total} color="blue" />
            </div>
          </div>

          {/* Argument Stats */}
          <div>
            <h4 className="text-xs font-medium text-slate-500 mb-2">Argument Graph</h4>
            <div className="flex gap-4 text-sm">
              <span className="text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {release.stats.arguments.attackEdges}
                </span>{" "}
                attacks
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {release.stats.arguments.supportEdges}
                </span>{" "}
                supports
              </span>
            </div>
          </div>
        </TabsContent>

        {/* Changelog Tab */}
        <TabsContent value="changelog" className="flex-1 overflow-y-auto p-4">
          {release.changelog?.details ? (
            <ChangelogViewer changelog={release.changelog.details} />
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">
              This is the first release — no changelog available.
            </p>
          )}
        </TabsContent>

        {/* Citation Tab */}
        <TabsContent value="citation" className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Citation URI */}
          <div>
            <h4 className="text-xs font-medium text-slate-500 mb-2">Citation URI</h4>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded font-mono overflow-x-auto">
                {release.citationUri}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopyUri} className="shrink-0">
                {copiedUri ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="sm" asChild className="shrink-0">
                <a href={release.citationUri} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </div>

          {/* BibTeX */}
          {release.bibtex && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-slate-500">BibTeX</h4>
                <Button variant="ghost" size="sm" onClick={handleCopyBibtex} className="h-7 text-xs">
                  {copiedBibtex ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <pre className="text-xs bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded font-mono overflow-x-auto whitespace-pre-wrap">
                {release.bibtex}
              </pre>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  variant?: "success" | "warning" | "error";
}) {
  return (
    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <span
        className={cn(
          "text-xl font-semibold",
          variant === "success" && "text-emerald-600 dark:text-emerald-400",
          variant === "warning" && "text-amber-600 dark:text-amber-400",
          variant === "error" && "text-red-600 dark:text-red-400",
          !variant && "text-slate-800 dark:text-slate-200"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function StatusBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: "emerald" | "amber" | "slate" | "blue" | "red";
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const colorClasses = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    slate: "bg-slate-400",
    blue: "bg-blue-500",
    red: "bg-red-500",
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-slate-500">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", colorClasses[color])}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-slate-600 dark:text-slate-400">{value}</span>
    </div>
  );
}

function ReleaseDetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse", className)}>
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
