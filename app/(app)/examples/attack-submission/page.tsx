"use client";

import React, { useState } from "react";
import {
  AttackPreview,
  AttackSubmission,
  SubmissionConfirmation,
  type AttackData,
  type SubmissionResult,
} from "@/components/argumentation/AttackPreviewSubmission";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default function AttackPreviewSubmissionExamples() {
  // Sample attack data - Strong quality
  const strongAttack: AttackData = {
    attackType: "UNDERCUTS",
    targetId: "claim-123",
    targetType: "inference",
    targetText:
      "Therefore, we should implement universal basic income to address income inequality.",
    schemeId: "scheme-456",
    schemeName: "Argument from Expert Opinion",
    premises: {
      expert_name: "Dr. Sarah Johnson, Professor of Economics at MIT",
      expert_claim:
        "Universal basic income programs have shown mixed results in pilot studies, with some participants experiencing reduced work incentives.",
      expert_credibility:
        "Published over 50 peer-reviewed papers on economic policy and advised multiple governments on welfare programs.",
      domain_relevance:
        "Labor economics and welfare policy, directly relevant to UBI implementation.",
    },
    evidence: [
      {
        id: "ev-1",
        type: "expert-testimony",
        content:
          "According to the 2023 MIT Economic Policy Review, Dr. Johnson's meta-analysis of 15 UBI pilot programs across 8 countries found that while basic needs were better met, 23% of working-age participants reduced their work hours by more than 10 hours per week.",
        source: "https://example.com/mit-economic-policy-review-2023",
      },
      {
        id: "ev-2",
        type: "statistical-data",
        content:
          "The Finland UBI experiment (2017-2018) showed that while stress levels decreased by 35%, employment rates among UBI recipients were 2 percentage points lower than the control group.",
        source: "https://example.com/finland-ubi-study",
      },
    ],
    burdenOfProof: "proponent",
    burdenAdvantage: true,
    overallScore: 82,
    completenessScore: 95,
    evidenceScore: 85,
    coherenceScore: 78,
    vulnerabilityScore: 15,
    strategicValue: 88,
    difficulty: 45,
    reasoning:
      "This undercut targets the implicit assumption that UBI will maintain work incentives while reducing inequality. By presenting expert testimony showing mixed results, we cast doubt on the inference without necessarily disproving the conclusion.",
    constructionSteps: [
      "Identify the implicit assumption about work incentives",
      "Find credible expert testimony challenging this assumption",
      "Support with quantitative data from pilot programs",
      "Frame as questioning the inference, not the conclusion",
    ],
  };

  // Sample attack data - Moderate quality
  const moderateAttack: AttackData = {
    attackType: "REBUTS",
    targetId: "claim-789",
    targetType: "conclusion",
    targetText:
      "Climate change is the most pressing issue facing humanity today.",
    schemeId: "scheme-101",
    schemeName: "Argument from Consequences",
    premises: {
      alternative_issue: "Global pandemic preparedness and response",
      consequence_comparison:
        "Pandemics have killed 6.9 million people in the past 3 years vs gradual climate impacts",
      urgency_factor:
        "Pandemic threats can materialize in weeks, climate change unfolds over decades",
      resource_allocation:
        "Limited resources should prioritize immediate threats to human life",
    },
    evidence: [
      {
        id: "ev-3",
        type: "statistical-data",
        content:
          "WHO data shows COVID-19 caused 6.9 million deaths globally between 2020-2023, while estimates suggest climate change causes approximately 150,000 deaths annually.",
        source: "https://example.com/who-mortality-data",
      },
    ],
    burdenOfProof: "challenger",
    burdenAdvantage: false,
    overallScore: 58,
    completenessScore: 85,
    evidenceScore: 45,
    coherenceScore: 60,
    vulnerabilityScore: 50,
    strategicValue: 65,
    difficulty: 70,
    reasoning:
      "This rebuttal directly challenges the claim by proposing an alternative 'most pressing issue.' However, it requires substantial evidence to overcome the burden of proof, and the comparison is vulnerable to counter-arguments about long-term vs short-term thinking.",
  };

  // Sample attack data - Weak quality
  const weakAttack: AttackData = {
    attackType: "UNDERMINES",
    targetId: "claim-456",
    targetType: "premise",
    targetText: "Studies show that solar energy is becoming more cost-effective.",
    schemeId: "scheme-202",
    schemeName: "Argument from Sign",
    premises: {
      sign_observation: "Some recent solar projects have faced cost overruns",
      interpretation:
        "This suggests solar may not be as cost-effective as claimed",
      sign_reliability: "",
      alternative_explanations: "",
    },
    evidence: [],
    burdenOfProof: "challenger",
    burdenAdvantage: false,
    overallScore: 28,
    completenessScore: 50,
    evidenceScore: 0,
    coherenceScore: 35,
    vulnerabilityScore: 75,
    strategicValue: 25,
    difficulty: 85,
    reasoning:
      "This undermining attack questions the premise but lacks sufficient support. Several key premises are unfilled and there is no evidence provided.",
  };

  const [submissionState, setSubmissionState] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [selectedAttack, setSelectedAttack] = useState<AttackData>(strongAttack);

  // Mock submission handler
  const handleSubmit = async (
    attack: AttackData
  ): Promise<SubmissionResult> => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Simulate success/failure based on quality
    if (attack.overallScore >= 40) {
      return {
        success: true,
        attackId: `attack-${Date.now()}`,
        message:
          "Your attack has been successfully submitted and is now part of the deliberation.",
      };
    } else {
      return {
        success: false,
        error:
          "Attack quality is below the minimum threshold. Please improve your premises and evidence before resubmitting.",
      };
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Attack Preview & Submission</h1>
          <p className="text-lg text-muted-foreground">
            Interactive demonstration of the attack review and submission flow
            with quality validation and confirmation steps.
          </p>
          <div className="flex gap-2">
            <Badge className="bg-sky-600">Step 3.2.5</Badge>
            <Badge variant="outline">Phase 3 Week 10</Badge>
            <Badge variant="outline">Attack Preview & Submission</Badge>
          </div>
        </div>

        {/* Attack quality selector */}
        <Card>
          <CardHeader>
            <CardTitle>Select Attack Quality Level</CardTitle>
            <p className="text-sm text-muted-foreground">
              Try different quality levels to see how the preview and submission
              flow responds
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedAttack(strongAttack)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                  selectedAttack === strongAttack
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 hover:border-green-300"
                }`}
              >
                <div className="text-sm font-medium">Strong Attack</div>
                <div className="text-xs text-muted-foreground">
                  82% Quality Score
                </div>
              </button>
              <button
                onClick={() => setSelectedAttack(moderateAttack)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                  selectedAttack === moderateAttack
                    ? "border-amber-500 bg-amber-50"
                    : "border-gray-200 hover:border-amber-300"
                }`}
              >
                <div className="text-sm font-medium">Moderate Attack</div>
                <div className="text-xs text-muted-foreground">
                  58% Quality Score
                </div>
              </button>
              <button
                onClick={() => setSelectedAttack(weakAttack)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                  selectedAttack === weakAttack
                    ? "border-red-500 bg-red-50"
                    : "border-gray-200 hover:border-red-300"
                }`}
              >
                <div className="text-sm font-medium">Weak Attack</div>
                <div className="text-xs text-muted-foreground">
                  28% Quality Score
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="preview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="submission">Full Submission Flow</TabsTrigger>
            <TabsTrigger value="confirmation">Confirmation States</TabsTrigger>
          </TabsList>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Attack Preview Component</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Comprehensive preview showing all attack details before
                  submission. Sections are collapsible for better readability.
                </p>
              </CardHeader>
              <CardContent>
                <AttackPreview attack={selectedAttack} showFullDetails={true} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integration Example</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Use in the AttackConstructionWizard ReviewStep or any review
                  interface:
                </p>
                <pre className="text-xs bg-muted p-3 rounded border overflow-x-auto">
                  {`<AttackPreview 
  attack={attackData}
  showFullDetails={true}
/>`}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Submission Flow Tab */}
          <TabsContent value="submission" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Complete Submission Flow</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Multi-step submission process with validation, confirmation, and
                  result handling. Try submitting attacks with different quality
                  levels.
                </p>
              </CardHeader>
              <CardContent>
                <AttackSubmission
                  attack={selectedAttack}
                  onSubmit={handleSubmit}
                  onCancel={() => alert("Submission cancelled")}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <div className="font-medium">✓ Validation Checklist</div>
                    <div className="text-muted-foreground">
                      Ensures all premises filled and quality threshold met
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">✓ Quality Gate</div>
                    <div className="text-muted-foreground">
                      Blocks submission if quality score below 40%
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">✓ Confirmation Step</div>
                    <div className="text-muted-foreground">
                      Requires explicit confirmation before final submission
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">✓ Result Handling</div>
                    <div className="text-muted-foreground">
                      Clear success/error states with actionable feedback
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integration Example</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Complete submission flow with custom handlers:
                </p>
                <pre className="text-xs bg-muted p-3 rounded border overflow-x-auto">
                  {`<AttackSubmission
  attack={attackData}
  onSubmit={async (attack) => {
    // Call your API endpoint
    const response = await fetch('/api/attacks', {
      method: 'POST',
      body: JSON.stringify(attack),
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: 'Failed to submit attack',
      };
    }
    
    const data = await response.json();
    return {
      success: true,
      attackId: data.id,
      message: 'Attack submitted successfully!',
    };
  }}
  onCancel={() => {
    // Handle cancellation
    router.back();
  }}
/>`}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Confirmation States Tab */}
          <TabsContent value="confirmation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Success State</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Displayed when attack is successfully submitted
                </p>
              </CardHeader>
              <CardContent>
                <SubmissionConfirmation
                  result={{
                    success: true,
                    attackId: "attack-demo-12345",
                    message:
                      "Your attack has been successfully added to the deliberation.",
                  }}
                  onDismiss={() => alert("Dismissed success message")}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error State</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Displayed when submission fails
                </p>
              </CardHeader>
              <CardContent>
                <SubmissionConfirmation
                  result={{
                    success: false,
                    error:
                      "Network error: Unable to connect to server. Please check your connection and try again.",
                  }}
                  onDismiss={() => alert("Dismissed error message")}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quality Gate Error</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Specific error for attacks below quality threshold
                </p>
              </CardHeader>
              <CardContent>
                <SubmissionConfirmation
                  result={{
                    success: false,
                    error:
                      "Attack quality is below the minimum threshold (40%). Please improve your premises and add supporting evidence before resubmitting.",
                  }}
                  onDismiss={() => alert("Dismissed error message")}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integration Example</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Display confirmation after submission completes:
                </p>
                <pre className="text-xs bg-muted p-3 rounded border overflow-x-auto">
                  {`const [result, setResult] = useState<SubmissionResult | null>(null);

// After submission
const submissionResult = await submitAttack(attack);
setResult(submissionResult);

// Display confirmation
{result && (
  <SubmissionConfirmation
    result={result}
    onDismiss={() => {
      setResult(null);
      if (result.success) {
        router.push('/deliberation');
      }
    }}
  />
)}`}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quality comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Quality Validation Examples</CardTitle>
            <p className="text-sm text-muted-foreground">
              How different quality levels affect the submission flow
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Strong */}
              <div className="space-y-2 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-green-900">Strong (82%)</div>
                  <Badge className="bg-green-600">✓ Can Submit</Badge>
                </div>
                <div className="text-sm text-green-800 space-y-1">
                  <div>✓ All premises filled</div>
                  <div>✓ Quality threshold met (≥40%)</div>
                  <div>✓ Evidence provided</div>
                  <div>✓ Low vulnerability</div>
                </div>
              </div>

              {/* Moderate */}
              <div className="space-y-2 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-amber-900">
                    Moderate (58%)
                  </div>
                  <Badge className="bg-amber-600">✓ Can Submit</Badge>
                </div>
                <div className="text-sm text-amber-800 space-y-1">
                  <div>✓ All premises filled</div>
                  <div>✓ Quality threshold met (≥40%)</div>
                  <div>⚠ Limited evidence</div>
                  <div>⚠ Higher vulnerability</div>
                </div>
              </div>

              {/* Weak */}
              <div className="space-y-2 p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-red-900">Weak (28%)</div>
                  <Badge className="bg-red-600">✗ Cannot Submit</Badge>
                </div>
                <div className="text-sm text-red-800 space-y-1">
                  <div>✗ Some premises empty</div>
                  <div>✗ Below quality threshold</div>
                  <div>✗ No evidence</div>
                  <div>✗ High vulnerability</div>
                </div>
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                The submission flow enforces a minimum quality score of 40% and
                requires all premises to be filled. This ensures attacks meet a
                basic standard of completeness and quality before being added to
                deliberations.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Complete workflow */}
        <Card>
          <CardHeader>
            <CardTitle>Complete Attack Generator Workflow</CardTitle>
            <p className="text-sm text-muted-foreground">
              How all Week 10 components work together
            </p>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded border overflow-x-auto">
              {`// Step 1: User browses attack suggestions (Step 3.2.1)
<AttackSuggestions
  targetClaimId={claimId}
  onSelectAttack={(suggestion) => {
    // Step 2: Load construction wizard (Step 3.2.2)
    setSelectedSuggestion(suggestion);
    openWizard();
  }}
/>

// Step 2: User constructs attack in wizard
<AttackConstructionWizard
  suggestion={selectedSuggestion}
  onComplete={(attackData) => {
    // Step 3: Show preview and submission (Step 3.2.5)
    setAttackToSubmit(attackData);
    showSubmissionFlow();
  }}
>
  {/* Step 3: Wizard includes burden indicators (Step 3.2.3) */}
  <BurdenIndicator burden={attack.burdenOfProof} />
  
  {/* Step 4: Wizard includes evidence guidance (Step 3.2.4) */}
  <EvidenceRequirements requirements={template.evidenceRequirements} />
  <EvidenceValidator evidence={evidence} requirements={requirements} />
</AttackConstructionWizard>

// Step 5: Final submission flow (Step 3.2.5)
<AttackSubmission
  attack={attackToSubmit}
  onSubmit={async (attack) => {
    const result = await submitAttackToAPI(attack);
    return result;
  }}
  onCancel={() => router.back()}
/>

// Complete flow:
// 1. Browse suggestions → 2. Construct attack → 3. Review preview → 
// 4. Validate quality → 5. Confirm submission → 6. Show result`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
