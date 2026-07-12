"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Loader2, TrendingUp, AlertTriangle, CheckCircle, Info, Network } from "lucide-react";

interface CriticalPath {
  nodeIds: string[];
  totalStrength: number;
  avgStrength: number;
  weakestLink: {
    nodeId: string;
    edgeStrength: number;
  };
  pathLength: number;
}

interface Cycle {
  nodeIds: string[];
  severity: "warning" | "error";
  avgStrength: number;
  description: string;
}

interface ChainStrength {
  overallStrength: number;
  nodeStrengths: Record<string, number>;
  vulnerableNodes: string[];
  strongNodes: string[];
  structureType: string;
}

interface AnalysisResult {
  criticalPath: CriticalPath;
  cycles: Cycle[];
  strength: ChainStrength;
  suggestions: any[];
  schemeNetComplexity?: {
    complexNodes: string[];
    schemeNetNodes: Record<string, {
      schemeCount: number;
      hasSteps: boolean;
      overallConfidence: number;
      isPrimary: boolean;
    }>;
  };
  schemeInfo?: {
    argumentsWithSchemes: number;
    argumentsWithSchemeNets: number;
    schemeCounts: Array<{
      schemeId: string;
      schemeName: string;
      schemeKey: string;
      count: number;
    }>;
    unstructuredArguments: string[];
  };
  metadata: {
    analyzedAt: string;
    nodeCount: number;
    edgeCount: number;
    structureType: string;
  };
}

interface ChainAnalysisPanelProps {
  chainId: string;
  onHighlightNodes?: (nodeIds: string[]) => void;
}

export function ChainAnalysisPanel({
  chainId,
  onHighlightNodes,
}: ChainAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/argument-chains/${chainId}/analyze`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to analyze chain");
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = (strength: number): string => {
    if (strength >= 0.8) return "text-green-600";
    if (strength >= 0.5) return "text-yellow-600";
    return "text-red-600";
  };

  const getStrengthLabel = (strength: number): string => {
    if (strength >= 0.8) return "Strong";
    if (strength >= 0.5) return "Moderate";
    return "Weak";
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Chain Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            onClick={runAnalysis}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Analyzing..." : "Run Analysis"}
          </Button>
          {analysis && (
            <Badge variant="outline" className="text-xs">
              Last analyzed: {new Date(analysis.metadata.analyzedAt).toLocaleTimeString()}
            </Badge>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {analysis && (
          <div className="space-y-6">
            {/* Overall Strength */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Overall Chain Strength</h3>
                <Badge
                  variant={analysis.strength.overallStrength >= 0.8 ? "default" : "secondary"}
                  className={getStrengthColor(analysis.strength.overallStrength)}
                >
                  {getStrengthLabel(analysis.strength.overallStrength)}
                </Badge>
              </div>
              <Progress
                value={analysis.strength.overallStrength * 100}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">
                {(analysis.strength.overallStrength * 100).toFixed(0)}% (
                {analysis.strength.structureType} structure)
              </p>
            </div>

            {/* Critical Path */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Critical Path (Strongest Reasoning)
              </h3>
              <p className="text-xs text-muted-foreground">
                The most robust inference chain through your arguments
              </p>
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap gap-1">
                  {analysis.criticalPath.nodeIds.map((nodeId, idx) => (
                    <div key={nodeId} className="flex items-center gap-1">
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-primary/10"
                        onClick={() => onHighlightNodes?.([nodeId])}
                      >
                        Node {idx + 1}
                      </Badge>
                      {idx < analysis.criticalPath.nodeIds.length - 1 && (
                        <span className="text-muted-foreground">→</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Avg Strength:</span>{" "}
                    <span className="font-medium">
                      {(analysis.criticalPath.avgStrength * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Path Length:</span>{" "}
                    <span className="font-medium">
                      {analysis.criticalPath.pathLength} steps
                    </span>
                  </div>
                </div>
                {analysis.criticalPath.weakestLink.nodeId && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Weakest Link:</span>{" "}
                    <Badge
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() =>
                        onHighlightNodes?.([analysis.criticalPath.weakestLink.nodeId])
                      }
                    >
                      {analysis.criticalPath.weakestLink.edgeStrength.toFixed(2)} strength
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Cycles Warning */}
            {analysis.cycles.length > 0 && (
              <Alert variant={analysis.cycles.some((c) => c.severity === "error") ? "destructive" : "default"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="space-y-2">
                  <p className="font-semibold">Circular Reasoning Detected</p>
                  <p>
                    Found {analysis.cycles.length} circular pattern(s) in your chain.
                  </p>
                  {analysis.cycles.map((cycle, idx) => (
                    <div
                      key={idx}
                      className="bg-background/50 rounded p-2 space-y-1 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={cycle.severity === "error" ? "destructive" : "secondary"}
                        >
                          {cycle.severity}
                        </Badge>
                        <span>{cycle.description}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {cycle.nodeIds.map((nodeId, i) => (
                          <div key={nodeId} className="flex items-center gap-1">
                            <Badge
                              variant="outline"
                              className="cursor-pointer"
                              onClick={() => onHighlightNodes?.(cycle.nodeIds)}
                            >
                              {nodeId.slice(0, 8)}
                            </Badge>
                            {i < cycle.nodeIds.length - 1 && (
                              <span className="text-muted-foreground">→</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {/* Vulnerable Nodes */}
            {analysis.strength.vulnerableNodes.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  Vulnerable Nodes
                </h3>
                <p className="text-xs text-muted-foreground">
                  Arguments with weak support or strong attacks (&lt;50% strength)
                </p>
                <div className="flex flex-wrap gap-2">
                  {analysis.strength.vulnerableNodes.map((nodeId) => (
                    <Badge
                      key={nodeId}
                      variant="destructive"
                      className="cursor-pointer"
                      onClick={() => onHighlightNodes?.([nodeId])}
                    >
                      {nodeId.slice(0, 8)}... (
                      {(analysis.strength.nodeStrengths[nodeId] * 100).toFixed(0)}%)
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Strong Nodes */}
            {analysis.strength.strongNodes.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Strong Nodes
                </h3>
                <p className="text-xs text-muted-foreground">
                  Well-supported arguments with high confidence (&gt;80% strength)
                </p>
                <div className="flex flex-wrap gap-2">
                  {analysis.strength.strongNodes.map((nodeId) => (
                    <Badge
                      key={nodeId}
                      variant="default"
                      className="cursor-pointer bg-green-600 hover:bg-green-700"
                      onClick={() => onHighlightNodes?.([nodeId])}
                    >
                      {nodeId.slice(0, 8)}... (
                      {(analysis.strength.nodeStrengths[nodeId] * 100).toFixed(0)}%)
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Scheme Coverage Summary (Phase 3 Lite) */}
            {analysis.schemeInfo && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  Scheme Coverage
                </h3>
                <p className="text-xs text-muted-foreground">
                  Argumentation schemes used across the chain
                </p>
                <div className="bg-muted/50 rounded-lg p-3 space-y-3">
                  {/* Coverage stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">With Schemes:</span>{" "}
                      <span className="font-medium">
                        {analysis.schemeInfo.argumentsWithSchemes}/{analysis.metadata.nodeCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">With SchemeNets:</span>{" "}
                      <span className="font-medium">
                        {analysis.schemeInfo.argumentsWithSchemeNets}
                      </span>
                    </div>
                  </div>
                  
                  {/* Scheme distribution */}
                  {analysis.schemeInfo.schemeCounts.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Schemes Used:</span>
                      <div className="flex flex-wrap gap-1">
                        {analysis.schemeInfo.schemeCounts.slice(0, 5).map((scheme) => (
                          <Badge
                            key={scheme.schemeId}
                            variant="outline"
                            className="text-xs border-blue-200 text-blue-700"
                          >
                            {scheme.schemeName} ({scheme.count})
                          </Badge>
                        ))}
                        {analysis.schemeInfo.schemeCounts.length > 5 && (
                          <Badge variant="secondary" className="text-xs">
                            +{analysis.schemeInfo.schemeCounts.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Unstructured arguments warning */}
                  {analysis.schemeInfo.unstructuredArguments.length > 0 && (
                    <div className="text-xs text-amber-700 bg-amber-50 rounded p-2">
                      <span className="font-medium">
                        {analysis.schemeInfo.unstructuredArguments.length} argument(s)
                      </span>{" "}
                      without assigned schemes.{" "}
                      <span className="text-muted-foreground">
                        Consider adding scheme classifications for deeper analysis.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SchemeNet Complexity Indicators (Task 3.6) */}
            {analysis.schemeNetComplexity && analysis.schemeNetComplexity.complexNodes.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Network className="h-4 w-4 text-purple-600" />
                  Multi-Scheme Arguments
                </h3>
                <p className="text-xs text-muted-foreground">
                  Arguments using complex multi-scheme structures (SchemeNet)
                </p>
                <div className="flex flex-wrap gap-2">
                  {analysis.schemeNetComplexity.complexNodes.map((nodeId) => {
                    const nodeData = analysis.schemeNetComplexity!.schemeNetNodes[nodeId];
                    return (
                      <Badge
                        key={nodeId}
                        variant="outline"
                        className="cursor-pointer border-purple-300 text-purple-700 hover:bg-purple-50"
                        onClick={() => onHighlightNodes?.([nodeId])}
                      >
                        <Network className="h-3 w-3 mr-1" />
                        {nodeId.slice(0, 8)}... ({nodeData?.schemeCount || 0} schemes)
                      </Badge>
                    );
                  })}
                </div>
                <Alert className="bg-purple-50 border-purple-200">
                  <Info className="h-4 w-4 text-purple-600" />
                  <AlertDescription className="text-xs text-purple-900">
                    These arguments use multiple argumentation schemes in coordinated structures.
                    This indicates sophisticated reasoning but may also introduce complexity.
                    {analysis.schemeNetComplexity.complexNodes.length > 2 && (
                      <span className="block mt-1 font-medium">
                        Your chain shows high argumentative sophistication with {analysis.schemeNetComplexity.complexNodes.length} multi-scheme nodes.
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Metadata */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="h-3 w-3" />
                <span>
                  Analyzed {analysis.metadata.nodeCount} nodes and{" "}
                  {analysis.metadata.edgeCount} edges using WWAW strength formula
                </span>
              </div>
            </div>
          </div>
        )}

        {!analysis && !loading && !error && (
          <div className="text-center text-sm text-muted-foreground py-8">
            Click &quot;Run Analysis&quot; to evaluate your argument chain
          </div>
        )}
      </CardContent>
    </Card>
  );
}
