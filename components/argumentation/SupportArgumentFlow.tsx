"use client";

import { useState } from "react";
import { SupportConstructionWizard } from "./SupportConstructionWizard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Shield,
  Plus,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface SupportArgumentFlowProps {
  targetArgumentId: string;
  deliberationId: string;
  currentUserId: string;
  onComplete?: () => void;
  initialMode?: "overview" | "wizard";
}

type FlowState = "overview" | "wizard" | "completed";

interface ArgumentSummary {
  id: string;
  content: string;
  strength: number;
  supportCount: number;
  attackCount: number;
}

// ============================================================================
// Main Component
// ============================================================================

export function SupportArgumentFlow({
  targetArgumentId,
  deliberationId,
  currentUserId,
  onComplete,
  initialMode = "overview",
}: SupportArgumentFlowProps) {
  const [flowState, setFlowState] = useState<FlowState>(
    initialMode === "wizard" ? "wizard" : "overview"
  );
  const [targetArgument, setTargetArgument] = useState<ArgumentSummary>({
    id: targetArgumentId,
    content: "This policy will improve economic outcomes for small businesses.",
    strength: 72,
    supportCount: 3,
    attackCount: 5,
  });

  function handleStartWizard() {
    setFlowState("wizard");
  }

  function handleWizardComplete() {
    setFlowState("completed");
    // Update support count
    setTargetArgument((prev) => ({
      ...prev,
      supportCount: prev.supportCount + 1,
      strength: Math.min(prev.strength + 8, 100),
    }));
  }

  function handleStartAnother() {
    setFlowState("wizard");
  }

  function handleFinish() {
    if (onComplete) {
      onComplete();
    }
  }

  return (
    <div className="space-y-6">
      {/* Overview State */}
      {flowState === "overview" && (
        <>
          {/* Target Argument Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-sky-600" />
                    Target Argument
                  </CardTitle>
                  <CardDescription>
                    Create support arguments to strengthen this position
                  </CardDescription>
                </div>
                <Badge className="bg-sky-100 text-sky-800">
                  {targetArgument.strength}% Strong
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm">{targetArgument.content}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <div className="text-2xl font-bold text-green-700">
                    {targetArgument.supportCount}
                  </div>
                  <div className="text-xs text-green-600">Support Arguments</div>
                </div>
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="text-2xl font-bold text-red-700">
                    {targetArgument.attackCount}
                  </div>
                  <div className="text-xs text-red-600">Attack Arguments</div>
                </div>
                <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
                  <div className="text-2xl font-bold text-sky-700">
                    {targetArgument.attackCount - targetArgument.supportCount}
                  </div>
                  <div className="text-xs text-sky-600">Support Needed</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Card */}
          <Card>
            <CardHeader>
              <CardTitle>Support Options</CardTitle>
              <CardDescription>Choose how to create support arguments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                onClick={handleStartWizard}
                className="w-full p-4 rounded-lg border-2 border-sky-600 bg-sky-50 hover:bg-sky-100 transition-colors text-left"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-sky-600" />
                    <span className="font-semibold text-sky-900">
                      Guided Support Wizard
                    </span>
                  </div>
                  <Badge className="bg-sky-600 text-white">Recommended</Badge>
                </div>
                <p className="text-sm text-sky-700 mb-3">
                  Step-by-step process with AI suggestions, evidence matching, and
                  quality checks. Perfect for building strong, well-reasoned support.
                </p>
                <div className="flex items-center gap-2 text-sm text-sky-600">
                  <Clock className="h-4 w-4" />
                  <span>5-10 minutes</span>
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </div>
              </button>

              <Alert className="bg-sky-50 border-sky-200">
                <TrendingUp className="h-4 w-4 text-sky-600" />
                <AlertDescription className="text-sky-900">
                  <strong>Tip:</strong> The guided wizard analyzes weaknesses, matches
                  evidence to optimal schemes, and can generate multiple support
                  arguments efficiently.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </>
      )}

      {/* Wizard State */}
      {flowState === "wizard" && (
        <SupportConstructionWizard
          targetArgumentId={targetArgumentId}
          deliberationId={deliberationId}
          currentUserId={currentUserId}
          onComplete={handleWizardComplete}
        />
      )}

      {/* Completed State */}
      {flowState === "completed" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <CardTitle>Support Arguments Created!</CardTitle>
            </div>
            <CardDescription>
              You have successfully strengthened this argument
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900">
                <strong>Argument Strengthened!</strong> The support you&apos;ve added increases
                the overall strength of this position.
              </AlertDescription>
            </Alert>

            {/* Updated Stats */}
            <div className="space-y-3">
              <h4 className="font-medium">Updated Argument Status</h4>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm mb-3">{targetArgument.content}</p>
                <div className="flex items-center gap-3">
                  <Badge className="bg-green-100 text-green-800">
                    +1 Support Added
                  </Badge>
                  <Badge className="bg-sky-100 text-sky-800">
                    {targetArgument.strength}% Strong (↑ 8%)
                  </Badge>
                </div>
              </div>
            </div>

            {/* Updated Comparison */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="text-2xl font-bold text-green-700">
                  {targetArgument.supportCount}
                </div>
                <div className="text-xs text-green-600">Support Arguments</div>
              </div>
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="text-2xl font-bold text-red-700">
                  {targetArgument.attackCount}
                </div>
                <div className="text-xs text-red-600">Attack Arguments</div>
              </div>
              <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
                <div className="text-2xl font-bold text-sky-700">
                  {targetArgument.attackCount - targetArgument.supportCount}
                </div>
                <div className="text-xs text-sky-600">Support Needed</div>
              </div>
            </div>

            {/* Next Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleStartAnother}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Another Support
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                Finish & Return
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
