"use client";

import { NetExplorer } from "@/components/nets/visualization/NetExplorer";

// Mock data for testing
const mockNet = {
  id: "net-test-1",
  netType: "convergent",
  complexity: 65,
  confidence: 82,
  schemes: [
    {
      schemeId: "s1",
      schemeName: "Expert Opinion",
      schemeCategory: "Source-Based",
      confidence: 90,
      role: "primary",
      premises: [
        { key: "p1", text: "Dr. Smith is an expert in climate science", isFilled: true },
        { key: "p2", text: "Dr. Smith says global warming is accelerating", isFilled: true },
      ],
      conclusion: "Global warming is accelerating",
    },
    {
      schemeId: "s2",
      schemeName: "Argument from Sign",
      schemeCategory: "Causal",
      confidence: 85,
      role: "supporting",
      premises: [
        { key: "p1", text: "Rising sea levels are observed", isFilled: true },
        { key: "p2", text: "Rising sea levels indicate warming", isFilled: true },
      ],
      conclusion: "Climate is warming",
    },
    {
      schemeId: "s3",
      schemeName: "Argument from Example",
      schemeCategory: "Inductive",
      confidence: 75,
      role: "supporting",
      premises: [
        { key: "p1", text: "Arctic ice melting faster than predicted", isFilled: true },
        { key: "p2", text: "This exemplifies warming trend", isFilled: true },
      ],
      conclusion: "Warming is significant",
    },
    {
      schemeId: "s4",
      schemeName: "Causal Argument",
      schemeCategory: "Causal",
      confidence: 80,
      role: "subordinate",
      premises: [
        { key: "p1", text: "CO2 levels have increased", isFilled: true },
        { key: "p2", text: "CO2 causes greenhouse effect", isFilled: true },
      ],
      conclusion: "Greenhouse effect is strengthening",
    },
    {
      schemeId: "s5",
      schemeName: "Argument from Correlation",
      schemeCategory: "Statistical",
      confidence: 70,
      role: "supporting",
      premises: [
        { key: "p1", text: "Temperature and CO2 correlate over time", isFilled: true },
      ],
      conclusion: "CO2 affects temperature",
    },
  ],
  relationships: [
    {
      sourceScheme: "s2",
      targetScheme: "s1",
      type: "supports",
      strength: 0.8,
    },
    {
      sourceScheme: "s3",
      targetScheme: "s1",
      type: "supports",
      strength: 0.7,
    },
    {
      sourceScheme: "s4",
      targetScheme: "s2",
      type: "depends-on",
      strength: 0.9,
    },
    {
      sourceScheme: "s5",
      targetScheme: "s4",
      type: "supports",
      strength: 0.6,
    },
  ],
};

const mockDependencyGraph = {
  nodes: [
    { schemeId: "s1", schemeName: "Expert Opinion", role: "primary", depth: 2 },
    { schemeId: "s2", schemeName: "Argument from Sign", role: "supporting", depth: 1 },
    { schemeId: "s3", schemeName: "Argument from Example", role: "supporting", depth: 1 },
    { schemeId: "s4", schemeName: "Causal Argument", role: "subordinate", depth: 0 },
    { schemeId: "s5", schemeName: "Argument from Correlation", role: "supporting", depth: 0 },
  ],
  edges: [
    {
      sourceSchemeId: "s2",
      targetSchemeId: "s1",
      type: "supporting",
      strength: 0.8,
      criticality: "important",
      explanation: "Argument from Sign strengthens the Expert Opinion by providing empirical evidence.",
    },
    {
      sourceSchemeId: "s3",
      targetSchemeId: "s1",
      type: "supporting",
      strength: 0.7,
      criticality: "important",
      explanation: "Example provides concrete instance supporting the expert claim.",
    },
    {
      sourceSchemeId: "s4",
      targetSchemeId: "s2",
      type: "prerequisite",
      strength: 0.9,
      criticality: "critical",
      explanation: "The causal mechanism must be established before the sign can be interpreted.",
    },
    {
      sourceSchemeId: "s5",
      targetSchemeId: "s4",
      type: "enabling",
      strength: 0.6,
      criticality: "optional",
      explanation: "Correlation data enables the causal argument by showing association.",
    },
  ],
  cycles: [],
  criticalPath: ["s5", "s4", "s2", "s1"],
  roots: ["s5", "s3"],
  leaves: ["s1"],
};

const mockExplicitnessAnalysis = {
  overallExplicitness: "semi-explicit" as const,
  confidence: 72,
  schemeExplicitness: [
    {
      schemeId: "s1",
      level: "explicit" as const,
      confidence: 90,
      indicators: {
        hasExplicitMarkers: true,
        hasMetaCommentary: true,
        hasStructuralCues: true,
        userConfirmed: true,
      },
      evidence: ["Contains explicit marker: 'Dr. Smith says'", "All premises are explicitly filled"],
    },
    {
      schemeId: "s2",
      level: "semi-explicit" as const,
      confidence: 75,
      indicators: {
        hasExplicitMarkers: true,
        hasMetaCommentary: false,
        hasStructuralCues: true,
        userConfirmed: false,
      },
      evidence: ["Contains explicit marker: 'indicate'", "All premises are explicitly filled"],
    },
    {
      schemeId: "s3",
      level: "semi-explicit" as const,
      confidence: 70,
      indicators: {
        hasExplicitMarkers: false,
        hasMetaCommentary: false,
        hasStructuralCues: true,
        userConfirmed: false,
      },
      evidence: ["All premises are explicitly filled"],
    },
    {
      schemeId: "s4",
      level: "explicit" as const,
      confidence: 85,
      indicators: {
        hasExplicitMarkers: true,
        hasMetaCommentary: false,
        hasStructuralCues: true,
        userConfirmed: false,
      },
      evidence: ["Contains explicit marker: 'causes'", "All premises are explicitly filled"],
    },
    {
      schemeId: "s5",
      level: "implicit" as const,
      confidence: 50,
      indicators: {
        hasExplicitMarkers: false,
        hasMetaCommentary: false,
        hasStructuralCues: false,
        userConfirmed: false,
      },
      evidence: [],
    },
  ],
  relationshipExplicitness: [
    {
      sourceScheme: "s2",
      targetScheme: "s1",
      level: "explicit" as const,
      confidence: 80,
      indicators: {
        hasConnectives: true,
        hasSequenceMarkers: false,
        hasProximityCues: true,
      },
      evidence: ["Strong supporting dependency detected"],
    },
    {
      sourceScheme: "s3",
      targetScheme: "s1",
      level: "semi-explicit" as const,
      confidence: 65,
      indicators: {
        hasConnectives: false,
        hasSequenceMarkers: false,
        hasProximityCues: true,
      },
      evidence: [],
    },
    {
      sourceScheme: "s4",
      targetScheme: "s2",
      level: "implicit" as const,
      confidence: 55,
      indicators: {
        hasConnectives: false,
        hasSequenceMarkers: false,
        hasProximityCues: false,
      },
      evidence: [],
    },
    {
      sourceScheme: "s5",
      targetScheme: "s4",
      level: "implicit" as const,
      confidence: 45,
      indicators: {
        hasConnectives: false,
        hasSequenceMarkers: false,
        hasProximityCues: false,
      },
      evidence: [],
    },
  ],
  reconstructionNeeded: true,
  reconstructionPriority: "medium" as const,
  suggestions: [
    "Add connectives to clarify 2 implicit relationships",
    "Make 1 implicit scheme more explicit with clear scheme markers",
  ],
};

export default function NetVisualizationTestPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Net Visualization Test Page</h1>
        <p className="text-gray-600">
          Testing the complete argument net visualization system with a convergent net
          containing 5 schemes and 4 dependencies.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="font-semibold text-blue-900 mb-2">Test Scenario</h2>
        <p className="text-sm text-blue-800 mb-2">
          This net demonstrates a climate change argument with:
        </p>
        <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
          <li>1 primary scheme (Expert Opinion)</li>
          <li>3 supporting schemes (Sign, Example, Correlation)</li>
          <li>1 subordinate scheme (Causal Argument)</li>
          <li>Mixed explicitness levels (explicit, semi-explicit, implicit)</li>
          <li>Critical path: s5 → s4 → s2 → s1</li>
        </ul>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <NetExplorer
          net={mockNet}
          dependencyGraph={mockDependencyGraph}
          explicitnessAnalysis={mockExplicitnessAnalysis}
          onSchemeSelect={(schemeId) => console.log("Selected scheme:", schemeId)}
        />
      </div>

      <div className="bg-gray-50 border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Testing Instructions</h2>
        <div className="space-y-3 text-sm">
          <div>
            <h3 className="font-medium mb-1">1. Layout Testing</h3>
            <p className="text-gray-600">
              Try all 4 layout modes: Hierarchical, Force-Directed, Circular, and Tree
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-1">2. Interaction Testing</h3>
            <p className="text-gray-600">
              Click nodes to see details in sidebar. Try navigating between connected schemes.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-1">3. Filter Testing</h3>
            <p className="text-gray-600">
              Toggle dependency types, adjust minimum strength, enable critical path only mode
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-1">4. Visual Encoding</h3>
            <p className="text-gray-600">
              Check the legend tab. Verify color coding, opacity, and special markers (⭐ critical path)
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-1">5. Critical Path</h3>
            <p className="text-gray-600">
              Click &quot;Show Critical Path&quot; to highlight: Correlation → Causal → Sign → Expert Opinion
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
