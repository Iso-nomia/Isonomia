"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Network,
  Plus,
  TrendingDown,
  TrendingUp,
  BarChart3,
  Loader2,
  Info,
} from "lucide-react";
import { ArgumentNetBuilder } from "@/components/argumentation/ArgumentNetBuilder";
import { NetDetailView } from "@/components/nets/NetDetailView";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Net {
  id: string;
  argumentId: string;
  argumentConclusion: string;
  description: string | null;
  netType: "serial" | "convergent" | "divergent" | "hybrid";
  overallConfidence: number;
  stepCount: number;
  createdAt: string;
  updatedAt: string;
  author: {
    id: bigint;
    username: string;
    name: string | null;
    image: string | null;
  };
  steps: Array<{
    id: string;
    order: number;
    schemeId: string;
    schemeName: string;
    label: string | null;
    confidence: number;
    inputFromStep: number | null;
  }>;
  weakestStep: {
    id: string;
    stepOrder: number;
    confidence: number;
    label: string | null;
  };
}

interface NetsData {
  nets: Net[];
  stats: {
    totalNets: number;
    averageConfidence: number;
    averageStepCount: number;
    netTypeBreakdown: {
      serial: number;
      convergent: number;
      divergent: number;
      hybrid: number;
    };
  };
}

interface NetsTabProps {
  deliberationId: string;
}

export function NetsTab({ deliberationId }: NetsTabProps) {
  const [netTypeFilter, setNetTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showNetBuilder, setShowNetBuilder] = useState(false);
  const [selectedNetId, setSelectedNetId] = useState<string | null>(null);
  const [showDetailView, setShowDetailView] = useState(false);

  // Fetch nets
  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<NetsData>(
    `/api/deliberations/${deliberationId}/nets?netType=${
      netTypeFilter === "all" ? "" : netTypeFilter
    }&sortBy=${sortBy}&order=${sortOrder}`,
    fetcher
  );

  const handleNetCreated = (netId: string) => {
    console.log("Net created:", netId);
    setShowNetBuilder(false);
    void mutate(); // Refresh nets list
  };

  const handleDeleteNet = async (netId: string) => {
    if (!confirm("Delete this net? This cannot be undone.")) return;

    try {
      const response = await fetch(`/api/nets?id=${netId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete net");
      }

      void mutate(); // Refresh list
    } catch (err) {
      console.error("Error deleting net:", err);
      alert(err instanceof Error ? err.message : "Failed to delete net");
    }
  };

  const handleViewNet = (netId: string) => {
    setSelectedNetId(netId);
    setShowDetailView(true);
  };

  const handleEditNet = (netId: string) => {
    setSelectedNetId(netId);
    // TODO: Open ArgumentNetBuilder in edit mode
    console.log("Edit net:", netId);
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load nets. Please try again.</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading nets...</span>
      </div>
    );
  }

  const nets = data?.nets || [];
  const stats = data?.stats;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6" />
            Argument Nets
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Multi-scheme reasoning chains with step-by-step confidence analysis
          </p>
        </div>
        <Button onClick={() => setShowNetBuilder(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Net
        </Button>
      </div>

      {/* Stats Dashboard */}
      {stats && stats.totalNets > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/30 rounded-lg p-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.totalNets}</div>
            <div className="text-xs text-muted-foreground">Total Nets</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {Math.round(stats.averageConfidence * 100)}%
            </div>
            <div className="text-xs text-muted-foreground">Avg Confidence</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {stats.averageStepCount.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">Avg Steps</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <div>
                <Badge variant="outline" className="text-xs">
                  Serial: {stats.netTypeBreakdown.serial}
                </Badge>
              </div>
              <div>
                <Badge variant="outline" className="text-xs">
                  Conv: {stats.netTypeBreakdown.convergent}
                </Badge>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Net Types</div>
          </div>
        </div>
      )}

      {/* Filters & Sort */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter:</span>
          <Select value={netTypeFilter} onValueChange={setNetTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="serial">Serial</SelectItem>
              <SelectItem value="convergent">Convergent</SelectItem>
              <SelectItem value="divergent">Divergent</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Date Created</SelectItem>
              <SelectItem value="confidence">Confidence</SelectItem>
              <SelectItem value="stepCount">Step Count</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
        >
          {sortOrder === "asc" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Empty State */}
      {nets.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            No nets yet. Create your first argument net to analyze multi-scheme reasoning chains
            with weakest link detection.
          </AlertDescription>
        </Alert>
      )}

      {/* Nets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {nets.map((net) => (
          <NetCard
            key={net.id}
            net={net}
            onView={() => handleViewNet(net.id)}
            onEdit={() => handleEditNet(net.id)}
            onDelete={() => handleDeleteNet(net.id)}
          />
        ))}
      </div>

      {/* Net Builder Dialog */}
      {showNetBuilder && (
        <ArgumentNetBuilder
          open={showNetBuilder}
          onClose={() => setShowNetBuilder(false)}
          deliberationId={deliberationId}
          onComplete={handleNetCreated}
        />
      )}

      {/* Net Detail View Dialog */}
      {selectedNetId && showDetailView && (
        <NetDetailView
          netId={selectedNetId}
          open={showDetailView}
          onClose={() => {
            setShowDetailView(false);
            setSelectedNetId(null);
          }}
          onEdit={() => {
            setShowDetailView(false);
            handleEditNet(selectedNetId);
          }}
        />
      )}
    </div>
  );
}

// Net Card Component
interface NetCardProps {
  net: Net;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function NetCard({ net, onView, onEdit, onDelete }: NetCardProps) {
  const confidenceColor =
    net.overallConfidence >= 0.8
      ? "text-green-600"
      : net.overallConfidence >= 0.6
      ? "text-yellow-600"
      : "text-red-600";

  const netTypeColors = {
    serial: "bg-sky-100 text-sky-800 border-sky-200",
    convergent: "bg-purple-100 text-purple-800 border-purple-200",
    divergent: "bg-orange-100 text-orange-800 border-orange-200",
    hybrid: "bg-gray-100 text-gray-800 border-gray-200",
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow bg-white">
      {/* Header */}
      <div className="flex items-start justify-between">
        <Badge className={netTypeColors[net.netType]}>{net.netType}</Badge>
        <div className={`text-2xl font-bold ${confidenceColor}`}>
          {Math.round(net.overallConfidence * 100)}%
        </div>
      </div>

      {/* Argument */}
      <div>
        <div className="text-xs text-muted-foreground">Argument</div>
        <div className="font-medium text-sm line-clamp-2">{net.argumentConclusion}</div>
      </div>

      {/* Description */}
      {net.description && (
        <div className="text-xs text-muted-foreground line-clamp-2">{net.description}</div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div>{net.stepCount} steps</div>
        <div>•</div>
        <div>Weakest: {Math.round((net.weakestStep?.confidence || net.overallConfidence) * 100)}%</div>
      </div>

      {/* Steps Preview */}
      <div className="space-y-1">
        {net.steps.slice(0, 3).map((step, idx) => (
          <div key={step.id} className="text-xs flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {idx + 1}
            </Badge>
            <span className="truncate">{step.label || step.schemeName}</span>
            <span className="text-muted-foreground ml-auto">
              {Math.round(step.confidence * 100)}%
            </span>
          </div>
        ))}
        {net.steps.length > 3 && (
          <div className="text-xs text-muted-foreground">
            +{net.steps.length - 3} more steps
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" className="flex-1" onClick={onView}>
          View
        </Button>
        <Button variant="ghost" size="sm" className="flex-1" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive">
          Delete
        </Button>
      </div>

      {/* Meta */}
      <div className="text-xs text-muted-foreground">
        Created {new Date(net.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}
