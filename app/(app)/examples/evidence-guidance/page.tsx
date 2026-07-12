"use client";

import React, { useState } from "react";
import {
  EvidenceRequirements,
  EvidenceValidator,
  EvidenceQualityIndicator,
  EvidenceSuggestions,
  EvidenceStrengthMeter,
  type EvidenceRequirement,
  type EvidenceItem,
  type EvidenceSuggestion,
} from "@/components/argumentation/EvidenceGuidance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function EvidenceGuidanceExamples() {
  // Sample data for demonstrations
  const sampleRequirements: EvidenceRequirement[] = [
    {
      type: "expert-testimony",
      description:
        "Citations from qualified authorities, peer-reviewed studies, or recognized experts",
      required: true,
      strengthNeeded: 70,
      examples: [
        "Peer-reviewed journal article from a domain expert",
        "Statement from a credentialed professional in the field",
        "Consensus report from scientific organization",
      ],
      tips: [
        "Check the author's credentials and affiliations",
        "Look for citations in reputable academic journals",
        "Verify the expert's relevance to the specific claim",
      ],
    },
    {
      type: "statistical-data",
      description:
        "Numbers, percentages, or quantitative evidence from reliable sources",
      required: true,
      strengthNeeded: 60,
      examples: [
        "Government statistics or census data",
        "Large-scale survey results with clear methodology",
        "Meta-analysis combining multiple studies",
      ],
      tips: [
        "Check the sample size and methodology",
        "Look for confidence intervals and error margins",
        "Verify the data source is reputable",
        "Consider potential biases in data collection",
      ],
    },
    {
      type: "documentary-evidence",
      description: "Official documents, reports, publications, or records",
      required: false,
      strengthNeeded: 50,
      examples: [
        "Official government report or policy document",
        "Corporate financial statements or annual reports",
        "Legal documents or court records",
      ],
      tips: [
        "Verify authenticity of the document",
        "Check publication date for relevance",
        "Consider the authority of the issuing organization",
      ],
    },
  ];

  const sampleEvidence: EvidenceItem[] = [
    {
      id: "1",
      type: "expert-testimony",
      content:
        "According to Dr. Jane Smith, professor of environmental science at MIT and lead author of the IPCC report, 'The evidence for anthropogenic climate change is overwhelming, with 97% consensus among climate scientists.'",
      source: "https://example.com/climate-consensus-study",
      quality: "strong",
      strengthScore: 85,
    },
    {
      id: "2",
      type: "statistical-data",
      content:
        "NASA data shows global average temperature has increased by 1.1°C since pre-industrial times, with the ten warmest years on record occurring since 2010.",
      source: "https://climate.nasa.gov/vital-signs/global-temperature/",
      quality: "strong",
      strengthScore: 90,
    },
    {
      id: "3",
      type: "documentary-evidence",
      content:
        "The 2023 UN Climate Report documents increasing frequency of extreme weather events, including hurricanes, droughts, and floods.",
      source: "https://www.un.org/climate-report-2023",
      quality: "moderate",
      strengthScore: 55,
      issues: [
        "Source is recent but could use more specific data points",
        "Consider adding supporting statistical evidence",
      ],
    },
  ];

  const sampleSuggestions: EvidenceSuggestion[] = [
    {
      type: "causal-evidence",
      description:
        "You're missing causal evidence to strengthen the connection between CO2 emissions and temperature rise",
      searchTerms: [
        "CO2 greenhouse effect mechanism",
        "carbon dioxide radiative forcing",
        "climate sensitivity studies",
      ],
      sources: [
        "IPCC Assessment Reports (Chapter on Physical Science Basis)",
        "Nature Climate Change journal",
        "American Meteorological Society publications",
      ],
    },
    {
      type: "example",
      description:
        "Specific real-world examples would make your argument more concrete and relatable",
      searchTerms: [
        "climate change case studies",
        "regional climate impacts",
        "extreme weather attribution studies",
      ],
      sources: [
        "Climate Central case studies",
        "NOAA regional climate reports",
        "World Weather Attribution project",
      ],
    },
  ];

  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>(sampleEvidence);

  // Simulate adding weak evidence
  const addWeakEvidence = () => {
    const weakEvidence: EvidenceItem = {
      id: String(Date.now()),
      type: "documentary-evidence",
      content:
        "A blog post mentions that some scientists disagree about climate projections.",
      source: "https://example.com/blog-post",
      quality: "weak",
      strengthScore: 25,
      issues: [
        "Source credibility unclear - blog post vs peer-reviewed source",
        "Vague claim without specific details or citations",
        "Does not meet minimum 50% strength requirement",
      ],
    };
    setEvidenceList([...evidenceList, weakEvidence]);
  };

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Evidence Guidance System</h1>
          <p className="text-lg text-muted-foreground">
            Interactive demonstration of evidence requirement, validation, and
            guidance components for the Attack Generator UI.
          </p>
          <div className="flex gap-2">
            <Badge className="bg-sky-600">Step 3.2.4</Badge>
            <Badge variant="outline">Phase 3 Week 10</Badge>
            <Badge variant="outline">Evidence Guidance UI</Badge>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="requirements" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="requirements">Requirements</TabsTrigger>
            <TabsTrigger value="validator">Validator</TabsTrigger>
            <TabsTrigger value="quality">Quality</TabsTrigger>
            <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
            <TabsTrigger value="strength">Strength</TabsTrigger>
          </TabsList>

          {/* Requirements Tab */}
          <TabsContent value="requirements" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Evidence Requirements Display</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Shows what types of evidence are needed for an argument, with
                  detailed guidance, examples, and tips.
                </p>
              </CardHeader>
              <CardContent>
                <EvidenceRequirements requirements={sampleRequirements} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integration Example</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Use in the AttackConstructionWizard EvidenceStep to show users
                  what evidence they need:
                </p>
                <pre className="text-xs bg-muted p-3 rounded border overflow-x-auto">
                  {`<EvidenceRequirements 
  requirements={template.evidenceRequirements}
/>`}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Validator Tab */}
          <TabsContent value="validator" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Evidence Validator</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Validates provided evidence against requirements. Shows what&apos;s
                  satisfied, what needs improvement, and what&apos;s missing.
                </p>
              </CardHeader>
              <CardContent>
                <EvidenceValidator
                  evidence={evidenceList}
                  requirements={sampleRequirements}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Interactive Demo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Click below to add weak evidence and see how validation responds:
                </p>
                <button
                  onClick={addWeakEvidence}
                  className="py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors"
                >
                  Add Weak Evidence
                </button>
                <p className="text-xs text-muted-foreground">
                  Current evidence items: {evidenceList.length}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integration Example</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Use to provide real-time validation feedback as users add
                  evidence:
                </p>
                <pre className="text-xs bg-muted p-3 rounded border overflow-x-auto">
                  {`<EvidenceValidator
  evidence={userEvidence}
  requirements={template.evidenceRequirements}
/>`}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quality Tab */}
          <TabsContent value="quality" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Evidence Quality Indicators</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Displays quality assessment for individual pieces of evidence with
                  strength scores and issue detection.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {sampleEvidence.map((evidence) => (
                  <div key={evidence.id} className="border rounded-lg p-4">
                    <EvidenceQualityIndicator
                      evidence={evidence}
                      showDetails={true}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compact Mode</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Use showDetails=false for a compact view in lists:
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {sampleEvidence.map((evidence) => (
                  <div key={evidence.id} className="border rounded-lg p-3">
                    <EvidenceQualityIndicator
                      evidence={evidence}
                      showDetails={false}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integration Example</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Display quality indicators for each evidence item:
                </p>
                <pre className="text-xs bg-muted p-3 rounded border overflow-x-auto">
                  {`{evidence.map((item) => (
  <EvidenceQualityIndicator
    key={item.id}
    evidence={item}
    showDetails={true}
  />
))}`}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Suggestions Tab */}
          <TabsContent value="suggestions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI-Powered Evidence Suggestions</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Provides intelligent suggestions for finding and improving
                  evidence based on what&apos;s missing or weak.
                </p>
              </CardHeader>
              <CardContent>
                <EvidenceSuggestions
                  suggestions={sampleSuggestions}
                  onApplySuggestion={(suggestion) => {
                    alert(
                      `Applied suggestion for ${suggestion.type}:\n${suggestion.description}`
                    );
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integration Example</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Generate suggestions based on validation results and user context:
                </p>
                <pre className="text-xs bg-muted p-3 rounded border overflow-x-auto">
                  {`<EvidenceSuggestions
  suggestions={aiSuggestions}
  onApplySuggestion={(suggestion) => {
    // Handle applying suggestion
    // e.g., open search, pre-fill form, etc.
  }}
/>`}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Strength Tab */}
          <TabsContent value="strength" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Evidence Strength Meter</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Visual meter showing overall evidence strength with category
                  breakdown to help users understand what needs improvement.
                </p>
              </CardHeader>
              <CardContent>
                <EvidenceStrengthMeter
                  overallStrength={73}
                  breakdown={[
                    {
                      category: "Source Credibility",
                      score: 85,
                      description:
                        "How trustworthy and authoritative your sources are. Based on peer review, author credentials, and publication reputation.",
                    },
                    {
                      category: "Relevance",
                      score: 78,
                      description:
                        "How directly your evidence supports your specific claims. More targeted evidence scores higher.",
                    },
                    {
                      category: "Recency",
                      score: 65,
                      description:
                        "How current your evidence is. Recent evidence is generally stronger, especially for rapidly evolving topics.",
                    },
                    {
                      category: "Completeness",
                      score: 60,
                      description:
                        "Whether you have all required evidence types. Missing required evidence lowers this score.",
                    },
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Different Strength Levels</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Strong */}
                <EvidenceStrengthMeter
                  overallStrength={85}
                  breakdown={[
                    {
                      category: "Credibility",
                      score: 90,
                      description: "Source credibility",
                    },
                    {
                      category: "Relevance",
                      score: 85,
                      description: "Evidence relevance",
                    },
                    {
                      category: "Recency",
                      score: 80,
                      description: "Evidence recency",
                    },
                  ]}
                />

                {/* Moderate */}
                <EvidenceStrengthMeter
                  overallStrength={55}
                  breakdown={[
                    {
                      category: "Credibility",
                      score: 60,
                      description: "Source credibility",
                    },
                    {
                      category: "Relevance",
                      score: 55,
                      description: "Evidence relevance",
                    },
                    {
                      category: "Recency",
                      score: 50,
                      description: "Evidence recency",
                    },
                  ]}
                />

                {/* Weak */}
                <EvidenceStrengthMeter
                  overallStrength={30}
                  breakdown={[
                    {
                      category: "Credibility",
                      score: 35,
                      description: "Source credibility",
                    },
                    {
                      category: "Relevance",
                      score: 30,
                      description: "Evidence relevance",
                    },
                    {
                      category: "Recency",
                      score: 25,
                      description: "Evidence recency",
                    },
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integration Example</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Display overall evidence quality in the review step:
                </p>
                <pre className="text-xs bg-muted p-3 rounded border overflow-x-auto">
                  {`<EvidenceStrengthMeter
  overallStrength={calculateOverallStrength(evidence)}
  breakdown={[
    { category: "Credibility", score: 85, description: "..." },
    { category: "Relevance", score: 78, description: "..." },
    // ... more categories
  ]}
/>`}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Overall integration example */}
        <Card>
          <CardHeader>
            <CardTitle>Complete Integration Example</CardTitle>
            <p className="text-sm text-muted-foreground">
              How to use all evidence guidance components together in the
              AttackConstructionWizard
            </p>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded border overflow-x-auto">
              {`// In AttackConstructionWizard EvidenceStep:

function EvidenceStep() {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [suggestions, setSuggestions] = useState<EvidenceSuggestion[]>([]);

  return (
    <div className="space-y-6">
      {/* Show what is required */}
      <EvidenceRequirements 
        requirements={template.evidenceRequirements}
      />

      {/* Validate as user adds evidence */}
      <EvidenceValidator
        evidence={evidence}
        requirements={template.evidenceRequirements}
      />

      {/* Show quality for each piece */}
      <div className="space-y-3">
        {evidence.map((item) => (
          <EvidenceQualityIndicator
            key={item.id}
            evidence={item}
            showDetails={true}
          />
        ))}
      </div>

      {/* Provide AI suggestions */}
      <EvidenceSuggestions
        suggestions={suggestions}
        onApplySuggestion={handleApplySuggestion}
      />

      {/* Show overall strength meter */}
      <EvidenceStrengthMeter
        overallStrength={calculateStrength(evidence)}
        breakdown={calculateBreakdown(evidence)}
      />
    </div>
  );
}`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
