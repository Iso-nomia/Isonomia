// components/dialogue/minimap/types.ts
// types for minimap component in dialogue panels
export type NodeStatus = 'IN'|'OUT'|'UNDEC';
export type NodeKind = 'argument'|'claim';
export type EdgeKind = 'support'|'rebut'|'undercut';

export interface MinimapNode {
  id: string;                  // claimId or argumentId
  kind: NodeKind;
  label?: string;
  status: NodeStatus;
  closable?: boolean;          // † hint
  fogged?: boolean;            // unexplored (no WHY/GROUNDS)
  hasOpenCq?: number;          // count
  locusPath?: string | null;   // for focusing a branch
  endorsements?: number;       // optional overlay
  rejections?: number;
}

export interface MinimapEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface MinimapProps {
  nodes: MinimapNode[];
  edges: MinimapEdge[];
  selectedId?: string | null;
  onSelectNode?: (id: string, locusPath?: string | null) => void;  // scroll feed / open panel
  onHoverNode?: (id: string | null) => void;
  width?: number;
  height?: number;
  fogPolicy?: 'cqsBased'|'activityBased';
  showLegend?: boolean;
}
