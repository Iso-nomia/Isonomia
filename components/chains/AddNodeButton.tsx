"use client";

import React, { useState, useCallback } from "react";
import { Plus, Search, X, Sparkles, PlusCircle } from "lucide-react";
import { useChainEditorStore } from "@/lib/stores/chainEditorStore";
import { getNewNodePosition } from "@/lib/utils/chainLayoutUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AIFArgumentWithSchemeComposer } from "@/components/arguments/AIFArgumentWithSchemeComposer";

interface Argument {
  id: string;
  text: string;
  title?: string;
  createdAt: string;
  creator: {
    id: string;
    name: string | null;
  };
}

interface AddNodeButtonProps {
  deliberationId: string;
  userId?: string; // For creating new arguments
}

const ROLE_OPTIONS = [
  { value: "PREMISE", label: "Premise", description: "Provides foundational claim" },
  { value: "EVIDENCE", label: "Evidence", description: "Supports with data/facts" },
  { value: "CONCLUSION", label: "Conclusion", description: "Final claim being argued for" },
  { value: "OBJECTION", label: "Objection", description: "Challenges another argument" },
  { value: "REBUTTAL", label: "Rebuttal", description: "Responds to objection" },
  { value: "QUALIFIER", label: "Qualifier", description: "Adds conditions/scope" },
  { value: "COMMENT", label: "Comment", description: "Lightweight annotation/note" },
];

const AddNodeButton: React.FC<AddNodeButtonProps> = ({ deliberationId, userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [selectedRole, setSelectedRole] = useState("PREMISE");
  const [searchQuery, setSearchQuery] = useState("");
  const [argumentsList, setArgumentsList] = useState<Argument[]>([]);
  const [loading, setLoading] = useState(false);

  const { nodes, addNode, chainId, edgeAttackMode, targetedEdgeId, exitEdgeAttackMode } = useChainEditorStore();

  // Fetch arguments from deliberation
  const fetchArguments = useCallback(async () => {
    if (!deliberationId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/deliberations/${deliberationId}/arguments/aif?limit=100`);
      if (response.ok) {
        const data = await response.json();
        // Map AIF arguments to simpler format
        const mapped = (data.items || []).map((item: any) => ({
          id: item.id,
          text: item.text,
          title: item.aif?.conclusion?.text || item.text.substring(0, 50) + "...",
          createdAt: item.createdAt,
          creator: {
            id: item.authorId,
            name: item.dialogueProvenance?.speakerName || "Unknown",
          },
        }));
        setArgumentsList(mapped);
      }
    } catch (error) {
      console.error("Failed to fetch arguments:", error);
    } finally {
      setLoading(false);
    }
  }, [deliberationId]);

  // Open modal and fetch arguments
  const handleOpen = useCallback(() => {
    setIsOpen(true);
    fetchArguments();
  }, [fetchArguments]);

  // Add argument as node
  const handleAddArgument = useCallback(async (argument: Argument) => {
    if (!chainId) {
      console.error("No chain ID set");
      return;
    }

    try {
      // If in edge attack mode, use the edge attack endpoint
      if (edgeAttackMode && targetedEdgeId) {
        const response = await fetch(`/api/argument-chains/${chainId}/attack-edge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            argumentId: argument.id,
            edgeId: targetedEdgeId,
            role: selectedRole,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to add edge attack");
        }

        const result = await response.json();
        const nodeData = result.node;

        // Calculate position for new node (near the targeted edge)
        const position = getNewNodePosition(nodes, 280, 180);

        // Add to local state with full node data from API
        addNode({
          id: nodeData.id,
          type: "argumentNode",
          position,
          data: {
            argument: nodeData.argument,
            role: nodeData.role,
            addedBy: nodeData.contributor,
            nodeOrder: nodeData.nodeOrder,
            targetType: "EDGE",
            targetEdgeId: targetedEdgeId,
          },
        });

        // Exit attack mode after adding
        exitEdgeAttackMode();
      } else {
        // Normal node addition
        const response = await fetch(`/api/argument-chains/${chainId}/nodes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            argumentId: argument.id,
            role: selectedRole,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to add node");
        }

        const result = await response.json();
        const nodeData = result.node;

        // Calculate position for new node
        const position = getNewNodePosition(nodes, 280, 180);

        // Add to local state with full node data from API
        addNode({
          id: nodeData.id,
          type: "argumentNode",
          position,
          data: {
            argument: nodeData.argument,
            role: nodeData.role,
            addedBy: nodeData.contributor,
            nodeOrder: nodeData.nodeOrder,
          },
        });
      }

      setIsOpen(false);
      setSearchQuery("");
      setSelectedRole("PREMISE");
    } catch (error) {
      console.error("Failed to add node:", error);
    }
  }, [chainId, selectedRole, nodes, addNode, edgeAttackMode, targetedEdgeId, exitEdgeAttackMode]);

  const filteredArguments = argumentsList.filter((arg) => {
    const query = searchQuery.toLowerCase();
    return (
      arg.text.toLowerCase().includes(query) ||
      arg.title?.toLowerCase().includes(query)
    );
  });

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors shadow-md"
      >
        <Plus className="w-4 h-4" />
        Add Argument
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl max-h-[85vh] bg-white rounded-xl shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Add Argument to Chain</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Role Selection */}
            <div className="p-4 border-b bg-gray-50">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.map((role) => (
                  <button
                    key={role.value}
                    onClick={() => setSelectedRole(role.value)}
                    className={`
                      p-2 text-left rounded-lg border-2 transition-colors
                      ${selectedRole === role.value
                        ? "border-sky-500 bg-sky-50"
                        : "border-gray-200 hover:border-gray-300"
                      }
                    `}
                  >
                    <div className="font-medium text-sm text-gray-900">{role.label}</div>
                    <div className="text-xs text-gray-500">{role.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="p-1 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-xs text-gray-400" />
                <input
                  type="text"
                  placeholder="Search arguments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Arguments List */}
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="text-center text-gray-500 py-8">Loading arguments...</div>
              ) : filteredArguments.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No arguments found</div>
              ) : (
                <div className="space-y-2">
                  {filteredArguments.map((arg) => (
                    <button
                      key={arg.id}
                      onClick={() => handleAddArgument(arg)}
                      className="w-full p-3 text-left bg-white border border-gray-200 rounded-lg hover:border-sky-300 hover:bg-sky-50 transition-colors"
                    >
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">
                        {arg.title || "Untitled"}
                      </h4>
                      <p className="text-xs text-gray-600 line-clamp-2 mb-1">{arg.text}</p>
                      <div className="text-xs text-gray-500">
                        By {arg.creator.name || "Unknown"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Create New Argument Button */}
            {userId && (
              <div className="p-4 border-t bg-gray-50">
                <button
                  onClick={() => setShowComposer(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <PlusCircle className="w-4 h-4" />
                  Create New Argument
                </button>
                {/* <p className="text-xs text-gray-500 text-center mt-2">
                  Build a new structured argument with scheme support
                </p> */}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Argument Composer Dialog */}
      <Dialog open={showComposer} onOpenChange={setShowComposer}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-white overflow-y-auto">
         
          
          {userId && (
            <AIFArgumentWithSchemeComposer
              deliberationId={deliberationId}
              authorId={userId}
              conclusionClaim={null}
              defaultSchemeKey={null}
              onCreated={async (argumentId) => {
                try {
                  // Fetch the newly created argument details
                  const response = await fetch(`/api/arguments/${argumentId}`);
                  if (response.ok) {
                    const data = await response.json();
                    const newArg: Argument = {
                      id: argumentId,
                      text: data.text || "",
                      title: data.conclusion?.text || data.text?.substring(0, 50) + "...",
                      createdAt: data.createdAt || new Date().toISOString(),
                      creator: {
                        id: userId,
                        name: "You",
                      },
                    };
                    
                    // Add the new argument to the chain
                    await handleAddArgument(newArg);
                  }
                } catch (error) {
                  console.error("Failed to add newly created argument:", error);
                }
                
                setShowComposer(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AddNodeButton;
