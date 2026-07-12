/**
 * Phase 6 UI Components - Viewers
 * 
 * Enhanced visualization components for ludic deliberation integration:
 * - ArenaViewer: Arena tree with polarity coloring and path highlighting
 * - InteractionPlayer: Unified play/replay/simulate interface
 * - LandscapeHeatMap: Strategic landscape visualization with heat map
 * - ProofNarrative: Justified narrative display from proof traces
 */

export { ArenaViewer, default as ArenaViewerDefault } from "./ArenaViewer";
export type { ArenaViewerProps } from "./ArenaViewer";

export { InteractionPlayer, default as InteractionPlayerDefault } from "./InteractionPlayer";
export type { InteractionPlayerProps } from "./InteractionPlayer";

export { LandscapeHeatMap, default as LandscapeHeatMapDefault } from "./LandscapeHeatMap";
export type { LandscapeHeatMapProps } from "./LandscapeHeatMap";

export { ProofNarrative, default as ProofNarrativeDefault } from "./ProofNarrative";
export type { ProofNarrativeProps } from "./ProofNarrative";
