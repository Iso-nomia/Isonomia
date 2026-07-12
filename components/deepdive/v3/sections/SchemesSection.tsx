"use client";

import React from "react";
import useSWR from "swr";
import { SectionCard } from "@/components/deepdive/shared";
import { Network, ExternalLink, ChevronRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

interface SchemesSectionProps {
  deliberationId: string;
}

interface SchemeGroup {
  schemeId: string;
  schemeName: string;
  schemeKey: string;
  arguments: Array<{
    id: string;
    text: string;
    confidence?: number;
  }>;
  averageConfidence: number;
  cqCount?: number;
}

/**
 * SchemesSection - Browse detected argumentation schemes (Phase 1 Integration)
 * 
 * Features:
 * - Lists all schemes detected in deliberation
 * - Shows argument count per scheme
 * - Displays average confidence scores
 * - Links to scheme definitions
 * - Click to filter/view arguments using that scheme
 */
export function SchemesSection({ deliberationId }: SchemesSectionProps) {
  const { data, error, isLoading } = useSWR(
    `/api/deliberations/${deliberationId}/arguments/aif?limit=100`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Group arguments by scheme
  const schemeGroups = React.useMemo(() => {
    if (!data?.items) return [];

    const groups = new Map<string, SchemeGroup>();

    for (const arg of data.items) {
      const scheme = arg.aif?.scheme;
      if (!scheme) continue;

      // Construct readable text from premises and conclusion if text is empty
      let displayText = arg.text;
      if (!displayText || displayText.trim() === "") {
        const premises = arg.aif?.premises || [];
        const conclusion = arg.aif?.conclusion;
        if (premises.length > 0 || conclusion) {
          const premiseTexts = premises
            .filter((p: any) => p.text)
            .map((p: any) => p.text);
          if (premiseTexts.length > 0 && conclusion?.text) {
            displayText = `${premiseTexts.join("; ")} → ${conclusion.text}`;
          } else if (conclusion?.text) {
            displayText = conclusion.text;
          } else if (premiseTexts.length > 0) {
            displayText = premiseTexts.join("; ");
          }
        }
      }

      const existing = groups.get(scheme.id);
      if (existing) {
        existing.arguments.push({
          id: arg.id,
          text: displayText || "(No text available)",
          confidence: arg.aif?.confidence,
        });
        existing.averageConfidence =
          existing.arguments.reduce((sum, a) => sum + (a.confidence || 1), 0) /
          existing.arguments.length;
      } else {
        groups.set(scheme.id, {
          schemeId: scheme.id,
          schemeName: scheme.name || "Unnamed Scheme",
          schemeKey: scheme.key || "",
          arguments: [
            {
              id: arg.id,
              text: displayText || "(No text available)",
              confidence: arg.aif?.confidence,
            },
          ],
          averageConfidence: arg.aif?.confidence || 1,
          cqCount: arg.aif?.cq?.required || 0,
        });
      }
    }

    return Array.from(groups.values()).sort(
      (a, b) => b.arguments.length - a.arguments.length
    );
  }, [data]);

  if (isLoading) {
    return (
      <SectionCard title="Detected Schemes" className="w-full" padded={true}>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-slate-200/70" />
          ))}
        </div>
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard title="Detected Schemes" className="w-full" padded={true} tone="danger">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-center">
          <p className="text-sm text-rose-700">Failed to load schemes</p>
          <p className="mt-1 text-xs text-rose-600">{error.message}</p>
        </div>
      </SectionCard>
    );
  }

  if (schemeGroups.length === 0) {
    return (
      <SectionCard title="Detected Schemes" className="w-full" padded={true}>
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <Network className="mx-auto mb-3 size-12 text-slate-400" />
          <h3 className="mb-2 text-base font-semibold text-slate-700">
            No Schemes Detected
          </h3>
          <p className="text-sm text-slate-600">
            Arguments in this deliberation don&apos;t have argumentation schemes assigned yet.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Create arguments using the scheme composer to see detected schemes here.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Detected Argumentation Schemes"
      subtitle={`${schemeGroups.length} scheme${schemeGroups.length === 1 ? "" : "s"} found • ${
        data?.items?.length || 0
      } arguments analyzed`}
      className="w-full"
      padded={true}
    >
      <div className="space-y-3">
        {schemeGroups.map((group) => (
          <SchemeCard key={group.schemeId} group={group} />
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
        <h4 className="mb-2 text-sm font-semibold text-indigo-900">
          📊 Scheme Distribution
        </h4>
        <div className="flex flex-wrap gap-2 text-xs text-indigo-700">
          <span>
            <strong>{schemeGroups.length}</strong> distinct schemes
          </span>
          <span>•</span>
          <span>
            <strong>{data?.items?.filter((a: any) => a.aif?.scheme).length}</strong> structured
            arguments
          </span>
          <span>•</span>
          <span>
            Avg confidence:{" "}
            <strong>
              {Math.round(
                (schemeGroups.reduce((sum, g) => sum + g.averageConfidence, 0) /
                  schemeGroups.length) *
                  100
              )}
              %
            </strong>
          </span>
        </div>
      </div>
    </SectionCard>
  );
}

function SchemeCard({ group }: { group: SchemeGroup }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Network className="size-5 shrink-0 text-indigo-600" />
            <h3 className="truncate text-base font-semibold text-slate-900">
              {group.schemeName}
            </h3>
          </div>
          {group.schemeKey && (
            <p className="mt-1 text-xs text-slate-500">
              Key: <code className="rounded bg-slate-100 px-1 py-0.5">{group.schemeKey}</code>
            </p>
          )}
        </div>

        {/* Badges */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
            {group.arguments.length} arg{group.arguments.length === 1 ? "" : "s"}
          </span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            {Math.round(group.averageConfidence * 100)}%
          </span>
        </div>
      </div>

      {/* Metadata */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span>Confidence: {Math.round(group.averageConfidence * 100)}%</span>
        {group.cqCount !== undefined && group.cqCount > 0 && (
          <>
            <span>•</span>
            <span>Critical Questions: {group.cqCount}</span>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Hide" : "View"} Arguments ({group.arguments.length})
          <ChevronRight
            className={`size-3 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </Button>

        <Link
          href={`/schemes/${group.schemeKey || group.schemeId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs">
            <BookOpen className="size-3" />
            View Definition
            <ExternalLink className="size-3" />
          </Button>
        </Link>
      </div>

      {/* Expanded Arguments List */}
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
          <p className="mb-2 text-xs font-medium text-slate-600">
            Showing {Math.min(group.arguments.length, 5)} of {group.arguments.length} argument
            {group.arguments.length === 1 ? "" : "s"}
          </p>
          {group.arguments.slice(0, 5).map((arg, idx) => (
            <div
              key={arg.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
            >
              <p className="text-slate-700">{arg.text}</p>
              {arg.confidence !== undefined && (
                <p className="mt-1 text-xs text-slate-500">
                  Confidence: {Math.round(arg.confidence * 100)}%
                </p>
              )}
            </div>
          ))}
          {group.arguments.length > 5 && (
            <p className="text-center text-xs text-slate-500">
              + {group.arguments.length - 5} more argument
              {group.arguments.length - 5 === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
