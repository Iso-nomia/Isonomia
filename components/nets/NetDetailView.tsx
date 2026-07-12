"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  Network, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2,
  Download,
  Eye,
  GitFork,
  List,
} from "lucide-react";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// ============================
// Types
// ============================

interface NetDetailViewProps {
  netId: string;
  open: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

interface NetDetail {
  id: string;
  argumentId: string;
  description: string | null;
  overallConfidence: number;
  netType: "serial" | "convergent" | "divergent" | "hybrid";
  argument: {
    conclusion: string;
    author: {
      username: string;
      name: string | null;
    };
  };
  steps: Array<{
    id: string;
    stepOrder: number;
    label: string;
    stepText: string;
    confidence: number;
    inputFromStep: number | null;
    inputSlotMapping: any;
    scheme: {
      id: string;
      name: string;
      description: string | null;
      criticalQuestions: string[];
    };
  }>;
}

// ============================
// Helper Functions
// ============================

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "text-green-600";
  if (confidence >= 0.6) return "text-yellow-600";
  return "text-red-600";
}

function getConfidenceBadgeColor(confidence: number): string {
  if (confidence >= 0.8) return "bg-green-100 text-green-800 border-green-200";
  if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-red-100 text-red-800 border-red-200";
}

function getNetTypeBadgeColor(netType: string): string {
  const colors = {
    serial: "bg-sky-100 text-sky-800 border-sky-200",
    convergent: "bg-purple-100 text-purple-800 border-purple-200",
    divergent: "bg-orange-100 text-orange-800 border-orange-200",
    hybrid: "bg-gray-100 text-gray-800 border-gray-200",
  };
  return colors[netType as keyof typeof colors] || colors.hybrid;
}

// ============================
// Main Component
// ============================

export function NetDetailView({ netId, open, onClose, onEdit }: NetDetailViewProps) {
  const [net, setNet] = useState<NetDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Build ReactFlow graph from net structure
  const buildGraph = useCallback((netData: NetDetail) => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Sort steps by order
    const sortedSteps = [...netData.steps].sort((a, b) => a.stepOrder - b.stepOrder);

    // Create nodes for each step
    sortedSteps.forEach((step, index) => {
      const confidence = step.confidence;
      const isWeakest = confidence === Math.min(...sortedSteps.map(s => s.confidence));

      newNodes.push({
        id: String(step.stepOrder),
        type: "default",
        position: { x: 250, y: index * 150 + 50 },
        data: {
          label: (
            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm">Step {step.stepOrder}</span>
                <Badge className={getConfidenceBadgeColor(confidence)}>
                  {Math.round(confidence * 100)}%
                </Badge>
              </div>
              <div className="text-xs font-medium text-sky-600">{step.scheme.name}</div>
              <div className="text-xs text-gray-700 font-medium">{step.label}</div>
              {isWeakest && (
                <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  Weakest Link
                </Badge>
              )}
            </div>
          ),
        },
        style: {
          border: isWeakest ? "2px solid #ef4444" : "1px solid #e5e7eb",
          borderRadius: "8px",
          background: "white",
          width: 280,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      });

      // Create edges for dependencies
      if (step.inputFromStep !== null) {
        newEdges.push({
          id: `e${step.inputFromStep}-${step.stepOrder}`,
          source: String(step.inputFromStep),
          target: String(step.stepOrder),
          type: "smoothstep",
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#3b82f6",
          },
          style: {
            stroke: "#3b82f6",
            strokeWidth: 2,
          },
        });
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [setNodes, setEdges]);

  // Fetch net details
  useEffect(() => {
    async function fetchNet() {
      if (!open || !netId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/scheme-nets/${netId}`);
        if (!response.ok) throw new Error("Failed to fetch net details");

        const data = await response.json();
        setNet(data);

        // Build graph visualization
        buildGraph(data);
      } catch (err) {
        console.error("[NetDetailView] Error fetching net:", err);
        setError(err instanceof Error ? err.message : "Failed to load net");
      } finally {
        setLoading(false);
      }
    }

    void fetchNet();
  }, [open, netId, buildGraph]);

  // Export net as JSON
  const handleExport = () => {
    if (!net) return;

    const exportData = {
      net: {
        id: net.id,
        type: net.netType,
        description: net.description,
        overallConfidence: net.overallConfidence,
      },
      argument: {
        conclusion: net.argument.conclusion,
        author: net.argument.author.username,
      },
      steps: net.steps.map(step => ({
        order: step.stepOrder,
        scheme: step.scheme.name,
        label: step.label,
        text: step.stepText,
        confidence: step.confidence,
        inputFrom: step.inputFromStep,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `argument-net-${net.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <DialogTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Argument Net Details
              </DialogTitle>
              {net && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={getNetTypeBadgeColor(net.netType)}>
                    {net.netType}
                  </Badge>
                  <Badge className={getConfidenceBadgeColor(net.overallConfidence)}>
                    {Math.round(net.overallConfidence * 100)}% Confidence
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {net.steps.length} steps
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onEdit && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  Edit Net
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading net details...</span>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : net ? (
          <Tabs defaultValue="visualization" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-6">
              <TabsTrigger value="visualization">
                <GitFork className="h-4 w-4 mr-2" />
                Visualization
              </TabsTrigger>
              <TabsTrigger value="steps">
                <List className="h-4 w-4 mr-2" />
                Step Details
              </TabsTrigger>
              <TabsTrigger value="analysis">
                <Eye className="h-4 w-4 mr-2" />
                Analysis
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visualization" className="flex-1 m-0 p-6 pt-4 overflow-hidden">
              <div className="h-full border rounded-lg bg-gray-50">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  fitView
                  attributionPosition="bottom-left"
                >
                  <Background />
                  <Controls />
                  <MiniMap />
                </ReactFlow>
              </div>
            </TabsContent>

            <TabsContent value="steps" className="flex-1 m-0 p-6 pt-4 overflow-y-auto">
              <div className="space-y-4">
                {/* Argument Info */}
                <div className="border rounded-lg p-4 bg-sky-50">
                  <h3 className="font-semibold text-sm text-sky-900 mb-2">
                    Argument Conclusion
                  </h3>
                  <p className="text-sm text-sky-800">{net.argument.conclusion}</p>
                  <p className="text-xs text-sky-600 mt-2">
                    By {net.argument.author.name || net.argument.author.username}
                  </p>
                </div>

                {/* Net Description */}
                {net.description && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-sm mb-2">Description</h3>
                    <p className="text-sm text-muted-foreground">{net.description}</p>
                  </div>
                )}

                {/* Steps */}
                <div className="space-y-3">
                  <h3 className="font-semibold">Reasoning Steps</h3>
                  {net.steps
                    .sort((a, b) => a.stepOrder - b.stepOrder)
                    .map((step) => {
                      const isWeakest = step.confidence === net.overallConfidence;
                      return (
                        <div
                          key={step.id}
                          className={`border rounded-lg p-4 space-y-3 ${
                            isWeakest ? "border-red-300 bg-red-50" : "bg-white"
                          }`}
                        >
                          {/* Step Header */}
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-lg">
                                  Step {step.stepOrder}
                                </span>
                                {isWeakest && (
                                  <Badge className="bg-red-100 text-red-800 border-red-200">
                                    <TrendingDown className="w-3 h-3 mr-1" />
                                    Weakest Link
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm font-medium text-sky-600">
                                {step.scheme.name}
                              </p>
                            </div>
                            <Badge className={getConfidenceBadgeColor(step.confidence)}>
                              {Math.round(step.confidence * 100)}%
                            </Badge>
                          </div>

                          {/* Step Content */}
                          <div>
                            <p className="font-medium text-sm">{step.label}</p>
                            <p className="text-sm text-muted-foreground mt-1">{step.stepText}</p>
                          </div>

                          {/* Dependency Info */}
                          {step.inputFromStep && (
                            <div className="text-xs text-muted-foreground flex items-center">
                              <GitFork className="h-3 w-3 mr-1" />
                              Feeds from Step {step.inputFromStep}
                            </div>
                          )}

                          {/* Scheme Description */}
                          {step.scheme.description && (
                            <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                              <span className="font-semibold">Scheme: </span>
                              {step.scheme.description}
                            </div>
                          )}

                          {/* Critical Questions */}
                          {step.scheme.criticalQuestions.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-gray-700">
                                Critical Questions:
                              </p>
                              <ul className="text-xs text-gray-600 space-y-0.5 ml-4">
                                {step.scheme.criticalQuestions.map((cq, i) => (
                                  <li key={i} className="list-disc">
                                    {cq}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="analysis" className="flex-1 m-0 p-6 pt-4 overflow-y-auto">
              <div className="space-y-6">
                {/* Overall Confidence Analysis */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-sky-600" />
                    Overall Confidence
                  </h3>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-4xl font-bold ${getConfidenceColor(net.overallConfidence)}`}>
                      {Math.round(net.overallConfidence * 100)}%
                    </span>
                    <span className="text-sm text-muted-foreground">
                      (Weakest link principle)
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    The overall confidence of this net is determined by its weakest step. 
                    Even if all other steps are highly confident, a single weak step reduces 
                    the reliability of the entire reasoning chain.
                  </p>
                </div>

                {/* Weakest Link Analysis */}
                <div className="border border-red-200 rounded-lg p-4 bg-red-50 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2 text-red-900">
                    <TrendingDown className="h-5 w-5" />
                    Weakest Link
                  </h3>
                  {(() => {
                    const weakest = net.steps.reduce((min, step) => 
                      step.confidence < min.confidence ? step : min
                    );
                    return (
                      <>
                        <div>
                          <p className="font-medium text-sm text-red-900">
                            Step {weakest.stepOrder}: {weakest.label}
                          </p>
                          <p className="text-sm text-red-800 mt-1">
                            Confidence: {Math.round(weakest.confidence * 100)}%
                          </p>
                        </div>
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            This step has the lowest confidence in the net. Consider strengthening 
                            this step by adding more evidence, addressing critical questions, or 
                            using a stronger argumentation scheme.
                          </AlertDescription>
                        </Alert>
                        {weakest.scheme.criticalQuestions.length > 0 && (
                          <div>
                            <p className="text-sm font-semibold text-red-900 mb-2">
                              Focus on these critical questions:
                            </p>
                            <ul className="space-y-1">
                              {weakest.scheme.criticalQuestions.slice(0, 3).map((cq, i) => (
                                <li key={i} className="text-sm text-red-800 flex items-start">
                                  <span className="mr-2">•</span>
                                  <span>{cq}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Confidence Distribution */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold">Confidence Distribution</h3>
                  <div className="space-y-2">
                    {net.steps
                      .sort((a, b) => b.confidence - a.confidence)
                      .map((step) => (
                        <div key={step.id} className="flex items-center gap-3">
                          <span className="text-sm w-16">Step {step.stepOrder}</span>
                          <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                step.confidence >= 0.8
                                  ? "bg-green-500"
                                  : step.confidence >= 0.6
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                              }`}
                              style={{ width: `${step.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-sm w-12 text-right">
                            {Math.round(step.confidence * 100)}%
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Net Structure Analysis */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold">Structure Analysis</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Net Type</p>
                      <Badge className={getNetTypeBadgeColor(net.netType)}>
                        {net.netType}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Steps</p>
                      <p className="font-semibold">{net.steps.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Independent Steps</p>
                      <p className="font-semibold">
                        {net.steps.filter(s => !s.inputFromStep).length}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Confidence</p>
                      <p className="font-semibold">
                        {Math.round(
                          net.steps.reduce((sum, s) => sum + s.confidence, 0) / net.steps.length * 100
                        )}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
