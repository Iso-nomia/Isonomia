"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import { SuppositionBanner, NestedMoveContainer } from "./SuppositionBanner";
import { SchemeComposerPicker } from "@/components/SchemeComposerPicker";
import { ClaimPicker } from "../claims/ClaimPicker";
/**
 * DialogueInspector - A comprehensive debug component to visualize the entire
 * dialogue state including claims, arguments, moves, CQs, and legal actions.
 * 
 * Now supports dynamic claim selection via SchemeComposerPicker.
 * 
 * Usage:
 * <DialogueInspector
 *   deliberationId="delib_123"
 *   initialTargetType="claim"  // optional
 *   initialTargetId="claim_456" // optional
 * />
 */

type TargetType = "claim" | "argument" | "card";

interface DialogueInspectorProps {
  deliberationId: string;
  initialTargetType?: TargetType;
  initialTargetId?: string;
  initialLocusPath?: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function DialogueInspector({
  deliberationId,
  initialTargetType = "claim",
  initialTargetId,
  initialLocusPath = "0",
}: DialogueInspectorProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "moves" | "legal" | "cqs" | "raw">("overview");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [claimPickerOpen, setClaimPickerOpen] = useState(false); // Only open when button clicked
  
  // Internal state for selected target
  const [targetType, setTargetType] = useState<TargetType>(initialTargetType);
  const [targetId, setTargetId] = useState<string | null>(initialTargetId || null);
  const [locusPath, setLocusPath] = useState<string>(initialLocusPath);

  // Fetch target data (claim or argument) - only if targetId is set
  const { data: targetData } = useSWR(
    targetId && targetType === "claim"
      ? `/api/claims/${targetId}`
      : targetId && targetType === "argument"
      ? `/api/arguments/${targetId}`
      : null,
    fetcher
  );

  // Fetch dialogue moves for the entire deliberation
  const { data: movesData } = useSWR(
    `/api/dialogue/moves?deliberationId=${deliberationId}&limit=500`,
    fetcher
  );

  // Fetch legal moves - only if targetId is set
  const { data: legalMovesData } = useSWR(
    targetId
      ? `/api/dialogue/legal-moves?deliberationId=${deliberationId}&targetType=${targetType}&targetId=${targetId}&locusPath=${locusPath}`
      : null,
    fetcher
  );

  // Fetch CQs (if target is a claim) - only if targetId is set
  const { data: cqsData } = useSWR(
    targetId && targetType === "claim" ? `/api/cqs?targetType=claim&targetId=${targetId}` : null,
    fetcher
  );

  // Fetch CQ attachments - only if targetId is set
  const { data: attachmentsData } = useSWR(
    targetId && targetType === "claim" ? `/api/cqs/attachments?targetType=claim&targetId=${targetId}` : null,
    fetcher
  );

  // Filter moves related to this target
  const targetMoves = React.useMemo(() => {
    if (!movesData?.items) return [];
    return movesData.items.filter(
      (m: any) => m.targetId === targetId || m.payload?.targetId === targetId
    );
  }, [movesData, targetId]);

  // Detect active SUPPOSE scope
  const activeSupposition = React.useMemo(() => {
    if (!movesData?.items) return null;
    
    // Find all SUPPOSE moves at this locus
    const supposes = movesData.items.filter(
      (m: any) => 
        m.kind === "SUPPOSE" && 
        m.targetId === targetId &&
        (m.payload?.locusPath === locusPath || (!m.payload?.locusPath && locusPath === "0"))
    );

    if (supposes.length === 0) return null;

    // Get most recent SUPPOSE
    const mostRecentSuppose = supposes.sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    // Check if it's been discharged
    const discharges = movesData.items.filter(
      (m: any) =>
        m.kind === "DISCHARGE" &&
        m.targetId === targetId &&
        (m.payload?.locusPath === locusPath || (!m.payload?.locusPath && locusPath === "0")) &&
        new Date(m.createdAt) > new Date(mostRecentSuppose.createdAt)
    );

    if (discharges.length > 0) return null; // Scope has been closed

    // Extract expression from payload
    const expression = mostRecentSuppose.payload?.expression || "Hypothetical assumption";

    return {
      id: mostRecentSuppose.id,
      expression,
      locusPath: mostRecentSuppose.payload?.locusPath || "0",
      createdAt: mostRecentSuppose.createdAt,
    };
  }, [movesData, targetId, locusPath]);

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="dialogue-inspector border border-indigo-500 rounded-lg bg-white/30 backdrop-blur-md h-full shadow-lg p-4 mt-2 mb-0">
      {/* Header */}
      <div className="border-b border-indigo-300 pb-3 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
               Dialogue Inspector
              {targetId && (
                <span className="text-xs font-mono bg-indigo-100 px-2 py-1 rounded">
                  {targetType}:{targetId.slice(-8)}
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              Deliberation: <span className="font-mono">{deliberationId.slice(-8)}</span> | Locus: <span className="font-mono">{locusPath}</span>
            </p>
          </div>
          
          {/* Claim Selector Button */}
          <button
            onClick={() => setClaimPickerOpen(true)}
            className="px-3 py-2 btnv2 bg-indigo-300/70 hover:bg-indigo-400/70 text-indigo-700 rounded-lg text-sm font-medium transition-colors "
          >
            {targetId ? "Change Claim" : "Select Claim"}
          </button>
        </div>
        
        {!targetId && (
          <div className="mt-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-sm text-emerald-800">
              Click <strong>&ldquo;Select Claim&rdquo;</strong> to choose a claim and view its dialogue state
            </p>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        {[
          { id: "overview", label: "📊 Overview" },
          { id: "moves", label: "💬 Moves" },
          { id: "legal", label: "⚖️ Legal Actions" },
          { id: "cqs", label: "❓ Critical Questions" },
          { id: "raw", label: "🔧 Metadata" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "text-indigo-700 border-b-2 border-indigo-700"
                : "text-gray-600 hover:text-indigo-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {!targetId ? (
          <div className="text-center py-12">
            
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Claim Selected</h3>
            <p className="text-sm text-gray-600 mb-4">
              Select a claim using the button above to inspect its dialogue state
            </p>
            <button
              onClick={() => setClaimPickerOpen(true)}
            className="px-3 py-2 btnv2 bg-indigo-300/70 hover:bg-indigo-400/70 text-indigo-700 rounded-lg text-sm font-medium transition-colors "
            >
              Select Claim
            </button>
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                {/* Active Supposition Banner */}
                {activeSupposition && (
                  <SuppositionBanner
                suppositionText={activeSupposition.expression}
                locusPath={activeSupposition.locusPath}
              />
            )}

            {/* Target Info */}
            <Section title="🎯 Target" defaultExpanded>
              <InfoRow label="Type" value={targetType} />
              <InfoRow label="ID" value={targetId} mono />
              {targetData && (
                <>
                  <InfoRow label="Text" value={targetData.text || targetData.claim?.text || "N/A"} />
                  {targetType === "argument" && (
                    <>
                      <InfoRow
                        label="Conclusion Claim"
                        value={targetData.conclusionClaimId || "N/A"}
                        mono
                      />
                      <InfoRow label="Scheme" value={targetData.scheme?.name || "None"} />
                    </>
                  )}
                  {targetType === "claim" && (
                    <>
                      <InfoRow label="Deliberation" value={targetData.deliberationId?.slice(-8) || "N/A"} mono />
                      <InfoRow label="Created" value={new Date(targetData.createdAt).toLocaleString()} />
                    </>
                  )}
                </>
              )}
            </Section>

            {/* Quick Stats */}
            <Section title="📈 Quick Stats">
              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  label="Dialogue Moves"
                  value={targetMoves.length}
                  color="sky"
                />
                <StatCard
                  label="Legal Actions"
                  value={legalMovesData?.moves?.filter((m: any) => !m.disabled).length || 0}
                  color="green"
                />
                <StatCard
                  label="Critical Questions"
                  value={(() => {
                    if (!cqsData?.schemes) return 0;
                    return cqsData.schemes.reduce((sum: number, scheme: any) => sum + (scheme.cqs?.length || 0), 0);
                  })()}
                  color="amber"
                />
                <StatCard
                  label="Open CQs"
                  value={(() => {
                    if (!cqsData?.schemes) return 0;
                    return cqsData.schemes.reduce((sum: number, scheme: any) => {
                      return sum + (scheme.cqs?.filter((cq: any) => !cq.satisfied).length || 0);
                    }, 0);
                  })()}
                  color="rose"
                />
              </div>
            </Section>

            {/* Latest Activity */}
            <Section title="⏱️ Latest Activity">
              {targetMoves.slice(0, 5).map((move: any, idx: number) => (
                <div key={idx} className="flex items-start gap-2 p-2 bg-gray-50 rounded mb-2">
                  <span className="text-xs font-mono bg-sky-100 px-2 py-1 rounded">
                    {move.kind}
                  </span>
                  <div className="flex-1 text-sm">
                    <div className="font-medium text-gray-700">
                      {move.payload?.expression || move.payload?.brief || "No content"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(move.createdAt).toLocaleString()} | Actor: {move.actorId.slice(-6)}
                    </div>
                  </div>
                </div>
              ))}
              {targetMoves.length === 0 && (
                <p className="text-sm text-gray-500 italic">No moves yet</p>
              )}
            </Section>
          </div>
        )}

        {/* MOVES TAB */}
        {activeTab === "moves" && (
          <div className="space-y-3">
            {/* Active Supposition Banner */}
            {activeSupposition && (
              <SuppositionBanner
                suppositionText={activeSupposition.expression}
                locusPath={activeSupposition.locusPath}
              />
            )}

            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-gray-700">
                All Moves ({targetMoves.length})
              </h3>
              <button
                onClick={() => window.location.reload()}
                className="text-xs px-2 py-1 bg-sky-100 hover:bg-sky-200 rounded"
              >
                🔄 Refresh
              </button>
            </div>

            {/* Categorize moves: before supposition, inside supposition, after discharge */}
            {activeSupposition ? (
              <>
                {/* Moves before SUPPOSE */}
                {targetMoves
                  .filter((m: any) => new Date(m.createdAt) < new Date(activeSupposition.createdAt))
                  .map((move: any, idx: number) => (
                    <MoveCard key={move.id} move={move} index={idx} />
                  ))}

                {/* SUPPOSE marker */}
                <div className="p-3 bg-indigo-100 border-l-4 border-indigo-500 rounded-r">
                  <div className="text-xs font-semibold text-indigo-900">
                    📍 SUPPOSE: {activeSupposition.expression}
                  </div>
                  <div className="text-[10px] text-indigo-700 mt-1">
                    Opened: {new Date(activeSupposition.createdAt).toLocaleString()}
                  </div>
                </div>

                {/* Nested moves inside supposition */}
                <NestedMoveContainer level={1}>
                  {targetMoves
                    .filter((m: any) => new Date(m.createdAt) >= new Date(activeSupposition.createdAt))
                    .map((move: any, idx: number) => (
                      <MoveCard key={move.id} move={move} index={idx} isNested />
                    ))}
                </NestedMoveContainer>
              </>
            ) : (
              /* No active supposition - show all moves normally */
              targetMoves.map((move: any, idx: number) => (
                <MoveCard key={move.id} move={move} index={idx} />
              ))
            )}
            {targetMoves.length === 0 && (
              <EmptyState message="No dialogue moves for this target yet" />
            )}
          </div>
        )}

        {/* LEGAL ACTIONS TAB */}
        {activeTab === "legal" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-gray-700">
                Legal Moves ({legalMovesData?.moves?.length || 0})
              </h3>
              <div className="text-xs text-gray-500">
                Available: {legalMovesData?.moves?.filter((m: any) => !m.disabled).length || 0} |
                Disabled: {legalMovesData?.moves?.filter((m: any) => m.disabled).length || 0}
              </div>
            </div>
            {legalMovesData?.moves?.map((move: any, idx: number) => (
              <LegalMoveCard key={idx} move={move} />
            ))}
            {!legalMovesData?.moves?.length && (
              <EmptyState message="No legal moves computed yet" />
            )}
          </div>
        )}

        {/* CQS TAB */}
        {activeTab === "cqs" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-gray-700">
                Critical Questions (
                {cqsData?.schemes
                  ? cqsData.schemes.reduce((sum: number, s: any) => sum + (s.cqs?.length || 0), 0)
                  : 0}
                )
              </h3>
              {targetType !== "claim" && (
                <p className="text-xs text-amber-600">⚠️ CQs only available for claims</p>
              )}
            </div>
            {cqsData?.schemes?.map((scheme: any) =>
              scheme.cqs?.map((cq: any, idx: number) => (
                <CQCard
                  key={`${scheme.key}-${cq.key}`}
                  cq={{ ...cq, schemeKey: scheme.key, schemeTitle: scheme.title }}
                  attachments={attachmentsData?.attachments || []}
                />
              ))
            )}
            {targetType === "claim" &&
              cqsData?.schemes &&
              cqsData.schemes.every((s: any) => !s.cqs || s.cqs.length === 0) && (
                <EmptyState message="No critical questions for this claim" />
              )}
          </div>
        )}

        {/* RAW DATA TAB */}
        {activeTab === "raw" && (
          <div className="space-y-4">
            <RawDataSection title="Target Data" data={targetData} />
            <RawDataSection
              title={`Moves Data (${targetMoves.length} for this target, ${movesData?.items?.length || 0} total)`}
              data={{ moves: targetMoves, total: movesData?.items?.length }}
            />
            <RawDataSection title="Legal Moves Data" data={legalMovesData} />
            <RawDataSection title="CQs Data" data={cqsData} />
            <RawDataSection title="Attachments Data" data={attachmentsData} />
          </div>
        )}
          </>
        )}
      </div>

      {/* Claim Picker for selection/navigation */}
      <ClaimPicker
        deliberationId={deliberationId}
        open={claimPickerOpen}
        onClose={() => setClaimPickerOpen(false)}
        onPick={(claim) => {
          // Update selected claim
          setTargetType("claim");
          setTargetId(claim.id);
          setLocusPath("0"); // Reset to root locus
          setClaimPickerOpen(false);
        }}
      />
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function Section({
  title,
  children,
  defaultExpanded = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 bg-gray-50 hover:bg-gray-100 text-left font-semibold text-sm text-gray-700 flex items-center justify-between"
      >
        {title}
        <span className="text-gray-400">{isExpanded ? "▼" : "▶"}</span>
      </button>
      {isExpanded && <div className="p-4 space-y-2">{children}</div>}
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-start text-sm">
      <span className="font-medium text-gray-600 min-w-[120px]">{label}:</span>
      <span className={`text-gray-900 text-right flex-1 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "sky" | "green" | "amber" | "rose";
}) {
  const colorClasses = {
    sky: "bg-sky-50 border-sky-200 text-sky-900",
    green: "bg-green-50 border-green-200 text-green-900",
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    rose: "bg-rose-50 border-rose-200 text-rose-900",
  };

  return (
    <div className={`border rounded-lg p-3 ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-1">{label}</div>
    </div>
  );
}

function MoveCard({ move, index, isNested = false }: { move: any; index: number; isNested?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const forceIcons: Record<string, string> = {
    ATTACK: "⚔️",
    SURRENDER: "🏳️",
    NEUTRAL: "●",
  };
  const forceIcon = forceIcons[move.payload?.force || "NEUTRAL"] || "●";

  // Highlight SUPPOSE and DISCHARGE moves
  const isStructural = move.kind === "SUPPOSE" || move.kind === "DISCHARGE";
  const bgClass = isStructural 
    ? "bg-indigo-50 hover:bg-indigo-100" 
    : isNested 
    ? "bg-slate-50 hover:bg-slate-100"
    : "bg-gray-50 hover:bg-gray-100";

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full px-3 py-2 ${bgClass} text-left flex items-center justify-between`}
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono px-2 py-1 rounded ${
            isStructural ? "bg-indigo-200 text-indigo-900" : "bg-indigo-100"
          }`}>
            #{index + 1} {move.kind}
          </span>
          <span className="text-sm">{forceIcon}</span>
          <span className="text-xs text-gray-600 font-mono">
            {move.id.slice(-8)}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {new Date(move.createdAt).toLocaleTimeString()}
        </span>
      </button>
      {expanded && (
        <div className="p-3 bg-white space-y-2 text-sm">
          <div>
            <span className="font-semibold">Expression:</span>{" "}
            {move.payload?.expression || move.payload?.brief || "N/A"}
          </div>
          <div>
            <span className="font-semibold">Locus:</span>{" "}
            <code>{move.payload?.locusPath || "0"}</code>
          </div>
          <div>
            <span className="font-semibold">Actor:</span>{" "}
            <code>{move.actorId}</code>
          </div>
          {move.payload?.cqId && (
            <div>
              <span className="font-semibold">CQ ID:</span>{" "}
              <code>{move.payload.cqId}</code>
            </div>
          )}
          {move.signature && (
            <div>
              <span className="font-semibold">Signature:</span>{" "}
              <code className="text-xs break-all">{move.signature}</code>
            </div>
          )}
          {move.payload?.acts && (
            <div>
              <span className="font-semibold">Acts:</span>
              <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                {JSON.stringify(move.payload.acts, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LegalMoveCard({ move }: { move: any }) {
  const forceIcons: Record<string, string> = {
    ATTACK: "⚔️",
    SURRENDER: "🏳️",
    NEUTRAL: "●",
  };
  const forceIcon = forceIcons[move.force] || "●";

  const relevanceColor = move.relevance === "likely" ? "text-green-600" : move.relevance === "unlikely" ? "text-amber-600" : "text-gray-400";

  return (
    <div
      className={`border rounded-lg p-3 ${
        move.disabled ? "bg-gray-50 opacity-60" : "bg-white"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm font-semibold">{move.kind}</span>
            <span>{forceIcon}</span>
            {move.relevance && (
              <span className={`text-xs ${relevanceColor}`}>
                {move.relevance === "likely" ? "●" : "○"}
              </span>
            )}
            {move.disabled && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                DISABLED
              </span>
            )}
          </div>
          <div className="text-sm text-gray-700">{move.label}</div>
          {move.reason && (
            <div className="text-xs text-gray-500 italic mt-1">{move.reason}</div>
          )}
          {move.payload && (
            <div className="text-xs text-gray-600 mt-2">
              <span className="font-semibold">Payload:</span>{" "}
              <code>{JSON.stringify(move.payload).slice(0, 100)}...</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CQCard({ cq, attachments }: { cq: any; attachments: any[] }) {
  const attachment = attachments.find((a) => a.cqKey === cq.key);
  const isAnswered = cq.satisfied || attachment?.status === "answered";

  return (
    <div
      className={`border rounded-lg p-3 ${
        isAnswered ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs bg-white px-2 py-1 rounded">
            {cq.key}
          </span>
          <span className="text-xs">
            {isAnswered ? "✅" : "⏳"}
          </span>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded ${
            isAnswered
              ? "bg-green-200 text-green-800"
              : "bg-amber-200 text-amber-800"
          }`}
        >
          {isAnswered ? "Answered" : "Open"}
        </span>
      </div>
      <div className="text-sm text-gray-900 font-medium mb-1">
        {cq.question}
      </div>
      {cq.description && (
        <div className="text-xs text-gray-600">{cq.description}</div>
      )}
      {attachment && (
        <div className="text-xs text-gray-500 mt-2">
          <span className="font-semibold">Attached:</span> {attachment.claimId?.slice(-8) || "N/A"}
        </div>
      )}
    </div>
  );
}

function RawDataSection({ title, data }: { title: string; data: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-left font-mono text-sm font-semibold flex items-center justify-between"
      >
        {title}
        <span className="text-gray-400">{expanded ? "▼" : "▶"}</span>
      </button>
      {expanded && (
        <div className="p-3 bg-gray-50">
          <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-8 text-gray-500 italic">
      <div className="text-4xl mb-2">📭</div>
      {message}
    </div>
  );
}
