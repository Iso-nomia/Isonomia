'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
// @ts-ignore - cytoscape-navigator ships no type declarations
import navigator from 'cytoscape-navigator';
import CyCanvas from './CyCanvas';
import SchemeOverlayFetch from './SchemeOverlayFetch';
import HullOverlay from './HullOverlay';

cytoscape.use(navigator);
try {
  // avoid double-registration
  (cytoscape as any).__dagre__ || (cytoscape as any).use(dagre);
  (cytoscape as any).__dagre__ = true;
} catch {}

const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

type GraphNode = {
  id: string;
  text: string;
  approvals?: number;
  schemeIcon?: string | null;
};
type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: 'supports' | 'rebuts'; // normalized
  attackType?: 'SUPPORTS' | 'REBUTS' | 'UNDERCUTS' | 'UNDERMINES';
  targetScope?: 'premise' | 'inference' | 'conclusion' | null;
};
type GraphResponse = { nodes: GraphNode[]; edges: GraphEdge[]; version?: number | string };

export default function BipolarLens({
  deliberationId,
  height = 420,
}: {
  deliberationId: string;
  height?: number;
}) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [extraQuery, setExtraQuery] = useState(''); // cluster focus query suffix
  const [showHulls, setShowHulls] = useState<boolean>(() => {
    try { return localStorage.getItem('graph:showHulls') === '1'; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('graph:showHulls', showHulls ? '1' : '0'); } catch {}
  }, [showHulls]);

  const hasFocus = /focusClusterId=|focusClusterIds=/.test(extraQuery);

  // Listen for single or dual cluster focus
  useEffect(() => {
    const handler = (ev: any) => {
      if (ev?.detail?.deliberationId !== deliberationId) return;
      const ids: string[] = ev.detail.clusterIds || (ev.detail.clusterId ? [ev.detail.clusterId] : []);
      if (ids.length >= 2) {
        setExtraQuery(`&focusClusterIds=${encodeURIComponent(ids.join(','))}`);
      } else if (ids.length === 1) {
        setExtraQuery(`&focusClusterId=${encodeURIComponent(ids[0])}`);
      } else {
        setExtraQuery('');
      }
    };
    window.addEventListener('mesh:graph:focusCluster', handler as any);
    return () => window.removeEventListener('mesh:graph:focusCluster', handler as any);
  }, [deliberationId]);

  // Optional: compare pill labels
  const focusedPairs = useMemo(() => {
    const m = extraQuery.match(/focusClusterIds=([^&]+)/);
    if (!m) return null;
    const decoded = decodeURIComponent(m[1] || '');
    const ids = decoded.split(',').filter(Boolean);
    return ids.length === 2 ? (ids as [string, string]) : null;
  }, [extraQuery]);

  const radius = 1;
  const maxNodes = 400;

  const key = useMemo(() => {
    if (!deliberationId) return null;
    const base = `/api/deliberations/${deliberationId}/graph?lens=bipolar&maxNodes=${maxNodes}`;
    const focusPart = focusId ? `&focus=${focusId}&radius=${radius}` : '';
    // include cluster focus extras so server can constrain nodes/edges
    return `${base}${focusPart}${extraQuery}`;
  }, [deliberationId, focusId, extraQuery]);

  const { data } = useSWR<GraphResponse>(key, fetcher, { revalidateOnFocus: false });

  // for compare pill labels (optional)
  const { data: cl } = useSWR<{ items: { id: string; label: string }[] }>(
    focusedPairs ? `/api/deliberations/${deliberationId}/clusters?type=topic` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const labelFor = (id: string) => cl?.items?.find(x => x.id === id)?.label ?? id.slice(0, 6);

  function clearCompare() {
    window.dispatchEvent(
      new CustomEvent('mesh:graph:focusCluster', { detail: { deliberationId, clusterIds: [] } })
    );
    setExtraQuery('');
  }

  // preview bridges (dotted inter-cluster links)
  const { data: preview } = useSWR<{ pairs: Array<{ source: string; target: string }> }>(
    focusedPairs
      ? `/api/deliberations/${deliberationId}/bridges/preview?clusterA=${encodeURIComponent(
          focusedPairs[0]
        )}&clusterB=${encodeURIComponent(focusedPairs[1])}&limit=60`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const cyRef = useRef<cytoscape.Core | null>(null);

  // Build Cy elements from server data (support + attacks)
  const elements = useMemo(() => {
    if (!data) return [];
    const els: any[] = [];
    const stubIds = new Set<string>();

    const addStub = (src: string, tgt: string) => {
      const id = `warrant:${src}:${tgt}`;
      if (!stubIds.has(id)) {
        stubIds.add(id);
        els.push({ data: { id, label: 'warrant' }, classes: 'warrant-stub' });
      }
      return id;
    };

    for (const n of data.nodes) {
      els.push({
        data: {
          id: n.id,
          label: n.text.length > 80 ? n.text.slice(0, 77) + '…' : n.text,
          approvals: n.approvals ?? 0,
          schemeIcon: n.schemeIcon ?? null,
        },
        classes: n.schemeIcon ? 'has-scheme' : '',
      });
    }

    for (const e of data.edges) {
      // UNDERCUTS: src → [warrant-stub] → tgt (dash purple into stub; dotted link to target)
      if (e.attackType === 'UNDERCUTS') {
        const stub = addStub(e.source, e.target);
        els.push({
          data: { id: e.id, source: e.source, target: stub, scope: 'I', targetScope: 'inference' },
          classes: 'edge undercut',
        });
        els.push({ data: { id: `${e.id}:stub`, source: stub, target: e.target }, classes: 'stublink' });
        continue;
      }

      // UNDERMINES: premise-level attack (dash amber)
      if (e.attackType === 'UNDERMINES') {
        els.push({
          data: { id: e.id, source: e.source, target: e.target, scope: 'P', targetScope: 'premise' },
          classes: 'edge undermine',
        });
        continue;
      }

      // REBUTS vs SUPPORTS (conclusion-level by default)
      if (e.type === 'rebuts' || e.attackType === 'REBUTS') {
        els.push({
          data: { id: e.id, source: e.source, target: e.target, scope: 'C', targetScope: e.targetScope ?? 'conclusion' },
          classes: 'edge rebut',
        });
      } else {
        els.push({
          data: { id: e.id, source: e.source, target: e.target, targetScope: e.targetScope ?? null },
          classes: 'edge support',
        });
      }
    }

    // preview bridges (dotted)
    if (preview?.pairs?.length) {
      for (const p of preview.pairs) {
        els.push({
          data: { id: `preview:${p.source}:${p.target}`, source: p.source, target: p.target },
          classes: 'preview-bridge',
        });
      }
    }

    return els;
  }, [data, preview]);

  // Stylesheet (support + attack + scopes + scheme icons)
  const stylesheet: cytoscape.StylesheetStyle[] = [
    {
      selector: 'node',
      style: {
        shape: 'round-rectangle',
        'background-color': '#f1f5f9',
        label: 'data(label)',
        'font-size': '11px',
        'text-wrap': 'wrap',
        'text-max-width': '180px',
        'text-valign': 'center',
        'text-halign': 'center',
        padding: '8px',
        width: 'label',
        height: 'label',
        'border-width': 1,
        'border-color': (ele: any) => {
          const a = ele.data('approvals') ?? 0;
          const capped = Math.min(a, 20);
          const hue = (capped / 20) * 120; // 0 red → 120 green
          return `hsl(${hue},70%,45%)`;
        },
      },
    },
    {
      selector: 'node.warrant-stub',
      style: {
        shape: 'round-rectangle',
        'background-color': '#f5f3ff',
        'border-color': '#ddd6fe',
        width: 40,
        height: 18,
        label: 'data(label)',
        'font-size': '10px',
        color: '#6d28d9',
      },
    },
    {
      selector: 'edge',
      style: {
        'curve-style': 'bezier',
        width: 2,
        'target-arrow-shape': 'triangle',
        label: (ele: any) => {
          const scope = ele.data('scope') || ele.data('targetScope');
          if (scope === 'premise' || scope === 'P') return 'P';
          if (scope === 'inference' || scope === 'I') return 'I';
          if (scope === 'conclusion' || scope === 'C') return 'C';
          return '';
        },
        'font-size': '8px',
        'text-background-opacity': 0.85,
        'text-background-color': '#fff',
        'text-background-padding': "1",
      },
    },
    { selector: 'edge.support',   style: { 'line-color': '#22c55e', 'target-arrow-color': '#22c55e' } },
    { selector: 'edge.rebut',     style: { 'line-color': '#ef4444', 'target-arrow-color': '#ef4444' } },
    { selector: 'edge.undermine', style: { 'line-color': '#f59e0b', 'target-arrow-color': '#f59e0b', 'line-style': 'dashed' } },
    { selector: 'edge.undercut',  style: { 'line-color': '#7c3aed', 'target-arrow-color': '#7c3aed', 'line-style': 'dashed' } },
    { selector: 'edge.stublink',  style: { 'line-color': '#c7d2fe', 'line-style': 'dotted', 'target-arrow-shape': 'none', width: 1 } },
    {
      selector: 'edge.preview-bridge',
      style: {
        'curve-style': 'bezier',
        'line-style': 'dotted',
        'line-color': '#94a3b8', // slate-400
        'target-arrow-color': '#94a3b8',
        'target-arrow-shape': 'vee',
        width: 1.5,
        opacity: 0.85,
      },
    },
    {
      selector: 'node.has-scheme',
      style: {
        'background-image': 'data(schemeIcon)',
        'background-fit': 'none',
        'background-width': 14,
        'background-height': 14,
        'background-position-x': '95%',
        'background-position-y': '5%',
      },
    },
    { selector: '.faded', style: { opacity: 0.15 } },
    // Optional pulse style (if you already have CSS elsewhere, you can remove this)
    {
      selector: 'node.pulse',
      style: {
        'border-width': 3,
        'border-color': '#6366f1',
      },
    },
  ];

  const cacheKey = `cy-layout:bipolar:${deliberationId}`;

  function runLayout() {
    cyRef.current?.layout({ name: 'dagre', nodeSep: 30, rankSep: 70, rankDir: 'TB', padding: 20 } as any).run();
  }
  function saveLayout() {
    if (!cyRef.current) return;
    const positions: Record<string, { x: number; y: number }> = {};
    cyRef.current.nodes().forEach(n => { positions[n.id()] = n.position(); });
    try { localStorage.setItem(cacheKey, JSON.stringify(positions)); } catch {}
  }
  function loadLayout(): boolean {
    if (!cyRef.current) return false;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return false;
      const positions = JSON.parse(raw);
      cyRef.current.nodes().forEach(n => { if (positions[n.id()]) n.position(positions[n.id()]); });
      cyRef.current.fit();
      return true;
    } catch { return false; }
  }

  // Mount/update graph
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !data) return;
    cy.startBatch();
    cy.elements().remove();
    cy.add(elements as any);
    cy.endBatch();
    if (!loadLayout()) runLayout();
  }, [data, elements]);

  // Ready hook
  function handleReady(cy: cytoscape.Core) {
    cyRef.current = cy;

    const restored = loadLayout();
    if (!restored) {
      cy.layout({ name: 'dagre', nodeSep: 30, rankSep: 70, rankDir: 'TB', padding: 20 } as any).run();
    }
    cy.on('layoutstop', saveLayout);

    // Node tap → focus
    cy.on('tap', 'node', evt => {
      const id = evt.target.id();
      setFocusId(prev => (prev === id ? null : id));
    });

    // External “focus node” bus (e.g., from lists)
    const focusListener = (ev: any) => {
      const id = ev?.detail?.id;
      if (!id || !cyRef.current) return;
      const ele = cyRef.current.getElementById(id);
      if (ele && ele.nonempty()) {
        cyRef.current.animate({ center: { eles: ele }, duration: 300 });
        ele.addClass('pulse');
        setTimeout(() => ele.removeClass('pulse'), 1200);
      }
    };
    window.addEventListener('mesh:graph:focusNode', focusListener);
    cy.on('destroy', () => window.removeEventListener('mesh:graph:focusNode', focusListener));
  }

  // Focus/fade effect
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    if (focusId) {
      cy.elements().addClass('faded');
      cy.getElementById(focusId).closedNeighborhood().removeClass('faded');
    } else {
      cy.elements().removeClass('faded');
    }
  }, [focusId]);

  return (
    <div className="relative z-10 rounded border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 text-xs text-neutral-600">
        <div className="flex items-center gap-2">
          <span>Bipolar (support + attack)</span>
          {focusedPairs && (
            <div className="ml-2 inline-flex items-center gap-2 px-2 py-0.5 rounded border bg-slate-50">
              <span className="text-[11px]">
                Compare:&nbsp;
                <strong>{labelFor(focusedPairs[0])}</strong> vs <strong>{labelFor(focusedPairs[1])}</strong>
              </span>
              <button className="text-[11px] underline" onClick={clearCompare}>Clear</button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <i className="inline-block w-3 h-[2px] bg-green-500" /> support
            <i className="inline-block w-3 h-[2px] bg-red-500" /> rebut
            <i className="inline-block w-3 h-[2px] bg-amber-500" /> undermine (P)
            <i className="inline-block w-3 h-[2px] bg-violet-600" /> undercut (I)
          </div>
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={showHulls} onChange={(e) => setShowHulls(e.target.checked)} />
            Show hulls
          </label>
          <button className="px-2 py-0.5 border rounded" onClick={runLayout}>
            Re‑layout
          </button>
        </div>
      </div>

      <div className="relative">
        <CyCanvas elements={elements} stylesheet={stylesheet} height={height} onReady={handleReady} />
        {hasFocus && showHulls && <HullOverlay cy={cyRef.current} height={height} enabled />}
      </div>

      {/* Scheme badges + CQ tap hook (same overlay you use in AF lens) */}
      <SchemeOverlayFetch
        deliberationId={deliberationId}
        cy={cyRef.current}
        onOpenCQ={(id) => console.log('CQ for', id)}
      />
    </div>
  );
}
