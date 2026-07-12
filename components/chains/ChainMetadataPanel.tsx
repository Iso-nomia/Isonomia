"use client";

import React, { useState, useEffect } from "react";
import { Settings, Save, X } from "lucide-react";
import { useChainEditorStore } from "@/lib/stores/chainEditorStore";

const CHAIN_TYPES = [
  { value: "SERIAL", label: "Serial", description: "Linear sequence of arguments" },
  { value: "CONVERGENT", label: "Convergent", description: "Multiple premises supporting one conclusion" },
  { value: "DIVERGENT", label: "Divergent", description: "One premise supporting multiple conclusions" },
  { value: "TREE", label: "Tree", description: "Hierarchical branching structure" },
  { value: "GRAPH", label: "Graph", description: "General network of interconnected arguments" },
];

const ChainMetadataPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [localName, setLocalName] = useState("");
  const [localType, setLocalType] = useState<"SERIAL" | "CONVERGENT" | "DIVERGENT" | "TREE" | "GRAPH">("SERIAL");
  const [localIsPublic, setLocalIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);

  const { chainId, chainName, chainType, isPublic, setChainMetadata } = useChainEditorStore();

  // Sync local state with store
  useEffect(() => {
    setLocalName(chainName);
    setLocalType(chainType);
    setLocalIsPublic(isPublic);
  }, [chainName, chainType, isPublic]);

  const handleSave = async () => {
    if (!chainId) {
      console.error("No chain ID set");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/argument-chains/${chainId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: localName,
          chainType: localType,
          isPublic: localIsPublic,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update chain");
      }

      // Update store
      setChainMetadata({
        chainName: localName,
        chainType: localType,
        isPublic: localIsPublic,
      });

      setIsOpen(false);
    } catch (error) {
      console.error("Failed to update chain metadata:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset to store values
    setLocalName(chainName);
    setLocalType(chainType);
    setLocalIsPublic(isPublic);
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Settings className="w-4 h-4" />
        Settings
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Chain Settings</h2>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-6">
              {/* Chain Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chain Name
                </label>
                <input
                  type="text"
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  placeholder="Enter chain name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Chain Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chain Type
                </label>
                <div className="space-y-2">
                  {CHAIN_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setLocalType(type.value as any)}
                      className={`
                        w-full p-3 text-left rounded-lg border-2 transition-colors
                        ${localType === type.value
                          ? "border-sky-500 bg-sky-50"
                          : "border-gray-200 hover:border-gray-300"
                        }
                      `}
                    >
                      <div className="font-medium text-sm text-gray-900">{type.label}</div>
                      <div className="text-xs text-gray-500">{type.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Visibility */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localIsPublic}
                    onChange={(e) => setLocalIsPublic(e.target.checked)}
                    className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">Make Public</div>
                    <div className="text-xs text-gray-500">
                      Allow others to view and contribute to this chain
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={handleCancel}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChainMetadataPanel;
