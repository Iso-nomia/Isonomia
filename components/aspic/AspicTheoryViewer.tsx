// components/aspic/AspicTheoryViewer.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, ChevronDown, ChevronRight, AlertCircle, Sparkles, Loader2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  validateTranspositionClosure, 
  applyTranspositionClosure, 
  getTranspositionSummary,
  type TranspositionValidation 
} from "@/lib/aspic/transposition";

interface AspicTheoryViewerProps {
  theory: any; // Will be properly typed after API is created
  highlightFormula?: string;
}

export function AspicTheoryViewer({ theory, highlightFormula }: AspicTheoryViewerProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["language", "rules", "kb", "contraries"])
  );
  const [showMissingRules, setShowMissingRules] = useState(false);
  const [autoTransposing, setAutoTransposing] = useState(false);
  const [localTheory, setLocalTheory] = useState(theory);

  // Update local theory when prop changes
  useEffect(() => {
    setLocalTheory(theory);
  }, [theory]);

  // Extract data from theory (handle both old and new formats)
  const language = localTheory?.system?.language || localTheory?.language || [];
  const strictRules = localTheory?.system?.strictRules || localTheory?.strictRules || [];
  const defeasibleRules = localTheory?.system?.defeasibleRules || localTheory?.defeasibleRules || [];
  const axioms = localTheory?.knowledgeBase?.axioms || localTheory?.axioms || [];
  const premises = localTheory?.knowledgeBase?.premises || localTheory?.premises || [];
  const assumptions = localTheory?.knowledgeBase?.assumptions || localTheory?.assumptions || [];
  const contraries = localTheory?.system?.contraries || localTheory?.contraries || {};

  // Validate transposition closure (memoized to avoid recalculation)
  const transpositionValidation = useMemo<TranspositionValidation | null>(() => {
    if (!strictRules || strictRules.length === 0) {
      return null;
    }
    
    const validation = validateTranspositionClosure(strictRules);
    
    if (!validation.isClosed) {
      console.warn(
        `[AspicTheoryViewer] ⚠️  Transposition closure violated: ${validation.missingRules.length} rules missing`
      );
    }
    
    return validation;
  }, [strictRules]);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    // TODO: Add toast notification
    console.log(`Copied ${label} to clipboard`);
  };

  if (!theory) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No theory data available
      </div>
    );
  }

  // Convert to arrays for rendering (handle both arrays and Sets/Maps)
  const languageArray = Array.isArray(language) ? language : Array.from(language);
  const axiomsArray = Array.isArray(axioms) ? axioms : Array.from(axioms);
  const premisesArray = Array.isArray(premises) ? premises : Array.from(premises);
  const assumptionsArray = Array.isArray(assumptions) ? assumptions : Array.from(assumptions);
  
  // Handle contraries - it's an object with formula -> array of contraries
  const contrariesEntries = Object.entries(contraries);

  // Handler for auto-generating transpositions
  const handleAutoGenerateTranspositions = () => {
    if (!localTheory || !strictRules || strictRules.length === 0) return;
    
    setAutoTransposing(true);
    
    try {
      // Apply transposition closure
      const closedRules = applyTranspositionClosure(strictRules);
      
      console.log(`[AspicTheoryViewer] Generated ${closedRules.length - strictRules.length} transposed rules`);
      
      // Update local theory with transposed rules
      const updatedTheory = {
        ...localTheory,
        system: {
          ...localTheory.system,
          strictRules: closedRules,
        },
      };
      
      setLocalTheory(updatedTheory);
      setShowMissingRules(false);
      
      // TODO: Add toast notification
      console.log("✅ Transposition closure applied");
    } catch (error) {
      console.error("[handleAutoGenerateTranspositions] Error:", error);
      // TODO: Add error toast
    } finally {
      setAutoTransposing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Language Section */}
      <Card className="sidebarv2 p-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => toggleSection("language")}
              className="flex items-center gap-2 hover:text-purple-600 transition-colors"
            >
              {expandedSections.has("language") ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <CardTitle className="text-base tracking-wide">
                <span className="flex font-mono tracking-wide items-center gap-2">∈ Language ({languageArray.length} formulas)</span>
              </CardTitle>
            </button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(languageArray.join(", "), "Language")}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        {expandedSections.has("language") && (
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {languageArray.length > 0 ? (
                languageArray.map((formula, idx) => (
                  <div className="flex gap-1" key={idx}>
                    •
                  <Badge
                    key={idx}
                    variant={formula === highlightFormula ? "default" : "outline"}
                    className="font-mono btnv2--ghost bg-white/60 text-xs"
                  >
                    {formula}
                    
                  </Badge>
                  
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500">No formulas defined</p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Rules Section */}
            <Card className="sidebarv2 p-0">

        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => toggleSection("rules")}
              className="flex items-center gap-2 hover:text-purple-600 transition-colors"
            >
              {expandedSections.has("rules") ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <CardTitle className="text-base ">
                <span className="flex font-mono text-base items-center gap-2">∴ Inference Rules ({strictRules.length + defeasibleRules.length} total)</span>
              </CardTitle>
            </button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                copyToClipboard(
                  JSON.stringify({ strictRules, defeasibleRules }, null, 2),
                  "Rules"
                )
              }
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        {expandedSections.has("rules") && (
          <CardContent className="space-y-4">
            {/* Transposition Closure Warning */}
            {transpositionValidation && !transpositionValidation.isClosed && (
              <Alert className="border-amber-500 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-800 space-y-2">
                  <div className="font-semibold text-amber-900 mb-2">
                    Transposition Closure Violated
                  </div>
                  <p>
                    {transpositionValidation.missingRules.length} contrapositive rule
                    {transpositionValidation.missingRules.length !== 1 ? "s" : ""} missing.
                    Strict rules should be closed under transposition for logical consistency.
                  </p>
                  <div className="text-xs text-amber-700 mt-2">
                    {getTranspositionSummary(transpositionValidation)}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-600 text-amber-900 hover:bg-amber-100"
                      onClick={() => setShowMissingRules(!showMissingRules)}
                    >
                      {showMissingRules ? "Hide" : "Show"} Missing Rules ({transpositionValidation.missingRules.length})
                    </Button>
                    <Button
                      size="sm"
                      className="bg-amber-600 text-white hover:bg-amber-700"
                      onClick={handleAutoGenerateTranspositions}
                      disabled={autoTransposing}
                    >
                      {autoTransposing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Auto-generate Transpositions
                        </>
                      )}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Missing Rules List (Collapsible) */}
            {showMissingRules && transpositionValidation?.missingRules && (
              <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-4">
                <h4 className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Missing Transposed Rules ({transpositionValidation.missingRules.length})
                </h4>
                <div className="space-y-2">
                  {transpositionValidation.missingRules.map((rule, idx) => (
                    <div
                      key={rule.id}
                      className="rounded-lg border border-amber-200 bg-white p-3 text-sm"
                    >
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="text-xs border-amber-500 text-amber-700">
                          T{idx + 1}
                        </Badge>
                        <div className="flex-1">
                          <code className="text-xs font-mono text-slate-700 block mb-1">
                            {rule.antecedents.join(", ")} → {rule.consequent}
                          </code>
                          <p className="text-xs text-slate-600">
                            {rule.explanation}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            ← From rule: <code className="font-mono">{rule.sourceRuleId}</code>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strict Rules */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Strict Rules ({strictRules.length})
              </h4>
              {strictRules.length > 0 ? (
                <div className="space-y-2">
                  {strictRules.map((rule: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <Badge variant="secondary" className="text-xs">
                        {rule.id || `r${idx + 1}`}
                      </Badge>
                      <div className="flex-1">
                        <code className="text-xs font-mono bg-gray-50 px-2 py-1 rounded">
                          {Array.isArray(rule.antecedents)
                            ? rule.antecedents.join(", ")
                            : rule.antecedents}{" "}
                          → {rule.consequent}
                        </code>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No strict rules defined</p>
              )}
            </div>

            {/* Defeasible Rules */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Defeasible Rules ({defeasibleRules.length})
              </h4>
              {defeasibleRules.length > 0 ? (
                <div className="space-y-3">
                  {defeasibleRules.map((rule: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-4 text-sm">
                      <Badge variant="secondary" className="text-xs">
                        {`${rule.id}`  || `d${idx + 1}`}
                      </Badge>
                      ⩴
                      <div className="flex-1">
                        <code className="text-xs font-mono bg-gray-50 px-2 py-1 rounded-md">
                          {Array.isArray(rule.antecedents)
                            ? rule.antecedents.join(", ")
                            : rule.antecedents}{" "}
                          ⇒ {rule.consequent}
                        </code>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No defeasible rules defined</p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Knowledge Base Section */}
      <Card className="sidebarv2 p-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => toggleSection("kb")}
              className="flex items-center gap-2 hover:text-purple-600 transition-colors"
            >
              {expandedSections.has("kb") ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <CardTitle className="text-base">
                ᎒᎒᎒ Knowledge Base (
                {axiomsArray.length + premisesArray.length + assumptionsArray.length} items)
              </CardTitle>
            </button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                copyToClipboard(
                  JSON.stringify({ axioms: axiomsArray, premises: premisesArray, assumptions: assumptionsArray }, null, 2),
                  "Knowledge Base"
                )
              }
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        {expandedSections.has("kb") && (
          <CardContent className="space-y-3">
            {/* Axioms */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Axioms ({axiomsArray.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {axiomsArray.length > 0 ? (
                  axiomsArray.map((axiom, idx) => (
                    <Badge key={idx} variant="default" className="font-mono text-xs bg-sky-100 text-sky-900 hover:bg-sky-200">
                      {axiom}
                    </Badge>
                  ))
                ) : (
                  <p className="text-xs text-gray-500">No axioms defined</p>
                )}
              </div>
            </div>

            {/* Premises */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Premises ({premisesArray.length})
              </h4>
              <div className="flex flex-wrap gap-2.5">
                {premisesArray.length > 0 ? (
                  premisesArray.map((premise, idx) => (
                    <Badge key={idx} variant="outline" className="font-mono text-xs">
                      {premise}
                    </Badge>
                  ))
                ) : (
                  <p className="text-xs text-gray-500">No premises defined</p>
                )}
              </div>
            </div>

            {/* Assumptions */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Assumptions ({assumptionsArray.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {assumptionsArray.length > 0 ? (
                  assumptionsArray.map((assumption, idx) => (
                    <Badge key={idx} variant="secondary" className="font-mono text-xs">
                      {assumption}
                    </Badge>
                  ))
                ) : (
                  <p className="text-xs text-gray-500">No assumptions defined</p>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Contraries Section */}
      <Card className="sidebarv2 p-0 border-2 border-rose-200">
        <CardHeader className="pb-3 bg-rose-50/50">
          <div className="flex items-center justify-between">
            <button
              onClick={() => toggleSection("contraries")}
              className="flex items-center gap-2 hover:text-rose-600 transition-colors"
            >
              {expandedSections.has("contraries") ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <CardTitle className="text-base flex items-center gap-2">
                ䷅ Contraries ({contrariesEntries.length})
                {contrariesEntries.length > 0 && (
                  <Badge variant="outline" className="border-rose-400 text-rose-700 bg-rose-100 text-[10px]">
                    REBUTTAL SOURCE
                  </Badge>
                )}
              </CardTitle>
            </button>
            <div className="flex items-center gap-4">
              {/* Legend */}
              <div className="flex items-center gap-3 text-[10px] text-gray-700">
                <span className="flex items-center gap-1">
                  <span className="text-orange-600 font-medium  font-mono  text-sm">↝ ¬</span>
                  <span>contrary (asymmetric attack)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-red-600 font-semibold text-sm font-mono">⊥</span>
                  <span>contradictory (mutual defeat)</span>
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  copyToClipboard(
                    JSON.stringify(Object.fromEntries(contrariesEntries), null, 2),
                    "Contraries"
                  )
                }
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        {expandedSections.has("contraries") && (
          <CardContent>
            {contrariesEntries.length > 0 ? (
              <>
                {/* Informational Note */}
                <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  <p className="font-semibold mb-1">⚠️ About Contraries</p>
                  <p>
                    Contraries define which propositions cannot both be true. 
                    Arguments with contrary conclusions enable <strong>rebutting attacks</strong> in ASPIC+.
                  </p>
                </div>
                
                <div className="space-y-2">
                {contrariesEntries.map(([formula, contrarySet]: [string, any], idx) => {
                  // contrarySet can be an array or Set depending on data source
                  const contrariesArray = Array.isArray(contrarySet) 
                    ? contrarySet 
                    : Array.from(contrarySet);
                  
                  // Build a map for reverse lookup to check symmetry
                  const contrariesMap = new Map<string, Set<string>>(
                    contrariesEntries.map(([f, cs]) => {
                      const csArray = Array.isArray(cs) ? cs : Array.from(cs as Iterable<string>);
                      return [f as string, new Set(csArray)];
                    })
                  );
                  
                  return (
                    <div key={idx} className="flex items-start gap-2 text-sm py-1">
                      <Badge variant="outline" className="font-mono text-xs shrink-0">
                        {formula}
                      </Badge>
                      
                      <div className="flex flex-col gap-1">
                        {contrariesArray.map((contrary: string, cIdx) => {
                          // Check if symmetric (contradictory) or asymmetric (contrary)
                          const reverseContraries = contrariesMap.get(contrary);
                          const isContradictory = reverseContraries?.has(formula) ?? false;
                          
                          return (
                            <div key={cIdx} className="flex items-center gap-2">
                              <span className={`text-xs font-mono ${
                                isContradictory ? "text-red-600" : "text-orange-600"
                              }`}>
                                {isContradictory ? "⊥" : "↝ ¬"}
                              </span>
                              <Badge 
                                variant="outline" 
                                className={`font-mono text-xs ${
                                  isContradictory 
                                    ? "border-red-300 text-red-700 bg-red-50" 
                                    : "border-orange-300 text-orange-700 bg-orange-50"
                                }`}
                              >
                                {contrary}
                              </Badge>
                              {/* <span className="text-[9px] text-gray-500 italic">
                                {isContradictory ? "contradictory" : "contrary"}
                              </span> */}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              </>
            ) : (
              <p className="text-xs text-gray-500">No contraries defined</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Export Actions */}
      <div className="flex gap-2 justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => copyToClipboard(JSON.stringify(theory, null, 2), "Theory (JSON)")}
        >
          Export JSON
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            // TODO: Generate LaTeX format
            console.log("LaTeX export coming soon");
          }}
        >
          Export LaTeX
        </Button>
      </div>
    </div>
  );
}
