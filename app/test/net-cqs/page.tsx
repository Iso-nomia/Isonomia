"use client";

import { useState, useCallback } from "react";
import { NetGraph } from "@/components/nets/visualization/NetGraph";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PanelLeftClose, PanelRightClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { MockComposedCQPanel } from "./MockComposedCQPanel";

export default function NetCQsTestPage() {
  const [testMode, setTestMode] = useState<"integrated" | "panel-only">("integrated");
  const [showCQPanel, setShowCQPanel] = useState(true);
  const [selectedSchemes, setSelectedSchemes] = useState<Set<string>>(new Set());
  const [highlightedDependencies, setHighlightedDependencies] = useState<
    Array<{ source: string; target: string }>
  >([]);

  // Mock net data (reusing from Week 14 test)
  const mockNet = {
    id: "test-net-1",
    netType: "convergent",
    rootArgumentId: "arg-1",
    schemes: [
      {
        schemeId: "s1",
        schemeName: "Argument from Expert Opinion",
        role: "primary",
        conclusion: "We must act immediately on climate change",
        premises: [
          { text: "97% of climate scientists agree on human-caused warming", confidence: 95 },
          { text: "These experts have studied the data extensively", confidence: 90 },
        ],
        confidence: 85,
        explicitness: "explicit",
      },
      {
        schemeId: "s2",
        schemeName: "Argument from Consequences",
        role: "supporting",
        conclusion: "Delaying action will cause catastrophic damage",
        premises: [
          { text: "Sea levels are rising at accelerating rates", confidence: 88 },
          { text: "Extreme weather events are increasing", confidence: 85 },
        ],
        confidence: 80,
        explicitness: "semi-explicit",
      },
      {
        schemeId: "s3",
        schemeName: "Argument from Analogy",
        role: "supporting",
        conclusion: "Like the ozone crisis, we can solve climate change with coordinated action",
        premises: [
          { text: "The Montreal Protocol successfully banned CFCs", confidence: 92 },
          { text: "Climate change requires similar global cooperation", confidence: 75 },
        ],
        confidence: 70,
        explicitness: "implicit",
      },
      {
        schemeId: "s4",
        schemeName: "Argument from Cause to Effect",
        role: "supporting",
        conclusion: "Carbon emissions directly cause warming",
        premises: [
          { text: "CO2 traps heat in the atmosphere", confidence: 95 },
          { text: "Human activity has increased CO2 by 50%", confidence: 93 },
        ],
        confidence: 90,
        explicitness: "explicit",
      },
      {
        schemeId: "s5",
        schemeName: "Argument from Sign",
        role: "subordinate",
        conclusion: "Observable signs indicate warming is accelerating",
        premises: [
          { text: "Arctic ice is melting faster than predicted", confidence: 87 },
          { text: "Ocean temperatures are at record highs", confidence: 90 },
        ],
        confidence: 85,
        explicitness: "semi-explicit",
      },
    ],
    relationships: [
      { source: "s4", target: "s2", type: "supports" },
      { source: "s5", target: "s4", type: "supports" },
      { source: "s2", target: "s1", type: "supports" },
      { source: "s3", target: "s1", type: "supports" },
    ],
    confidence: 82,
    complexity: 65,
  };

  const mockDependencyGraph = {
    nodes: [
      { schemeId: "s1", schemeName: "Expert Opinion", role: "primary", depth: 0 },
      { schemeId: "s2", schemeName: "Consequences", role: "supporting", depth: 1 },
      { schemeId: "s3", schemeName: "Analogy", role: "supporting", depth: 1 },
      { schemeId: "s4", schemeName: "Cause to Effect", role: "supporting", depth: 2 },
      { schemeId: "s5", schemeName: "Sign", role: "subordinate", depth: 3 },
    ],
    edges: [
      {
        id: "dep-1",
        sourceSchemeId: "s5",
        targetSchemeId: "s4",
        type: "supporting",
        strength: 0.75,
        explicit: true,
      },
      {
        id: "dep-2",
        sourceSchemeId: "s4",
        targetSchemeId: "s2",
        type: "prerequisite",
        strength: 0.85,
        explicit: true,
      },
      {
        id: "dep-3",
        sourceSchemeId: "s2",
        targetSchemeId: "s1",
        type: "supporting",
        strength: 0.8,
        explicit: false,
      },
      {
        id: "dep-4",
        sourceSchemeId: "s3",
        targetSchemeId: "s1",
        type: "supporting",
        strength: 0.6,
        explicit: false,
      },
    ],
    cycles: [],
    criticalPath: ["s5", "s4", "s2", "s1"],
  };

  const mockExplicitnessAnalysis = {
    overallExplicitness: "semi-explicit",
    schemeExplicitness: [
      { schemeId: "s1", level: "explicit", confidence: 90 },
      { schemeId: "s2", level: "semi-explicit", confidence: 75 },
      { schemeId: "s3", level: "implicit", confidence: 60 },
      { schemeId: "s4", level: "explicit", confidence: 85 },
      { schemeId: "s5", level: "semi-explicit", confidence: 70 },
    ],
    relationshipExplicitness: [
      { sourceScheme: "s5", targetScheme: "s4", level: "explicit" },
      { sourceScheme: "s4", targetScheme: "s2", level: "explicit" },
      { sourceScheme: "s2", targetScheme: "s1", level: "implicit" },
      { sourceScheme: "s3", targetScheme: "s1", level: "implicit" },
    ],
    reconstructionPriority: "high",
  };

  const handleAnswerSubmit = (questionId: string, answer: string) => {
    console.log("Answer submitted:", { questionId, answer });
    alert(`Answer submitted for question ${questionId}: "${answer}"`);
  };

  // Handle scheme selection from CQ
  const handleSchemeSelect = useCallback((schemeId: string) => {
    setSelectedSchemes(new Set([schemeId]));
    setHighlightedDependencies([]);
    
    // Scroll to scheme in visualization if possible
    const schemeElement = document.getElementById(`scheme-${schemeId}`);
    if (schemeElement) {
      schemeElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  // Handle dependency highlighting from CQ
  const handleDependencyHighlight = useCallback(
    (sourceId: string, targetId: string) => {
      setHighlightedDependencies([{ source: sourceId, target: targetId }]);
      setSelectedSchemes(new Set([sourceId, targetId]));
    },
    []
  );

  // Create enhanced net data with highlighting
  const enhancedNet = {
    ...mockNet,
    schemes: mockNet.schemes.map((scheme) => ({
      ...scheme,
      _highlighted: selectedSchemes.has(scheme.schemeId),
      _dimmed: selectedSchemes.size > 0 && !selectedSchemes.has(scheme.schemeId),
    })),
  };

  const enhancedDependencyGraph = {
    ...mockDependencyGraph,
    edges: mockDependencyGraph.edges.map((edge) => {
      const isHighlighted = highlightedDependencies.some(
        (h) => h.source === edge.sourceSchemeId && h.target === edge.targetSchemeId
      );
      return {
        ...edge,
        _highlighted: isHighlighted,
        _dimmed: highlightedDependencies.length > 0 && !isHighlighted,
      };
    }),
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Week 15: Net-Aware Critical Questions Test</h1>
          <p className="text-gray-600">
            Testing the complete CQ system with net awareness, grouping, filtering, and navigation.
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-500">Net Type</div>
            <div className="text-2xl font-bold capitalize">{mockNet.netType}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Total Schemes</div>
            <div className="text-2xl font-bold">{mockNet.schemes.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Dependencies</div>
            <div className="text-2xl font-bold">{mockDependencyGraph.edges.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Complexity</div>
            <div className="text-2xl font-bold">{mockNet.complexity}/100</div>
          </Card>
        </div>

        {/* Test Mode Selector */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Test Mode</h3>
              <p className="text-sm text-gray-600">
                Choose between integrated view (graph + CQs) or panel-only view
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={testMode === "integrated" ? "default" : "outline"}
                onClick={() => setTestMode("integrated")}
              >
                Integrated View
              </Button>
              <Button
                variant={testMode === "panel-only" ? "default" : "outline"}
                onClick={() => setTestMode("panel-only")}
              >
                Panel Only
              </Button>
            </div>
          </div>
        </Card>

        {/* Main Content */}
        {testMode === "integrated" ? (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Integrated View: Graph + CQs</h2>
            <p className="text-sm text-gray-600 mb-6">
              Click schemes in the CQ panel to highlight them in the graph. Toggle the CQ panel
              on/off with the button in the top-right.
            </p>
            
            {/* Integrated Layout */}
            <div className="flex gap-4 h-[calc(100vh-400px)]">
              {/* Visualization Panel */}
              <div
                className={cn(
                  "transition-all duration-300",
                  showCQPanel ? "flex-1" : "w-full"
                )}
              >
                <Card className="h-full p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Argument Net</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCQPanel(!showCQPanel)}
                    >
                      {showCQPanel ? (
                        <>
                          <PanelRightClose className="w-4 h-4 mr-2" />
                          Hide Questions
                        </>
                      ) : (
                        <>
                          <PanelLeftClose className="w-4 h-4 mr-2" />
                          Show Questions
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="h-[calc(100%-60px)]">
                    <NetGraph
                      net={enhancedNet as any}
                      dependencyGraph={enhancedDependencyGraph as any}
                      explicitnessAnalysis={mockExplicitnessAnalysis as any}
                      layout="hierarchical"
                    />
                  </div>
                </Card>
              </div>

              {/* CQ Panel */}
              {showCQPanel && (
                <div className="w-[450px] overflow-y-auto">
                  <MockComposedCQPanel
                    netId={mockNet.id}
                    onSchemeSelect={handleSchemeSelect}
                    onDependencyHighlight={handleDependencyHighlight}
                    onAnswerSubmit={handleAnswerSubmit}
                  />
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">CQ Panel Only</h2>
            <p className="text-sm text-gray-600 mb-6">
              Test the CQ panel in isolation. Try different grouping strategies and filters.
            </p>
            <MockComposedCQPanel
              netId={mockNet.id}
              onSchemeSelect={(id) => console.log("Scheme selected:", id)}
              onDependencyHighlight={(s, t) =>
                console.log("Dependency highlighted:", s, "→", t)
              }
              onAnswerSubmit={handleAnswerSubmit}
            />
          </Card>
        )}

        {/* Testing Instructions */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Testing Instructions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm mb-2">1. Test Grouping Strategies</h3>
              <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                <li>
                  <strong>By Scheme:</strong> Questions grouped by target scheme
                </li>
                <li>
                  <strong>By Dependency:</strong> All dependency-related questions together
                </li>
                <li>
                  <strong>By Attack Type:</strong> Grouped by question category
                </li>
                <li>
                  <strong>By Burden:</strong> Who should answer (proponent/opponent/shared)
                </li>
                <li>
                  <strong>By Priority:</strong> Critical/High/Medium/Low groups
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">2. Test Filtering</h3>
              <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                <li>Toggle priority filters (critical/high/medium/low)</li>
                <li>Toggle type filters (scheme/dependency/net-structure/explicitness)</li>
                <li>Notice how the question count updates dynamically</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">3. Test Navigation (Integrated View)</h3>
              <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                <li>Click &quot;Scheme X&quot; buttons to highlight schemes in the graph</li>
                <li>
                  Click &quot;s1 → s2&quot; buttons to highlight dependencies
                </li>
                <li>Watch for smooth animations and highlighting</li>
                <li>Toggle the CQ panel on/off to test the layout</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">4. Test Answer Submission</h3>
              <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                <li>Expand a question and type an answer in the textarea</li>
                <li>Click &quot;Submit Answer&quot; to test the answer flow</li>
                <li>Check the browser console for the submitted data</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">5. Test Suggested Actions</h3>
              <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                <li>Look for questions with suggested actions</li>
                <li>Click &quot;Show Suggested Actions&quot; to expand</li>
                <li>Verify action recommendations are relevant</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Expected Features */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Expected Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-sm mb-2">CQ Generation</h3>
              <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                <li>Scheme-level CQs (traditional + role-specific)</li>
                <li>Dependency CQs (prerequisite/supporting/enabling)</li>
                <li>Net structure CQs (cycles/orphans/complexity/critical path)</li>
                <li>Explicitness CQs (implicit schemes and relationships)</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">UI Features</h3>
              <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                <li>Accordion groups with priority badges</li>
                <li>Priority and type filters</li>
                <li>Scheme targeting buttons</li>
                <li>Dependency highlighting buttons</li>
                <li>Answer submission UI</li>
                <li>Suggested actions expandable</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">Navigation</h3>
              <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                <li>Smooth animations on scheme selection</li>
                <li>Highlighting in graph (blue ring)</li>
                <li>Dimming of non-selected elements</li>
                <li>Scroll to view selected schemes</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">Technical</h3>
              <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                <li>NetAwareCQService integration</li>
                <li>NetNavigationService state management</li>
                <li>Mock API responses (ready for real data)</li>
                <li>All TypeScript types properly defined</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Mock Data Info */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <h2 className="text-xl font-semibold mb-2 text-blue-900">Mock Data Note</h2>
          <p className="text-sm text-blue-800">
            This test page uses mock data for the net and CQs. The API route at{" "}
            <code className="bg-blue-100 px-1 py-0.5 rounded">
              /api/nets/[id]/cqs
            </code>{" "}
            will generate real CQs from your NetAwareCQService once you have actual
            ArgumentNet data in the database. The answer submission is also mocked and logs to
            the console.
          </p>
        </Card>
      </div>
    </div>
  );
}
