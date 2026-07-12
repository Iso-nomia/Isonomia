/**
 * ArgumentNetworkCard Component
 * 
 * Individual argument card in debate sheet grid with:
 * - Argument text/title
 * - AIF metadata badges (scheme, CQ status, attacks, preferences)
 * - Support bar visualization
 * - Action buttons (preview, actions, expand)
 * - Acceptance label
 * 
 * Part of Phase 2: Component Structure Refactor
 */

"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Waypoints } from "lucide-react";
import { SchemeBadge } from "@/components/aif/SchemeBadge";
import { CQStatusIndicator } from "@/components/aif/CQStatusIndicator";
import { AttackBadge } from "@/components/aif/AttackBadge";
import { PreferenceBadge } from "@/components/aif/PreferenceBadge";

export interface ArgumentNode {
  id: string;
  argumentId?: string;
  title?: string;
  claimId?: string;
  diagramId?: string;
  [key: string]: any;
}

export interface SupportValue {
  kind: "scalar" | "ds";
  s?: number; // scalar value
  bel?: number; // DS belief
  pl?: number; // DS plausibility
  /** Sprint C4: cross-room transport band. When present, the scalar bar
   *  splits into a local fill + a hatched imported overlay. */
  band?: { local: number; imported: number; total: number };
}

export interface ArgumentNetworkCardProps {
  /** The argument node data */
  node: ArgumentNode;
  
  /** AIF metadata for this argument */
  aif: any | null;
  
  /** Acceptance label */
  label: "accepted" | "rejected" | "undecided";
  
  /** Support value for visualization */
  supportValue?: SupportValue | null;
  
  /** Support score (0-1) for display */
  supportScore?: number;
  
  /** Number of edges connected to this node */
  edgeCount: number;
  
  /** Handler for preview button click */
  onPreview: (nodeId: string) => void;
  
  /** Handler for actions button click */
  onActions: (node: ArgumentNode) => void;
  
  /** Handler for expand button click */
  onExpand: (nodeId: string) => void;
  
  /** Handler for view contributing arguments */
  onViewContributing: (claimId: string) => void;
  
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Argument card component for debate sheet grid
 */
export function ArgumentNetworkCard({
  node,
  aif,
  label,
  supportValue,
  supportScore,
  edgeCount,
  onPreview,
  onActions,
  onExpand,
  onViewContributing,
  className,
}: ArgumentNetworkCardProps) {
  return (
    <li className={`panelv2 panelv2--aurora panelv2--nohover px-4 py-3 relative transition-all  ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="font-medium text-sm mb-2">{node.title ?? node.id}</div>
          
          {/* Metadata badges */}
          <div className="flex flex-wrap gap-1 mb-2">
            {aif?.scheme && (
              <SchemeBadge schemeKey={aif.scheme.key} schemeName={aif.scheme.name} />
            )}
            {aif?.cq && (
              <CQStatusIndicator required={aif.cq.required} satisfied={aif.cq.satisfied} />
            )}
            {aif?.attacks && <AttackBadge attacks={aif.attacks} />}
            {aif?.preferences && (
              <PreferenceBadge
                preferredBy={aif.preferences.preferredBy}
                dispreferredBy={aif.preferences.dispreferredBy}
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Preview toggle button */}
          {node.argumentId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreview(node.id);
              }}
              className="p-1.5 rounded-lg border transition-all bg-white border-gray-300 text-gray-500 hover:bg-gray-50 hover:border-gray-400"
              title="View AIF neighborhood"
            >
              <Waypoints className="w-4 h-4" />
            </button>
          )}
          
          <button
            onClick={() => onActions(node)}
            className="btnv2--ghost text-xs rounded-lg p-2 bg-white"
          >
            <span>Actions</span>
          </button>

          <Badge
            variant={
              label === "accepted"
                ? "secondary"
                : label === "rejected"
                  ? "destructive"
                  : "outline"
            }
            className="text-[10px] shrink-0"
          >
            {label}
          </Badge>
        </div>
      </div>

      {/* Support visualization */}
      <div className="cursor-pointer space-y-3 hover:opacity-80 transition-opacity">
        
        
        {supportValue && supportValue.kind === "ds" && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-[11px] text-neutral-600 mb-0.5 gap-1">
              <span>Belief:</span>
              <span>
                {typeof supportValue.bel === "number"
                  ? (supportValue.bel * 100).toFixed(0) + "%"
                  : "N/A"}
              </span>
            </div>
            <div className="h-1.5 bg-neutral-200 rounded">
              <div
                className="h-1.5 rounded bg-emerald-500 transition-all"
                style={{ width: `${Math.max(0, Math.min(1, supportValue.bel ?? 0)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {typeof supportScore === "number" && (() => {
          const band = supportValue?.kind === "scalar" ? supportValue.band : undefined;
          const showBand = !!band && band.total > band.local;
          const localPct = showBand ? Math.max(0, Math.min(1, band!.local)) * 100 : 0;
          const totalPct = showBand ? Math.max(0, Math.min(1, band!.total)) * 100 : 0;
          return (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[11px] text-neutral-600 mb-0.5">
                <span>Support{showBand ? " (local + imported)" : ""}</span>
                {showBand ? (
                  <span title={`local ${localPct.toFixed(0)}% + imported delta ${(totalPct - localPct).toFixed(0)}%`}>
                    {localPct.toFixed(0)}% + {(totalPct - localPct).toFixed(0)}% → {totalPct.toFixed(0)}%
                  </span>
                ) : (
                  <span>{(supportScore * 100).toFixed(0)}%</span>
                )}
              </div>
              <div className="h-1.5 bg-neutral-200 rounded relative overflow-hidden mt-1.5">
                {showBand ? (
                  <>
                    <div
                      className="h-1.5 rounded-l bg-emerald-500 transition-all"
                      style={{ width: `${localPct}%` }}
                      title={`Local: ${localPct.toFixed(1)}%`}
                    />
                    <div
                      className="h-1.5 absolute top-0 bg-sky-400/70"
                      style={{
                        left: `${localPct}%`,
                        width: `${totalPct - localPct}%`,
                        backgroundImage:
                          "repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 5px)",
                      }}
                      title={`Imported (cross-room): +${(totalPct - localPct).toFixed(1)}% (raw imported ${(band!.imported * 100).toFixed(1)}%)`}
                    />
                  </>
                ) : (
                  <div
                    className="h-1.5 rounded bg-emerald-500 transition-all"
                    style={{ width: `${Math.max(0, Math.min(1, supportScore)) * 100}%` }}
                  />
                )}
              </div>
            </div>
          );
        })()}

        {/* Action links */}
        <div className="justify-end items-end align-end mt-auto text-xs flex gap-3">
          <button
            className="underline disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onExpand(node.id)}
            disabled={!node.diagramId && !node.argumentId}
          >
            Expand
          </button>
          
          {node.claimId && (
            <button className="underline" onClick={() => onViewContributing(node.claimId!)}>
              View contributing arguments
            </button>
          )}
          
          <span className="text-neutral-500">Edges: {edgeCount}</span>
        </div>
      </div>
    </li>
  );
}
