"use client";

import React from "react";
import useSWR from "swr";
import { GitFork, ChevronRight, Network, Zap, Activity } from "lucide-react";
import { SectionCard } from "../../shared/SectionCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArgumentNetAnalyzer } from "@/components/argumentation/ArgumentNetAnalyzer";

interface NetworksSectionProps {
  deliberationId: string;
}

interface NetCandidate {
  id: string;
  rootArgumentId: string;
  netType: "convergent" | "linked" | "serial" | "divergent" | "hybrid";
  complexity: number;
  confidence: number;
  schemes: Array<{
    schemeId: string;
    schemeName: string;
    schemeCategory: string;
    role: "primary" | "supporting" | "subordinate";
  }>;
  relationships: Array<{
    sourceScheme: string;
    targetScheme: string;
    type: "supports" | "depends-on" | "challenges" | "refines";
  }>;
}

const fetcher = async (url: string) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!response.ok) throw new Error("Failed to fetch nets");
  return response.json();
};

export function NetworksSection({ deliberationId }: NetworksSectionProps) {
  const [selectedNetId, setSelectedNetId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // Fetch nets for this deliberation
  const { data, error, isLoading } = useSWR(
    `/api/nets/detect?deliberationId=${deliberationId}`,
    async (url) => {
      const response = await fetch("/api/nets/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliberationId }),
      });
      if (!response.ok) throw new Error("Failed to detect nets");
      return response.json();
    },
    { revalidateOnFocus: false }
  );

  const nets: NetCandidate[] = data?.nets || [];

  const handleAnalyzeNet = (netId: string) => {
    setSelectedNetId(netId);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <SectionCard title="Detected Argument Networks" className="w-full" padded={true}>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-lg bg-slate-200/70" />
          ))}
        </div>
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard title="Detected Argument Networks" className="w-full" padded={true} tone="danger">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-center">
          <p className="text-sm text-rose-700">Failed to detect networks</p>
          <p className="mt-1 text-xs text-rose-600">{error.message}</p>
        </div>
      </SectionCard>
    );
  }

  if (!nets || nets.length === 0) {
    return (
      <SectionCard title="Detected Argument Networks" className="w-full" padded={true}>
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <GitFork className="mb-3 size-12 text-slate-400" />
          <h3 className="mb-2 text-base font-semibold text-slate-700">
            No Multi-Scheme Networks Detected
          </h3>
          <p className="text-sm text-slate-600">
            This deliberation doesn't have arguments using multiple schemes in composition.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Networks appear when arguments combine schemes like "Analogy → Causal → Authority"
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <>
      <SectionCard title="Detected Argument Networks" className="w-full" padded={true}>
        <div className="space-y-4">
          {/* Network Cards */}
          <div className="grid gap-4">
            {nets.map((net) => (
              <NetCard
                key={net.id}
                net={net}
                onAnalyze={() => handleAnalyzeNet(net.rootArgumentId)}
              />
            ))}
          </div>

          {/* Summary Stats */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200 pt-4 text-sm">
            <h4 className="font-semibold text-slate-700">Summary</h4>
            <div className="flex flex-wrap gap-2 text-xs text-emerald-700">
              <span>
                <strong>{nets.length}</strong> network{nets.length === 1 ? "" : "s"}
              </span>
              <span>•</span>
              <span>
                <strong>{nets.reduce((sum, n) => sum + n.schemes.length, 0)}</strong> scheme
                instances
              </span>
              <span>•</span>
              <span>
                Avg complexity:{" "}
                <strong>
                  {Math.round(
                    nets.reduce((sum, n) => sum + n.complexity, 0) / nets.length
                  )}
                  %
                </strong>
              </span>
              <span>•</span>
              <span>
                Avg confidence:{" "}
                <strong>
                  {Math.round(
                    nets.reduce((sum, n) => sum + n.confidence, 0) / nets.length
                  )}
                  %
                </strong>
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Net Analyzer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-6xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Argument Network Analysis</DialogTitle>
          </DialogHeader>
          {selectedNetId && (
            <ArgumentNetAnalyzer
              argumentId={selectedNetId}
              deliberationId={deliberationId}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function NetCard({
  net,
  onAnalyze,
}: {
  net: NetCandidate;
  onAnalyze: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  // Get net type icon and color
  const getNetTypeInfo = () => {
    switch (net.netType) {
      case "serial":
        return { 
          icon: ChevronRight, 
          color: "sky", 
          label: "Serial",
          iconClass: "text-sky-600",
          badgeBgClass: "bg-sky-100",
          badgeTextClass: "text-sky-700"
        };
      case "convergent":
        return { 
          icon: GitFork, 
          color: "purple", 
          label: "Convergent",
          iconClass: "text-purple-600",
          badgeBgClass: "bg-purple-100",
          badgeTextClass: "text-purple-700"
        };
      case "linked":
        return { 
          icon: Network, 
          color: "emerald", 
          label: "Linked",
          iconClass: "text-emerald-600",
          badgeBgClass: "bg-emerald-100",
          badgeTextClass: "text-emerald-700"
        };
      case "divergent":
        return { 
          icon: Activity, 
          color: "orange", 
          label: "Divergent",
          iconClass: "text-orange-600",
          badgeBgClass: "bg-orange-100",
          badgeTextClass: "text-orange-700"
        };
      case "hybrid":
        return { 
          icon: Zap, 
          color: "indigo", 
          label: "Hybrid",
          iconClass: "text-indigo-600",
          badgeBgClass: "bg-indigo-100",
          badgeTextClass: "text-indigo-700"
        };
      default:
        return { 
          icon: Network, 
          color: "slate", 
          label: "Unknown",
          iconClass: "text-slate-600",
          badgeBgClass: "bg-slate-100",
          badgeTextClass: "text-slate-700"
        };
    }
  };

  const typeInfo = getNetTypeInfo();
  const TypeIcon = typeInfo.icon;

  return (
    <div className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <TypeIcon className={`size-5 shrink-0 ${typeInfo.iconClass}`} />
            <h3 className="text-base font-semibold text-slate-900">
              {typeInfo.label} Network
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {net.schemes.length} scheme{net.schemes.length === 1 ? "" : "s"} •{" "}
            {net.relationships.length} relationship{net.relationships.length === 1 ? "" : "s"}
          </p>
        </div>

        {/* Badges */}
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full ${typeInfo.badgeBgClass} ${typeInfo.badgeTextClass} px-2.5 py-1 text-xs font-semibold`}>
            {net.schemes.length} schemes
          </span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            {Math.round(net.confidence)}%
          </span>
        </div>
      </div>

      {/* Metadata */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span>Complexity: {Math.round(net.complexity)}%</span>
        <span>•</span>
        <span>Confidence: {Math.round(net.confidence)}%</span>
      </div>

      {/* Scheme Composition */}
      <div className="mt-3">
        <button
          className="flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900"
          onClick={() => setExpanded(!expanded)}
        >
          Scheme Composition
          <ChevronRight
            className={`size-3 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </button>

        {expanded && (
          <div className="mt-2 space-y-1">
            {net.schemes.map((scheme, idx) => (
              <div
                key={`${scheme.schemeId}-${idx}`}
                className="flex items-center gap-2 rounded bg-slate-50 px-3 py-1.5 text-xs"
              >
                <span className="font-medium text-slate-700">{scheme.schemeName}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-500">{scheme.role}</span>
                {scheme.schemeCategory && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-500">{scheme.schemeCategory}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={onAnalyze}
        >
          <Network className="size-3" />
          Analyze Network
        </Button>
      </div>
    </div>
  );
}
