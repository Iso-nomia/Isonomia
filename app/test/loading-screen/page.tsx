"use client";

import { DeliberationLoadingScreen } from "@/components/deliberations/DeliberationLoadingScreen";
import { useState } from "react";

export default function LoadingScreenTestPage() {
  const [hostName, setHostName] = useState<string | null>("Sample Article Title");
  const [showHostName, setShowHostName] = useState(true);

  return (
    <div className="min-h-screen">
      {/* Controls Panel */}
      <div className="fixed top-4 right-4 z-50 bg-white/95 backdrop-blur rounded-lg shadow-lg p-4 border border-slate-200 max-w-xs">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Loading Screen Test Controls
        </h3>
        
        <div className="space-y-3">
          <div>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={showHostName}
                onChange={(e) => setShowHostName(e.target.checked)}
                className="rounded"
              />
              Show host name
            </label>
          </div>

          {showHostName && (
            <div>
              <label className="block text-xs text-slate-700 mb-1">
                Host Name:
              </label>
              <input
                type="text"
                value={hostName || ""}
                onChange={(e) => setHostName(e.target.value || null)}
                className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                placeholder="Enter title..."
              />
            </div>
          )}

          <div className="pt-2 border-t border-slate-200">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded transition"
            >
              Reload Page
            </button>
          </div>

          <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-200">
            Edit component at:<br />
            <code className="text-indigo-600">
              components/deliberations/<br />DeliberationLoadingScreen.tsx
            </code>
          </div>
        </div>
      </div>

      {/* Loading Screen Component */}
      <DeliberationLoadingScreen 
        hostName={showHostName ? hostName : null} 
      />
    </div>
  );
}
