"use client";

import { useState } from "react";
import {
  BurdenIndicator,
  BurdenBadge,
  BurdenExplanation,
  BurdenComparison,
  BurdenProgressIndicator,
} from "@/components/argumentation/BurdenOfProofIndicators";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

/**
 * Example usage of Burden of Proof Indicators
 * This file demonstrates all the different burden indicator components
 */

export default function BurdenIndicatorsExamplePage() {
  const [evidenceLevel, setEvidenceLevel] = useState(45);

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Burden of Proof Indicators</h1>
        <p className="text-muted-foreground">
          Visual components for displaying burden of proof in argumentation
        </p>
      </div>

      <Tabs defaultValue="variants" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="variants">Variants</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
          <TabsTrigger value="explanation">Explanation</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
        </TabsList>

        {/* Variants Tab */}
        <TabsContent value="variants" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>BurdenIndicator Variants</CardTitle>
              <CardDescription>
                Three display styles: detailed (default), compact, and inline
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Proponent burden - detailed */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Proponent Burden - Detailed (Default)</h3>
                <BurdenIndicator burden="proponent" requiresEvidence={false} />
              </div>

              <Separator />

              {/* Challenger burden - detailed */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Challenger Burden - Detailed</h3>
                <BurdenIndicator burden="challenger" requiresEvidence={true} />
              </div>

              <Separator />

              {/* Compact variants */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Compact Variants (Badges with Hover)</h3>
                <div className="flex flex-wrap gap-2">
                  <BurdenIndicator
                    burden="proponent"
                    requiresEvidence={false}
                    variant="compact"
                  />
                  <BurdenIndicator
                    burden="challenger"
                    requiresEvidence={false}
                    variant="compact"
                  />
                  <BurdenIndicator
                    burden="challenger"
                    requiresEvidence={true}
                    variant="compact"
                  />
                </div>
              </div>

              <Separator />

              {/* Inline variants */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Inline Variants</h3>
                <div className="space-y-2 text-sm">
                  <p>
                    This attack has{" "}
                    <BurdenIndicator
                      burden="proponent"
                      requiresEvidence={false}
                      variant="inline"
                    />{" "}
                    which means you can challenge without extensive evidence.
                  </p>
                  <p>
                    This attack requires{" "}
                    <BurdenIndicator
                      burden="challenger"
                      requiresEvidence={true}
                      variant="inline"
                    />{" "}
                    so you need strong supporting evidence.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Badges */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">BurdenBadge Components</h3>
                <div className="flex flex-wrap gap-2">
                  <BurdenBadge burden="proponent" />
                  <BurdenBadge burden="challenger" requiresEvidence={false} />
                  <BurdenBadge burden="challenger" requiresEvidence={true} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Burden Comparison</CardTitle>
              <CardDescription>Side-by-side comparison of burden positions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Advantage scenario */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Scenario 1: You Have Advantage</h3>
                <BurdenComparison
                  yourBurden="proponent"
                  theirBurden="challenger"
                  requiresEvidence={false}
                />
              </div>

              <Separator />

              {/* Challenging scenario */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Scenario 2: You Must Prove Your Challenge</h3>
                <BurdenComparison
                  yourBurden="challenger"
                  theirBurden="proponent"
                  requiresEvidence={true}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Explanation Tab */}
        <TabsContent value="explanation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Burden Explanations</CardTitle>
              <CardDescription>
                Detailed explanations with context (attack/support/general)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Attack context - proponent */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">
                  Attack Context - Proponent Burden (Advantage)
                </h3>
                <div className="bg-muted p-4 rounded-lg">
                  <BurdenExplanation burden="proponent" context="attack" />
                </div>
              </div>

              <Separator />

              {/* Attack context - challenger */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Attack Context - Challenger Burden</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <BurdenExplanation burden="challenger" context="attack" />
                </div>
              </div>

              <Separator />

              {/* Support context */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Support Context - Proponent</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <BurdenExplanation burden="proponent" context="support" />
                </div>
              </div>

              <Separator />

              {/* General context */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">General Context</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <BurdenExplanation burden="proponent" context="general" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Burden Progress Indicator</CardTitle>
              <CardDescription>
                Track evidence level against burden requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Evidence level control */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Evidence Level: {evidenceLevel}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={evidenceLevel}
                  onChange={(e) => setEvidenceLevel(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <Separator />

              {/* Proponent burden progress */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">
                  Proponent Burden (30% requirement)
                </h3>
                <BurdenProgressIndicator
                  currentBurden="proponent"
                  evidenceProvided={evidenceLevel}
                />
              </div>

              <Separator />

              {/* Challenger burden progress */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">
                  Challenger Burden (70% requirement)
                </h3>
                <BurdenProgressIndicator
                  currentBurden="challenger"
                  evidenceProvided={evidenceLevel}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Integration Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Examples</CardTitle>
          <CardDescription>How to use these components in your app</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <pre className="text-xs overflow-x-auto">
              <code>{`// In AttackSuggestions
<BurdenIndicator 
  burden={suggestion.burdenOfProof}
  requiresEvidence={suggestion.requiresEvidence}
  variant="compact"
/>

// In AttackConstructionWizard Overview
<BurdenIndicator 
  burden={suggestion.burdenOfProof}
  requiresEvidence={suggestion.requiresEvidence}
/>

// In Premises Step
<BurdenProgressIndicator
  currentBurden={suggestion.burdenOfProof}
  evidenceProvided={calculateEvidenceScore()}
/>

// In Argument Display
<BurdenBadge burden="proponent" />

// In Help/Tutorial Content
<BurdenExplanation 
  burden="challenger" 
  context="attack"
/>

// In Strategic Analysis View
<BurdenComparison
  yourBurden={yourAttack.burdenOfProof}
  theirBurden="proponent"
  requiresEvidence={yourAttack.requiresEvidence}
/>`}</code>
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
