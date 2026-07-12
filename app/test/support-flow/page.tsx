"use client";

import { useState } from "react";
import { SupportArgumentFlow } from "@/components/argumentation/SupportArgumentFlow";
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
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export default function SupportFlowTestPage() {
  const [testMode, setTestMode] = useState(true);
  const [completedRuns, setCompletedRuns] = useState(0);
  const [key, setKey] = useState(0);

  function handleComplete() {
    setCompletedRuns((prev) => prev + 1);
  }

  function handleReset() {
    setKey((prev) => prev + 1);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-white">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Shield className="h-6 w-6 text-sky-600" />
                  Support Argument Flow - Test Page
                </CardTitle>
                <CardDescription className="text-base">
                  Phase 3.4 Week 12 - Support Generator Testing
                </CardDescription>
              </div>
              <Badge className="bg-green-600 text-white">
                Phase 3.4 Complete
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-sky-50 border-sky-200">
              <Sparkles className="h-4 w-4 text-sky-600" />
              <AlertDescription className="text-sky-900">
                <strong>Test Environment Active</strong> - All API calls use mock data.
                No backend required.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-white border border-gray-200">
                <div className="text-2xl font-bold text-sky-600">4</div>
                <div className="text-sm text-muted-foreground">Components</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Suggestions, Mapper, Batch, Wizard
                </div>
              </div>
              <div className="p-4 rounded-lg bg-white border border-gray-200">
                <div className="text-2xl font-bold text-sky-600">7</div>
                <div className="text-sm text-muted-foreground">Wizard Steps</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Analyze → Review
                </div>
              </div>
              <div className="p-4 rounded-lg bg-white border border-gray-200">
                <div className="text-2xl font-bold text-sky-600">
                  {completedRuns}
                </div>
                <div className="text-sm text-muted-foreground">Test Runs</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Completed this session
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Reset Flow
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Feature Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Phase 3.4 Components Overview</CardTitle>
            <CardDescription>All support generation features</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-sky-200 bg-sky-50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-sky-600" />
                  <span className="font-semibold">SupportSuggestions</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  AI-powered analysis of argument weaknesses with prioritized
                  improvement suggestions
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge className="bg-sky-100 text-sky-800 text-xs">~530 LOC</Badge>
                  <Badge className="bg-green-100 text-green-800 text-xs">
                    + API endpoint
                  </Badge>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-sky-200 bg-sky-50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-sky-600" />
                  <span className="font-semibold">EvidenceSchemeMapper</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Intelligent matching of evidence to optimal argument schemes with
                  strength prediction
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge className="bg-sky-100 text-sky-800 text-xs">~550 LOC</Badge>
                  <Badge className="bg-green-100 text-green-800 text-xs">
                    + API endpoint
                  </Badge>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-sky-200 bg-sky-50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-sky-600" />
                  <span className="font-semibold">BatchArgumentGenerator</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Multi-argument generation with configurable diversity modes and
                  evidence strategies
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge className="bg-sky-100 text-sky-800 text-xs">~520 LOC</Badge>
                  <Badge className="bg-green-100 text-green-800 text-xs">
                    + API endpoint
                  </Badge>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-sky-200 bg-sky-50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-sky-600" />
                  <span className="font-semibold">SupportConstructionWizard</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  7-step guided workflow integrating all components with progress
                  tracking and state management
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge className="bg-sky-100 text-sky-800 text-xs">~620 LOC</Badge>
                  <Badge className="bg-purple-100 text-purple-800 text-xs">
                    Integration
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Testing Instructions */}
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              Testing Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <p className="font-medium text-blue-900">
                Test the complete support argument workflow:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-blue-800 ml-2">
                <li>
                  <strong>Start Flow:</strong> Click &quot;Guided Support Wizard&quot; to begin
                </li>
                <li>
                  <strong>Analyze:</strong> Review the target argument details
                </li>
                <li>
                  <strong>Suggestions:</strong> View AI-generated improvement suggestions
                  (filter, sort, expand)
                </li>
                <li>
                  <strong>Evidence:</strong> Add sample evidence and view scheme matches
                </li>
                <li>
                  <strong>Mode Selection:</strong> Choose Single or Batch mode
                </li>
                <li>
                  <strong>Construction:</strong> Build arguments using selected mode
                </li>
                <li>
                  <strong>Review:</strong> See completion summary with stats
                </li>
              </ol>
              <p className="font-medium text-blue-900 mt-4">
                Test Features to Verify:
              </p>
              <ul className="list-disc list-inside space-y-1 text-blue-800 ml-2">
                <li>Progress bar updates correctly across steps</li>
                <li>Back/Next navigation maintains state</li>
                <li>Evidence addition works (click &quot;Add Sample Evidence&quot;)</li>
                <li>Scheme matching shows intelligent suggestions</li>
                <li>Both Single and Batch modes function</li>
                <li>Completion summary displays accurate stats</li>
                <li>&quot;Add Another Support&quot; restarts wizard</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Main Test Flow */}
        <SupportArgumentFlow
          key={key}
          targetArgumentId="arg_test_123"
          deliberationId="delib_test_456"
          currentUserId="user_test_789"
          onComplete={handleComplete}
        />
      </div>
    </div>
  );
}
