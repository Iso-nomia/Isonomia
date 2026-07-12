"use client";

import { useState } from "react";
import { DialogueInspector } from "@/components/dialogue/DialogueInspector";
import { Input } from "@/components/ui/input";

/**
 * Dialogue Inspector Test Page
 * 
 * Navigate to /test/dialogue-inspector to use this tool
 * 
 * This provides a simple interface to inspect any claim or argument
 * in the dialogue system.
 */

export default function DialogueInspectorPage() {
  const [deliberationId, setDeliberationId] = useState("");
  const [targetType, setTargetType] = useState<"claim" | "argument" | "card">("claim");
  const [targetId, setTargetId] = useState("");
  const [locusPath, setLocusPath] = useState("0");
  const [showInspector, setShowInspector] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (deliberationId && targetId) {
      setShowInspector(true);
    }
  };

  const loadExample = () => {
    // You can update these with real IDs from your system
    setDeliberationId("cmgy6c8vz0000c04w4l9khiux");
    setTargetType("claim");
    setTargetId("cmgzyuusc000ec0leqk4cf26g");
    setLocusPath("0");
    setShowInspector(true);
  };

  return (
    <div className="min-h-screen bg-blue p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔍 Dialogue Inspector
          </h1>
          <p className="text-gray-600">
            A unified view of claims, arguments, dialogue moves, critical questions, and legal actions.
            Enter the IDs below to inspect any dialogue target.
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Deliberation ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deliberation ID
                </label>
                <Input
                  type="text"
                  value={deliberationId}
                  onChange={(e) => setDeliberationId(e.target.value)}
                  placeholder="cmgy6c8vz0000c04w4l9khiux"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                  required
                />
              </div>

              {/* Target Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Type
                </label>
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="claim">Claim</option>
                  <option value="argument">Argument</option>
                  <option value="card">Card</option>
                </select>
              </div>

              {/* Target ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target ID
                </label>
                <Input
                  type="text"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  placeholder="cmgzyuusc000ec0leqk4cf26g"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                  required
                />
              </div>

              {/* Locus Path */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Locus Path
                </label>
                <Input
                  type="text"
                  value={locusPath}
                  onChange={(e) => setLocusPath(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium transition-colors"
              >
                🔍 Inspect
              </button>
              <button
                type="button"
                onClick={loadExample}
                className="px-6 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 font-medium transition-colors"
              >
                📝 Load Example
              </button>
              <button
                type="button"
                onClick={() => setShowInspector(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium transition-colors"
              >
                🗑️ Clear
              </button>
            </div>
          </form>
        </div>

        {/* Instructions */}
        {!showInspector && (
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-6">
            <h3 className="font-semibold text-sky-900 mb-2">📖 How to Use</h3>
            <ol className="space-y-2 text-sm text-sky-800">
              <li>
                <strong>1.</strong> Get a Deliberation ID from the browser console or database
              </li>
              <li>
                <strong>2.</strong> Choose whether you want to inspect a Claim, Argument, or Card
              </li>
              <li>
                <strong>3.</strong> Enter the Target ID (claim ID, argument ID, or card ID)
              </li>
              <li>
                <strong>4.</strong> Optionally adjust the Locus Path (default is "0")
              </li>
              <li>
                <strong>5.</strong> Click "🔍 Inspect" to view all dialogue data
              </li>
            </ol>
            <div className="mt-4 p-3 bg-white rounded border border-sky-200">
              <p className="text-xs font-mono text-gray-700">
                <strong>Tip:</strong> You can find IDs in the network tab when browsing deliberations,
                or by looking at API responses in the console.
              </p>
            </div>
          </div>
        )}

        {/* Inspector Component */}
        {showInspector && (
          <DialogueInspector
            deliberationId={deliberationId}
            initialTargetType={targetType as any}
            initialTargetId={targetId}
            initialLocusPath={locusPath}
          />
        )}

        {/* Footer with links */}
        {showInspector && (
          <div className="mt-6 bg-white rounded-lg shadow-md p-4">
            <h3 className="font-semibold text-gray-700 mb-2">🔗 Quick Links</h3>
            <div className="flex flex-wrap gap-2 text-sm">
              <a
                href={`/api/claims/${targetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-sky-100 text-sky-700 rounded hover:bg-sky-200 transition-colors"
              >
                📄 Claim API
              </a>
              <a
                href={`/api/deliberations/${deliberationId}/moves`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
              >
                💬 Moves API
              </a>
              <a
                href={`/api/dialogue/legal-moves?deliberationId=${deliberationId}&targetType=${targetType}&targetId=${targetId}&locusPath=${locusPath}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
              >
                ⚖️ Legal Moves API
              </a>
              <a
                href={`/api/cqs?targetType=${targetType}&targetId=${targetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
              >
                ❓ CQs API
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
