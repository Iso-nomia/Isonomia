"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lightbulb, AlertCircle, HelpCircle } from "lucide-react";
import { Node } from "@xyflow/react";
import { ChainNodeData } from "@/lib/types/argumentChain";

interface Enabler {
  nodeId: string;
  nodeName: string;
  schemeName: string;
  schemeKey: string;
  enablerText: string; // The conditional/warrant from the scheme
  confidence: number;
  role: "primary" | "supporting" | "presupposed";
  premiseCount: number;
  conclusionText?: string;
  justification?: string; // Reconstruction reasoning
}

interface EnablerPanelProps {
  nodes: Node<ChainNodeData>[];
  chainId?: string;
  onHighlightNode?: (nodeId: string) => void;
  onChallengeEnabler?: (nodeId: string, schemeName: string, enablerText: string) => void;
}

/**
 * EnablerPanel - Displays explicit inference assumptions (enablers) from argumentation schemes.
 * 
 * Implements AGORA-net's core insight: "Making inference rules explicit enables critical reflection."
 * 
 * For each node with an argumentation scheme, extracts the scheme's major premise (conditional)
 * and displays it as an explicit assumption that can be challenged.
 * 
 * Example: For "Argument from Expert Opinion", shows:
 *   "This reasoning assumes: IF source E is an expert in domain S, AND E asserts A, THEN A is plausible."
 */
export function EnablerPanel({ 
  nodes, 
  chainId, 
  onHighlightNode,
  onChallengeEnabler 
}: EnablerPanelProps) {
  const [enablers, setEnablers] = useState<Enabler[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedEnablerId, setExpandedEnablerId] = useState<string | null>(null);

  useEffect(() => {
    extractEnablers();
  }, [nodes]);

  const extractEnablers = () => {
    const extractedEnablers: Enabler[] = [];

    nodes.forEach(node => {
      const data = node.data;
      
      // Check if node has schemes (use argumentSchemes - Prisma relation name)
      if (!data.argument?.argumentSchemes || data.argument.argumentSchemes.length === 0) {
        return;
      }

      // Process each scheme on this node
      data.argument.argumentSchemes.forEach((schemeInstance: any) => {
        const scheme = schemeInstance.scheme;
        
        if (!scheme) return;

        // Extract the major premise (enabler) from scheme.premises
        let enablerText = "";
        
        if (scheme.premises && Array.isArray(scheme.premises)) {
          // Find the major premise (usually marked with type: "major" or first conditional)
          const majorPremise = (scheme.premises as any[]).find((p: any) => 
            p.type === "major" || p.type === "conditional" || p.id === "P1"
          );
          
          if (majorPremise) {
            enablerText = majorPremise.text;
          } else if (scheme.premises.length > 0) {
            // Fallback: use first premise if no major premise marked
            enablerText = (scheme.premises as any[])[0].text;
          }
        }

        // Fallback: construct from scheme name/description if no premises
        if (!enablerText && scheme.description) {
          enablerText = `IF ${scheme.name || scheme.key} applies, THEN the conclusion follows.`;
        } else if (!enablerText) {
          enablerText = `This argument uses the ${scheme.name || scheme.key} scheme.`;
        }

        extractedEnablers.push({
          nodeId: node.id,
          nodeName: data.argument?.text || "Unnamed node",
          schemeName: scheme.name || scheme.title || scheme.key,
          schemeKey: scheme.key,
          enablerText,
          confidence: schemeInstance.confidence || 1.0,
          role: schemeInstance.role || "primary",
          premiseCount: Array.isArray(scheme.premises) ? scheme.premises.length : 0,
          conclusionText: data.argument?.text,
          justification: schemeInstance.justification || undefined
        });
      });
    });

    setEnablers(extractedEnablers);
  };

  const handleHighlightNode = (nodeId: string) => {
    if (onHighlightNode) {
      onHighlightNode(nodeId);
    }
  };

  const handleChallengeEnabler = (enabler: Enabler) => {
    if (onChallengeEnabler) {
      onChallengeEnabler(enabler.nodeId, enabler.schemeName, enabler.enablerText);
    }
  };

  const toggleExpanded = (enablerId: string) => {
    setExpandedEnablerId(expandedEnablerId === enablerId ? null : enablerId);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "primary":
        return "bg-sky-100 text-sky-700 border-sky-300";
      case "supporting":
        return "bg-green-100 text-green-700 border-green-300";
      case "presupposed":
        return "bg-purple-100 text-purple-700 border-purple-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600";
    if (confidence >= 0.5) return "text-yellow-600";
    return "text-red-600";
  };

  if (enablers.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Lightbulb className="w-4 h-4 text-yellow-500" />
            Inference Assumptions (Enablers)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No schemes found. Add argumentation schemes to nodes to see their underlying inference assumptions.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Group enablers by node
  const enablersByNode = enablers.reduce((acc, enabler) => {
    if (!acc[enabler.nodeId]) {
      acc[enabler.nodeId] = [];
    }
    acc[enabler.nodeId].push(enabler);
    return acc;
  }, {} as Record<string, Enabler[]>);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Lightbulb className="w-4 h-4 text-yellow-500" />
          Inference Assumptions (Enablers)
          <Badge variant="outline" className="ml-auto">
            {enablers.length} assumption{enablers.length !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Explicit inference rules that make these arguments work. Challenge them to test the reasoning.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(enablersByNode).map(([nodeId, nodeEnablers]) => (
          <Card key={nodeId} className="border-l-4 border-l-yellow-400">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="text-sm font-medium">
                    {nodeEnablers[0].nodeName}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {nodeEnablers.length} inference rule{nodeEnablers.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleHighlightNode(nodeId)}
                  className="h-7 text-xs"
                >
                  Highlight
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {nodeEnablers.map((enabler, idx) => {
                const enablerId = `${enabler.nodeId}-${idx}`;
                const isExpanded = expandedEnablerId === enablerId;

                return (
                  <div
                    key={enablerId}
                    className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-3 space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge 
                            variant="outline" 
                            className={getRoleBadgeColor(enabler.role)}
                          >
                            {enabler.role}
                          </Badge>
                          <span className="text-xs font-medium text-yellow-800">
                            {enabler.schemeName}
                          </span>
                          <span className={`text-xs font-semibold ${getConfidenceColor(enabler.confidence)}`}>
                            {Math.round(enabler.confidence * 100)}%
                          </span>
                        </div>
                        
                        <div className="text-xs text-gray-700 leading-relaxed">
                          <span className="font-semibold text-yellow-800">This reasoning assumes:</span>
                          <p className="mt-1 italic">
                            {isExpanded 
                              ? enabler.enablerText 
                              : enabler.enablerText.length > 120
                                ? `${enabler.enablerText.substring(0, 120)}...`
                                : enabler.enablerText
                            }
                          </p>
                        </div>

                        {enabler.enablerText.length > 120 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(enablerId)}
                            className="h-6 text-xs text-yellow-700 hover:text-yellow-800"
                          >
                            {isExpanded ? "Show less" : "Show full assumption"}
                          </Button>
                        )}

                        {isExpanded && enabler.conclusionText && (
                          <div className="mt-2 pt-2 border-t border-yellow-200">
                            <p className="text-xs text-gray-600">
                              <span className="font-semibold">Conclusion:</span> {enabler.conclusionText}
                            </p>
                          </div>
                        )}
                        
                        {/* Justification Display */}
                        {enabler.justification && (
                          <div className="mt-2 pt-2 border-t border-yellow-200 bg-yellow-100/30 -mx-1 px-1 py-1 rounded">
                            <div className="flex items-start gap-1.5">
                              <span className="text-yellow-700 text-xs shrink-0">💭</span>
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-yellow-800 mb-0.5">
                                  Why this reconstruction:
                                </p>
                                <p className="text-xs text-yellow-700 italic leading-relaxed">
                                  {enabler.justification}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-yellow-200">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <HelpCircle className="w-3 h-3" />
                        <span>{enabler.premiseCount} premise{enabler.premiseCount !== 1 ? "s" : ""}</span>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleChallengeEnabler(enabler)}
                        className="h-7 text-xs bg-white hover:bg-red-50 border-red-300 text-red-700 hover:text-red-800"
                      >
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Challenge this assumption
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}

        <Alert className="mt-4 bg-sky-50 border-sky-200">
          <Lightbulb className="h-4 w-4 text-sky-600" />
          <AlertDescription className="text-xs text-sky-800">
            <strong>What are enablers?</strong> Enablers are the implicit inference rules that connect premises to conclusions. 
            In AGORA-net's framework, making these explicit allows critical reflection on the reasoning itself, 
            not just the claims being made.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
