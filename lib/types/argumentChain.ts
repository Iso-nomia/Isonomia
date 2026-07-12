import { Prisma } from "@prisma/client";

// Full chain with all relations
export type ArgumentChainWithRelations = Prisma.ArgumentChainGetPayload<{
  include: {
    creator: {
      select: {
        id: true;
        name: true;
        image: true;
      };
    };
    deliberation: {
      select: {
        id: true;
        title: true;
      };
    };
    scopes: {
      include: {
        creator: {
          select: {
            id: true;
            name: true;
          };
        };
        _count: {
          select: {
            nodes: true;
            childScopes: true;
          };
        };
      };
    };
    nodes: {
      include: {
        argument: {
          include: {
            conclusion: {
              select: {
                id: true;
                text: true;
              };
            };
            argumentSchemes: {
              include: {
                scheme: true;
              };
            };
            schemeNet: {
              include: {
                steps: {
                  include: {
                    scheme: true;
                  };
                  orderBy: {
                    stepOrder: "asc";
                  };
                };
              };
            };
          };
        };
        contributor: {
          select: {
            id: true;
            name: true;
            image: true;
          };
        };
        scope: {
          select: {
            id: true;
            scopeType: true;
            assumption: true;
            color: true;
          };
        };
      };
      orderBy: {
        nodeOrder: "asc";
      };
    };
    edges: {
      include: {
        sourceNode: {
          include: {
            argument: {
              select: {
                id: true;
                text: true;
                conclusion: {
                  select: {
                    id: true;
                    text: true;
                  };
                };
              };
            };
          };
        };
        targetNode: {
          include: {
            argument: {
              select: {
                id: true;
                text: true;
                conclusion: {
                  select: {
                    id: true;
                    text: true;
                  };
                };
              };
            };
          };
        };
      };
    };
  };
}>;

// Chain summary (for list views)
export type ArgumentChainSummary = Prisma.ArgumentChainGetPayload<{
  include: {
    creator: {
      select: {
        id: true;
        name: true;
        image: true;
      };
    };
    _count: {
      select: {
        nodes: true;
        edges: true;
      };
    };
  };
}>;

// Node with argument
export type ArgumentChainNodeWithArgument = Prisma.ArgumentChainNodeGetPayload<{
  include: {
    argument: {
      include: {
        argumentSchemes: {
          include: {
            scheme: true;
          };
        };
        schemeNet: {
          include: {
            steps: {
              include: {
                scheme: true;
              };
              orderBy: {
                stepOrder: "asc";
              };
            };
          };
        };
      };
    };
    contributor: {
      select: {
        id: true;
        name: true;
        image: true;
      };
    };
  };
}>;

// Edge with nodes
export type ArgumentChainEdgeWithNodes = Prisma.ArgumentChainEdgeGetPayload<{
  include: {
    sourceNode: {
      include: {
        argument: {
          select: {
            id: true;
            text: true;
          };
        };
      };
    };
    targetNode: {
      include: {
        argument: {
          select: {
            id: true;
            text: true;
          };
        };
      };
    };
  };
}>;

// Analysis result types
export interface ChainAnalysis {
  complexity: {
    nodeCount: number;
    edgeCount: number;
    averageDegree: number;
    maxDepth: number;
    rootNodes: string[];
    conclusionNodes: string[];
  };
  criticalPath: {
    nodes: string[];
    edges: string[];
    overallStrength: number;
    weakestLink: {
      edgeId: string;
      sourceNodeId: string;
      targetNodeId: string;
      strength: number;
    } | null;
  } | null;
  suggestions: Array<{
    type: "disconnected_nodes" | "weak_links" | "circular_dependency";
    message: string;
    affectedNodes: string[];
  }>;
  
  // Phase 3 Lite: Basic scheme aggregation
  schemeInfo?: {
    /** Total arguments with at least one scheme assigned */
    argumentsWithSchemes: number;
    /** Total arguments with a SchemeNet (multi-step reasoning) */
    argumentsWithSchemeNets: number;
    /** Aggregated scheme usage across all chain nodes */
    schemeCounts: Array<{
      schemeId: string;
      schemeName: string;
      schemeKey: string;
      count: number;
    }>;
    /** Arguments lacking scheme assignment (potential gaps) */
    unstructuredArguments: string[];
  };
}

// ReactFlow node data
export interface ChainNodeData {
  argument: ArgumentChainNodeWithArgument["argument"] & {
    conclusion?: { id: string; text: string } | null;
  };
  role?: string;
  addedBy: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
  nodeOrder: number;
  isHighlighted?: boolean;
  targetType?: "NODE" | "EDGE";
  targetEdgeId?: string | null;
  // Epistemic status fields (Phase 4)
  epistemicStatus?: EpistemicStatus;
  scopeId?: string | null;
  dialecticalRole?: DialecticalRole | null;
  // Scope info for display (when node belongs to a scope)
  scope?: {
    id: string;
    scopeType: ScopeType;
    assumption: string;
    color?: string | null;
  } | null;
  // Index signature to satisfy ReactFlow Node<T> generic constraint.
  [key: string]: unknown;
}

// ReactFlow edge data
export interface ChainEdgeData {
  edgeType: string;
  strength: number;
  description?: string | null;
  slotMapping?: any;
  isTargeted?: boolean;
  attackCount?: number;
  // Index signature to satisfy ReactFlow Edge<T> generic constraint.
  [key: string]: unknown;
}

// Epistemic status types (Phase 4)
export type EpistemicStatus = 
  | "ASSERTED"
  | "HYPOTHETICAL"
  | "COUNTERFACTUAL"
  | "CONDITIONAL"
  | "QUESTIONED"
  | "DENIED"
  | "SUSPENDED";

export type ScopeType =
  | "HYPOTHETICAL"
  | "COUNTERFACTUAL"
  | "CONDITIONAL"
  | "OPPONENT"
  | "MODAL";

export type DialecticalRole =
  | "THESIS"
  | "ANTITHESIS"
  | "SYNTHESIS"
  | "OBJECTION"
  | "RESPONSE"
  | "CONCESSION";

// Scope with nodes
export type ArgumentScopeWithNodes = Prisma.ArgumentScopeGetPayload<{
  include: {
    nodes: {
      include: {
        argument: {
          select: {
            id: true;
            text: true;
            conclusion: {
              select: {
                id: true;
                text: true;
              };
            };
          };
        };
      };
    };
    creator: {
      select: {
        id: true;
        name: true;
        image: true;
      };
    };
    childScopes: true;
    parentScope: true;
  };
}>;

// Scope summary (for list views)
export type ArgumentScopeSummary = Prisma.ArgumentScopeGetPayload<{
  include: {
    _count: {
      select: {
        nodes: true;
        childScopes: true;
      };
    };
    creator: {
      select: {
        id: true;
        name: true;
      };
    };
  };
}>;

// Epistemic status configuration for UI
export const EPISTEMIC_STATUS_CONFIG: Record<EpistemicStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderStyle: string;
  icon: string;
  description: string;
}> = {
  ASSERTED: {
    label: "Asserted",
    color: "text-gray-700",
    bgColor: "bg-white",
    borderStyle: "solid",
    icon: "✓",
    description: "Normal claim, asserted as true",
  },
  HYPOTHETICAL: {
    label: "Hypothetical",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderStyle: "solid",
    icon: "💡",
    description: "Assumed true for sake of argument",
  },
  COUNTERFACTUAL: {
    label: "Counterfactual",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderStyle: "dashed",
    icon: "⑂",
    description: "Contrary to known facts",
  },
  CONDITIONAL: {
    label: "Conditional",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderStyle: "dotted",
    icon: "↔",
    description: "Part of an if-then structure",
  },
  QUESTIONED: {
    label: "Questioned",
    color: "text-yellow-700",
    bgColor: "bg-yellow-50",
    borderStyle: "solid",
    icon: "?",
    description: "Under examination",
  },
  DENIED: {
    label: "Denied",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderStyle: "solid",
    icon: "✗",
    description: "Explicitly negated",
  },
  SUSPENDED: {
    label: "Suspended",
    color: "text-slate-500",
    bgColor: "bg-slate-50",
    borderStyle: "solid",
    icon: "⏸",
    description: "Temporarily set aside",
  },
};

// Scope type configuration for UI
export const SCOPE_TYPE_CONFIG: Record<ScopeType, {
  label: string;
  color: string;
  borderColor: string;
  bgColor: string;
  borderStyle: "solid" | "dashed" | "dotted";
  icon: string;
  prompt: string;
  description: string;
}> = {
  HYPOTHETICAL: {
    label: "Hypothetical",
    color: "#f59e0b", // amber-500
    borderColor: "#fbbf24", // amber-400
    bgColor: "#fef3c7", // amber-100
    borderStyle: "dashed",
    icon: "💡",
    prompt: "Suppose that...",
    description: "Arguments assuming a hypothetical premise",
  },
  COUNTERFACTUAL: {
    label: "Counterfactual",
    color: "#8b5cf6", // purple-500
    borderColor: "#a78bfa", // purple-400
    bgColor: "#ede9fe", // purple-100
    borderStyle: "dashed",
    icon: "⑂",
    prompt: "Had it been the case that...",
    description: "Exploring what would have followed from a contrary-to-fact assumption",
  },
  CONDITIONAL: {
    label: "Conditional",
    color: "#3b82f6", // blue-500
    borderColor: "#60a5fa", // blue-400
    bgColor: "#dbeafe", // blue-100
    borderStyle: "solid",
    icon: "↔",
    prompt: "If..., then...",
    description: "Arguments contingent on a specified condition",
  },
  OPPONENT: {
    label: "Opponent's View",
    color: "#ef4444", // red-500
    borderColor: "#f87171", // red-400
    bgColor: "#fee2e2", // red-100
    borderStyle: "dotted",
    icon: "👤",
    prompt: "From the opponent's perspective...",
    description: "Representing an opposing viewpoint for dialectical analysis",
  },
  MODAL: {
    label: "Modal",
    color: "#06b6d4", // cyan-500
    borderColor: "#22d3ee", // cyan-400
    bgColor: "#cffafe", // cyan-100
    borderStyle: "solid",
    icon: "◇",
    prompt: "It is possible/necessary that...",
    description: "Reasoning about possibility, necessity, or other modalities",
  },
};