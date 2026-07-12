// lib/client/graph/visualDesignSystem.ts

export type ViewMode = 
  | 'structural'    // Hierarchical: shows argument flow (premises → conclusions)
  | 'conflict'      // Polarized: support vs attack
  | 'grounded'      // Grouped by IN/OUT/UNDEC
  | 'temporal'      // Timeline: shows evolution
  | 'focus';        // Ego network around selected node

export type VisualEncoding = {
  // Node visual properties
  nodeSize: 'uniform' | 'byApprovals' | 'byConnections' | 'byConfidence';
  nodeColor: 'byStatus' | 'byCluster' | 'byAge' | 'byAuthor';
  nodeShape: 'circle' | 'rounded-rect' | 'icon';
  
  // Edge visual properties
  edgeThickness: 'uniform' | 'byConfidence' | 'byImportance';
  edgeStyle: 'straight' | 'curved' | 'orthogonal';
  edgeEmphasis: 'all' | 'attacks-only' | 'supports-only';
  
  // Layout properties
  spacing: 'compact' | 'comfortable' | 'spacious';
  grouping: boolean;
  showLabels: 'none' | 'hover' | 'selected' | 'all';
};

// Visual scales for encoding data to visual properties
export const VisualScales = {
  // Node size by approvals: 4-12px radius
  nodeSizeByApprovals: (approvals: number) => 
    Math.max(4, Math.min(12, 6 + approvals * 1.5)),
  
  // Node size by connections: 4-12px radius
  nodeSizeByConnections: (degree: number) =>
    Math.max(4, Math.min(12, 4 + degree * 0.8)),
  
  // Edge thickness by confidence: 0.5-3px
  edgeThicknessByConfidence: (confidence: number) =>
    0.5 + confidence * 2.5,
  
  // Opacity by age: newer = more opaque
  opacityByAge: (ageInDays: number) =>
    Math.max(0.3, 1 - ageInDays / 30),
};

// Color palettes for different encodings
export const ColorPalettes = {
  status: {
    IN: '#16a34a',      // Green
    OUT: '#dc2626',     // Red
    UNDEC: '#64748b',   // Gray
  },
  
  clusters: [
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#06b6d4', // Cyan
  ],
  
  temporal: {
    new: '#8b5cf6',     // Purple (< 1 day)
    recent: '#3b82f6',  // Blue (< 7 days)
    old: '#64748b',     // Gray (> 7 days)
  },
  
  edges: {
    support: '#64748b',
    rebut: '#dc2626',
    undercut: '#f59e0b',
    undermine: '#ef4444',
  },
};