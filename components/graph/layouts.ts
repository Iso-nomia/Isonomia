// components/graph/layouts.ts
import { useMemo } from 'react';
import { CegNode, CegEdge } from './useCegData';

type LayoutProps = {
  nodes: CegNode[];
  edges: CegEdge[];
  width: number;
  height: number;
  selectedId?: string | null;
  spacing?: 'compact' | 'comfortable' | 'spacious';
};

// Hierarchical layout: shows argument flow from premises to conclusions
export function useHierarchicalLayout(props: LayoutProps) {
  return useMemo(() => {
    const { nodes, edges, width, height } = props;
    const positions = new Map<string, { x: number; y: number }>();
    
    if (nodes.length === 0) return positions;

    // Build adjacency for topological sort
    const inDegree = new Map<string, number>();
    const outEdges = new Map<string, string[]>();
    
    nodes.forEach(n => {
      inDegree.set(n.id, 0);
      outEdges.set(n.id, []);
    });
    
    edges.forEach(e => {
      if (e.type === 'supports') {  // Only follow support edges for hierarchy
        inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
        outEdges.get(e.source)?.push(e.target);
      }
    });

    // Topological layering (Sugiyama-style)
    const layers: string[][] = [];
    const queue = nodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id);
    const visited = new Set<string>();
    
    while (queue.length > 0 || visited.size < nodes.length) {
      if (queue.length === 0) {
        // Add remaining nodes (cycles/disconnected) to a new layer
        const remaining = nodes.filter(n => !visited.has(n.id));
        if (remaining.length > 0) {
          queue.push(remaining[0].id);
        }
      }
      
      const layer: string[] = [];
      const nextQueue: string[] = [];
      
      while (queue.length > 0) {
        const nodeId = queue.shift()!;
        if (visited.has(nodeId)) continue;
        
        visited.add(nodeId);
        layer.push(nodeId);
        
        outEdges.get(nodeId)?.forEach(targetId => {
          const deg = inDegree.get(targetId)! - 1;
          inDegree.set(targetId, deg);
          if (deg === 0) nextQueue.push(targetId);
        });
      }
      
      if (layer.length > 0) layers.push(layer);
      queue.push(...nextQueue);
    }

    // Position nodes in layers
    const layerHeight = height / Math.max(layers.length, 1);
    
    layers.forEach((layer, layerIdx) => {
      const y = (layerIdx + 0.5) * layerHeight;
      const layerWidth = width / (layer.length + 1);
      
      layer.forEach((nodeId, nodeIdx) => {
        const x = (nodeIdx + 1) * layerWidth;
        positions.set(nodeId, { x, y });
      });
    });

    return positions;
  }, [props.nodes, props.edges, props.width, props.height]);
}

// Polarized layout: support on left, attacks on right
export function usePolarizedLayout(props: LayoutProps) {
  return useMemo(() => {
    const { nodes, edges, width, height } = props;
    const positions = new Map<string, { x: number; y: number }>();
    
    if (nodes.length === 0) return positions;

    // Classify nodes by their predominant role
    const supportScores = new Map<string, number>();
    nodes.forEach(n => supportScores.set(n.id, 0));
    
    edges.forEach(e => {
      const score = e.type === 'supports' ? 1 : -1;
      supportScores.set(e.source, (supportScores.get(e.source) || 0) + score);
    });

    const supporters = nodes.filter(n => (supportScores.get(n.id) || 0) > 0);
    const attackers = nodes.filter(n => (supportScores.get(n.id) || 0) < 0);
    const neutral = nodes.filter(n => (supportScores.get(n.id) || 0) === 0);

    // Position in three columns
    const colWidth = width / 3;
    
    [supporters, neutral, attackers].forEach((group, colIdx) => {
      const x = (colIdx + 0.5) * colWidth;
      const spacing = height / (group.length + 1);
      
      group.forEach((node, idx) => {
        const y = (idx + 1) * spacing;
        positions.set(node.id, { x, y });
      });
    });

    return positions;
  }, [props.nodes, props.edges, props.width, props.height]);
}

// Grounded layout: group by IN/OUT/UNDEC status
export function useGroundedLayout(props: LayoutProps) {
  return useMemo(() => {
    const { nodes, width, height } = props;
    const positions = new Map<string, { x: number; y: number }>();
    
    if (nodes.length === 0) return positions;

    const groups = {
      IN: nodes.filter(n => n.label === 'IN'),
      UNDEC: nodes.filter(n => n.label === 'UNDEC'),
      OUT: nodes.filter(n => n.label === 'OUT'),
    };

    const colWidth = width / 3;
    
    Object.entries(groups).forEach(([_, group], colIdx) => {
      const x = (colIdx + 0.5) * colWidth;
      const spacing = height / (group.length + 1);
      
      group.forEach((node, idx) => {
        const y = (idx + 1) * spacing;
        positions.set(node.id, { x, y });
      });
    });

    return positions;
  }, [props.nodes, props.width, props.height]);
}

// Temporal layout: spiral or timeline by creation date
export function useTemporalLayout(props: LayoutProps) {
  return useMemo(() => {
    const { nodes, width, height } = props;
    const positions = new Map<string, { x: number; y: number }>();
    
    if (nodes.length === 0) return positions;

    // Sort by creation date
    const sorted = [...nodes].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });

    // Spiral layout
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.4;
    
    sorted.forEach((node, idx) => {
      const t = idx / sorted.length;
      const angle = t * 4 * Math.PI; // 2 full rotations
      const radius = t * maxRadius;
      
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      positions.set(node.id, { x, y });
    });

    return positions;
  }, [props.nodes, props.width, props.height]);
}

// Focus layout: ego network around selected node
export function useFocusLayout(props: LayoutProps & { focusId?: string | null }) {
  return useMemo(() => {
    const { nodes, edges, width, height, focusId } = props;
    const positions = new Map<string, { x: number; y: number }>();
    
    if (nodes.length === 0 || !focusId) {
      // Fallback to circular
      return computeCircularLayout(nodes, width, height);
    }

    // Place focus node in center
    const centerX = width / 2;
    const centerY = height / 2;
    positions.set(focusId, { x: centerX, y: centerY });

    // Find connected nodes
    const connected = new Set<string>();
    edges.forEach(e => {
      if (e.source === focusId) connected.add(e.target);
      if (e.target === focusId) connected.add(e.source);
    });

    // Place connected nodes in a ring
    const radius = Math.min(width, height) * 0.35;
    const connectedNodes = nodes.filter(n => connected.has(n.id));
    
    connectedNodes.forEach((node, idx) => {
      const angle = (idx / connectedNodes.length) * 2 * Math.PI;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      positions.set(node.id, { x, y });
    });

    // Place remaining nodes in outer ring
    const outerRadius = radius * 1.6;
    const remainingNodes = nodes.filter(n => n.id !== focusId && !connected.has(n.id));
    
    remainingNodes.forEach((node, idx) => {
      const angle = (idx / remainingNodes.length) * 2 * Math.PI;
      const x = centerX + outerRadius * Math.cos(angle);
      const y = centerY + outerRadius * Math.sin(angle);
      positions.set(node.id, { x, y });
    });

    return positions;
  }, [props.nodes, props.edges, props.width, props.height, props.focusId]);
}

function computeCircularLayout(nodes: CegNode[], width: number, height: number) {
  const positions = new Map<string, { x: number; y: number }>();
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.4;
  
  nodes.forEach((node, idx) => {
    const angle = (idx / nodes.length) * 2 * Math.PI;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    positions.set(node.id, { x, y });
  });
  
  return positions;
}