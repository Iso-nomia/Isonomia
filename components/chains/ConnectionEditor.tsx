"use client";

import React, { useState, useCallback } from "react";
import { X, Shield, Swords, Sparkles } from "lucide-react";
import { useChainEditorStore } from "@/lib/stores/chainEditorStore";
import { EDGE_TYPES, EDGE_TYPE_GROUPS } from "@/lib/constants/chainEdgeTypes";
import { MarkerType } from "@xyflow/react";

const CATEGORY_ICONS = {
  support: Shield,
  attack: Swords,
  modifier: Sparkles,
};

const CATEGORY_COLORS = {
  support: "text-green-600",
  attack: "text-red-600",
  modifier: "text-amber-600",
};

const ConnectionEditor: React.FC = () => {
  const {
    showConnectionEditor,
    pendingConnection,
    closeConnectionEditor,
    addEdge,
    chainId,
  } = useChainEditorStore();

  const [edgeType, setEdgeType] = useState("SUPPORTS");
  const [strength, setStrength] = useState(0.7);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset form when modal opens
  React.useEffect(() => {
    if (showConnectionEditor) {
      setEdgeType("SUPPORTS");
      setStrength(0.7);
      setDescription("");
    }
  }, [showConnectionEditor]);

  const handleSubmit = useCallback(async () => {
    if (!pendingConnection || !chainId) return;

    setLoading(true);
    try {
      // Create edge via API
      const response = await fetch(`/api/argument-chains/${chainId}/edges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceNodeId: pendingConnection.sourceNodeId,
          targetNodeId: pendingConnection.targetNodeId,
          edgeType,
          strength,
          description: description || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create edge");
      }

      const result = await response.json();
      const edgeData = result.edge;

      // Add to local state
      addEdge({
        id: edgeData.id,
        source: pendingConnection.sourceNodeId,
        target: pendingConnection.targetNodeId,
        type: "chainEdge",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: EDGE_TYPES[edgeType].color,
        },
        data: {
          edgeType,
          strength,
          description: description || null,
          slotMapping: null,
        },
      });

      closeConnectionEditor();
    } catch (error) {
      console.error("Failed to create connection:", error);
    } finally {
      setLoading(false);
    }
  }, [pendingConnection, chainId, edgeType, strength, description, addEdge, closeConnectionEditor]);

  if (!showConnectionEditor || !pendingConnection) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-h-[500px] overflow-y-auto max-w-md bg-white rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Define Connection</h2>
          <button
            onClick={closeConnectionEditor}
            disabled={loading}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Edge Type Selection - Grouped by Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Connection Type
            </label>
            <div className="space-y-4">
              {Object.entries(EDGE_TYPE_GROUPS).map(([category, group]) => {
                const Icon = CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS];
                const colorClass = CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS];
                
                return (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                      <Icon className={`w-4 h-4 ${colorClass}`} />
                      <span>{group.label}</span>
                    </div>
                    <div className="space-y-1 ml-6">
                      {group.types.map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setEdgeType(type.id)}
                          className={`
                            w-full p-2.5 text-left rounded-lg border-2 transition-all
                            ${edgeType === type.id
                              ? "border-sky-500 bg-sky-50 ring-2 ring-sky-200"
                              : "border-gray-200 hover:border-gray-300"
                            }
                          `}
                          style={{
                            borderLeftWidth: "4px",
                            borderLeftColor: type.color,
                          }}
                        >
                          <div className="font-medium text-sm text-gray-900">{type.label}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{type.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Strength Slider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Connection Strength: <span className="text-sky-600 font-semibold">{Math.round(strength * 100)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={strength}
              onChange={(e) => setStrength(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Weak</span>
              <span>Moderate</span>
              <span>Strong</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain how these arguments are connected..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={closeConnectionEditor}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Connection"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionEditor;
