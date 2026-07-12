// app/(editor)/about/onboarding/_components/ceg-explorer-embedded.tsx
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Loader2, AlertCircle } from "lucide-react";
import type { CegNode, CegEdge } from "@/components/graph/useCegData";

// We'll fetch the CEG data client-side to avoid SSR issues in the accordion
interface CegExplorerEmbeddedProps {
  deliberationId: string;
  defaultExpanded?: boolean;
}

export default function CegExplorerEmbedded({
  deliberationId,
  defaultExpanded = false,
}: CegExplorerEmbeddedProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cegData, setCegData] = useState<{
    nodes: CegNode[];
    edges: CegEdge[];
    metadata: {
      title: string;
      description: string | null;
      claimCount: number;
      edgeCount: number;
    };
  } | null>(null);

  // Dynamically import the client component only when expanded
  const [ClientComponent, setClientComponent] = useState<any>(null);

  useEffect(() => {
    if (isExpanded && !ClientComponent) {
      // Dynamically import to avoid loading until needed
      import("../demos/ceg-explorer-real/ceg-explorer-real-data-client").then(
        (mod) => setClientComponent(() => mod.default)
      );
    }
  }, [isExpanded, ClientComponent]);

  // Fetch data when expanded
  useEffect(() => {
    if (isExpanded && !cegData && !isLoading && !error) {
      fetchCegData();
    }
  }, [isExpanded, cegData, isLoading, error]);

  const fetchCegData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // We'll use the API endpoint that should exist for fetching CEG data
      const response = await fetch(`/api/deliberations/${deliberationId}/ceg/mini`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch CEG data: ${response.statusText}`);
      }

      const apiData = await response.json();
      
      // Transform the API response to match what the client component expects
      const transformedData = {
        nodes: (apiData.nodes || []).map((node: any) => ({
          ...node,
          type: "claim" as const,
          approvals: 0, // API doesn't provide this, default to 0
        })),
        edges: apiData.edges || [],
        metadata: {
          title: "Deliberation Claims Graph",
          description: "Real-time claim evaluation graph from the Mesh database",
          claimCount: apiData.totalClaims || 0,
          edgeCount: apiData.totalEdges || 0,
        },
      };
      
      setCegData(transformedData);
    } catch (err) {
      console.error("Error fetching CEG data:", err);
      setError(err instanceof Error ? err.message : "Failed to load CEG data");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className=" rounded-xl overflow-hidden  modalv2">
      {/* Accordion Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 "
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-slate-900">
              Live CEG Explorer Demo
            </h3>
            <p className="text-sm text-slate-600">
              Real deliberation data from the Mesh database
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-slate-900 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Accordion Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border border-indigo-200 rounded-xl bg-transparent"
          >
            <div className="surfacev2">
              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mx-auto mb-3" />
                    <p className="text-slate-600">Loading CEG data...</p>
                  </div>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center max-w-md">
                    <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
                    <h4 className="text-lg font-semibold text-slate-900 mb-2">
                      Failed to Load
                    </h4>
                    <p className="text-sm text-slate-600 mb-4">{error}</p>
                    <button
                      onClick={fetchCegData}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {/* Loaded Content */}
              {ClientComponent && cegData && !isLoading && !error && (
                <ClientComponent
                  deliberationId={deliberationId}
                  initialNodes={cegData.nodes}
                  initialEdges={cegData.edges}
                  metadata={cegData.metadata}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
