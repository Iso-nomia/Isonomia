"use client";

import React, { memo, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { ChainNodeData } from "@/lib/types/argumentChain";
import { Network, Info, Plus, ThumbsUp, Swords, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EpistemicStatusIcon } from "@/components/chains/EpistemicStatusBadge";
import { ScopeBoundaryMini } from "@/components/chains/ScopeBoundary";
import { EPISTEMIC_STATUS_CONFIG, type EpistemicStatus, type ScopeType } from "@/lib/types/argumentChain";

interface ExtendedChainNodeData extends ChainNodeData {
  isEditable?: boolean;
  onSupport?: (nodeId: string, argumentId: string, conclusionText?: string) => void;
  onAttack?: (
    nodeId: string, 
    argumentId: string, 
    conclusionId?: string,
    conclusionText?: string,
    attackType?: "REBUTS" | "UNDERCUTS" | "UNDERMINES"
  ) => void;
}

interface ArgumentChainNodeProps extends NodeProps<Node<ExtendedChainNodeData>> {}

const roleColors: Record<string, string> = {
  PREMISE: "border-sky-500",
  EVIDENCE: "border-teal-500",
  CONCLUSION: "border-green-500",
  OBJECTION: "border-red-500",
  REBUTTAL: "border-orange-500",
  QUALIFIER: "border-purple-500",
  COMMENT: "border-gray-400",
};

const roleBgColors: Record<string, string> = {
  PREMISE: "bg-sky-100 text-sky-800",
  EVIDENCE: "bg-teal-100 text-teal-800",
  CONCLUSION: "bg-green-100 text-green-800",
  OBJECTION: "bg-red-100 text-red-800",
  REBUTTAL: "bg-orange-100 text-orange-800",
  QUALIFIER: "bg-purple-100 text-purple-800",
  COMMENT: "bg-gray-100 text-gray-600",
};

const ArgumentChainNode: React.FC<ArgumentChainNodeProps> = ({ id, data, selected }) => {
  const role = data.role || "PREMISE";
  const borderColor = roleColors[role] || "border-gray-400";
  const badgeColor = roleBgColors[role] || "bg-gray-100 text-gray-800";
  const isHighlighted = data.isHighlighted || false;
  const isEditable = data.isEditable ?? true;
  const [showSchemeNetDetails, setShowSchemeNetDetails] = useState(false);
  const [showActions, setShowActions] = useState(false);

  // Epistemic status styling
  const epistemicStatus = (data.epistemicStatus || "ASSERTED") as EpistemicStatus;
  const epistemicConfig = EPISTEMIC_STATUS_CONFIG[epistemicStatus];
  const isHypothetical = epistemicStatus !== "ASSERTED";

  // Check for multi-scheme structure
  const hasSchemeNet = data.argument.schemeNet !== null && data.argument.schemeNet !== undefined;
  const multipleSchemes = data.argument.argumentSchemes?.length > 1;
  const schemeCount = data.argument.argumentSchemes?.length || 0;
  const hasSchemeNetSteps = hasSchemeNet && (data.argument.schemeNet?.steps?.length ?? 0) > 0;

  const showSchemeNetIndicator = hasSchemeNet && (hasSchemeNetSteps || multipleSchemes);

  // Get conclusion text for context
  const conclusionText = data.argument.conclusion?.text || data.argument.text?.substring(0, 100);
  const conclusionId = data.argument.conclusion?.id;

  // Handle support action
  const handleSupport = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onSupport) {
      data.onSupport(id, data.argument.id, conclusionText);
    }
  };

  // Handle attack actions
  const handleAttack = (e: React.MouseEvent, attackType: "REBUTS" | "UNDERCUTS" | "UNDERMINES") => {
    e.stopPropagation();
    if (data.onAttack) {
      data.onAttack(id, data.argument.id, conclusionId, conclusionText, attackType);
    }
  };

  return (
    <div
      className={`
        relative w-[280px] rounded-lg shadow-md border-l-4 ${borderColor}
        ${selected ? "ring-2 ring-sky-400 shadow-lg" : ""}
        ${isHighlighted ? "ring-4 ring-yellow-400 shadow-xl animate-pulse" : ""}
        transition-all duration-200
      `}
      style={{
        backgroundColor: isHypothetical ? epistemicConfig.bgColor : "white",
        borderStyle: epistemicConfig.borderStyle,
        borderRightWidth: isHypothetical ? "2px" : undefined,
        borderTopWidth: isHypothetical ? "2px" : undefined,
        borderBottomWidth: isHypothetical ? "2px" : undefined,
        borderRightColor: isHypothetical ? epistemicConfig.color : undefined,
        borderTopColor: isHypothetical ? epistemicConfig.color : undefined,
        borderBottomColor: isHypothetical ? epistemicConfig.color : undefined,
      }}
    >
      {/* Top Handle */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Role Badge, Epistemic Status, SchemeNet Indicator, and Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={`px-2 py-1 text-xs font-semibold rounded ${badgeColor}`}>
              {role}
            </span>
            {/* Epistemic Status Indicator */}
            {isHypothetical && (
              <EpistemicStatusIcon status={epistemicStatus} size={14} />
            )}
            {showSchemeNetIndicator && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSchemeNetDetails(!showSchemeNetDetails);
                }}
                className="relative group"
                title="Multi-scheme argument"
              >
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded border border-purple-300 hover:bg-purple-200 transition-colors">
                  <Network className="w-3 h-3" />
                  <span className="text-[10px] font-semibold">{schemeCount}</span>
                </div>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {data.nodeOrder !== undefined && (
              <span className="text-xs text-gray-500 font-mono">#{data.nodeOrder}</span>
            )}
            {/* Action Menu */}
            {isEditable && (data.onSupport || data.onAttack) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                    title="Actions"
                  >
                    <MoreHorizontal className="w-4 h-4 text-gray-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-xs text-gray-500">
                    Respond to this argument
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {data.onSupport && (
                    <DropdownMenuItem onClick={handleSupport} className="gap-2 cursor-pointer">
                      <ThumbsUp className="w-4 h-4 text-green-600" />
                      <span>Create Supporting Argument</span>
                    </DropdownMenuItem>
                  )}
                  {data.onAttack && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-gray-500">
                        Attack Types
                      </DropdownMenuLabel>
                      <DropdownMenuItem 
                        onClick={(e) => handleAttack(e, "REBUTS")} 
                        className="gap-2 cursor-pointer"
                      >
                        <Swords className="w-4 h-4 text-red-600" />
                        <div className="flex flex-col">
                          <span>Rebut (attack conclusion)</span>
                          <span className="text-[10px] text-gray-500">Deny or contradict the conclusion</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => handleAttack(e, "UNDERMINES")} 
                        className="gap-2 cursor-pointer"
                      >
                        <Swords className="w-4 h-4 text-orange-600" />
                        <div className="flex flex-col">
                          <span>Undermine (attack premise)</span>
                          <span className="text-[10px] text-gray-500">Challenge a supporting premise</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => handleAttack(e, "UNDERCUTS")} 
                        className="gap-2 cursor-pointer"
                      >
                        <Swords className="w-4 h-4 text-purple-600" />
                        <div className="flex flex-col">
                          <span>Undercut (attack inference)</span>
                          <span className="text-[10px] text-gray-500">Challenge the reasoning link</span>
                        </div>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Argument Preview */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-gray-800 line-clamp-2">
            {data.argument.conclusion?.text || data.argument.text?.substring(0, 100) || "No conclusion"}
          </h4>
          {data.argument.text && data.argument.conclusion?.text && (
            <p className="text-xs text-gray-600 line-clamp-2">{data.argument.text}</p>
          )}
        </div>

        {/* Contributor */}
        {data.addedBy && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500">Added by:</span>
            <span className="text-[10px] font-medium text-gray-700">
              {data.addedBy.name || "Unknown"}
            </span>
          </div>
        )}

        {/* Scope Membership Indicator */}
        {data.scope && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100">
            <span className="text-[10px] text-gray-500">In scope:</span>
            <ScopeBoundaryMini
              scopeType={data.scope.scopeType as ScopeType}
              assumption={data.scope.assumption}
              color={data.scope.color || undefined}
            />
          </div>
        )}

        {/* SchemeNet Details Popover */}
        {showSchemeNetDetails && showSchemeNetIndicator && (
          <div 
            className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-xl border-2 border-purple-200 z-50 p-3 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-purple-600" />
                <h4 className="text-sm font-semibold text-gray-800">Multi-Scheme Structure</h4>
              </div>
              <button
                onClick={() => setShowSchemeNetDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            {/* Schemes List */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-gray-600">
                Schemes ({schemeCount}):
              </div>
              {data.argument.argumentSchemes?.map((argScheme: any, idx: number) => (
                <div key={argScheme.id} className="flex items-start gap-2 bg-gray-50 rounded p-2">
                  <span className="text-[10px] font-mono text-gray-500 mt-0.5">#{idx + 1}</span>
                  <div className="flex-1 space-y-0.5">
                    <div className="text-xs font-medium text-gray-800">
                      {argScheme.scheme?.name || "Unknown Scheme"}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                        argScheme.isPrimary 
                          ? "bg-sky-100 text-sky-700" 
                          : argScheme.role === "supporting"
                          ? "bg-green-100 text-green-700"
                          : "bg-purple-100 text-purple-700"
                      }`}>
                        {argScheme.role || "primary"}
                      </span>
                      <span className="text-[9px] text-gray-500">
                        {Math.round(argScheme.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* SchemeNet Info */}
            {hasSchemeNet && data.argument.schemeNet && (
              <div className="space-y-1.5 pt-2 border-t">
                <div className="text-xs font-medium text-gray-600">
                  SchemeNet:
                </div>
                <div className="bg-purple-50 rounded p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-600">Overall Confidence:</span>
                    <span className="text-[10px] font-semibold text-purple-700">
                      {Math.round(data.argument.schemeNet.overallConfidence * 100)}%
                    </span>
                  </div>
                  {data.argument.schemeNet.description && (
                    <div className="text-[10px] text-gray-700 italic line-clamp-2">
                      {typeof data.argument.schemeNet.description === 'string' 
                        ? data.argument.schemeNet.description 
                        : JSON.stringify(data.argument.schemeNet.description)}
                    </div>
                  )}
                  {hasSchemeNetSteps && (
                    <div className="text-[10px] text-gray-600">
                      {data.argument.schemeNet.steps.length} sequential steps
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Help Text */}
            <div className="flex items-start gap-1.5 text-[10px] text-gray-500 pt-1 border-t">
              <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>
                This argument uses multiple argumentation schemes in a coordinated structure,
                indicating complex reasoning.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />

      {/* Left Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />

      {/* Right Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
    </div>
  );
};

export default memo(ArgumentChainNode);
