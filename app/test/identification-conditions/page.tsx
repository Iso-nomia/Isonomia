/**
 * Test page for Identification Conditions Filter
 * 
 * Week 7, Task 7.5: Test Infrastructure
 * Enhanced with sample arguments, testing scenarios, and validation
 * Accessible at: /test/identification-conditions
 */

"use client";

import { useState } from "react";
import { IdentificationConditionsFilter } from "@/components/schemes/IdentificationConditionsFilter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ArgumentScheme } from "@prisma/client";

interface TestScenario {
  id: string;
  name: string;
  argument: string;
  expectedConditions: string[];
  expectedScheme: string;
  difficulty: "easy" | "medium" | "hard";
}

const testScenarios: TestScenario[] = [
  {
    id: "test1",
    name: "Expert Opinion",
    argument:
      "Dr. Sarah Chen, a leading virologist with 25 years of experience at the CDC, states that the new vaccine is safe and effective. Therefore, we should trust that the vaccine is indeed safe and effective.",
    expectedConditions: [
      "appeals_to_expert",
      "cites_credentials",
      "about_state",
    ],
    expectedScheme: "expert_opinion",
    difficulty: "easy",
  },
  {
    id: "test2",
    name: "Consequence Argument",
    argument:
      "If we implement the new traffic system, congestion will decrease by 30%, air quality will improve, and commute times will be shorter. We should implement the new traffic system because these benefits are significant.",
    expectedConditions: [
      "argues_consequences",
      "about_action",
      "progressive_steps",
    ],
    expectedScheme: "positive_consequences",
    difficulty: "easy",
  },
  {
    id: "test3",
    name: "Causal Reasoning",
    argument:
      "Studies show that countries with higher education spending consistently have stronger economic growth. Since education spending leads to better-trained workers, and better-trained workers increase productivity, we can conclude that increased education spending causes economic growth.",
    expectedConditions: [
      "argues_causation",
      "uses_evidence",
      "about_state",
      "conditional_structure",
    ],
    expectedScheme: "causal",
    difficulty: "medium",
  },
  {
    id: "test4",
    name: "Analogy",
    argument:
      "Just as a chain is only as strong as its weakest link, a team is only as effective as its least skilled member. Therefore, we should invest in training all team members, not just the top performers.",
    expectedConditions: [
      "uses_analogy",
      "shows_similarity",
      "about_action",
    ],
    expectedScheme: "analogy",
    difficulty: "medium",
  },
  {
    id: "test5",
    name: "Popular Opinion",
    argument:
      "The vast majority of consumers prefer our product over competitors. Customer reviews consistently rate us 5 stars. Since so many people can't be wrong, our product must be superior.",
    expectedConditions: [
      "appeals_to_popularity",
      "uses_evidence",
      "about_state",
    ],
    expectedScheme: "popular_opinion",
    difficulty: "easy",
  },
  {
    id: "test6",
    name: "Precedent",
    argument:
      "In 2015, when we faced a similar budget crisis, we successfully resolved it by implementing across-the-board cuts of 10%. That approach worked well then, and the circumstances are nearly identical now. Therefore, we should use the same 10% cut strategy again.",
    expectedConditions: [
      "cites_precedent",
      "shows_similarity",
      "about_action",
    ],
    expectedScheme: "precedent",
    difficulty: "medium",
  },
  {
    id: "test7",
    name: "Values Appeal",
    argument:
      "This policy violates fundamental principles of fairness and equality that our society holds dear. We have always stood for justice and equal treatment under the law. Therefore, we must reject this policy as it contradicts our core values.",
    expectedConditions: [
      "appeals_to_values",
      "shows_inconsistency",
      "about_action",
    ],
    expectedScheme: "values",
    difficulty: "hard",
  },
];

export default function IdentificationConditionsTestPage() {
  const [selectedScheme, setSelectedScheme] = useState<ArgumentScheme | null>(null);
  const [compactMode, setCompactMode] = useState(false);
  const [currentScenario, setCurrentScenario] = useState<TestScenario | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});

  const handleScenarioSelect = (scenario: TestScenario) => {
    setCurrentScenario(scenario);
    setSelectedScheme(null);
  };

  const markTestComplete = (scenarioId: string, passed: boolean) => {
    setTestResults((prev) => ({ ...prev, [scenarioId]: passed }));
  };

  const completedTests = Object.keys(testResults).length;
  const passedTests = Object.values(testResults).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">
                Identification Conditions Filter Test
              </h1>
              <p className="text-muted-foreground mt-1">
                Week 7 - Pattern-based scheme discovery with test scenarios
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCompactMode(!compactMode)}
              >
                {compactMode ? "Normal Mode" : "Compact Mode"}
              </Button>
            </div>
          </div>

          {/* Test Progress */}
          {completedTests > 0 && (
            <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-green-900 dark:text-green-100">
                    Test Progress: {completedTests}/{testScenarios.length} scenarios
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {passedTests} passed, {completedTests - passedTests} need review
                  </p>
                </div>
                <Badge variant="outline" className="text-lg px-4 py-2">
                  {Math.round((passedTests / testScenarios.length) * 100)}%
                </Badge>
              </div>
            </Card>
          )}
        </div>

        {/* Tabbed Interface */}
        <Tabs defaultValue="free-test" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="free-test">Free Testing</TabsTrigger>
            <TabsTrigger value="scenarios">Test Scenarios</TabsTrigger>
            <TabsTrigger value="guide">Testing Guide</TabsTrigger>
          </TabsList>

          {/* Free Testing Tab */}
          <TabsContent value="free-test" className="space-y-6">
            <Card className="p-4 bg-muted/50">
              <h3 className="font-semibold mb-2">Free Testing Mode</h3>
              <p className="text-sm text-muted-foreground">
                Use the filter freely to explore how identification conditions work.
                Try different combinations and observe the results.
              </p>
            </Card>

            <IdentificationConditionsFilter
              onSchemeSelect={setSelectedScheme}
              compactMode={compactMode}
            />
          </TabsContent>

          {/* Test Scenarios Tab */}
          <TabsContent value="scenarios" className="space-y-6">
            {/* Scenario Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {testScenarios.map((scenario) => {
                const completed = testResults[scenario.id] !== undefined;
                const passed = testResults[scenario.id] === true;

                return (
                  <Card
                    key={scenario.id}
                    className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                      currentScenario?.id === scenario.id
                        ? "ring-2 ring-sky-500 dark:ring-sky-400"
                        : ""
                    } ${
                      completed
                        ? passed
                          ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                          : "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800"
                        : ""
                    }`}
                    onClick={() => handleScenarioSelect(scenario)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold">{scenario.name}</h4>
                      <Badge
                        variant={
                          scenario.difficulty === "easy"
                            ? "secondary"
                            : scenario.difficulty === "medium"
                            ? "default"
                            : "destructive"
                        }
                      >
                        {scenario.difficulty}
                      </Badge>
                    </div>
                    {completed && (
                      <Badge
                        variant="outline"
                        className={
                          passed
                            ? "bg-green-100 text-green-800 border-green-300"
                            : "bg-yellow-100 text-yellow-800 border-yellow-300"
                        }
                      >
                        {passed ? "✓ Passed" : "⚠ Needs Review"}
                      </Badge>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Current Scenario */}
            {currentScenario && (
              <div className="space-y-6">
                <Card className="p-6 bg-sky-50 dark:bg-sky-950 border-sky-200 dark:border-sky-800">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-bold">{currentScenario.name}</h3>
                        <Badge className="mt-2" variant="secondary">
                          Difficulty: {currentScenario.difficulty}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentScenario(null)}
                      >
                        Close
                      </Button>
                    </div>

                    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border">
                      <p className="text-sm font-semibold mb-2">Argument:</p>
                      <p className="text-sm italic">&quot;{currentScenario.argument}&quot;</p>
                    </div>

                    <details className="text-sm">
                      <summary className="cursor-pointer font-semibold mb-2">
                        Show Expected Results (Spoilers)
                      </summary>
                      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border space-y-2">
                        <p>
                          <strong>Expected Conditions:</strong>{" "}
                          {currentScenario.expectedConditions.join(", ")}
                        </p>
                        <p>
                          <strong>Expected Scheme:</strong> {currentScenario.expectedScheme}
                        </p>
                      </div>
                    </details>

                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        onClick={() => markTestComplete(currentScenario.id, true)}
                      >
                        Mark as Passed
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => markTestComplete(currentScenario.id, false)}
                      >
                        Needs Review
                      </Button>
                    </div>
                  </div>
                </Card>

                <IdentificationConditionsFilter
                  onSchemeSelect={setSelectedScheme}
                  compactMode={compactMode}
                />
              </div>
            )}
          </TabsContent>

          {/* Testing Guide Tab */}
          <TabsContent value="guide" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4">Testing Guide</h3>

              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2">Test Objectives</h4>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li>Verify that condition selections produce expected scheme matches</li>
                    <li>Test the scoring algorithm accuracy (perfect/strong/moderate/weak)</li>
                    <li>Validate UI interactions (expand/collapse, help dialogs, sorting)</li>
                    <li>Assess usability for both novice and expert users</li>
                    <li>Check performance with multiple condition selections</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Testing Checklist</h4>
                  <div className="space-y-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" />
                      <span>Tutorial is clear and helpful</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" />
                      <span>Category help dialogs are informative</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" />
                      <span>Condition examples aid understanding</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" />
                      <span>Match scores are accurate and meaningful</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" />
                      <span>Sorting and filtering work as expected</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" />
                      <span>Quality indicators are visually clear</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" />
                      <span>Match explanations help understand results</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" />
                      <span>Compact mode works properly</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" />
                      <span>Dark mode is readable</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" />
                      <span>All 7 test scenarios pass correctly</span>
                    </label>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">User Testing Protocol</h4>
                  <ol className="list-decimal pl-5 space-y-2 text-sm">
                    <li>
                      <strong>Orientation (5 min):</strong> Show the tutorial and explain the
                      concept of identification conditions
                    </li>
                    <li>
                      <strong>Guided Practice (10 min):</strong> Walk through 1-2 easy scenarios
                      together
                    </li>
                    <li>
                      <strong>Independent Testing (15 min):</strong> User attempts remaining
                      scenarios independently
                    </li>
                    <li>
                      <strong>Feedback Collection (10 min):</strong> Gather feedback on
                      usability, clarity, and usefulness
                    </li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Success Criteria</h4>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li>Users can complete easy scenarios in &lt;3 minutes</li>
                    <li>85%+ accuracy on expected scheme identification</li>
                    <li>Users rate the tool as &quot;helpful&quot; or better (4+/5)</li>
                    <li>No critical bugs or UI issues reported</li>
                    <li>Expert users prefer this over manual scheme browsing</li>
                  </ul>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Selected Scheme Detail */}
        {selectedScheme && (
          <div className="mt-8">
            <Card className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold">Selected Scheme</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedScheme(null)}
                >
                  Close
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-1">{selectedScheme.name}</h4>
                  {selectedScheme.summary && (
                    <p className="text-sm text-muted-foreground">
                      {selectedScheme.summary}
                    </p>
                  )}
                </div>

                {selectedScheme.description && (
                  <div>
                    <h5 className="text-sm font-semibold mb-1">Description</h5>
                    <p className="text-sm">{selectedScheme.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 pt-4 border-t text-sm">
                  <div>
                    <span className="text-muted-foreground">Purpose:</span>
                    <p className="font-medium capitalize">
                      {selectedScheme.purpose?.replace("_", " ") || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Source:</span>
                    <p className="font-medium capitalize">
                      {selectedScheme.source || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cluster:</span>
                    <p className="font-medium capitalize">
                      {(selectedScheme as any).semanticCluster?.replace("_", " ") || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Debug Info */}
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-medium mb-2">
            Debug Information
          </summary>
          <Card className="p-4 bg-muted/50">
            <pre className="text-xs overflow-auto">
              {JSON.stringify(
                {
                  compactMode,
                  selectedScheme: selectedScheme?.name || null,
                  timestamp: new Date().toISOString(),
                },
                null,
                2
              )}
            </pre>
          </Card>
        </details>
      </div>
    </div>
  );
}
