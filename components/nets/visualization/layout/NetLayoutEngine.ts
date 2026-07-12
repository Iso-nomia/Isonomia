import dagre from "dagre";
import { Node, Edge } from "@xyflow/react";

export class NetLayoutEngine {
  private readonly NODE_WIDTH = 280;
  private readonly NODE_HEIGHT = 150;
  private readonly RANK_SEPARATION = 100;
  private readonly NODE_SEPARATION = 80;

  /**
   * Apply layout algorithm based on net type and user preference
   */
  public applyLayout(
    nodes: Node[],
    edges: Edge[],
    layoutType: string,
    netType: string
  ): { nodes: Node[]; edges: Edge[] } {
    switch (layoutType) {
      case "hierarchical":
        return this.applyHierarchicalLayout(nodes, edges);
      case "force":
        return this.applyForceLayout(nodes, edges);
      case "circular":
        return this.applyCircularLayout(nodes, edges);
      case "tree":
        return this.applyTreeLayout(nodes, edges);
      default:
        return this.applyHierarchicalLayout(nodes, edges);
    }
  }

  /**
   * Hierarchical layout using Dagre (best for most nets)
   */
  private applyHierarchicalLayout(
    nodes: Node[],
    edges: Edge[]
  ): { nodes: Node[]; edges: Edge[] } {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Configure graph
    dagreGraph.setGraph({
      rankdir: "TB", // Top to bottom
      ranksep: this.RANK_SEPARATION,
      nodesep: this.NODE_SEPARATION,
      edgesep: 50,
    });

    // Add nodes to dagre
    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, {
        width: this.NODE_WIDTH,
        height: this.NODE_HEIGHT,
      });
    });

    // Validate edges before adding to dagre
    const nodeIds = new Set(nodes.map((n) => n.id));
    const validEdges: Edge[] = [];
    const invalidEdges: Edge[] = [];

    edges.forEach((edge) => {
      if (!nodeIds.has(edge.source)) {
        console.warn(
          `[NetLayoutEngine] Invalid edge: source node "${edge.source}" not found. Available nodes:`,
          Array.from(nodeIds)
        );
        invalidEdges.push(edge);
      } else if (!nodeIds.has(edge.target)) {
        console.warn(
          `[NetLayoutEngine] Invalid edge: target node "${edge.target}" not found. Available nodes:`,
          Array.from(nodeIds)
        );
        invalidEdges.push(edge);
      } else {
        validEdges.push(edge);
      }
    });

    if (invalidEdges.length > 0) {
      console.error(
        `[NetLayoutEngine] Found ${invalidEdges.length} invalid edges. These will be skipped to prevent layout errors.`
      );
    }

    // Add only valid edges to dagre
    validEdges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    // Calculate layout
    try {
      dagre.layout(dagreGraph);
    } catch (error) {
      console.error("[NetLayoutEngine] Dagre layout failed:", error);
      console.log("Graph details:", {
        nodeCount: nodes.length,
        validEdgeCount: validEdges.length,
        invalidEdgeCount: invalidEdges.length,
        nodes: nodes.map((n) => n.id),
        validEdges: validEdges.map((e) => `${e.source} → ${e.target}`),
        invalidEdges: invalidEdges.map((e) => `${e.source} → ${e.target}`),
      });
      throw error;
    }

    // Apply positions to nodes
    const layoutedNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - this.NODE_WIDTH / 2,
          y: nodeWithPosition.y - this.NODE_HEIGHT / 2,
        },
      };
    });

    // Return only valid edges that were actually laid out
    return { nodes: layoutedNodes, edges: validEdges };
  }

  /**
   * Force-directed layout (good for showing relationships)
   */
  private applyForceLayout(
    nodes: Node[],
    edges: Edge[]
  ): { nodes: Node[]; edges: Edge[] } {
    // Simple force-directed layout
    const iterations = 100;
    const repulsionStrength = 5000;
    const attractionStrength = 0.01;
    const damping = 0.9;

    // Initialize positions randomly
    const positions = new Map<string, { x: number; y: number; vx: number; vy: number }>();
    nodes.forEach((node, i) => {
      positions.set(node.id, {
        x: Math.cos((i / nodes.length) * 2 * Math.PI) * 300,
        y: Math.sin((i / nodes.length) * 2 * Math.PI) * 300,
        vx: 0,
        vy: 0,
      });
    });

    // Create adjacency map
    const adjacency = new Map<string, Set<string>>();
    edges.forEach((edge) => {
      if (!adjacency.has(edge.source)) {
        adjacency.set(edge.source, new Set());
      }
      adjacency.get(edge.source)!.add(edge.target);
    });

    // Run simulation
    for (let iter = 0; iter < iterations; iter++) {
      // Calculate forces
      const forces = new Map<string, { fx: number; fy: number }>();
      nodes.forEach((node) => {
        forces.set(node.id, { fx: 0, fy: 0 });
      });

      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const node1 = nodes[i];
          const node2 = nodes[j];
          const pos1 = positions.get(node1.id)!;
          const pos2 = positions.get(node2.id)!;

          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const distSq = dx * dx + dy * dy + 1; // Avoid division by zero
          const dist = Math.sqrt(distSq);

          const force = repulsionStrength / distSq;
          const fx = (force * dx) / dist;
          const fy = (force * dy) / dist;

          const f1 = forces.get(node1.id)!;
          const f2 = forces.get(node2.id)!;
          f1.fx -= fx;
          f1.fy -= fy;
          f2.fx += fx;
          f2.fy += fy;
        }
      }

      // Attraction along edges
      edges.forEach((edge) => {
        const pos1 = positions.get(edge.source)!;
        const pos2 = positions.get(edge.target)!;

        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 1;

        const force = attractionStrength * dist;
        const fx = (force * dx) / dist;
        const fy = (force * dy) / dist;

        const f1 = forces.get(edge.source)!;
        const f2 = forces.get(edge.target)!;
        f1.fx += fx;
        f1.fy += fy;
        f2.fx -= fx;
        f2.fy -= fy;
      });

      // Apply forces
      nodes.forEach((node) => {
        const pos = positions.get(node.id)!;
        const force = forces.get(node.id)!;

        pos.vx = (pos.vx + force.fx) * damping;
        pos.vy = (pos.vy + force.fy) * damping;

        pos.x += pos.vx;
        pos.y += pos.vy;
      });
    }

    // Apply positions to nodes
    const layoutedNodes = nodes.map((node) => {
      const pos = positions.get(node.id)!;
      return {
        ...node,
        position: { x: pos.x, y: pos.y },
      };
    });

    return { nodes: layoutedNodes, edges };
  }

  /**
   * Circular layout (good for showing cycles)
   */
  private applyCircularLayout(
    nodes: Node[],
    edges: Edge[]
  ): { nodes: Node[]; edges: Edge[] } {
    const radius = Math.max(300, nodes.length * 50);
    const angleStep = (2 * Math.PI) / nodes.length;

    const layoutedNodes = nodes.map((node, i) => {
      const angle = i * angleStep;
      return {
        ...node,
        position: {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        },
      };
    });

    return { nodes: layoutedNodes, edges };
  }

  /**
   * Tree layout (good for hierarchical nets with clear roots)
   */
  private applyTreeLayout(
    nodes: Node[],
    edges: Edge[]
  ): { nodes: Node[]; edges: Edge[] } {
    // Build adjacency list
    const children = new Map<string, string[]>();
    const parents = new Set<string>();

    edges.forEach((edge) => {
      if (!children.has(edge.source)) {
        children.set(edge.source, []);
      }
      children.get(edge.source)!.push(edge.target);
      parents.add(edge.target);
    });

    // Find root nodes (nodes with no parents)
    const roots = nodes.filter((node) => !parents.has(node.id));

    if (roots.length === 0) {
      // If no roots, fall back to hierarchical
      return this.applyHierarchicalLayout(nodes, edges);
    }

    // Calculate positions using BFS
    const positions = new Map<string, { x: number; y: number; level: number }>();
    const queue: Array<{ id: string; x: number; level: number }> = [];

    // Initialize roots
    roots.forEach((root, i) => {
      const x = i * 400;
      queue.push({ id: root.id, x, level: 0 });
    });

    while (queue.length > 0) {
      const { id, x, level } = queue.shift()!;

      if (positions.has(id)) continue;

      positions.set(id, { x, y: level * 200, level });

      const nodeChildren = children.get(id) || [];
      const childWidth = this.NODE_WIDTH + this.NODE_SEPARATION;
      const totalWidth = nodeChildren.length * childWidth;
      const startX = x - totalWidth / 2 + childWidth / 2;

      nodeChildren.forEach((childId, i) => {
        queue.push({
          id: childId,
          x: startX + i * childWidth,
          level: level + 1,
        });
      });
    }

    // Apply positions to nodes
    const layoutedNodes = nodes.map((node) => {
      const pos = positions.get(node.id) || { x: 0, y: 0, level: 0 };
      return {
        ...node,
        position: { x: pos.x, y: pos.y },
      };
    });

    return { nodes: layoutedNodes, edges };
  }
}
