"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { Link2, Plus, User, Calendar, ChevronRight } from "lucide-react";
import { SectionCard } from "../../shared/SectionCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import ArgumentChainCanvas from "@/components/chains/ArgumentChainCanvas";

interface ChainsSectionProps {
  deliberationId: string;
  currentUserId?: string;
}

interface ArgumentChainSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    name: string | null;
    image: string | null;
  };
  _count: {
    nodes: number;
    edges: number;
  };
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch chains");
  return response.json();
};

export function ChainsSection({ deliberationId, currentUserId }: ChainsSectionProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewChainId, setViewChainId] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form state for new chain
  const [newChainTitle, setNewChainTitle] = useState("");
  const [newChainDescription, setNewChainDescription] = useState("");

  // Fetch chains for this deliberation
  const { data, error, isLoading, mutate } = useSWR<{ chains: ArgumentChainSummary[] }>(
    `/api/argument-chains?deliberationId=${deliberationId}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const chains: ArgumentChainSummary[] = data?.chains || [];

  const handleCreateChain = async () => {
    if (!newChainTitle.trim()) {
      alert("Please enter a title for the chain");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/argument-chains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newChainTitle,
          description: newChainDescription || null,
          deliberationId,
          chainType: "SERIAL",
          isPublic: false,
          isEditable: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create chain");
      }

      const result = await response.json();
      
      // Reset form
      setNewChainTitle("");
      setNewChainDescription("");
      setCreateDialogOpen(false);
      
      // Refresh list
      mutate();

      // Open the newly created chain
      setViewChainId(result.chain.id);
      setViewDialogOpen(true);
    } catch (err) {
      console.error("Failed to create chain:", err);
      alert("Failed to create chain. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleViewChain = (chainId: string) => {
    setViewChainId(chainId);
    setViewDialogOpen(true);
  };

  if (isLoading) {
    return (
      <SectionCard title="Argument Chains" className="w-full" padded={true}>
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
      <SectionCard title="Argument Chains" className="w-full" padded={true} tone="danger">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-center">
          <p className="text-sm text-rose-700">Failed to load chains</p>
          <p className="mt-1 text-xs text-rose-600">{error.message}</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <>
      <SectionCard title="Argument Chains" className="w-full" padded={true}>
        <div className="space-y-4">
          {/* Create Button */}
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="w-full gap-2"
            variant="default"
          >
            <Plus className="size-4" />
            Create New Argument Chain
          </Button>

          {/* Empty State */}
          {chains.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-12 text-center">
              <Link2 className="mb-3 size-12 text-slate-400" />
              <h3 className="mb-2 text-base font-semibold text-slate-700">
                No Argument Chains Yet
              </h3>
              <p className="text-sm text-slate-600">
                Create a chain to build structured reasoning paths from premises to conclusions.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Chains help you visualize logical dependencies and analyze argument strength.
              </p>
            </div>
          )}

          {/* Chain Cards */}
          {chains.length > 0 && (
            <div className="grid gap-3">
              {chains.map((chain) => (
                <ChainCard
                  key={chain.id}
                  chain={chain}
                  onView={() => handleViewChain(chain.id)}
                />
              ))}
            </div>
          )}

          {/* Summary Stats */}
          {chains.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200 pt-4 text-sm">
              <h4 className="font-semibold text-slate-700">Summary</h4>
              <div className="flex flex-wrap gap-2 text-xs text-emerald-700">
                <span>
                  <strong>{chains.length}</strong> chain{chains.length === 1 ? "" : "s"}
                </span>
                <span>•</span>
                <span>
                  <strong>{chains.reduce((sum, c) => sum + c._count.nodes, 0)}</strong> total nodes
                </span>
                <span>•</span>
                <span>
                  <strong>{chains.reduce((sum, c) => sum + c._count.edges, 0)}</strong> total edges
                </span>
                <span>•</span>
                <span>
                  Avg nodes:{" "}
                  <strong>
                    {Math.round(
                      chains.reduce((sum, c) => sum + c._count.nodes, 0) / chains.length
                    )}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Create Chain Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>Create New Argument Chain</DialogTitle>
            <DialogDescription>
              Build a structured reasoning path from premises to conclusion.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="chain-title">Title</Label>
              <Input
                id="chain-title"
                placeholder="e.g., Climate Policy Justification"
                value={newChainTitle}
                onChange={(e) => setNewChainTitle(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="chain-description">Description (optional)</Label>
              <Textarea
                id="chain-description"
                placeholder="Describe the purpose or context of this chain..."
                value={newChainDescription}
                onChange={(e) => setNewChainDescription(e.target.value)}
                className="mt-1.5"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateChain} disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Chain"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Chain Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] bg-white p-0">
          <div className="flex h-[95vh] flex-col">
            <DialogHeader className="px-6 py-4 border-b">
              <DialogTitle>Argument Chain Editor</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              {viewChainId && (
                <ArgumentChainCanvas
                  chainId={viewChainId}
                  deliberationId={deliberationId}
                  currentUserId={currentUserId}
                  isEditable={true}
                  onNodeClick={(nodeId) => {
                    console.log("Node clicked:", nodeId);
                  }}
                  onEdgeClick={(edgeId) => {
                    console.log("Edge clicked:", edgeId);
                  }}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChainCard({
  chain,
  onView,
}: {
  chain: ArgumentChainSummary;
  onView: () => void;
}) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link2 className="size-4 shrink-0 text-sky-600" />
            <h3 className="text-sm font-semibold text-slate-900 truncate">
              {chain.name}
            </h3>
          </div>
          {chain.description && (
            <p className="mt-1 text-xs text-slate-600 line-clamp-2">
              {chain.description}
            </p>
          )}
        </div>

        {/* Node/Edge Count Badge */}
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
            {chain._count.nodes} nodes
          </span>
        </div>
      </div>

      {/* Metadata */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <div className="flex items-center gap-1">
          <User className="size-3" />
          <span>{chain.creator.name || "Unknown"}</span>
        </div>
        <span>•</span>
        <div className="flex items-center gap-1">
          <Calendar className="size-3" />
          <span>Updated {formatDate(chain.updatedAt)}</span>
        </div>
        <span>•</span>
        <span>{chain._count.edges} edges</span>
      </div>

      {/* Actions */}
      <div className="mt-3">
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs w-full"
          onClick={onView}
        >
          Open Chain
          <ChevronRight className="size-3" />
        </Button>
      </div>
    </div>
  );
}
