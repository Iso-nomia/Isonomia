"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AIFArgumentWithSchemeComposer,
  AttackContext,
} from "@/components/arguments/AIFArgumentWithSchemeComposer";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChainEditorStore } from "@/lib/stores/chainEditorStore";
import { getNewNodePosition } from "@/lib/utils/chainLayoutUtils";
import { Shield, Swords, Plus, MessageSquare, Lightbulb, GitBranch, ArrowRightCircle, HelpCircle, User2 } from "lucide-react";
import { SCOPE_TYPE_CONFIG, type ScopeType } from "@/lib/types/argumentChain";

/**
 * Epistemic scope context for hypothetical/counterfactual arguments
 */
export interface EpistemicScopeContext {
  scopeId: string;
  scopeType: ScopeType;
  assumption: string;
  color?: string;
}

/**
 * Context for the chain argument composer
 * Supports multiple modes for different argument creation scenarios
 */
export interface ChainComposerContext {
  mode: "support" | "attack";
  attackType?: "REBUTS" | "UNDERCUTS" | "UNDERMINES";
  targetNode?: {
    nodeId: string;
    argumentId: string;
    conclusionId?: string;
    conclusionText?: string;
  };
  targetEdge?: {
    edgeId: string;
    sourceNodeId: string;
    targetNodeId: string;
  };
  suggestedRole?: string;
  suggestedScheme?: string;
  // Epistemic context - when composing within a hypothetical scope
  epistemicScope?: EpistemicScopeContext;
}

interface ChainArgumentComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliberationId: string;
  userId: string;
  chainId: string;
  context?: ChainComposerContext;
  onCreated?: (argument: any) => void;
  onSuccess?: () => void;
}

const ROLE_OPTIONS = [
  { value: "PREMISE", label: "Premise", description: "Provides foundational claim" },
  { value: "EVIDENCE", label: "Evidence", description: "Supports with data/facts" },
  { value: "CONCLUSION", label: "Conclusion", description: "Final claim being argued for" },
  { value: "OBJECTION", label: "Objection", description: "Challenges another argument" },
  { value: "REBUTTAL", label: "Rebuttal", description: "Responds to objection" },
  { value: "QUALIFIER", label: "Qualifier", description: "Adds conditions/scope" },
];

// Icons for scope types
const SCOPE_ICONS: Record<ScopeType, React.ReactNode> = {
  HYPOTHETICAL: <Lightbulb className="w-4 h-4" />,
  COUNTERFACTUAL: <GitBranch className="w-4 h-4" />,
  CONDITIONAL: <ArrowRightCircle className="w-4 h-4" />,
  OPPONENT: <User2 className="w-4 h-4" />,
  MODAL: <HelpCircle className="w-4 h-4" />,
};

// Get default role based on context mode
function getDefaultRole(context?: ChainComposerContext): string {
  if (context?.suggestedRole) return context.suggestedRole;
  switch (context?.mode) {
    case "attack":
      return "OBJECTION";
    case "support":
      return "PREMISE";
    default:
      return "PREMISE";
  }
}

// Get edge type based on context mode
function getEdgeTypeForMode(context?: ChainComposerContext): string {
  if (context?.attackType) return context.attackType;
  switch (context?.mode) {
    case "attack":
      return "REBUTS";
    case "support":
      return "SUPPORTS";
    default:
      return "SUPPORTS";
  }
}

export function ChainArgumentComposer({
  open,
  onOpenChange,
  deliberationId,
  userId,
  chainId,
  context,
  onCreated,
  onSuccess,
}: ChainArgumentComposerProps) {
  const [selectedRole, setSelectedRole] = useState<string>(getDefaultRole(context));
  const [isCreating, setIsCreating] = useState(false);

  const { nodes, addNode, addEdge } = useChainEditorStore();

  // Derive attack context from chain context for the composer
  const attackContext: AttackContext | null = (() => {
    if (context?.mode !== "attack") return null;
    
    if (context.targetNode) {
      const attackType = context.attackType || "REBUTS";
      if (attackType === "REBUTS") {
        return {
          mode: "REBUTS" as const,
          targetClaimId: context.targetNode.argumentId,
          hint: `Challenging: "${context.targetNode.conclusionText || "this argument"}"`,
        };
      }
      if (attackType === "UNDERMINES") {
        return {
          mode: "UNDERMINES" as const,
          targetPremiseId: context.targetNode.argumentId,
          hint: `Undermining premise of: "${context.targetNode.conclusionText || "this argument"}"`,
        };
      }
      if (attackType === "UNDERCUTS") {
        return {
          mode: "UNDERCUTS" as const,
          targetArgumentId: context.targetNode.argumentId,
          hint: `Challenging reasoning in: "${context.targetNode.conclusionText || "this argument"}"`,
        };
      }
    }
    
    if (context.targetEdge) {
      return {
        mode: "UNDERCUTS" as const,
        targetArgumentId: context.targetEdge.edgeId,
        hint: "Challenging the inference connection",
      };
    }
    
    return null;
  })();

  // Get title and description based on mode
  const getDialogContent = () => {
    const isUndercut = context?.attackType === "UNDERCUTS";
    const isUndermine = context?.attackType === "UNDERMINES";
    
    switch (context?.mode) {
      case "attack":
        if (isUndercut) {
          return {
            title: "Challenge Inference",
            description: context.targetEdge 
              ? "Challenge the reasoning connection between these arguments"
              : `Challenge the reasoning that leads to: "${context.targetNode?.conclusionText || "this conclusion"}"`,
            icon: <MessageSquare className="w-5 h-5 text-purple-500" />,
            accentColor: "purple",
          };
        }
        if (isUndermine) {
          return {
            title: "Undermine Premise",
            description: `Challenge a premise supporting: "${context.targetNode?.conclusionText || "this conclusion"}"`,
            icon: <Swords className="w-5 h-5 text-orange-500" />,
            accentColor: "orange",
          };
        }
        return {
          title: "Create Objection",
          description: `Build an argument that challenges: "${context.targetNode?.conclusionText || "this argument"}"`,
          icon: <Swords className="w-5 h-5 text-red-500" />,
          accentColor: "red",
        };
      case "support":
        return {
          title: "Create Supporting Argument",
          description: `Build an argument that supports: "${context.targetNode?.conclusionText || "this argument"}"`,
          icon: <Shield className="w-5 h-5 text-green-500" />,
          accentColor: "green",
        };
      default:
        // Check if we have an epistemic scope context without a specific mode
        if (context?.epistemicScope) {
          const scopeConfig = SCOPE_TYPE_CONFIG[context.epistemicScope.scopeType];
          return {
            title: `New ${scopeConfig.label} Argument`,
            description: `Build an argument within: "${context.epistemicScope.assumption}"`,
            icon: SCOPE_ICONS[context.epistemicScope.scopeType],
            accentColor: "amber",
          };
        }
        return {
          title: "Create New Argument",
          description: "Build a structured argument with premises and conclusion",
          icon: <Plus className="w-5 h-5 text-sky-500" />,
          accentColor: "sky",
        };
    }
  };

  const dialogContent = getDialogContent();
  
  // Get epistemic scope styling
  const epistemicScope = context?.epistemicScope;
  const scopeColor = epistemicScope?.color ||
    (epistemicScope ? SCOPE_TYPE_CONFIG[epistemicScope.scopeType]?.color : undefined) || undefined;

  const handleCreated = useCallback(
    async (argumentId: string, argument?: any) => {
      if (isCreating) return;
      setIsCreating(true);

      try {
        // If external handler provided, delegate to it
        if (onCreated && argument) {
          onCreated(argument);
          return;
        }

        // Otherwise handle internally
        // 1. Add argument as node to the chain
        const nodeResponse = await fetch(`/api/argument-chains/${chainId}/nodes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            argumentId,
            role: selectedRole,
          }),
        });

        if (!nodeResponse.ok) {
          throw new Error("Failed to add node to chain");
        }

        const { node: nodeData } = await nodeResponse.json();

        // Calculate position for new node
        const position = getNewNodePosition(nodes, 280, 180);

        // Add to local state
        addNode({
          id: nodeData.id,
          type: "argumentNode",
          position,
          data: {
            argument: nodeData.argument,
            role: nodeData.role,
            addedBy: nodeData.contributor,
            nodeOrder: nodeData.nodeOrder,
          },
        });

        // 2. If we have a target node, create the edge automatically
        if (context?.targetNode) {
          const edgeType = getEdgeTypeForMode(context);
          
          // Determine source and target based on mode
          // For attacks: new node attacks target (new -> target with REBUTS)
          // For support: new node supports target (new -> target with SUPPORTS)
          const edgeResponse = await fetch(`/api/argument-chains/${chainId}/edges`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceNodeId: nodeData.id,
              targetNodeId: context.targetNode.nodeId,
              edgeType,
              strength: 0.8,
              description: context.mode === "attack" 
                ? "Challenges this claim"
                : "Supports this claim",
            }),
          });

          if (edgeResponse.ok) {
            const { edge: edgeData } = await edgeResponse.json();
            
            // Add edge to local state
            addEdge({
              id: edgeData.id,
              source: nodeData.id,
              target: context.targetNode.nodeId,
              type: "chainEdge",
              data: {
                edgeType,
                strength: 0.8,
              },
            });
          }
        }

        // 3. If we have a target edge (undercut), handle edge attack
        if (context?.targetEdge && context.attackType === "UNDERCUTS") {
          const attackResponse = await fetch(`/api/argument-chains/${chainId}/attack-edge`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              argumentId,
              edgeId: context.targetEdge.edgeId,
              role: selectedRole,
            }),
          });

          if (!attackResponse.ok) {
            console.error("Failed to create edge attack");
          }
        }

        onOpenChange(false);
        onSuccess?.();
      } catch (error) {
        console.error("Failed to create argument in chain context:", error);
      } finally {
        setIsCreating(false);
      }
    },
    [chainId, selectedRole, nodes, addNode, addEdge, context, onOpenChange, onSuccess, onCreated, isCreating]
  );

  // Reset role when context changes
  useEffect(() => {
    setSelectedRole(getDefaultRole(context));
  }, [context]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-white overflow-y-auto ">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2">
            {dialogContent.icon}
            {dialogContent.title}
          </DialogTitle>
          <DialogDescription>{dialogContent.description}</DialogDescription>
        </DialogHeader>

        {/* Epistemic Scope Banner - shows when composing within a hypothetical scope */}
        {epistemicScope && (
          <div
            className="p-3 rounded-lg border-2 transition-all"
            style={{
              backgroundColor: `${scopeColor}10`,
              borderColor: scopeColor || "#f59e0b",
              borderStyle: SCOPE_TYPE_CONFIG[epistemicScope.scopeType]?.borderStyle || "solid",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
                style={{ backgroundColor: `${scopeColor}25` }}
              >
                <span style={{ color: scopeColor }}>
                  {SCOPE_ICONS[epistemicScope.scopeType]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: scopeColor,
                      color: "white",
                    }}
                  >
                    {SCOPE_TYPE_CONFIG[epistemicScope.scopeType]?.label.toUpperCase()} SCOPE
                  </span>
                </div>
                <p
                  className="text-sm font-medium mt-1.5"
                  style={{ color: scopeColor }}
                >
                  {epistemicScope.assumption}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  This argument will have <strong>hypothetical</strong> status and be grouped within this scope.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Role selector */}
        <div className="p-1 bg-muted/50 rounded-lg">
          <Label className="text-sm font-medium">Role in Argument Chain</Label>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="mt-1 bg-slate-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((role) => (
                <SelectItem className="bg-white hover:bg-slate-100" key={role.value} value={role.value}>
                  <div className="flex gap-2">
                    <span className="text-xs flex font-medium">{role.label}</span>
                    <span className="text-xs flex font-medium">-</span>

                    <span className="text-xs text-muted-foreground">
                      {role.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AIFArgumentWithSchemeComposer
          deliberationId={deliberationId}
          authorId={userId}
          conclusionClaim={null}
          defaultSchemeKey={null}
          attackContext={attackContext}
          onCreated={handleCreated}
        />

        {isCreating && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Adding to chain...</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ChainArgumentComposer;
