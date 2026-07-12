"use client";

import React, { memo, useState } from "react";
import { NodeProps, type Node } from "@xyflow/react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SCOPE_TYPE_CONFIG, type ScopeType } from "@/lib/types/argumentChain";
import {
  HelpCircle,
  GitBranch,
  ArrowRightCircle,
  User2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Plus,
  MoreHorizontal,
  LucideIcon,
} from "lucide-react";

const scopeIconMap: Record<ScopeType, LucideIcon> = {
  HYPOTHETICAL: HelpCircle,
  COUNTERFACTUAL: GitBranch,
  CONDITIONAL: ArrowRightCircle,
  OPPONENT: User2,
  MODAL: Sparkles,
};

export interface ScopeBoundaryData extends Record<string, unknown> {
  id: string;
  scopeType: ScopeType;
  assumption: string;
  description?: string;
  color?: string;
  collapsed?: boolean;
  nodeCount: number;
  depth?: number;
  parentScopeId?: string;
  // Visual state
  isDragOver?: boolean;
  isHypotheticalMode?: boolean;
  // Actions
  onEdit?: (scopeId: string) => void;
  onDelete?: (scopeId: string) => void;
  onAddNode?: (scopeId: string) => void;
  onToggleCollapse?: (scopeId: string) => void;
  onEnterMode?: (scopeId: string) => void;
}

interface ScopeBoundaryProps extends NodeProps<Node<ScopeBoundaryData>> {}

/**
 * ScopeBoundary - A ReactFlow group node that visually contains hypothetical/counterfactual arguments
 * 
 * This renders as a colored boundary box with:
 * - Header showing scope type icon, assumption text
 * - Collapse/expand functionality
 * - Actions menu (edit, delete, add node)
 * - Visual nesting indication via depth
 */
const ScopeBoundary: React.FC<ScopeBoundaryProps> = ({ id, data, selected }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const config = SCOPE_TYPE_CONFIG[data.scopeType];
  const Icon = scopeIconMap[data.scopeType];
  const color = data.color || config.color;
  const isCollapsed = data.collapsed ?? false;
  const depth = data.depth ?? 0;
  const isDragOver = data.isDragOver ?? false;
  const isHypotheticalMode = data.isHypotheticalMode ?? false;

  // Calculate visual properties based on depth
  const borderWidth = isDragOver ? 3 : Math.max(2, 3 - depth * 0.5);
  const headerOpacity = Math.max(0.7, 1 - depth * 0.1);

  return (
    <div
      className={cn(
        "relative min-w-[320px] min-h-[200px] rounded-xl transition-all duration-200",
        selected && "ring-2 ring-offset-2",
        isCollapsed && "min-h-[60px]",
        isDragOver && "ring-4 ring-offset-2",
        isHypotheticalMode && "shadow-lg"
      )}
      style={{
        backgroundColor: isDragOver ? `${color}15` : `${color}08`,
        borderWidth: `${borderWidth}px`,
        borderStyle: isDragOver ? "solid" : config.borderStyle,
        borderColor: color,
        ...(selected && { ringColor: color }),
        ...(isDragOver && { ringColor: `${color}60` }),
        ...(isHypotheticalMode && { boxShadow: `0 0 20px ${color}40` }),
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Scope Header */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-t-xl border-b"
        style={{
          backgroundColor: `${color}15`,
          borderColor: `${color}30`,
          opacity: headerOpacity,
        }}
      >
        {/* Left: Icon, Type, Assumption */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Collapse Toggle */}
          {data.onToggleCollapse && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onToggleCollapse?.(id);
              }}
              className="p-0.5 rounded hover:bg-black/10 transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight size={16} style={{ color }} />
              ) : (
                <ChevronDown size={16} style={{ color }} />
              )}
            </button>
          )}
          
          {/* Scope Type Icon */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex items-center justify-center w-6 h-6 rounded-full shrink-0"
                  style={{ backgroundColor: `${color}25` }}
                >
                  <Icon size={14} style={{ color }} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="font-medium">{config.label}</p>
                <p className="text-xs text-muted-foreground">{config.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Assumption Text */}
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color }}
              title={data.assumption}
            >
              {data.assumption}
            </p>
            {!isCollapsed && data.description && (
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {data.description}
              </p>
            )}
          </div>
        </div>

        {/* Right: Mode indicator, Node Count & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Active Mode Indicator */}
          {isHypotheticalMode && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse"
              style={{
                backgroundColor: color,
                color: "white",
              }}
            >
              ACTIVE
            </span>
          )}
          
          {/* Drag Over Indicator */}
          {isDragOver && (
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${color}30`,
                color,
              }}
            >
              Drop here
            </span>
          )}
          
          {/* Node Count */}
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: `${color}20`,
              color,
            }}
          >
            {data.nodeCount} node{data.nodeCount !== 1 ? "s" : ""}
          </span>

          {/* Actions Menu */}
          {(isHovered || selected) && (data.onEdit || data.onDelete || data.onAddNode || data.onEnterMode) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 rounded hover:bg-black/10 transition-colors"
                >
                  <MoreHorizontal size={16} style={{ color }} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {data.onEnterMode && (
                  <DropdownMenuItem
                    onClick={() => data.onEnterMode?.(id)}
                    className="gap-2 cursor-pointer font-medium"
                    style={{ color }}
                  >
                    <Sparkles size={14} />
                    Enter Hypothetical Mode
                  </DropdownMenuItem>
                )}
                {data.onEnterMode && (data.onAddNode || data.onEdit) && (
                  <DropdownMenuSeparator />
                )}
                {data.onAddNode && (
                  <DropdownMenuItem
                    onClick={() => data.onAddNode?.(id)}
                    className="gap-2 cursor-pointer"
                  >
                    <Plus size={14} />
                    Add Node to Scope
                  </DropdownMenuItem>
                )}
                {data.onEdit && (
                  <DropdownMenuItem
                    onClick={() => data.onEdit?.(id)}
                    className="gap-2 cursor-pointer"
                  >
                    <Edit2 size={14} />
                    Edit Scope
                  </DropdownMenuItem>
                )}
                {(data.onAddNode || data.onEdit) && data.onDelete && (
                  <DropdownMenuSeparator />
                )}
                {data.onDelete && (
                  <DropdownMenuItem
                    onClick={() => data.onDelete?.(id)}
                    className="gap-2 cursor-pointer text-red-600 focus:text-red-600"
                  >
                    <Trash2 size={14} />
                    Delete Scope
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Content Area - where child nodes would be positioned */}
      {!isCollapsed && (
        <div className="p-4 min-h-[140px]">
          {/* Empty state when no nodes */}
          {data.nodeCount === 0 && (
            <div
              className="flex flex-col items-center justify-center h-full min-h-[100px] border-2 border-dashed rounded-lg"
              style={{ borderColor: `${color}40` }}
            >
              <Icon size={24} style={{ color: `${color}60` }} />
              <p className="text-sm mt-2" style={{ color: `${color}80` }}>
                No arguments in this scope yet
              </p>
              {data.onAddNode && (
                <button
                  onClick={() => data.onAddNode?.(id)}
                  className="mt-2 text-xs px-3 py-1.5 rounded-md transition-colors"
                  style={{
                    backgroundColor: `${color}15`,
                    color,
                  }}
                >
                  + Add Argument
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Depth Indicator (for nested scopes) */}
      {depth > 0 && (
        <div
          className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full"
          style={{ backgroundColor: color }}
          title={`Nesting depth: ${depth}`}
        />
      )}
    </div>
  );
};

export default memo(ScopeBoundary);

/**
 * ScopeBoundaryMini - Compact inline indicator for scope membership
 * Used when showing scope info within a node rather than as a group
 */
interface ScopeBoundaryMiniProps {
  scopeType: ScopeType;
  assumption: string;
  color?: string;
  className?: string;
  onClick?: () => void;
}

export function ScopeBoundaryMini({
  scopeType,
  assumption,
  color,
  className,
  onClick,
}: ScopeBoundaryMiniProps) {
  const config = SCOPE_TYPE_CONFIG[scopeType];
  const Icon = scopeIconMap[scopeType];
  const displayColor = color || config.color;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs",
              "border transition-colors",
              onClick && "hover:opacity-80 cursor-pointer",
              className
            )}
            style={{
              backgroundColor: `${displayColor}15`,
              borderColor: `${displayColor}40`,
              borderStyle: config.borderStyle,
              color: displayColor,
            }}
          >
            <Icon size={10} />
            <span className="truncate max-w-[120px]">{assumption}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-medium">{config.label} Scope</p>
          <p className="text-xs text-muted-foreground mt-1">{assumption}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
