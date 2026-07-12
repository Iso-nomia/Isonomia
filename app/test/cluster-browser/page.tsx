/**
 * Test Page: Cluster Browser
 * 
 * Interactive test page for the semantic cluster browser.
 * Browse schemes by topic/domain (authority, causality, values, etc.)
 * 
 * Week 6: Cluster Browser Integration & Testing
 */

"use client";

import { useState } from "react";
import { ClusterBrowser } from "@/components/schemes/ClusterBrowser";
import { RelatedSchemes } from "@/components/schemes/RelatedSchemes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ArgumentScheme } from "@prisma/client";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ClusterBrowserTestPage() {
  const [selectedScheme, setSelectedScheme] = useState<ArgumentScheme | null>(
    null
  );
  const [compactMode, setCompactMode] = useState(false);
  const [showRelated, setShowRelated] = useState(true);

  const { data: allSchemes } = useSWR<ArgumentScheme[]>(
    "/api/schemes/all",
    fetcher
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Cluster Browser Test Page
            </h1>
            <p className="text-muted-foreground">
              Week 6: Browse argument schemes by semantic domain
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant={compactMode ? "default" : "outline"}
              size="sm"
              onClick={() => setCompactMode(!compactMode)}
            >
              {compactMode ? "Normal" : "Compact"}
            </Button>

            {selectedScheme && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedScheme(null)}
              >
                Clear Selection
              </Button>
            )}
          </div>
        </div>

        <Card className="p-4 bg-muted/50">
          <div className="text-sm space-y-2">
            <p>
              <strong>Test Instructions:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Click a cluster card to see schemes in that category</li>
              <li>Hover over clusters to see detailed descriptions</li>
              <li>Click a scheme to view details in the right panel</li>
              <li>Test back navigation and related schemes</li>
              <li>Toggle compact mode to see responsive layouts</li>
            </ul>
          </div>
        </Card>
      </div>

      {/* Two-column layout: Browser + Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Cluster Browser (2/3 width on large screens) */}
        <div className="lg:col-span-2">
          <ClusterBrowser
            onSchemeSelect={setSelectedScheme}
            compactMode={compactMode}
          />
        </div>

        {/* Right: Selected Scheme Details (1/3 width on large screens) */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 space-y-4">
            {selectedScheme ? (
              <>
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-4">Selected Scheme</h2>

                  <div className="space-y-4">
                    <div>
                      <Badge variant="secondary" className="mb-2">
                        {selectedScheme.key}
                      </Badge>
                      <h3 className="font-bold text-lg">
                        {selectedScheme.name}
                      </h3>
                    </div>

                    {selectedScheme.summary && (
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-1">
                          Summary:
                        </p>
                        <p className="text-sm">{selectedScheme.summary}</p>
                      </div>
                    )}

                    <div className="border-t my-4" />

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {selectedScheme.purpose && (
                        <div>
                          <span className="font-semibold">Purpose: </span>
                          <Badge variant="outline" className="text-xs">
                            {selectedScheme.purpose}
                          </Badge>
                        </div>
                      )}

                      {selectedScheme.source && (
                        <div>
                          <span className="font-semibold">Source: </span>
                          <Badge variant="outline" className="text-xs">
                            {selectedScheme.source}
                          </Badge>
                        </div>
                      )}

                      {(selectedScheme as any).semanticCluster && (
                        <div className="col-span-2">
                          <span className="font-semibold">Cluster: </span>
                          <Badge variant="outline" className="text-xs">
                            {(selectedScheme as any).semanticCluster}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRelated(!showRelated)}
                      className="w-full"
                    >
                      {showRelated ? "Hide" : "Show"} Related Schemes
                    </Button>
                  </div>
                </Card>

                {/* Related Schemes */}
                {showRelated && allSchemes && (
                  <RelatedSchemes
                    currentScheme={selectedScheme}
                    allSchemes={allSchemes}
                    onSchemeSelect={setSelectedScheme}
                    maxSchemes={4}
                    compact
                  />
                )}

                {/* Raw JSON for debugging */}
                <details className="text-xs">
                  <summary className="cursor-pointer font-semibold p-2 bg-muted rounded">
                    View JSON
                  </summary>
                  <pre className="mt-2 p-4 bg-muted rounded overflow-auto max-h-96">
                    {JSON.stringify(selectedScheme, null, 2)}
                  </pre>
                </details>
              </>
            ) : (
              <Card className="p-6 text-center text-muted-foreground">
                <p className="text-sm">
                  Select a scheme to view details here
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Development Notes */}
      <Card className="mt-8 p-6 bg-muted/50">
        <h3 className="font-bold mb-3">Development Notes</h3>
        <div className="text-sm space-y-2">
          <p>
            <strong>Week 6 Status:</strong> All tasks complete
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              ✅ Task 6.1: Semantic cluster definitions (9 clusters, 23
              schemes)
            </li>
            <li>✅ Task 6.2: Cluster grid UI with hover interactions</li>
            <li>✅ Task 6.3: Scheme list view within clusters</li>
            <li>✅ Task 6.4: Related schemes navigation</li>
            <li>
              ✅ Task 6.5: Database schema updated + all schemes classified
            </li>
          </ul>

          <div className="border-t my-3" />

          <p>
            <strong>Cluster Distribution:</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>👨‍🏫 Authority & Expertise: 5 schemes</li>
            <li>🔗 Cause & Effect: 7 schemes</li>
            <li>🎯 Practical Decision Making: 7 schemes</li>
            <li>🔄 Analogy & Comparison: 6 schemes</li>
            <li>📋 Classification & Definition: 8 schemes</li>
            <li>⚖️ Values & Ethics: 4 schemes</li>
            <li>📊 Evidence & Proof: 5 schemes</li>
            <li>⚔️ Opposition & Conflict: 4 schemes</li>
            <li>🔍 Meta-Claims & Testing: 5 schemes</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
