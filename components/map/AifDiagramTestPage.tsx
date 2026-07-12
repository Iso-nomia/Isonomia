//components/map/AifDiagramTestPage.tsx

'use client';

import { useState } from 'react';
import AifDiagramView from '@/components/map/AifDiagramView';
import AifDiagramViewInteractive from '@/components/map/AifDiagramViewInteractive';
import { AIF_EXAMPLES, listAifExamples } from '@/components/map/aif-examples';
import type { AifNode } from '@/lib/arguments/diagram';


/**
 * AIF Diagram Test Page
 * Use this to preview and test all AIF diagram examples
 * 
 * To use:
 * 1. Create a page: app/test/aif-diagrams/page.tsx
 * 2. Import and render this component
 * 3. Navigate to /test/aif-diagrams
 */
export default function AifDiagramTestPage() {
  const [selectedExample, setSelectedExample] = useState<keyof typeof AIF_EXAMPLES>('defeasibleModusPonens');
  const [showMinimap, setShowMinimap] = useState(true);
  const [clickedNode, setClickedNode] = useState<AifNode | null>(null);
  const [viewMode, setViewMode] = useState<'static' | 'interactive'>('static');

  const examples = listAifExamples();
  const currentGraph = AIF_EXAMPLES[selectedExample];

  const handleNodeClick = (node: AifNode) => {
    setClickedNode(node);
    console.log('Clicked node:', node);
  };

  // Extract root argument ID from the graph (first RA node)
  const rootArgumentId = currentGraph.nodes.find(n => n.kind === 'RA')?.id || '';

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            AIF Diagram Viewer - Test Page
          </h1>
          <p className="text-slate-600">
            Interactive preview of AIF (Argument Interchange Format) graphs based on the standard specification
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
            <div className="flex-shrink-0 w-64">
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Display Settings
              </label>
              
              {/* View Mode Toggle */}
              <div className="mb-4">
                <div className="text-xs text-slate-600 mb-2">View Mode</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode('static')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      viewMode === 'static'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Static
                  </button>
                  <button
                    onClick={() => setViewMode('interactive')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      viewMode === 'interactive'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Interactive
                  </button>
                </div>
              </div>

              {/* Minimap toggle (only for static view) */}
              {viewMode === 'static' && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showMinimap}
                      onChange={(e) => setShowMinimap(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700">Show minimap</span>
                  </label>
                </div>
              )}

              {/* Graph stats */}
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="text-xs font-semibold text-slate-700 mb-2">Graph Statistics</div>
                <div className="space-y-1 text-xs text-slate-600">
                  <div>Nodes: {currentGraph.nodes.length}</div>
                  <div>Edges: {currentGraph.edges.length}</div>
                  <div>
                    I-Nodes: {currentGraph.nodes.filter(n => n.kind === 'I').length}
                  </div>
                  <div>
                    RA-Nodes: {currentGraph.nodes.filter(n => n.kind === 'RA').length}
                  </div>
                  <div>
                    CA-Nodes: {currentGraph.nodes.filter(n => n.kind === 'CA').length}
                  </div>
                  <div>
                    PA-Nodes: {currentGraph.nodes.filter(n => n.kind === 'PA').length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Diagram viewer */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              {viewMode === 'static' ? 'Static Viewer' : 'Interactive Viewer'}
            </h2>
            {viewMode === 'interactive' && (
              <div className="text-xs text-slate-500">
                Click RA-nodes to expand neighborhoods (requires API)
              </div>
            )}
          </div>

          {viewMode === 'static' ? (
            <AifDiagramView
              aif={currentGraph}
              className="h-[600px]"
              showMinimap={showMinimap}
              onNodeClick={handleNodeClick}
            />
          ) : (
            <AifDiagramViewInteractive
              initialAif={currentGraph}
              rootArgumentId={rootArgumentId}
              className="h-[600px]"
              enableExpansion={true}
              maxDepth={3}
              onNodeClick={handleNodeClick}
            />
          )}
        </div>

        {/* Clicked node info */}
        {clickedNode && (
          <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Last Clicked Node
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
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 bg-indigo-50 rounded-xl border border-indigo-200 p-6">
          <h3 className="text-sm font-semibold text-indigo-900 mb-3">
            💡 Usage Tips
          </h3>
          <ul className="space-y-2 text-sm text-indigo-900">
            {viewMode === 'static' ? (
              <>
                <li className="flex gap-2">
                  <span className="text-indigo-400">•</span>
                  <span><strong>Pan:</strong> Hold Shift + Drag the diagram</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400">•</span>
                  <span><strong>Zoom:</strong> Use mouse wheel to zoom in/out</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400">•</span>
                  <span><strong>Reset:</strong> Click "Reset View" button to fit the entire graph</span>
                </li>
              </>
            ) : (
              <>
                <li className="flex gap-2">
                  <span className="text-indigo-400">•</span>
                  <span><strong>Expand:</strong> Click RA-nodes to load their neighborhoods</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400">•</span>
                  <span><strong>Filter:</strong> Use the filters to control what gets loaded</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400">•</span>
                  <span><strong>Depth:</strong> Expansion is limited to max depth setting</span>
                </li>
              </>
            )}
            <li className="flex gap-2">
              <span className="text-indigo-400">•</span>
              <span><strong>Hover:</strong> Hover over edges to see their role labels</span>
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-400">•</span>
              <span><strong>Click:</strong> Click any node to see its details below</span>
            </li>
          </ul>
        </div>

        {/* Raw data viewer (optional) */}
        <details className="mt-6 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900 hover:text-indigo-600">
            View Raw Graph Data (JSON)
          </summary>
          <pre className="mt-4 text-xs bg-slate-50 rounded-lg p-4 overflow-auto max-h-96 border border-slate-200">
            {JSON.stringify(currentGraph, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}