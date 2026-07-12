/**
 * ChainsTab Component
 * Tab content for viewing and managing argument chains in a deliberation
 * 
 * Task 1.7: Add "Chains" tab to deliberation view
 * 
 * Updated to include full modal functionality matching ThreadedDiscussionTab:
 * - View Details modal (ArgumentCardV2)
 * - Preview Network modal (MiniNeighborhoodPreview)
 * - Reply modal (PropositionComposerPro)
 * - Support modal (AIFArgumentWithSchemeComposer)
 * - Attack modal flow (AttackSuggestions + AttackArgumentWizard)
 */

"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Link2, Plus, Network, LayoutGrid, PlusCircle, FileText, Sparkles, BookOpen, BookOpenText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ChainListPanel } from "@/components/chains/ChainListPanel";
import { ArgumentChainThread } from "@/components/chains/ArgumentChainThread";
import ArgumentChainCanvas from "@/components/chains/ArgumentChainCanvas";
import { ChainProseView } from "@/components/chains/ChainProseView";
import { ChainEssayView } from "@/components/chains/ChainEssayView";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArgumentCardV2 } from "@/components/arguments/ArgumentCardV2";
import { MiniNeighborhoodPreview } from "@/components/aif/MiniNeighborhoodPreview";
import { PropositionComposerPro } from "@/components/propositions/PropositionComposerPro";
import { AIFArgumentWithSchemeComposer } from "@/components/arguments/AIFArgumentWithSchemeComposer";
import { AttackSuggestions } from "@/components/argumentation/AttackSuggestions";
import { AttackArgumentWizard } from "@/components/argumentation/AttackArgumentWizard";
import type { AttackSuggestion } from "@/app/server/services/ArgumentGenerationService";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

// ===== Types =====

/** Action target representing an argument from the chain */
interface ActionTarget {
  argumentId: string;
  claimId?: string;
  text?: string;
}

interface ChainsTabProps {
  deliberationId: string;
  currentUserId?: string | null;
  
  /** Callback to switch to another tab */
  onTabChange?: (tab: any) => void;
  
  /** Currently selected argument ID */
  selectedArgumentId?: string;
}

// ===== Main Component =====

export function ChainsTab({
  deliberationId,
  currentUserId,
  onTabChange,
  selectedArgumentId,
}: ChainsTabProps) {
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "thread" | "canvas" | "prose" | "essay">("list");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Create chain form state
  const [newChainTitle, setNewChainTitle] = useState("");
  const [newChainDescription, setNewChainDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Modal state - matches ThreadedDiscussionTab pattern
  const [previewArgumentId, setPreviewArgumentId] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [expandModalOpen, setExpandModalOpen] = useState(false);
  const [expandArgumentId, setExpandArgumentId] = useState<string | null>(null);
  
  // Action modal state
  const [replyMode, setReplyMode] = useState(false);
  const [supportMode, setSupportMode] = useState(false);
  const [attackMode, setAttackMode] = useState(false);
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  
  // Attack flow state
  const [selectedAttack, setSelectedAttack] = useState<AttackSuggestion | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Fetch argument details when needed for modals (using AIF endpoint for full data)
  const { data: argumentData, mutate: mutateArgument } = useSWR(
    expandArgumentId ? `/api/arguments/${expandArgumentId}/aif` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch neighborhood for preview
  const { data: neighborhoodData, error: neighborhoodError, isLoading: neighborhoodLoading } = useSWR(
    previewArgumentId ? `/api/arguments/${previewArgumentId}/aif-neighborhood?depth=1` : null,
    fetcher
  );

  // Handle chain click - select chain and switch to thread view
  const handleChainClick = (chainId: string) => {
    setSelectedChainId(chainId);
    setViewMode("thread");
  };

  // Handle view chain as graph
  const handleViewChainGraph = (chainId: string) => {
    window.open(`/chain/${chainId}`, "_blank");
  };

  // ===== Action Handlers (matching ThreadedDiscussionTab) =====

  // Handle View Details - open ArgumentCardV2 modal
  const handleViewArgument = (argumentId: string) => {
    setExpandArgumentId(argumentId);
    setExpandModalOpen(true);
  };

  // Handle Preview Network - open MiniNeighborhoodPreview modal
  const handlePreviewArgument = (argumentId: string) => {
    setPreviewArgumentId(argumentId);
    setPreviewModalOpen(true);
  };

  // Handle Reply - open PropositionComposerPro modal
  const handleReplyArgument = async (argumentId: string) => {
    // Fetch argument data to get text preview
    try {
      const res = await fetch(`/api/arguments/${argumentId}`);
      const data = await res.json();
      setActionTarget({
        argumentId,
        claimId: data?.conclusionClaimId || data?.claim?.id,
        text: data?.claim?.text || data?.text || "Argument",
      });
      setReplyMode(true);
    } catch (e) {
      // Fallback without text
      setActionTarget({ argumentId, text: "Argument" });
      setReplyMode(true);
    }
  };

  // Handle Support - open AIFArgumentWithSchemeComposer modal
  const handleSupportArgument = async (argumentId: string) => {
    try {
      const res = await fetch(`/api/arguments/${argumentId}`);
      const data = await res.json();
      const claimId = data?.conclusionClaimId || data?.claim?.id;
      
      if (!claimId) {
        toast.error("Cannot support this argument - no claim ID found");
        return;
      }
      
      setActionTarget({
        argumentId,
        claimId,
        text: data?.claim?.text || data?.text || "Argument",
      });
      setSupportMode(true);
    } catch (e) {
      toast.error("Failed to load argument data");
    }
  };

  // Handle Attack - open AttackSuggestions modal
  const handleAttackArgument = async (argumentId: string) => {
    if (!currentUserId) {
      toast.error("Please sign in to create attacks");
      return;
    }

    try {
      const res = await fetch(`/api/arguments/${argumentId}`);
      const data = await res.json();
      const claimId = data?.conclusionClaimId || data?.claim?.id;
      
      if (!claimId) {
        toast.error("Cannot attack this argument - missing conclusion claim");
        return;
      }
      
      setActionTarget({
        argumentId,
        claimId,
        text: data?.claim?.text || data?.text || "Argument",
      });
      setAttackMode(true);
    } catch (e) {
      toast.error("Failed to load argument data");
    }
  };

  // Close composer modals and refresh data
  const handleComposerSuccess = () => {
    setReplyMode(false);
    setSupportMode(false);
    setAttackMode(false);
    setWizardOpen(false);
    setActionTarget(null);
    setSelectedAttack(null);
    mutateArgument(); // Refresh argument data
    toast.success("Successfully posted!");
  };

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-800">Argument Chains</h2>
        </div>
        
        <div className="flex  items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 h-full bg-slate-100/50 border border-indigo-300 rounded-lg">
            <button
              type="button"
              className={`flex px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                viewMode === "list" 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
              onClick={(e) => { e.stopPropagation(); setViewMode("list"); }}
            >
              List
            </button>
            <button
              type="button"
              className={`flex px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                viewMode === "thread" 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              } ${!selectedChainId ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={(e) => { e.stopPropagation(); if (selectedChainId) setViewMode("thread"); }}
              disabled={!selectedChainId}
            >
              Thread
            </button>
            <button
              type="button"
              className={`flex px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                viewMode === "canvas" 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              } ${!selectedChainId ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={(e) => { e.stopPropagation(); if (selectedChainId) setViewMode("canvas"); }}
              disabled={!selectedChainId}
            >
              <LayoutGrid className="w-3 h-3" />
              Canvas
            </button>
            <button
              type="button"
              className={`flex px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                viewMode === "prose" 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              } ${!selectedChainId ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={(e) => { e.stopPropagation(); if (selectedChainId) setViewMode("prose"); }}
              disabled={!selectedChainId}
            >
              <FileText className="w-3 h-3" />
              Brief
            </button>
            <button
              type="button"
              className={`flex px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                viewMode === "essay" 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              } ${!selectedChainId ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={(e) => { e.stopPropagation(); if (selectedChainId) setViewMode("essay"); }}
              disabled={!selectedChainId}
            >
              <BookOpenText className="w-3 h-3" />
              Essay
            </button>
          </div>

          {/* Create Chain Button */}
          <button
            
            onClick={() => setShowCreateDialog(true)}
            className="flex h-8 px-2 text-xs gap-2 font-medium items-center forumbutton border-indigo-200 bg-white/50 rounded-md"
          >
            <PlusCircle className="w-3 h-3 " />
            Create Argument Chain
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
        <p className="text-sm text-indigo-700">
          <strong>Argument chains</strong> organize related arguments into logical sequences.
          They help visualize how premises lead to conclusions and how arguments support or attack each other.
        </p>
      </div>

      {/* Main Content */}
      {viewMode === "list" ? (
        <ChainListPanel
          deliberationId={deliberationId}
          showCreate={true}
          onCreateChain={() => setShowCreateDialog(true)}
          onChainClick={handleChainClick}
          onViewChainGraph={(chainId) => {
            setSelectedChainId(chainId);
            setViewMode("canvas");
          }}
          onViewChainThread={(chainId) => {
            setSelectedChainId(chainId);
            setViewMode("thread");
          }}
          onViewChainProse={(chainId) => {
            setSelectedChainId(chainId);
            setViewMode("prose");
          }}
          onViewChainEssay={(chainId) => {
            setSelectedChainId(chainId);
            setViewMode("essay");
          }}
          onViewArgument={handleViewArgument}
          onPreviewArgument={handlePreviewArgument}
          onReplyArgument={handleReplyArgument}
          onSupportArgument={handleSupportArgument}
          onAttackArgument={handleAttackArgument}
          currentArgumentId={selectedArgumentId}
        />
      ) : viewMode === "thread" && selectedChainId ? (
        <div className="border rounded-lg p-4 bg-white">
          <ArgumentChainThread
            chainId={selectedChainId}
            currentArgumentId={selectedArgumentId}
            onViewGraph={() => setViewMode("canvas")}
            onViewArgument={handleViewArgument}
            onPreview={handlePreviewArgument}
            onReply={handleReplyArgument}
            onSupport={handleSupportArgument}
            onAttack={handleAttackArgument}
          />
        </div>
      ) : viewMode === "canvas" && selectedChainId ? (
        <div className="border rounded-lg bg-white overflow-hidden" style={{ height: "600px" }}>
          <ArgumentChainCanvas
            chainId={selectedChainId}
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
        </div>
      ) : viewMode === "prose" && selectedChainId ? (
        <div className="border rounded-lg p-4 bg-white">
          <ChainProseView
            chainId={selectedChainId}
            onViewThread={() => setViewMode("thread")}
            onViewCanvas={() => setViewMode("canvas")}
          />
        </div>
      ) : viewMode === "essay" && selectedChainId ? (
        <div className="border rounded-lg p-4 bg-white">
          <ChainEssayView
            chainId={selectedChainId}
            onViewThread={() => setViewMode("thread")}
            onViewCanvas={() => setViewMode("canvas")}
            onViewProse={() => setViewMode("prose")}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center py-12 text-slate-500">
          Select a chain to view in thread, canvas, brief, or essay mode
        </div>
      )}

      {/* Create Chain Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) {
          // Reset form on close
          setNewChainTitle("");
          setNewChainDescription("");
        }
      }}>
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
                onClick={() => setShowCreateDialog(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button 
                onClick={async () => {
                  if (!newChainTitle.trim()) {
                    toast.error("Please enter a title for the chain");
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
                    setShowCreateDialog(false);
                    
                    toast.success("Chain created successfully!");
                    
                    // Open the newly created chain in canvas view
                    setSelectedChainId(result.chain.id);
                    setViewMode("canvas");
                  } catch (err) {
                    console.error("Failed to create chain:", err);
                    toast.error("Failed to create chain. Please try again.");
                  } finally {
                    setIsCreating(false);
                  }
                }} 
                disabled={isCreating}
              >
                {isCreating ? "Creating..." : "Create Chain"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Network Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-[750px] bg-white/15 backdrop-blur-md border-2 border-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="tracking-wide font-medium">AIF Neighborhood Preview</DialogTitle>
          </DialogHeader>
          <div className="py-0">
            <MiniNeighborhoodPreview
              data={neighborhoodData}
              loading={neighborhoodLoading}
              error={neighborhoodError}
              maxWidth={700}
              maxHeight={400}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Argument Details Modal (ArgumentCardV2) */}
      {expandModalOpen && expandArgumentId && argumentData?.ok && (
        <Dialog open={expandModalOpen} onOpenChange={(open) => !open && setExpandModalOpen(false)}>
          <DialogContent className="max-w-4xl max-h-[90vh] bg-white overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Argument Details</DialogTitle>
            </DialogHeader>
            <ArgumentCardV2
              deliberationId={deliberationId}
              authorId={currentUserId || ""}
              id={argumentData.id || expandArgumentId}
              conclusion={{
                id: argumentData.aif?.conclusion?.id || expandArgumentId,
                text: argumentData.aif?.conclusion?.text || argumentData.text || "Untitled claim"
              }}
              premises={argumentData.aif?.premises || []}
              schemeKey={argumentData.aif?.scheme?.key}
              schemeName={argumentData.aif?.scheme?.name}
              schemes={argumentData.aif?.schemes?.map((s: any) => ({
                schemeId: s.id,
                schemeKey: s.key,
                schemeName: s.name,
                confidence: s.confidence || 1.0,
                isPrimary: s.isPrimary || false,
              }))}
              provenance={argumentData.provenance}
              onAnyChange={() => mutateArgument()}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Reply Composer Modal */}
      {replyMode && actionTarget && (
        <Dialog open={replyMode} onOpenChange={(open) => !open && setReplyMode(false)}>
          <DialogContent className="max-w-3xl max-h-[90vh] bg-white overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Reply to Argument
              </DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                Replying to: {actionTarget.text?.slice(0, 100)}...
              </p>
            </DialogHeader>
            <PropositionComposerPro
              deliberationId={deliberationId}
              replyTarget={
                actionTarget.claimId
                  ? { kind: "claim", id: actionTarget.claimId }
                  : { kind: "argument", id: actionTarget.argumentId }
              }
              onPosted={handleComposerSuccess}
              placeholder="Write your reply..."
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Support Composer Modal */}
      {supportMode && actionTarget && actionTarget.claimId && (
        <Dialog open={supportMode} onOpenChange={(open) => !open && setSupportMode(false)}>
          <DialogContent className="max-w-4xl max-h-[90vh] bg-white overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Create Supporting Argument
              </DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                Supporting: {actionTarget.text?.slice(0, 100)}...
              </p>
            </DialogHeader>
            <AIFArgumentWithSchemeComposer
              deliberationId={deliberationId}
              authorId={currentUserId || ""}
              conclusionClaim={{
                id: actionTarget.claimId,
                text: actionTarget.text || ""
              }}
              onCreated={handleComposerSuccess}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Attack Suggestions Dialog */}
      {attackMode && actionTarget && actionTarget.argumentId && actionTarget.claimId && !wizardOpen && (
        <Dialog 
          open={attackMode && !wizardOpen} 
          onOpenChange={(open) => {
            if (!open) {
              setAttackMode(false);
              setActionTarget(null);
            }
          }}
        >
          <DialogContent className="max-w-4xl bg-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Generate Strategic Attack</DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                Attacking: {actionTarget.text?.slice(0, 100)}...
              </p>
            </DialogHeader>
            {currentUserId && (
              <AttackSuggestions
                targetClaimId={actionTarget.claimId}
                targetArgumentId={actionTarget.argumentId}
                userId={currentUserId}
                onAttackSelect={(suggestion) => {
                  console.log("[ChainsTab] Attack selected:", suggestion);
                  setSelectedAttack(suggestion);
                  setWizardOpen(true);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Attack Construction Wizard Dialog */}
      {wizardOpen && actionTarget && actionTarget.argumentId && actionTarget.claimId && selectedAttack && (
        <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
          <DialogContent className="max-w-6xl bg-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Construct Attack</DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                Attacking: {actionTarget.text?.slice(0, 100)}...
              </p>
            </DialogHeader>
            {currentUserId && (
              <AttackArgumentWizard
                suggestion={selectedAttack}
                targetArgumentId={actionTarget.argumentId}
                targetClaimId={actionTarget.claimId}
                deliberationId={deliberationId}
                currentUserId={currentUserId}
                onComplete={(attackClaimId) => {
                  console.log("[ChainsTab] Attack completed, claim ID:", attackClaimId);
                  handleComposerSuccess();
                }}
                onCancel={() => {
                  setWizardOpen(false);
                  setSelectedAttack(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default ChainsTab;
