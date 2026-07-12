'use client';
import * as React from 'react';
import useSWR, { mutate as globalMutate } from 'swr';

type MapNode = {
  id: string;
  argumentId: string;
  kind: 'claim'|'reason'|'counter'|'evidence';
  text: string;
  start: number;
  end: number;
  createdAt: string | null;
};
type MapEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  kind: 'supports'|'rebuts'|'relates'|'evidence';
  meta?: any;
  createdAt?: string;
};

const fetcher = async (u: string) => {
  const r = await fetch(u, { cache: 'no-store' });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`${r.status} ${r.statusText} – ${u}\n${text}`);
  }
  return r.json();
};

const COLORS: Record<MapNode['kind'], string> = {
  claim:    '#2563eb',   // blue
  reason:   '#059669',   // emerald
  counter:  '#dc2626',   // red
  evidence: '#7c3aed',   // violet
};

const EDGE_COLORS: Record<MapEdge['kind'], string> = {
  supports: '#059669',
  rebuts:   '#dc2626',
  relates:  '#64748b',
  evidence: '#7c3aed',
};

type Pos = { x:number; y:number; vx:number; vy:number; fixed?:boolean };

export default function MapCanvas({
  deliberationId,
  height = 480,
  linkDistance = 120,
  charge = 800,     // larger = more repulsion
  spring = 0.03,    // link strength
  damping = 0.85,   // velocity decay
}: {
  deliberationId: string;
  height?: number;
  linkDistance?: number;
  charge?: number;
  spring?: number;
  damping?: number;
}) {
  const [size, setSize] = React.useState<{w:number; h:number}>({ w: 960, h: height });
  const containerRef = React.useRef<HTMLDivElement|null>(null);

  const nodesKey = `/api/map/nodes?deliberationId=${encodeURIComponent(deliberationId)}`;
  const edgesKey = `/api/map/edges?deliberationId=${encodeURIComponent(deliberationId)}`;
  const { data: ndata } = useSWR<{ok:true; nodes:MapNode[]}>(nodesKey, fetcher);
  const { data: edata } = useSWR<{ok:true; edges:MapEdge[]}>(edgesKey, fetcher);

  const nodes = React.useMemo(()=> ndata?.nodes ?? [], [ndata]);
  const edges = React.useMemo(()=> edata?.edges ?? [], [edata]);

  // positions map
  const [pos, setPos] = React.useState<Record<string, Pos>>({});
  const posRef = React.useRef(pos);
React.useEffect(() => { posRef.current = pos }, [pos]);

  // pan/zoom
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });

  // selection for edge creation / highlight
  const [selected, setSelected] = React.useState<string|null>(null);
  const [hovered, setHovered] = React.useState<string|null>(null);
  const [edgeKind, setEdgeKind] = React.useState<MapEdge['kind']>('relates');
  const [seeding, setSeeding] = React.useState(false);
const hasData = nodes.length > 0 || edges.length > 0;

async function seedFromArguments() {
  setSeeding(true);
  try {
    const r = await fetch('/api/map/seed', {
      method: 'POST', headers: {'content-type':'application/json'},
      body: JSON.stringify({ deliberationId }),
    });
    const j = await r.json().catch(()=>null);
    // force-refresh both lists
    await Promise.all([globalMutate(nodesKey), globalMutate(edgesKey)]);
  } finally {
    setSeeding(false);
  }
}


  React.useEffect(() => {
  const onRefresh = (ev: any) => {
    if (ev?.detail?.deliberationId && ev.detail.deliberationId !== deliberationId) return;
    globalMutate(nodesKey);
    globalMutate(edgesKey);
  };
  window.addEventListener('map:refresh', onRefresh as any);
  return () => window.removeEventListener('map:refresh', onRefresh as any);
}, [nodesKey, edgesKey, deliberationId]);

  // fit container width
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth || 960, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  // initialize positions for new nodes
  React.useEffect(() => {
    if (!nodes.length) {
      setPos({});
      return;
    }
    setPos((prev) => {
      const next = { ...prev };
      // scatter new nodes
      for (const n of nodes) {
        if (!next[n.id]) {
          next[n.id] = {
            x: (Math.random() - 0.5) * size.w * 0.6,
            y: (Math.random() - 0.5) * size.h * 0.6,
            vx: 0, vy: 0,
          };
        }
      }
      // prune positions that no longer exist
      for (const k of Object.keys(next)) {
        if (!nodes.find(n => n.id === k)) delete next[k];
      }
      return next;
    });
  }, [nodes, size.w, size.h]);

  // basic force simulation
  // basic force simulation (robust to async position seeding)
React.useEffect(() => {
  let raf = 0;
  let alive = true;
  let ticks = 0;

  function step() {
    if (!alive) return;
    ticks++;

    // always read latest positions
    const p: Record<string, Pos> = { ...posRef.current };

    // safety: ensure every node has a point
    for (const n of nodes) {
      if (!p[n.id]) {
        p[n.id] = {
          x: (Math.random() - 0.5) * size.w * 0.6,
          y: (Math.random() - 0.5) * size.h * 0.6,
          vx: 0, vy: 0
        };
      }
    }

    // --- repulsion (O(n^2)) ---
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]; const pa = p[a.id]; if (!pa) continue;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]; const pb = p[b.id]; if (!pb) continue;
        const dx = pa.x - pb.x, dy = pa.y - pb.y;
        let d2 = dx*dx + dy*dy;
        if (d2 < 40) d2 = 40;
        const f  = charge / d2;
        const invd = 1 / Math.sqrt(d2);
        const fx = f * dx * invd;
        const fy = f * dy * invd;
        if (!pa.fixed) { pa.vx +=  fx; pa.vy +=  fy; }
        if (!pb.fixed) { pb.vx += -fx; pb.vy += -fy; }
      }
    }

    // --- springs (edges) ---
    for (const e of edges) {
      const a = p[e.fromNodeId]; const b = p[e.toNodeId];
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.max(1, Math.sqrt(dx*dx + dy*dy));
      const diff = d - linkDistance;
      const k = spring * diff;
      const fx = k * (dx / d);
      const fy = k * (dy / d);
      if (!a.fixed) { a.vx +=  fx; a.vy +=  fy; }
      if (!b.fixed) { b.vx += -fx; b.vy += -fy; }
    }

    // --- integrate + damping + mild centering ---
    for (const id of Object.keys(p)) {
      const pt = p[id];
      if (!pt.fixed) {
        pt.vx *= damping; pt.vy *= damping;
        pt.x = pt.x + pt.vx + (-pt.x * 0.002);
        pt.y = pt.y + pt.vy + (-pt.y * 0.002);
      }
    }

    setPos(p);
    if (ticks < 600) raf = requestAnimationFrame(step);
  }

  raf = requestAnimationFrame(step);
  return () => { alive = false; cancelAnimationFrame(raf); };
// restart when the set of nodes/edges or constants change
}, [
  nodes.length, edges.length, // keep simple; ids-length is enough for restarts
  size.w, size.h,
  linkDistance, charge, spring, damping
]);

  // mouse interactions: drag node
  const dragState = React.useRef<{ id:string|null; last:{x:number;y:number} | null }>({ id:null, last:null });

  function toWorld(clientX:number, clientY:number) {
    const rect = containerRef.current?.getBoundingClientRect();
    const cx = (clientX - (rect?.left ?? 0) - pan.x) / zoom - size.w/2;
    const cy = (clientY - (rect?.top ?? 0) - pan.y) / zoom - size.h/2;
    return { x: cx, y: cy };
  }

  function onPointerDownNode(e:React.PointerEvent, id:string) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current.id = id;
    const world = toWorld(e.clientX, e.clientY);
    dragState.current.last = world;
    setPos(prev => ({ ...prev, [id]: { ...(prev[id] || {x:0,y:0,vx:0,vy:0}), fixed:true } }));
  }
  function onPointerMove(e:React.PointerEvent) {
    const d = dragState.current;
    if (!d.id || !d.last) return;
    const world = toWorld(e.clientX, e.clientY);
    const dx = world.x - d.last.x;
    const dy = world.y - d.last.y;
    setPos(prev => {
      const p = { ...prev };
      const pt = p[d.id!]; if (!pt) return prev;
      pt.x += dx; pt.y += dy;
      d.last = world;
      return p;
    });
  }
  function onPointerUp(e:React.PointerEvent) {
    const id = dragState.current.id;
    dragState.current = { id:null, last:null };
    if (id) {
      setPos(prev => ({ ...prev, [id]: { ...(prev[id]||{x:0,y:0,vx:0,vy:0}), fixed:false } }));
    }
  }

  // pan/zoom
  function onWheel(e:React.WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const dz = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(z => Math.max(0.2, Math.min(2.5, z * dz)));
    } else {
      setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }

  // create edge between selected → clicked
  async function createEdge(aId:string, bId:string) {
    if (aId === bId) return;
    try {
      await fetch('/api/map/edges', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ deliberationId, fromNodeId: aId, toNodeId: bId, kind: edgeKind }),
      });
      // refresh edges
      globalMutate(edgesKey);
      window.dispatchEvent(new CustomEvent('map:refresh', { detail: { deliberationId } }));
    } catch {}
  }

  function clickNode(id:string) {
    if (!selected) { setSelected(id); return; }
    // second click creates the edge
    createEdge(selected, id);
    setSelected(null);
  }

  function nodeStroke(id:string) {
    if (selected === id) return '#0ea5e9';
    if (hovered === id) return '#0ea5e9';
    return '#ffffff';
  }

  // compute transforms
  const viewTransform = `translate(${pan.x + size.w/2}, ${pan.y + size.h/2}) scale(${zoom})`;

  return (
    <div ref={containerRef} className="relative w-full" onWheel={onWheel} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
       {!hasData && (
      <div className="absolute z-20 left-2 top-2 rounded border bg-white/90 px-2 py-1 text-[11px]">
        <span className="mr-2 text-neutral-600">No map nodes yet.</span>
        <button
          className="px-2 py-0.5 rounded border bg-amber-50 border-amber-200 text-amber-700"
          onClick={seedFromArguments}
          disabled={seeding}
          title="Create one map node per argument and map edges from argument relations"
        >
          {seeding ? 'Seeding…' : 'Seed from arguments'}
        </button>
      </div>
    )}
      {/* Controls */}
      <div className="absolute z-10 top-2 left-2 bg-white/90 border rounded px-2 py-1 text-[11px] flex items-center gap-2">
        <span className="text-neutral-600">Add edge:</span>
        <select className="border rounded px-1 py-0.5" value={edgeKind} onChange={e=>setEdgeKind(e.target.value as any)}>
          <option value="relates">relates</option>
          <option value="supports">supports</option>
          <option value="rebuts">rebuts</option>
          <option value="evidence">evidence</option>
        </select>
        <button className="px-2 py-0.5 border rounded" onClick={()=>{ setSelected(null); setHovered(null); }}>Clear</button>
        <div className="ml-2 text-[10px] text-neutral-500">zoom: {zoom.toFixed(2)}</div>
      </div>

      {/* Legend */}
      <div className="absolute z-10 top-2 right-2 bg-white/90 border rounded px-2 py-1 text-[11px]">
        <div className="font-semibold mb-1">Legend</div>
        {(['claim','reason','counter','evidence'] as MapNode['kind'][]).map(k=>(
          <div key={k} className="flex items-center gap-2">
            <span style={{ background: COLORS[k], display:'inline-block', width:10, height:10, borderRadius:9999, border:'1px solid #fff' }}></span>
            <span>{k}</span>
          </div>
        ))}
      </div>
      <div className="absolute z-10 bottom-2 right-2 bg-white/90 border rounded px-2 py-1 text-[10px]">
  N:{nodes.length} E:{edges.length}
</div>

      {/* SVG scene */}
      <svg width="100%" height={size.h} style={{ background:'#f8fafc' }} onPointerDown={onPointerUp}>
        <g transform={viewTransform}>
          {/* Edges */}
          {edges.map(e => {
            const a = pos[e.fromNodeId]; const b = pos[e.toNodeId];
            if (!a || !b) return null;
            const col = EDGE_COLORS[e.kind] || '#64748b';
            const thick = (selected && (e.fromNodeId===selected || e.toNodeId===selected)) ? 2.5 : 1.4;
            return (
              <line
                key={e.id}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={col}
                strokeWidth={thick}
                opacity={0.9}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(n => {
            const p = pos[n.id]; if (!p) return null;
            const r = 10;
            const fill = COLORS[n.kind] || '#64748b';
            const stroke = nodeStroke(n.id);
            const strong = selected && selected === n.id;

            return (
              <g key={n.id} transform={`translate(${p.x} ${p.y})`} style={{ cursor:'pointer' }}
                 onPointerDown={(e)=>onPointerDownNode(e, n.id)}
                 onClick={()=>clickNode(n.id)}
                 onMouseEnter={()=>setHovered(n.id)}
                 onMouseLeave={()=>setHovered(null)}
              >
                <circle r={r} fill={fill} stroke={stroke} strokeWidth={2} opacity={strong ? 1 : 0.95} />
                {/* label */}
                <text x={r+6} y={4} fontSize={11} fill="#334155">
                  {shorten(n.text, 42)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function shorten(s:string, n:number) {
  if (s.length <= n) return s;
  return s.slice(0, n-1) + '…';
}
