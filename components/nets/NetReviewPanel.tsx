"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NetDetectionBadge } from "./NetDetectionBadge";
import { NetConfirmationModal } from "./NetConfirmationModal";
import { Loader2 } from "lucide-react";

interface NetReviewPanelProps {
  argumentId: string;
}

export function NetReviewPanel({ argumentId }: NetReviewPanelProps) {
  const [nets, setNets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNet, setSelectedNet] = useState<string | null>(null);
  const [netDetails, setNetDetails] = useState<any>(null);

  useEffect(() => {
    loadNets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [argumentId]);

  const loadNets = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/nets/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ argumentId }),
      });

      if (response.ok) {
        const data = await response.json();
        setNets(data.net ? [data.net] : []);
      }
    } catch (error) {
      console.error("Failed to load nets:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadNetDetails = async (netId: string) => {
    try {
      // Load explicitness analysis
      const explicitnessResponse = await fetch(`/api/nets/${netId}/explicitness`);
      const explicitnessData = await explicitnessResponse.json();

      // Load reconstruction suggestions
      const reconstructionResponse = await fetch(`/api/nets/${netId}/reconstruction`);
      const reconstructionData = await reconstructionResponse.json();

      setNetDetails({
        explicitness: explicitnessData.analysis,
        suggestions: reconstructionData.suggestions || [],
      });
    } catch (error) {
      console.error("Failed to load net details:", error);
    }
  };

  const handleNetClick = async (netId: string) => {
    setSelectedNet(netId);
    await loadNetDetails(netId);
  };

  const handleConfirm = async (netId: string, modifications?: any) => {
    try {
      const response = await fetch(`/api/nets/${netId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirmed", modifications }),
      });

      if (response.ok) {
        await loadNets();
        setSelectedNet(null);
        setNetDetails(null);
      }
    } catch (error) {
      console.error("Failed to confirm net:", error);
    }
  };

  const handleReject = async (netId: string, reason: string) => {
    try {
      const response = await fetch(`/api/nets/${netId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rejected", reason }),
      });

      if (response.ok) {
        await loadNets();
        setSelectedNet(null);
        setNetDetails(null);
      }
    } catch (error) {
      console.error("Failed to reject net:", error);
    }
  };

  const handleModify = async (netId: string, modifications: any) => {
    // Handle modifications
    console.log("Modify net:", netId, modifications);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (nets.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          No argument nets detected in this argument.
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Detected Argument Nets</h3>
        {nets.map((net) => (
          <Card key={net.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <NetDetectionBadge
                  netType={net.netType}
                  complexity={net.complexity}
                  confidence={net.confidence}
                  isConfirmed={net.isConfirmed || false}
                  onClick={() => handleNetClick(net.id)}
                />
                <p className="text-sm text-muted-foreground">
                  {net.schemes.length} schemes detected with {net.relationships.length}{" "}
                  relationships
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => handleNetClick(net.id)}
                disabled={net.isConfirmed}
              >
                {net.isConfirmed ? "Confirmed" : "Review"}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {selectedNet && netDetails && (
        <NetConfirmationModal
          netId={selectedNet}
          net={nets.find((n) => n.id === selectedNet)}
          explicitnessAnalysis={netDetails.explicitness}
          reconstructionSuggestions={netDetails.suggestions}
          onConfirm={handleConfirm}
          onReject={handleReject}
          onModify={handleModify}
          onClose={() => {
            setSelectedNet(null);
            setNetDetails(null);
          }}
        />
      )}
    </>
  );
}
