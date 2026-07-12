// components/agora/PlexusMatrix.tsx
'use client';
import * as React from 'react';
import useSWR from 'swr';

type EdgeKind = 'xref'|'overlap'|'stack_ref'|'imports'|'shared_author';
type RoomNode = {
  id: string; title?: string|null;
  nArgs: number; nEdges: number;
  accepted: number; rejected: number; undecided: number;
  tags?: string[]; updatedAt?: string|null;
};
type MetaEdge = { from:string; to:string; kind:EdgeKind; weight:number };
type Network = { scope:'public'|'following'; version:number; rooms:RoomNode[]; edges:MetaEdge[] };

const KCOL: Record<EdgeKind,string> = {
  xref:'#6366f1', overlap:'#ef4444', stack_ref:'#f59e0b', imports:'#14b8a6', shared_author:'#64748b'
};
const fetcher = (u:string) => fetch(u, { cache:'no-store' }).then(r => r.json());
type OrderBy = 'recent'|'size'|'accept'|'alpha';

export default function PlexusMatrix({ scope='public' }: { scope?: 'public'|'following' }) {
  const { data, error } = useSWR<Network>(`/api/agora/network?scope=${scope}`, fetcher, { revalidateOnFocus:false });

  const [q, setQ] = React.useState('');
  const [orderBy, setOrderBy] = React.useState<OrderBy>('recent');
  const [onKinds, setOnKinds] = React.useState<Record<EdgeKind, boolean>>({
    xref:true, overlap:true, stack_ref:true, imports:true, shared_author:false
  });

  const [hoverIdx, setHoverIdx] = React.useState<{i:number|null; j:number|null}>({ i:null, j:null });

  const containerRef = React.useRef<HTMLDivElement|null>(null);
  const surfaceRef = React.useRef<HTMLDivElement|null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement|null>(null);
  const miniRef = React.useRef<HTMLCanvasElement|null>(null);

  const [viewSize, setViewSize] = React.useState<{w:number; h:number}>({ w: 800, h: 520 });
  const [scroll, setScroll] = React.useState<{left:number; top:number}>({ left:0, top:0 });

  React.useEffect(() => {
    const onResize = () => {
      if (!containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      setViewSize({ w: Math.max(300, Math.floor(r.width)), h: Math.max(260, Math.floor(r.height)) });
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);


  // Filter & order rooms
  const qn = q.trim().toLowerCase();
  const rooms = (data?.rooms ?? [])
    .filter(r => !qn || (r.title ?? '').toLowerCase().includes(qn) || r.id.toLowerCase().includes(qn))
    .slice();

  const share = (r:RoomNode) => { const t = Math.max(1, r.accepted + r.rejected + r.undecided); return r.accepted / t; };
  const hash = (s:string) => { let h=2166136261>>>0; for (let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);} return h>>>0; };
  rooms.sort((a,b) => {
    if (orderBy==='recent') { const ta = a.updatedAt ? +new Date(a.updatedAt) : 0; const tb = b.updatedAt ? +new Date(b.updatedAt) : 0; return tb - ta; }
    if (orderBy==='size')   return (b.nArgs|0)-(a.nArgs|0);
    if (orderBy==='accept') return share(b) - share(a);
    return (hash(a.id)%1000) - (hash(b.id)%1000);
  });

  // Index map
  const idx = React.useMemo(() => new Map<string, number>(rooms.map((r,i)=>[r.id, i])), [rooms]);
  const N = rooms.length;

  // Precompute bundles per (i,j)
  type Cell = { [K in EdgeKind]?: number };
  const bundle = React.useMemo(() => {
    const m = new Map<string, Cell>();
    const key = (i:number, j:number) => i<=j ? `${i}|${j}` : `${j}|${i}`;
    for (const e of (data?.edges ?? [])) {
      const i = idx.get(e.from), j = idx.get(e.to);
      if (i==null || j==null) continue;
      const k = key(i,j);
      const cell = m.get(k) ?? {};
      cell[e.kind] = (cell[e.kind] ?? 0) + e.weight;
      m.set(k, cell);
    }
    return m;
  }, [data?.edges, idx]);

  // Sizing for matrix
  const cell = N <= 160 ? 12 : N <= 300 ? 8 : N <= 520 ? 6 : 4;
  const gap  = 1;
  const S = cell + gap;
  const fullSize = N * S + gap;

  // Ensure scroll surface matches full matrix size
  React.useEffect(() => {
    if (surfaceRef.current) {
      surfaceRef.current.style.width = `${fullSize}px`;
      surfaceRef.current.style.height = `${fullSize}px`;
    }
  }, [fullSize]);

  // Draw visible part
  React.useEffect(() => {
    const cvs = canvasRef.current;
    const cont = containerRef.current;
    if (!cvs || !cont) return;

    // Canvas covers only viewport; we re-draw on scroll/resize
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = viewSize.w, H = viewSize.h;
    cvs.width = Math.floor(W * dpr);
    cvs.height = Math.floor(H * dpr);
    cvs.style.width = `${W}px`;
    cvs.style.height = `${H}px`;

    const ctx = cvs.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0,0,W,H);
    ctx.imageSmoothingEnabled = false;

    // Visible window in matrix coords
    const { left, top } = scroll;
    const colStart = Math.max(0, Math.floor(left / S));
    const colEnd   = Math.min(N, Math.ceil((left +  W) / S));
    const rowStart = Math.max(0, Math.floor(top  / S));
    const rowEnd   = Math.min(N, Math.ceil((top  +  H) / S));

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,W,H);

    const kinds = (Object.keys(KCOL) as EdgeKind[]).filter(k => onKinds[k]);

    for (let i=rowStart; i<rowEnd; i++) {
      for (let j=colStart; j<colEnd; j++) {
        const k = i<=j ? `${i}|${j}` : `${j}|${i}`;
        const cellData = bundle.get(k);
        if (!cellData) continue;

        const x = j * S + gap - left;
        const y = i * S + gap - top;

        const enabled = kinds.filter(k => cellData[k]);
        if (!enabled.length) continue;

        const total = enabled.reduce((a,k)=>a+(cellData[k] ?? 0), 0);
        for (const kind of enabled) {
          const frac = (cellData[kind]! / total);
          const h = Math.max(1, Math.round(frac * cell));
          ctx.fillStyle = KCOL[kind];
          ctx.globalAlpha = 0.78;
          ctx.fillRect(x, y + (cell - h), cell, h);
        }

        if (hoverIdx.i===i || hoverIdx.j===j) {
          ctx.strokeStyle = 'rgba(2,6,23,0.6)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x-0.5, y-0.5, cell+1, cell+1);
        }
      }
    }
  }, [N, S, gap, viewSize, scroll, bundle, onKinds, hoverIdx]);

  // Minimap rendering
  React.useEffect(() => {
    const mini = miniRef.current;
    if (!mini) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mw = 160, mh = 160; // minimap CSS size
    mini.width = mw * dpr; mini.height = mh * dpr;
    mini.style.width = `${mw}px`; mini.style.height = `${mh}px`;
    const ctx = mini.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0,0,mw,mh);

    // scale entire matrix into minimap bounds
    const scale = Math.min(mw / fullSize, mh / fullSize);
    const kinds = (Object.keys(KCOL) as EdgeKind[]).filter(k => onKinds[k]);

    // very coarse dots (fast)
    const step = Math.max(1, Math.floor(N / 180)); // sample rows to keep it light
    for (let i=0; i<N; i+=step) {
      for (let j=0; j<N; j+=step) {
        const key = i<=j ? `${i}|${j}` : `${j}|${i}`;
        const cellData = bundle.get(key);
        if (!cellData) continue;
        const enabled = kinds.filter(k => cellData[k]);
        if (!enabled.length) continue;
        const maxKind = enabled.reduce((best, k) => ((cellData[k] ?? 0) > (cellData[best] ?? 0) ? k : best), enabled[0]);
        ctx.fillStyle = KCOL[maxKind];
        ctx.globalAlpha = 0.6;
        const x = Math.floor(j * S * scale);
        const y = Math.floor(i * S * scale);
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // viewport rectangle
    ctx.strokeStyle = 'rgba(2,6,23,0.8)';
    ctx.lineWidth = 1;
    const vx = scroll.left * scale;
    const vy = scroll.top  * scale;
    const vw = viewSize.w * scale;
    const vh = viewSize.h * scale;
    ctx.strokeRect(vx, vy, vw, vh);
  }, [bundle, N, S, fullSize, onKinds, scroll, viewSize]);

  // Scroll + mouse handlers
  const onScroll = () => {
    if (!containerRef.current) return;
    setScroll({
      left: containerRef.current.scrollLeft,
      top:  containerRef.current.scrollTop,
    });
  };
  const onMouseMove = (e:React.MouseEvent<HTMLCanvasElement>) => {
    const cont = containerRef.current!;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + scroll.left;
    const y = e.clientY - rect.top  + scroll.top;
    const i = Math.floor(y / S);
    const j = Math.floor(x / S);
    if (i>=0 && i<N && j>=0 && j<N) setHoverIdx({ i, j }); else setHoverIdx({ i:null, j:null });
  };

  // Minimap interaction (click to navigate)
  const onMiniPointer = (e:React.PointerEvent<HTMLCanvasElement>) => {
    const mini = e.currentTarget;
    const rect = mini.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const scale = Math.min(rect.width / fullSize, rect.height / fullSize);
    const targetLeft = Math.max(0, Math.min(fullSize - viewSize.w, px / scale - viewSize.w/2));
    const targetTop  = Math.max(0, Math.min(fullSize - viewSize.h, py / scale - viewSize.h/2));
    if (containerRef.current) {
      containerRef.current.scrollTo({ left: targetLeft, top: targetTop, behavior: 'smooth' });
    }
  };
  if (error) return <div className="text-xs text-red-600">Failed to load network</div>;
  if (!data)  return <div className="text-xs text-neutral-500">Loading…</div>;

  return (
    <div className="rounded-xl border bg-white/80 p-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">Plexus • Matrix</div>
          <span className="text-[11px] text-slate-600">rooms {rooms.length}</span>
          <span className="text-[11px] text-slate-600">• links {data.edges.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q} onChange={e=>setQ(e.target.value)}
            placeholder="Search rooms…"
            className="px-2 py-1 text-[12px] rounded border bg-white/70"
          />
          <select
            value={orderBy} onChange={e=>setOrderBy(e.target.value as OrderBy)}
            className="px-2 py-1 text-[12px] rounded border bg-white/70"
          >
            <option value="recent">recent</option>
            <option value="size">size</option>
            <option value="accept">acceptance</option>
            <option value="alpha">α‑order</option>
          </select>
          {/* Toggles */}
          <div className="hidden sm:flex items-center gap-2 ml-2">
            {(Object.keys(KCOL) as EdgeKind[]).map(k => (
              <label key={k} className="inline-flex items-center gap-1 text-[11px] cursor-pointer select-none">
                <input type="checkbox" className="accent-slate-600"
                       checked={onKinds[k]} onChange={e=>setOnKinds(s=>({ ...s, [k]: e.target.checked }))}/>
                <span className="inline-block w-2 h-2 rounded" style={{ background: KCOL[k] }} />
                {k.replace('_',' ')}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll container */}
      <div
        ref={containerRef}
        className="relative overflow-auto rounded-lg border bg-slate-50"
        style={{ maxHeight: 540, width: '100%' }}
        onScroll={onScroll}
      >
        {/* Scroll surface defines full matrix size */}
        <div ref={surfaceRef} style={{ width: fullSize, height: fullSize }} />

        {/* Viewport canvas overlay */}
        <canvas
          ref={canvasRef}
          onMouseMove={onMouseMove}
          onMouseLeave={()=>setHoverIdx({ i:null, j:null })}
          className="absolute top-0 left-0 pointer-events-auto"
          style={{ width: viewSize.w, height: viewSize.h }}
        />
        {/* Position canvas to follow scroll (fixed to container’s content) */}
        <style>{`
          [data-plexus-matrix] canvas { position: sticky; }
        `}</style>
      </div>

      {/* Hover readout */}
      {hoverIdx.i!=null && hoverIdx.j!=null && (
        <div className="mt-2 text-[11px] text-slate-700">
          Row: <b>{rooms[hoverIdx.i].title ?? rooms[hoverIdx.i].id}</b> • Col: <b>{rooms[hoverIdx.j].title ?? rooms[hoverIdx.j].id}</b>
        </div>
      )}

      {/* Minimap */}
      <div className="mt-2 flex items-center gap-2">
        <div className="text-[11px] text-slate-600">Minimap:</div>
        <canvas
          ref={miniRef}
          onPointerDown={onMiniPointer}
          onPointerMove={(e)=>{ if (e.buttons&1) onMiniPointer(e); }}
          className="rounded border bg-white"
          title="Click or drag to navigate"
          width={160}
          height={160}
        />
      </div>

      {/* Legend */}
      <div className="mt-2 text-[11px] text-slate-600">
        Cell shows stacked bars by edge type; brighter segments = higher share within that pair. Hover to highlight row/column; use the minimap to navigate quickly.
      </div>
    </div>
  );
}
