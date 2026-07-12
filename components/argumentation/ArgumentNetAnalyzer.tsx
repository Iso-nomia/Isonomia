"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Network,
  HelpCircle,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NetGraphWithCQs } from "@/components/nets/visualization/NetGraphWithCQs";
import { ComposedCQPanel } from "@/components/cqs/ComposedCQPanel";
import { ComposedCQsModal } from "@/components/arguments/ComposedCQsModal";

// ============================================================================
// Types
// ============================================================================

export interface ArgumentNetAnalyzerProps {
  argumentId: string;
  deliberationId: string;
  currentUserId?: string;
  
  // Optional: If you already have net data, pass it to skip detection
  netId?: string;
  
  // Callbacks
  onNetDetected?: (netId: string | null) => void;
  onNetConfirmed?: (netId: string) => void;
  
  // UI options
  defaultView?: "visualization" | "questions" | "history" | "export";
  showManagement?: boolean; // Show version history and export tabs
  compact?: boolean; // Compact mode for embedded usage
}

interface NetData {
  id: string;
  netType: string;
  schemes: any[];
  dependencyGraph: any;
  explicitnessAnalysis: any;
  complexity: number;
  confidence: number;
  isConfirmed?: boolean;
  detection?: {
    method: "structural" | "semantic" | "hybrid";
    timestamp: Date;
    signals: string[];
  };
}

// ============================================================================
// Main Component
// ============================================================================

export function ArgumentNetAnalyzer({
  argumentId,
  deliberationId,
  currentUserId,
  netId: providedNetId,
  onNetDetected,
  onNetConfirmed,
  defaultView = "visualization",
  showManagement = true,
  compact = false,
}: ArgumentNetAnalyzerProps) {
  // State
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [netData, setNetData] = useState<NetData | null>(null);
  const [activeTab, setActiveTab] = useState<string>(defaultView);
  const [isSingleScheme, setIsSingleScheme] = useState(false);

  // Initialize - detect or fetch net
  useEffect(() => {
    if (providedNetId) {
      fetchNet(providedNetId);
    } else {
      detectNet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [argumentId, providedNetId]);

  /**
   * Detect if argument contains a multi-scheme net
   */
  const detectNet = async () => {
    setDetecting(true);
    setError(null);
    
    try {
      const response = await fetch("/api/nets/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ argumentId }),
      });

      if (!response.ok) {
        throw new Error("Failed to detect net");
      }

      const data = await response.json();
      
      if (data.net) {
        // Multi-scheme net detected
        setNetData(data.net);
        setIsSingleScheme(false);
        onNetDetected?.(data.net.id);
        
        // Log detection details for debugging
        console.log("[ArgumentNetAnalyzer] Net detected:", {
          argumentId,
          netId: data.net.id,
          schemeCount: data.net.schemes?.length || 0,
          netType: data.net.netType,
          confidence: data.net.confidence,
          detectionMethod: data.net.detection?.method,
        });
      } else {
        // Single scheme argument
        setNetData(null);
        setIsSingleScheme(true);
        onNetDetected?.(null);
        console.log("[ArgumentNetAnalyzer] Single-scheme argument:", argumentId);
      }
    } catch (err) {
      console.error("Net detection error:", err);
      setError(err instanceof Error ? err.message : "Failed to detect net");
      setIsSingleScheme(true);
    } finally {
      setDetecting(false);
      setLoading(false);
    }
  };

  /**
   * Fetch existing net by ID
   */
  const fetchNet = async (netId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/nets/${netId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch net");
      }

      const data = await response.json();
      setNetData(data.net);
      setIsSingleScheme(false);
    } catch (err) {
      console.error("Net fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch net");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Confirm net detection
   */
  const handleConfirmNet = async () => {
    if (!netData) return;

    try {
      const response = await fetch(`/api/nets/${netData.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirmed",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to confirm net");
      }

      setNetData({ ...netData, isConfirmed: true });
      onNetConfirmed?.(netData.id);
    } catch (err) {
      console.error("Net confirmation error:", err);
      setError(err instanceof Error ? err.message : "Failed to confirm net");
    }
  };

  /**
   * Refresh net data
   */
  const handleRefresh = useCallback(() => {
    if (providedNetId) {
      fetchNet(providedNetId);
    } else {
      detectNet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providedNetId, argumentId]);

  // ============================================================================
  // Render States
  // ============================================================================

  if (loading || detecting) {
    return (
      <Card className={cn("p-6", compact && "p-4")}>
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          <span className="text-sm text-gray-600">
            {detecting ? "Detecting argument structure..." : "Loading net..."}
          </span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("p-6", compact && "p-4")}>
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <div>
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
        <Button onClick={handleRefresh} className="mt-4" variant="outline" size="sm">
          Try Again
        </Button>
      </Card>
    );
  }

  // Single scheme - fallback to basic CQ view
  if (isSingleScheme || !netData) {
    return (
      <Card className={cn("p-6", compact && "p-4")}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-semibold">Single Scheme Argument</h3>
              <p className="text-sm text-gray-600">
                This argument uses a single argumentation scheme. No multi-scheme net detected.
              </p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Multi-scheme net detected
  const needsConfirmation = !netData.isConfirmed && netData.confidence < 90;

  return (
    <div className={cn("space-y-4 ", compact && "space-y-2")}>
      {/* Header */}
      <Card className={cn("p-3", compact && "p-3")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Network className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-semibold">Multi-Scheme Argument Net</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">{netData.netType}</Badge>
                <Badge variant="outline">{netData.schemes.length} schemes</Badge>
                <Badge
                  variant={netData.confidence > 80 ? "default" : "secondary"}
                >
                  {netData.confidence}% confidence
                </Badge>
                {/* Week 5: Show detection method */}
                {netData.detection?.method === "hybrid" && (
                  <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                    Auto-detected
                  </Badge>
                )}
              </div>
            </div>
          </div>





           <div className="flex ">
{needsConfirmation && (
    <div className ="flex flex-col gap-2 items-end">
          <div className=" px-1.5 py-1 w-fit bg-orange-50 border border-orange-200 rounded-md">
            <p className="text-xs text-orange-800">
              This net was automatically detected. Please review the structure and confirm if
              it&apos;s correct.
            </p>
          </div>
    
            <button onClick={handleConfirmNet} className="flex w-fit justify-end items-center bg-indigo-50 text-xs gap-2 btnv2--ghost px-2 py-1 rounded-md">
              <CheckCircle2 className="flex items-center w-3 h-3 " />
             <span className="flex items-center">Confirm Net</span>
            </button>
             </div>
          )}
         
              </div>
        </div>
   

        
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={cn("w-full", compact && "h-9")}>
          <TabsTrigger value="visualization" className="flex-1">
            <Network className="w-4 h-4 mr-2" />
            Visualization
          </TabsTrigger>
          <TabsTrigger value="questions" className="flex-1">
            <HelpCircle className="w-4 h-4 mr-2" />
            Critical Questions
          </TabsTrigger>
        </TabsList>

        {/* Visualization Tab */}
        <TabsContent value="visualization" className="mt-4">
          <NetGraphWithCQs
            net={netData}
            dependencyGraph={netData.dependencyGraph}
            explicitnessAnalysis={netData.explicitnessAnalysis}
            layout="hierarchical"
            argumentId={argumentId}
          />
        </TabsContent>

        {/* Critical Questions Tab */}
        <TabsContent value="questions" className="mt-4">
          <ComposedCQPanel
            netId={netData.id.startsWith('net-') ? argumentId : netData.id}
            onSchemeSelect={(schemeId) => {
              // Switch to visualization tab and highlight scheme
              setActiveTab("visualization");
            }}
            onDependencyHighlight={(sourceId, targetId) => {
              // Switch to visualization tab and highlight dependency
              setActiveTab("visualization");
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
