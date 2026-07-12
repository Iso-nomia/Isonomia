// components/map/AifDiagramTestPageDagre.tsx
'use client';

import { useState } from 'react';
import AifDiagramView from '@/components/map/AifDiagramView';
import AifDiagramViewInteractive from '@/components/map/AifDiagramViewInteractive';
import AifDiagramViewSemanticZoom from '@/components/map/Aifdiagramviewsemanticzoom';
import { AifDiagramViewerDagre } from './Aifdiagramviewerdagre';
import { AIF_EXAMPLES, listAifExamples } from '@/components/map/aif-examples';
import type { AifNode } from '@/lib/arguments/diagram';

/**
 * Enhanced AIF Diagram Test Page - Phase 3 & 4
 * 
 * Features:
 * - Static view (Phase 1)
 * - Interactive expansion (Phase 2)
 * - Semantic zoom (Phase 3)
 * - Conflict type visualization (Phase 3)
 * - Dual-mode toggle (Phase 4)
 */
export default function AifDiagramTestPageDagre() {
  const [selectedExample, setSelectedExample] = useState<keyof typeof AIF_EXAMPLES>('defeasibleModusPonens');
  const [showMinimap, setShowMinimap] = useState(true);
  const [clickedNode, setClickedNode] = useState<AifNode | null>(null);
  
  // View mode: static, interactive, or semantic-zoom
  const [viewMode, setViewMode] = useState<'static' | 'interactive' | 'semantic-zoom' | 'complete'>('static');
  
  // Demo controls
  const [showConflictLegend, setShowConflictLegend] = useState(true);
  const [autoExpand, setAutoExpand] = useState(false);

  const examples = listAifExamples();
  const currentGraph = AIF_EXAMPLES[selectedExample];
  const rootArgumentId = currentGraph.nodes.find(n => n.kind === 'RA')?.id || '';

  const handleNodeClick = (node: AifNode) => {
    setClickedNode(node);
    console.log('Clicked node:', node);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            AIF Diagram Viewer - Phase 3 & 4 Demo
          </h1>
          <p className="text-slate-600">
            Advanced features: Conflict visualization, semantic zoom, and interactive exploration
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <div className="flex items-start justify-between gap-6">
            {/* Example selector */}
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Select Example
              </label>
              <div className="grid grid-cols-2 gap-2">
                {examples.map((ex) => (
                  <button
                    key={ex.name}
                    onClick={() => setSelectedExample(ex.name as keyof typeof AIF_EXAMPLES)}
                    className={`text-left px-4 py-3 rounded-lg border-2 transition-all ${
                      selectedExample === ex.name
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{ex.description}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {ex.nodeCount} nodes
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Settings */}
            <div className="flex-shrink-0 w-72">
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Display Settings
              </label>
              
              {/* View Mode Toggle */}
              <div className="mb-4">
                <div className="text-xs text-slate-600 mb-2">Viewer Type</div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setViewMode('static')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                      viewMode === 'static'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <div className="font-semibold">Static View</div>
                    <div className="text-[10px] opacity-80">Phase 1 - Basic rendering</div>
                  </button>
                  <button
                    onClick={() => setViewMode('interactive')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                      viewMode === 'interactive'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <div className="font-semibold">Interactive</div>
                    <div className="text-[10px] opacity-80">Phase 2 - Click to expand</div>
                  </button>
                  <button
                    onClick={() => setViewMode('semantic-zoom')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                      viewMode === 'semantic-zoom'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >

                            
                    <div className="font-semibold">Semantic Zoom</div>
                    <div className="text-[10px] opacity-80">Phase 3 - Zoom with detail levels</div>
                                      </button>
                                                     <button
                    onClick={() => setViewMode('complete')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                      viewMode === 'complete'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >


                          <div className="font-semibold">Complete Viewer</div>
                    <div className="text-[10px] opacity-80">Phase 4</div>
                  </button>
                </div>
              </div>

              {/* Additional controls */}
              <div className="space-y-2 border-t border-slate-200 pt-3">
                {viewMode === 'static' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showMinimap}
                      onChange={(e) => setShowMinimap(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span className="text-sm text-slate-700">Show minimap</span>
                  </label>
                )}
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showConflictLegend}
                    onChange={(e) => setShowConflictLegend(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Show conflict legend</span>
                </label>

                {viewMode !== 'static' && (
                  <label className="flex items-center gap-2 cursor-pointer opacity-50">
                    <input
                      type="checkbox"
                      checked={autoExpand}
                      onChange={(e) => setAutoExpand(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded"
                      disabled
                    />
                    <span className="text-sm text-slate-700">Auto-expand (coming soon)</span>
                  </label>
                )}
              </div>

              {/* Graph stats */}
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="text-xs font-semibold text-slate-700 mb-2">Graph Statistics</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="bg-slate-50 rounded p-2">
                    <div className="text-slate-500">Nodes</div>
                    <div className="font-semibold text-slate-900">{currentGraph.nodes.length}</div>
                  </div>
                  <div className="bg-slate-50 rounded p-2">
                    <div className="text-slate-500">Edges</div>
                    <div className="font-semibold text-slate-900">{currentGraph.edges.length}</div>
                  </div>
                  <div className="bg-yellow-50 rounded p-2">
                    <div className="text-yellow-600">I-Nodes</div>
                    <div className="font-semibold text-yellow-900">
                      {currentGraph.nodes.filter(n => n.kind === 'I').length}
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded p-2">
                    <div className="text-blue-600">RA-Nodes</div>
                    <div className="font-semibold text-blue-900">
                      {currentGraph.nodes.filter(n => n.kind === 'RA').length}
                    </div>
                  </div>
                  <div className="bg-red-50 rounded p-2">
                    <div className="text-red-600">CA-Nodes</div>
                    <div className="font-semibold text-red-900">
                      {currentGraph.nodes.filter(n => n.kind === 'CA').length}
                    </div>
                  </div>
                  <div className="bg-green-50 rounded p-2">
                    <div className="text-green-600">PA-Nodes</div>
                    <div className="font-semibold text-green-900">
                      {currentGraph.nodes.filter(n => n.kind === 'PA').length}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Conflict Type Legend */}
        {showConflictLegend && (
          <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl border border-red-200 p-4 mb-6">
            <div className="text-sm font-semibold text-red-900 mb-3">
              🎨 Phase 3: Conflict Type Visualization
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-2 bg-white rounded-lg p-2">
                <span className="text-xl">⊥</span>
                <div>
                  <div className="font-semibold text-red-700">Rebut</div>
                  <div className="text-red-600">Direct rebuttal</div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white rounded-lg p-2">
                <span className="text-xl">⇏</span>
                <div>
                  <div className="font-semibold text-amber-700">Undercut</div>
                  <div className="text-amber-600">Inference attack</div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white rounded-lg p-2">
                <span className="text-xl">⊗</span>
                <div>
                  <div className="font-semibold text-pink-700">Undermine</div>
                  <div className="text-pink-600">Premise challenge</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Diagram viewer */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              {viewMode === 'static' && 'Static Viewer'}
              {viewMode === 'interactive' && 'Interactive Viewer'}
              {viewMode === 'semantic-zoom' && 'Semantic Zoom Viewer'}
            </h2>
            <div className="flex items-center gap-4">
              {viewMode !== 'static' && (
                <div className="text-xs text-slate-500">
                  Click RA-nodes to expand (requires API)
                </div>
              )}
              {viewMode === 'semantic-zoom' && (
                <div className="text-xs text-indigo-600 font-medium">
                  🔍 Scroll to zoom · Shift + Drag to pan
                </div>
              )}
            </div>
          </div>

          {viewMode === 'static' && (
            <AifDiagramView
              aif={currentGraph}
              className="h-[600px]"
              showMinimap={showMinimap}
              onNodeClick={handleNodeClick}
            />
          )}

          {viewMode === 'interactive' && (
            <AifDiagramViewInteractive
              initialAif={currentGraph}
              rootArgumentId={rootArgumentId}
              className="h-[600px]"
              enableExpansion={true}
              maxDepth={3}
              onNodeClick={handleNodeClick}
            />
          )}

          {viewMode === 'semantic-zoom' && (
            <AifDiagramViewSemanticZoom
              initialAif={currentGraph}
              rootArgumentId={rootArgumentId}
              className="h-[600px]"
              enableExpansion={true}
              maxDepth={3}
              onNodeClick={handleNodeClick}
            />
          )}
          {viewMode === 'complete' && (
            <AifDiagramViewerDagre
              initialGraph={currentGraph}
              onNodeClick={(nodeId: string) => {
                const node = currentGraph.nodes.find(n => n.id === nodeId) || null;
                setClickedNode(node);
                console.log("Clicked node:", node);
              }}
              className="h-[600px]"
            />
          )}
        </div>

        {/* Clicked node info */}
        {clickedNode && (
          <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Selected Node Details
            </h3>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500 mb-1">ID</div>
                <div className="font-mono text-xs text-slate-900">{clickedNode.id}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Kind</div>
                <div className="font-semibold text-slate-900">{clickedNode.kind}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Label</div>
                <div className="text-slate-900">{clickedNode.label || '(none)'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Scheme</div>
                <div className="text-slate-900">{clickedNode.schemeKey || '(none)'}</div>
              </div>
            </div>
            {(clickedNode as AifNode & { text?: string | null }).text && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <div className="text-xs text-slate-500 mb-1">Content</div>
                <div className="text-sm text-slate-700">{(clickedNode as AifNode & { text?: string | null }).text}</div>
              </div>
            )}
          </div>
        )}

        {/* Feature showcase */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">
              ✅ Completed Features
            </h3>
            <ul className="space-y-2 text-xs text-blue-800">
              <li className="flex gap-2">
                <span>✓</span>
                <span>Phase 1: Static AIF rendering with proper node types</span>
              </li>
              <li className="flex gap-2">
                <span>✓</span>
                <span>Phase 2: Interactive expansion with neighborhood loading</span>
              </li>
              <li className="flex gap-2">
                <span>✓</span>
                <span>Phase 3: Conflict type visualization (rebut/undercut/undermine)</span>
              </li>
              <li className="flex gap-2">
                <span>✓</span>
                <span>Phase 3: Semantic zoom with detail levels</span>
              </li>
              <li className="flex gap-2">
                <span>✓</span>
                <span>Phase 4: Dual-mode viewer (Toulmin ↔ AIF toggle)</span>
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              🚀 Next Steps
            </h3>
            <ul className="space-y-2 text-xs text-slate-700">
              <li className="flex gap-2">
                <span>→</span>
                <span>Implement API routes for real neighborhood expansion</span>
              </li>
              <li className="flex gap-2">
                <span>→</span>
                <span>Add minimap to semantic zoom viewer</span>
              </li>
              <li className="flex gap-2">
                <span>→</span>
                <span>Highlight argument paths through the graph</span>
              </li>
              <li className="flex gap-2">
                <span>→</span>
                <span>Add search within graph functionality</span>
              </li>
              <li className="flex gap-2">
                <span>→</span>
                <span>Export graphs as SVG/PNG</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-indigo-50 rounded-xl border border-indigo-200 p-6">
          <h3 className="text-sm font-semibold text-indigo-900 mb-3">
            💡 Usage Guide
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="font-semibold text-sm text-indigo-900 mb-2">Static View</div>
              <ul className="space-y-1 text-xs text-indigo-800">
                <li>• Shift + Drag to pan</li>
                <li>• Mouse wheel to zoom</li>
                <li>• Minimap for overview</li>
                <li>• Click nodes for details</li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-sm text-indigo-900 mb-2">Interactive View</div>
              <ul className="space-y-1 text-xs text-indigo-800">
                <li>• Click RA-nodes to expand</li>
                <li>• Use filters to control expansion</li>
                <li>• Max depth prevents infinite expansion</li>
                <li>• Badge shows connection count</li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-sm text-indigo-900 mb-2">Semantic Zoom</div>
              <ul className="space-y-1 text-xs text-indigo-800">
                <li>• Scroll to zoom (0.2x - 3x)</li>
                <li>• Details adjust automatically</li>
                <li>• Shift + Drag to pan</li>
                <li>• Reset view button available</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Raw data viewer */}
        <details className="mt-6 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900 hover:text-indigo-600">
            📋 View Raw Graph Data (JSON)
          </summary>
          <pre className="mt-4 text-xs bg-slate-50 rounded-lg p-4 overflow-auto max-h-96 border border-slate-200">
            {JSON.stringify(currentGraph, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}