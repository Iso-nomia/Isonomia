/**
 * Phase 5: Type System Panel
 * UI for incarnation checking and type inference
 */

"use client";

import * as React from "react";
import useSWR from "swr";

const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

interface TypeSystemPanelProps {
  designId: string;
  deliberationId?: string;
  strategyId?: string;
}

type TypeStructure = {
  kind: "base" | "arrow" | "product" | "sum" | "variable";
  name?: string;
  left?: TypeStructure;
  right?: TypeStructure;
};

type TypeInference = {
  designId: string;
  inferredType: TypeStructure;
  confidence: number;
  method: "structural" | "behavioural";
  alternatives?: TypeStructure[];
};

type IncarnationResult = {
  sourceDesignId: string;
  targetDesignId: string;
  type: "lax" | "sharp";
  isValid: boolean;
  witnessActions?: any[];
};

type TypeCheckResult = {
  designId: string;
  targetType: TypeStructure;
  isValid: boolean;
  confidence: number;
  method: string;
  judgment: string;
  analysis: {
    structural?: {
      matches: boolean;
      designPattern: string;
      targetKind: string;
      mismatches?: Array<{ path: string; expected: string; actual: string; context?: string }>;
      depthMatch?: boolean;
      branchingMatch?: boolean;
    };
    inference?: {
      inferredType: TypeStructure;
      inferenceConfidence: number;
      typesMatch: boolean;
      isSubtype?: boolean;
    };
    failureReason?: string;
    suggestions?: string[];
  };
};

export function TypeSystemPanel({ designId, deliberationId, strategyId }: TypeSystemPanelProps) {
  const [activeTab, setActiveTab] = React.useState<"inference" | "incarnation" | "check">("inference");
  const [checkInProgress, setCheckInProgress] = React.useState(false);
  const [incarnationResult, setIncarnationResult] = React.useState<IncarnationResult | null>(null);
  const [selectedTargetDesign, setSelectedTargetDesign] = React.useState<string>("");
  
  // Type checking state
  const [selectedTypeKind, setSelectedTypeKind] = React.useState<string>("arrow");
  const [typeCheckResult, setTypeCheckResult] = React.useState<TypeCheckResult | null>(null);
  const [typeCheckInProgress, setTypeCheckInProgress] = React.useState(false);

  // Fetch type inference
  const { data: inferenceData, isLoading: inferenceLoading, mutate: refetchInference } = useSWR<{
    ok: boolean;
    designId: string;
    type: TypeStructure;
    confidence: number;
    method: "structural" | "behavioural" | "chronicle";
    details?: {
      alternatives?: TypeStructure[];
      designCount?: number;
    };
  }>(
    designId ? `/api/ludics/dds/types/infer?designId=${designId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Transform API response to UI format
  const inference = inferenceData?.ok ? {
    designId: inferenceData.designId,
    inferredType: inferenceData.type,
    confidence: inferenceData.confidence,
    method: inferenceData.method,
    alternatives: inferenceData.details?.alternatives,
  } : null;

  // Fetch designs for incarnation comparison - use deliberationId if provided
  const { data: designsData } = useSWR(
    deliberationId ? `/api/ludics/designs?deliberationId=${deliberationId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const designs = designsData?.designs ?? [];
  const otherDesigns = designs.filter((d: any) => d.id !== designId);

  const checkIncarnation = async (type: "lax" | "sharp") => {
    if (!selectedTargetDesign) return;
    
    setCheckInProgress(true);
    try {
      const response = await fetch("/api/ludics/dds/types/incarnation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceDesignId: designId,
          targetDesignId: selectedTargetDesign,
          type,
        }),
      });
      const result = await response.json();
      if (result.ok) {
        setIncarnationResult(result.incarnation);
      }
    } catch (error) {
      console.error("Incarnation check failed:", error);
    } finally {
      setCheckInProgress(false);
    }
  };

  // Type checking function
  const checkType = async (method: "structural" | "inference" | "combined" = "combined") => {
    if (!designId || !selectedTypeKind) return;
    
    setTypeCheckInProgress(true);
    setTypeCheckResult(null);
    
    try {
      // Build target type based on selected kind
      let targetType: TypeStructure;
      
      // If we have an inferred type, use that as the basis for comparison
      if (inference && selectedTypeKind === "inferred") {
        targetType = inference.inferredType;
      } else {
        targetType = { kind: selectedTypeKind as any };
      }
      
      const response = await fetch("/api/ludics/dds/types/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designId,
          targetType,
          method,
        }),
      });
      
      const data = await response.json();
      if (data.ok) {
        setTypeCheckResult(data.result);
      } else {
        console.error("Type check failed:", data.error);
      }
    } catch (error) {
      console.error("Type check error:", error);
    } finally {
      setTypeCheckInProgress(false);
    }
  };

  // inference is now computed above from inferenceData

  return (
    <div className="type-system-panel border rounded-lg bg-white/70 overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex border-b bg-slate-50">
        <button
          onClick={() => setActiveTab("inference")}
          className={`px-4 py-2 text-xs font-medium transition ${
            activeTab === "inference"
              ? "bg-white border-b-2 border-indigo-600 text-indigo-700"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          🔍 Type Inference
        </button>
        <button
          onClick={() => setActiveTab("incarnation")}
          className={`px-4 py-2 text-xs font-medium transition ${
            activeTab === "incarnation"
              ? "bg-white border-b-2 border-indigo-600 text-indigo-700"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          ⊂ Incarnation
        </button>
        <button
          onClick={() => setActiveTab("check")}
          className={`px-4 py-2 text-xs font-medium transition ${
            activeTab === "check"
              ? "bg-white border-b-2 border-indigo-600 text-indigo-700"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          ✓ Type Check
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Type Inference Tab */}
        {activeTab === "inference" && (
          <div className="inference-content">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-800">Inferred Type</h4>
              <button
                onClick={() => refetchInference()}
                className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded transition"
              >
                Refresh
              </button>
            </div>

            {inferenceLoading && (
              <div className="text-xs text-slate-500 animate-pulse">Computing type...</div>
            )}

            {inference && (
              <div className="space-y-3">
                {/* Main Type Display */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <div className="font-mono text-sm text-indigo-800">
                    <TypeDisplay type={inference.inferredType} />
                  </div>
                </div>

                {/* Confidence */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">Confidence:</span>
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all"
                      style={{ width: `${inference.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-slate-700">
                    {(inference.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Method */}
                <div className="text-xs text-slate-500">
                  <span className="font-medium">Method:</span>{" "}
                  <span className="px-1.5 py-0.5 bg-slate-100 rounded">
                    {inference.method}
                  </span>
                </div>

                {/* Alternatives (deduplicated) */}
                {inference.alternatives && inference.alternatives.length > 0 && (() => {
                  // Deduplicate alternatives by serializing to JSON
                  const mainTypeKey = JSON.stringify(inference.inferredType);
                  const seen = new Set<string>([mainTypeKey]);
                  const uniqueAlts = inference.alternatives.filter((alt: TypeStructure) => {
                    const key = JSON.stringify(alt);
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  });
                  
                  if (uniqueAlts.length === 0) return null;
                  
                  return (
                    <div className="border-t pt-2">
                      <div className="text-xs text-slate-600 mb-1">Alternative typings:</div>
                      <div className="space-y-1">
                        {uniqueAlts.map((alt: TypeStructure, idx: number) => (
                          <div
                            key={idx}
                            className="font-mono text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded"
                          >
                            <TypeDisplay type={alt} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {!inference && !inferenceLoading && (
              <div className="text-xs text-slate-500">No type inference available</div>
            )}
          </div>
        )}

        {/* Incarnation Tab */}
        {activeTab === "incarnation" && (
          <div className="incarnation-content space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800">Incarnation Check</h4>
              <div className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Definition 6.3
              </div>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
              Check if this design incarnates in (is a refinement of) another design.
              <br />
              <strong>Lax:</strong> D ⊂ E (actions subset) | <strong>Sharp:</strong> D ⊂⊂ E (branch containment)
            </div>

            {/* Target Selection */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-600">Target Design:</label>
              <select
                value={selectedTargetDesign}
                onChange={(e) => setSelectedTargetDesign(e.target.value)}
                className="flex-1 text-xs border rounded px-2 py-1"
              >
                <option value="">Select a design...</option>
                {otherDesigns.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.participantId} ({d.id.slice(0, 8)}...)
                  </option>
                ))}
              </select>
            </div>

            {/* Check Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => checkIncarnation("lax")}
                disabled={!selectedTargetDesign || checkInProgress}
                className="flex-1 px-3 py-2 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 rounded transition disabled:opacity-50"
              >
                {checkInProgress ? "Checking..." : "Lax (⊂)"}
              </button>
              <button
                onClick={() => checkIncarnation("sharp")}
                disabled={!selectedTargetDesign || checkInProgress}
                className="flex-1 px-3 py-2 text-xs bg-rose-100 hover:bg-rose-200 text-rose-800 rounded transition disabled:opacity-50"
              >
                {checkInProgress ? "Checking..." : "Sharp (⊂⊂)"}
              </button>
            </div>

            {/* Result */}
            {incarnationResult && (
              <div
                className={`rounded-lg p-3 ${
                  incarnationResult.isValid
                    ? "bg-emerald-50 border border-emerald-200"
                    : "bg-rose-50 border border-rose-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">
                    {incarnationResult.isValid ? "✓" : "✗"}
                  </span>
                  <span
                    className={`font-semibold ${
                      incarnationResult.isValid ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {incarnationResult.isValid
                      ? `${incarnationResult.type === "sharp" ? "Sharp" : "Lax"} Incarnation Holds`
                      : `No ${incarnationResult.type === "sharp" ? "Sharp" : "Lax"} Incarnation`}
                  </span>
                </div>
                {incarnationResult.witnessActions && incarnationResult.witnessActions.length > 0 && (
                  <div className="text-xs text-slate-600">
                    Witness actions: {incarnationResult.witnessActions.length}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Type Check Tab */}
        {activeTab === "check" && (
          <div className="type-check-content space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800">Type Checking</h4>
              <div className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                D : A judgment
              </div>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
              Verify that design D has type A. Uses structural analysis, type inference comparison,
              and optionally orthogonality checking.
            </div>

            {/* Type Selection */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700">Target Type:</label>
              <div className="flex flex-wrap gap-2">
                {["arrow", "product", "sum", "base", "unit"].map((kind) => (
                  <button
                    key={kind}
                    onClick={() => setSelectedTypeKind(kind)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                      selectedTypeKind === kind
                        ? "bg-indigo-100 border-indigo-300 text-indigo-800"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {kind === "arrow" && "A → B"}
                    {kind === "product" && "A × B"}
                    {kind === "sum" && "A + B"}
                    {kind === "base" && "Base"}
                    {kind === "unit" && "Unit (1)"}
                  </button>
                ))}
                {inference && (
                  <button
                    onClick={() => setSelectedTypeKind("inferred")}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                      selectedTypeKind === "inferred"
                        ? "bg-purple-100 border-purple-300 text-purple-800"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    Inferred
                  </button>
                )}
              </div>
            </div>

            {/* Check Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => checkType("structural")}
                disabled={typeCheckInProgress}
                className="flex-1 px-3 py-2 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition disabled:opacity-50"
              >
                {typeCheckInProgress ? "Checking..." : "Structural"}
              </button>
              <button
                onClick={() => checkType("inference")}
                disabled={typeCheckInProgress}
                className="flex-1 px-3 py-2 text-xs bg-purple-100 hover:bg-purple-200 text-purple-800 rounded transition disabled:opacity-50"
              >
                {typeCheckInProgress ? "Checking..." : "Inference"}
              </button>
              <button
                onClick={() => checkType("combined")}
                disabled={typeCheckInProgress}
                className="flex-1 px-3 py-2 text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded transition disabled:opacity-50"
              >
                {typeCheckInProgress ? "Checking..." : "Combined"}
              </button>
            </div>

            {/* Result Display */}
            {typeCheckResult && (
              <div
                className={`rounded-lg p-3 ${
                  typeCheckResult.isValid
                    ? "bg-emerald-50 border border-emerald-200"
                    : "bg-rose-50 border border-rose-200"
                }`}
              >
                {/* Judgment */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">
                    {typeCheckResult.isValid ? "✓" : "✗"}
                  </span>
                  <span
                    className={`font-semibold ${
                      typeCheckResult.isValid ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {typeCheckResult.isValid ? "Type Check Passed" : "Type Check Failed"}
                  </span>
                </div>

                {/* Judgment String */}
                <div className="font-mono text-sm mb-2 px-2 py-1 bg-white/50 rounded">
                  {typeCheckResult.judgment}
                </div>

                {/* Confidence */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-600">Confidence:</span>
                  <div className="flex-1 h-2 bg-white/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        typeCheckResult.isValid ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${typeCheckResult.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono">
                    {(typeCheckResult.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Method */}
                <div className="text-xs text-slate-600 mb-2">
                  <span className="font-medium">Method:</span>{" "}
                  <span className="px-1.5 py-0.5 bg-white/50 rounded">
                    {typeCheckResult.method}
                  </span>
                </div>

                {/* Structural Analysis */}
                {typeCheckResult.analysis.structural && (
                  <div className="text-xs border-t border-slate-200/50 pt-2 mt-2">
                    <div className="font-medium text-slate-700 mb-1">Structural Analysis:</div>
                    <div className="space-y-1 text-slate-600">
                      <div>
                        Design pattern: <code className="bg-white/50 px-1 rounded">{typeCheckResult.analysis.structural.designPattern}</code>
                      </div>
                      <div>
                        Target kind: <code className="bg-white/50 px-1 rounded">{typeCheckResult.analysis.structural.targetKind}</code>
                      </div>
                      {typeCheckResult.analysis.structural.depthMatch !== undefined && (
                        <div>
                          Depth match: {typeCheckResult.analysis.structural.depthMatch ? "✓" : "✗"}
                        </div>
                      )}
                      {typeCheckResult.analysis.structural.branchingMatch !== undefined && (
                        <div>
                          Branching match: {typeCheckResult.analysis.structural.branchingMatch ? "✓" : "✗"}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Inference Analysis */}
                {typeCheckResult.analysis.inference && (
                  <div className="text-xs border-t border-slate-200/50 pt-2 mt-2">
                    <div className="font-medium text-slate-700 mb-1">Inference Analysis:</div>
                    <div className="space-y-1 text-slate-600">
                      <div>
                        Inferred type:{" "}
                        <span className="font-mono bg-white/50 px-1 rounded">
                          <TypeDisplay type={typeCheckResult.analysis.inference.inferredType} />
                        </span>
                      </div>
                      <div>
                        Types match: {typeCheckResult.analysis.inference.typesMatch ? "✓" : "✗"}
                      </div>
                      {typeCheckResult.analysis.inference.isSubtype !== undefined && (
                        <div>
                          Is subtype: {typeCheckResult.analysis.inference.isSubtype ? "✓" : "✗"}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Failure Reason */}
                {typeCheckResult.analysis.failureReason && (
                  <div className="text-xs border-t border-slate-200/50 pt-2 mt-2">
                    <div className="font-medium text-rose-700 mb-1">Reason:</div>
                    <div className="text-rose-600">
                      {typeCheckResult.analysis.failureReason}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {typeCheckResult.analysis.suggestions && typeCheckResult.analysis.suggestions.length > 0 && (
                  <div className="text-xs border-t border-slate-200/50 pt-2 mt-2">
                    <div className="font-medium text-amber-700 mb-1">💡 Suggestions:</div>
                    <ul className="list-disc list-inside text-amber-600 space-y-0.5">
                      {typeCheckResult.analysis.suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TypeDisplay({ type }: { type: TypeStructure }) {
  if (!type) return <span>?</span>;

  switch (type.kind) {
    case "base":
      return <span className="text-indigo-700">{type.name || "Base"}</span>;
    case "arrow":
      return (
        <span>
          (<TypeDisplay type={type.left!} /> → <TypeDisplay type={type.right!} />)
        </span>
      );
    case "product":
      return (
        <span>
          (<TypeDisplay type={type.left!} /> × <TypeDisplay type={type.right!} />)
        </span>
      );
    case "sum":
      return (
        <span>
          (<TypeDisplay type={type.left!} /> + <TypeDisplay type={type.right!} />)
        </span>
      );
    case "variable":
      return <span className="text-purple-600">{type.name || "T"}</span>;
    default:
      return <span>Unknown</span>;
  }
}

export default TypeSystemPanel;
