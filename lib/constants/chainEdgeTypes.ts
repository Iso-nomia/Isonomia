// Edge type definitions for ArgumentChain visual editor

export interface EdgeTypeConfig {
  id: string;
  label: string;
  color: string;
  description: string;
  strokeDasharray?: string;
  category: "support" | "attack" | "modifier";
}

export const EDGE_TYPES: Record<string, EdgeTypeConfig> = {
  // Support relationships
  SUPPORTS: {
    id: "SUPPORTS",
    label: "Supports",
    color: "#10b981", // green-500
    description: "This argument provides evidence or reasoning that strengthens the target argument",
    category: "support",
  },
  ENABLES: {
    id: "ENABLES",
    label: "Enables",
    color: "#3b82f6", // blue-500
    description: "This argument provides a necessary condition or prerequisite for the target argument",
    category: "support",
  },
  PRESUPPOSES: {
    id: "PRESUPPOSES",
    label: "Presupposes",
    color: "#8b5cf6", // violet-500
    description: "This argument assumes or depends on the truth of the target argument",
    strokeDasharray: "5,5",
    category: "support",
  },
  
  // Attack relationships (ASPIC+)
  REBUTS: {
    id: "REBUTS",
    label: "Rebuts",
    color: "#ef4444", // red-500
    description: "Directly contradicts or denies the conclusion of the target argument",
    category: "attack",
  },
  UNDERCUTS: {
    id: "UNDERCUTS",
    label: "Undercuts",
    color: "#a855f7", // purple-500
    description: "Challenges the inference/reasoning link rather than premises or conclusion",
    strokeDasharray: "3,3",
    category: "attack",
  },
  UNDERMINES: {
    id: "UNDERMINES",
    label: "Undermines",
    color: "#f97316", // orange-500
    description: "Attacks one or more premises supporting the target argument",
    category: "attack",
  },
  
  // Legacy attack type (kept for compatibility)
  REFUTES: {
    id: "REFUTES",
    label: "Refutes",
    color: "#ef4444", // red-500
    description: "This argument contradicts or disproves the target argument",
    category: "attack",
  },
  
  // Modifier relationships
  QUALIFIES: {
    id: "QUALIFIES",
    label: "Qualifies",
    color: "#f59e0b", // amber-500
    description: "This argument modifies or adds constraints to the target argument",
    category: "modifier",
  },
  EXEMPLIFIES: {
    id: "EXEMPLIFIES",
    label: "Exemplifies",
    color: "#06b6d4", // cyan-500
    description: "This argument provides a concrete example or instance of the target argument",
    category: "modifier",
  },
  GENERALIZES: {
    id: "GENERALIZES",
    label: "Generalizes",
    color: "#ec4899", // pink-500
    description: "This argument extracts a general principle from the target argument",
    strokeDasharray: "8,4",
    category: "modifier",
  },
};

// Grouped edge types for UI selection
export const EDGE_TYPE_GROUPS = {
  support: {
    label: "Support Relationships",
    description: "Arguments that strengthen or enable the target",
    types: Object.values(EDGE_TYPES).filter(t => t.category === "support"),
  },
  attack: {
    label: "Attack Relationships",
    description: "Arguments that challenge or oppose the target",
    types: Object.values(EDGE_TYPES).filter(t => t.category === "attack"),
  },
  modifier: {
    label: "Modifier Relationships", 
    description: "Arguments that qualify or extend the target",
    types: Object.values(EDGE_TYPES).filter(t => t.category === "modifier"),
  },
};

export const getEdgeTypeConfig = (edgeType: string): EdgeTypeConfig => {
  return EDGE_TYPES[edgeType] || {
    id: "SUPPORTS",
    label: "Supports",
    color: "#6b7280", // gray-500
    description: "Unknown edge type",
  };
};

export const getEdgeStrokeWidth = (strength: number): number => {
  // Map strength (0-1) to stroke width (1-4)
  return 1 + (strength * 3);
};

export const getEdgeAnimated = (strength: number): boolean => {
  // Animate edges with strength > 0.7
  return strength > 0.7;
};
