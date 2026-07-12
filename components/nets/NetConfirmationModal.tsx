"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { CheckCircle, XCircle, Edit, AlertTriangle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface NetConfirmationModalProps {
  netId: string;
  net: any;
  explicitnessAnalysis: any;
  reconstructionSuggestions: any[];
  onConfirm: (netId: string, modifications?: any) => void;
  onReject: (netId: string, reason: string) => void;
  onModify: (netId: string, modifications: any) => void;
  onClose: () => void;
}

export function NetConfirmationModal({
  netId,
  net,
  explicitnessAnalysis,
  reconstructionSuggestions,
  onConfirm,
  onReject,
  onModify,
  onClose,
}: NetConfirmationModalProps) {
  const [rejectReason, setRejectReason] = useState("");
  const [modifications, setModifications] = useState<any>({});
  const [showRejectInput, setShowRejectInput] = useState(false);

  const handleConfirm = () => {
    onConfirm(netId, Object.keys(modifications).length > 0 ? modifications : undefined);
    onClose();
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }
    onReject(netId, rejectReason);
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Argument Net Detected
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="schemes">Schemes</TabsTrigger>
            <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
            <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Net Overview</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <Badge className="capitalize">{net.netType}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Complexity</p>
                  <p className="font-medium">{net.complexity}/100</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Confidence</p>
                  <p className="font-medium">{net.confidence}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Explicitness</p>
                  <Badge
                    className={
                      explicitnessAnalysis.overallExplicitness === "explicit"
                        ? "bg-green-100 text-green-800"
                        : explicitnessAnalysis.overallExplicitness === "semi-explicit"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }
                  >
                    {explicitnessAnalysis.overallExplicitness}
                  </Badge>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-2">Detection Signals</h3>
              <ul className="list-disc list-inside space-y-1">
                {net.detection.signals.map((signal: string, idx: number) => (
                  <li key={idx} className="text-sm">
                    {signal}
                  </li>
                ))}
              </ul>
            </Card>
          </TabsContent>

          {/* Schemes Tab */}
          <TabsContent value="schemes" className="space-y-4">
            {net.schemes.map((scheme: any, idx: number) => {
              const schemeAnalysis = explicitnessAnalysis.schemeExplicitness.find(
                (s: any) => s.schemeId === scheme.schemeId
              );

              return (
                <Card key={idx} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold">{scheme.schemeName}</h4>
                      <p className="text-sm text-muted-foreground">{scheme.schemeCategory}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge className="capitalize">{scheme.role}</Badge>
                      {schemeAnalysis && (
                        <Badge
                          className={
                            schemeAnalysis.level === "explicit"
                              ? "bg-green-100 text-green-800"
                              : schemeAnalysis.level === "semi-explicit"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }
                        >
                          {schemeAnalysis.level}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm">Confidence: {scheme.confidence}%</p>
                  {schemeAnalysis && schemeAnalysis.evidence.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted-foreground">Evidence:</p>
                      <ul className="list-disc list-inside text-xs space-y-1">
                        {schemeAnalysis.evidence.map((e: string, i: number) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              );
            })}
          </TabsContent>

          {/* Dependencies Tab */}
          <TabsContent value="dependencies" className="space-y-4">
            {net.relationships.map((rel: any, idx: number) => {
              const relAnalysis = explicitnessAnalysis.relationshipExplicitness.find(
                (r: any) =>
                  r.sourceScheme === rel.sourceScheme && r.targetScheme === rel.targetScheme
              );

              const sourceScheme = net.schemes.find((s: any) => s.schemeId === rel.sourceScheme);
              const targetScheme = net.schemes.find((s: any) => s.schemeId === rel.targetScheme);

              return (
                <Card key={idx} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">{sourceScheme?.schemeName}</span>
                    <span className="text-muted-foreground">→</span>
                    <Badge className="capitalize">{rel.type}</Badge>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-sm font-medium">{targetScheme?.schemeName}</span>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span>Strength: {Math.round(rel.strength * 100)}%</span>
                    {relAnalysis && (
                      <Badge
                        className={
                          relAnalysis.level === "explicit"
                            ? "bg-green-100 text-green-800"
                            : relAnalysis.level === "semi-explicit"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }
                      >
                        {relAnalysis.level}
                      </Badge>
                    )}
                  </div>
                </Card>
              );
            })}
          </TabsContent>

          {/* Suggestions Tab */}
          <TabsContent value="suggestions" className="space-y-4">
            {reconstructionSuggestions.length === 0 ? (
              <Card className="p-4">
                <p className="text-muted-foreground">No reconstruction suggestions needed</p>
              </Card>
            ) : (
              reconstructionSuggestions.slice(0, 5).map((suggestion: any, idx: number) => (
                <Card key={idx} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold">{suggestion.suggestion.title}</h4>
                    <Badge
                      className={
                        suggestion.priority === "critical"
                          ? "bg-red-100 text-red-800"
                          : suggestion.priority === "high"
                          ? "bg-orange-100 text-orange-800"
                          : suggestion.priority === "medium"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-sky-100 text-sky-800"
                      }
                    >
                      {suggestion.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {suggestion.suggestion.description}
                  </p>
                  <div className="flex gap-4 text-xs">
                    <span>Impact: +{suggestion.impact.explicitnessGain}</span>
                    <span>Effort: {suggestion.effort}</span>
                  </div>
                </Card>
              ))
            )}
            {reconstructionSuggestions.length > 5 && (
              <p className="text-sm text-muted-foreground text-center">
                +{reconstructionSuggestions.length - 5} more suggestions available
              </p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex gap-2 flex-col sm:flex-row">
          {!showRejectInput ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => setShowRejectInput(true)}>
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button onClick={handleConfirm}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirm Net
              </Button>
            </>
          ) : (
            <div className="w-full space-y-2">
              <Textarea
                placeholder="Why is this not a valid net?"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowRejectInput(false)}>
                  Back
                </Button>
                <Button variant="destructive" onClick={handleReject}>
                  Submit Rejection
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
