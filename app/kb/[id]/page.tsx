'use client';
import * as React from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import { ProvenanceChip } from '@/components/kb/ProvenanceChip';
import AifDiagramView from '@/components/map/AifDiagramView';
import type { AifSubgraph } from '@/lib/arguments/diagram';


/** ---------- Shared types (match your API shapes) ---------- */
type EvalMode = 'product'|'min'|'logodds';
type ImportsQ = 'off'|'materialized'|'virtual'|'all';

type KbBlockKind =
  | 'text' | 'image' | 'link'
  | 'claim' | 'argument' | 'room_summary' | 'sheet' | 'transport';

type KbPage = {
  id: string;
  spaceId: string;
  title: string;
  summary?: string | null;
  tags?: string[];
  // Page default evaluation knobs (server may omit; we handle gracefully)
  evalDefaults?: { mode?: EvalMode; tau?: number | null; imports?: ImportsQ };
  // The authoring-time blocks; structured ones will be hydrated via /transclude
  blocks: Array<{
    id: string;
    kind: KbBlockKind;
    live?: boolean;            // true if live transclusion, false if pinned
    lens?: string | null;      // rendering hint (optional)
    pinnedAt?: string | null;  // ISO, if pinned
    // Authoring-time data; for structured kinds this may simply contain IDs (resolved later)
    data?: any;
  }>;
};

type TranscludeRequest = {
  spaceId: string;
  eval?: { mode?: EvalMode; tau?: number | null; imports?: ImportsQ };
  at?: string | null; // ISO timestamp OR snapshot id; null = live
  items: Array<any>;  // constructed from page.blocks
};

type TranscludeItemEnvelope = {
  ok?: boolean;
  // echo
  kind: KbBlockKind;
  id?: string;             // for claim/argument/sheet/room_summary items
  fromId?: string;         // for transport
  toId?: string;           // for transport
  live?: boolean;
  pinnedAt?: string | null;
  lens?: string | null;
  // normalized data shape per kind
  data?: any;
  // provenance + suggested deep-links
  provenance?: {
    source: 'deliberation'|'argument'|'sheet'|'room_functor'|'unknown';
    roomId?: string;
    endpoints?: string[];
  };
  actions?: Record<string, string>; // e.g. openRoom/openSheet/openTransport
  // errors are bubbled separately as well
};

type TranscludeResponse = {
  ok?: boolean;
  items: TranscludeItemEnvelope[];
  errors?: Array<{ idx: number; code: string; message?: string }>;
};

const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

/** ---------- Small shared UI bits ---------- */
function Section({ title, children, right }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white/80 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] px-1.5 py-[2px] rounded border bg-white">{children}</span>;
}

function InnerProvenanceChip({
  live, pinnedAt, evalMode, tau, imports, provenance
}: {
  live?: boolean; pinnedAt?: string | null;
  evalMode?: EvalMode; tau?: number | null; imports?: ImportsQ;
  provenance?: { source?: string; endpoints?: string[] }
}) {
  return (
    <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-600">
      <span className={clsx(
        'inline-flex items-center gap-1 px-1.5 py-[1px] rounded border',
        live ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50'
      )}>
        {live ? 'live' : 'pinned'}{!live && pinnedAt ? ` • ${new Date(pinnedAt).toLocaleString()}` : null}
      </span>
      {evalMode && <Chip>mode: {evalMode}</Chip>}
      {typeof tau === 'number' && <Chip>τ: {tau}</Chip>}
      {imports && <Chip>imports: {imports}</Chip>}
      {provenance?.source && <Chip>src: {provenance.source}</Chip>}
    </div>
  );
}

/** ---------- Block renderers (lens-aware, robust to partial data) ---------- */
function ClaimBlock({ item, evalMode, tau, imports } : {
  item: TranscludeItemEnvelope; evalMode?: EvalMode; tau?: number | null; imports?: ImportsQ;
}) {
  const d = item.data ?? {};
  const bel = typeof d.bel === 'number' ? d.bel : (typeof d.score === 'number' ? d.score : null);
  const pl  = typeof d.pl  === 'number' ? d.pl  : null;

  return (
    <div className="rounded border p-3 bg-white/70">
      <div className="text-sm font-medium mb-1">{d.text ?? '(claim)'}</div>
      {(bel!=null || pl!=null) && (
        <div className="text-[12px] text-slate-700">
          {pl!=null ? <>Bel {Math.round((bel ?? 0)*100)}% • Pl {Math.round(pl*100)}%</> : <>score {Math.round((bel ?? 0)*100)}%</>}
        </div>
      )}
      {Array.isArray(d.top) && d.top.length > 0 && (
        <ul className="mt-1 text-[12px] text-slate-700 list-disc pl-5">
          {d.top.slice(0,3).map((t:any) => (
            <li key={t.argumentId}>arg:{t.argumentId?.slice(0,8)}… • {Math.round((t.score ?? 0)*100)}%</li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-1">
        {item.actions?.openRoom &&
          <button className="px-1.5 py-0.5 rounded border text-[12px]" onClick={() => window.open(item.actions!.openRoom!, '_blank', 'noopener,noreferrer')}>open room</button>}
        {item.actions?.openSheet &&
          <button className="px-1.5 py-0.5 rounded border text-[12px]" onClick={() => window.open(item.actions!.openSheet!, '_blank', 'noopener,noreferrer')}>sheet</button>}
      </div>
      <InnerProvenanceChip
        live={item.live} pinnedAt={item.pinnedAt}
        evalMode={evalMode} tau={tau} imports={imports}
        provenance={item.provenance}
      />

    </div>
  );
}
const myAifData: AifSubgraph = {
  nodes: [
    { id: 'I:claim1', kind: 'I', label: 'The sky is blue' },
    { id: 'RA:arg1', kind: 'RA', label: 'Modus Ponens' },
    { id: 'I:claim2', kind: 'I', label: 'It is daytime' },
  ],
  edges: [
    { id: 'e1', from: 'I:claim2', to: 'RA:arg1', role: 'premise' },
    { id: 'e2', from: 'RA:arg1', to: 'I:claim1', role: 'conclusion' },
  ]
};


function ArgumentBlock({ item, evalMode, tau }: { item: TranscludeItemEnvelope; evalMode?: EvalMode; tau?: number | null; }) {
  const diag = item.data?.diagram;
  const aif  = diag?.aif;
  return (
    <div className="rounded border p-3 bg-white/70">
      <div className="text-sm font-medium mb-1">Argument</div>
      
      {aif?.nodes?.length && aif?.edges?.length ? (
        <AifDiagramView 
  aif={aif}
  className="h-[600px] mb-2"
  showMinimap={true}
  onNodeClick={(node) => console.log('Clicked:', node)}
/>
      ) : diag?.statements?.length ? (
        <div className="text-[12px]">
          <div className="font-medium mb-1">Diagram</div>
          <ul className="list-disc pl-5">
            {diag.statements.slice(0,6).map((s: any) => (
              <li key={s.id}><b>{s.role ? `${s.role}: ` : ''}</b>{s.text}</li>
            ))}
            {diag.statements.length > 6 && <li>…</li>}
          </ul>
        </div>
      ) : <div className="text-[12px] text-slate-600">No diagram data.</div>}
      <div className="mt-2 flex gap-1">
        {item.actions?.openArgument &&
          <button className="px-1.5 py-0.5 rounded border text-[12px]" onClick={() => window.open(item.actions!.openArgument!, '_blank', 'noopener,noreferrer')}>open</button>}
      </div>
      <ProvenanceChip item={item} />
    </div>
  );
}

function RoomSummaryBlock({ item, evalMode, tau, imports } : {
  item: TranscludeItemEnvelope; evalMode?: EvalMode; tau?: number | null; imports?: ImportsQ;
}) {
  const claims = Array.isArray(item.data?.claims) ? item.data.claims : [];
  return (
    <div className="rounded border p-3 bg-white/70">
      <div className="text-sm font-medium mb-2">Room summary</div>
      {claims.length ? (
        <ul className="text-[12px] space-y-1">
          {claims.slice(0,6).map((c:any) => (
            <li key={c.id} className="flex items-center gap-2">
              <span className="truncate">{c.text ?? c.id}</span>
              <span className="ml-auto text-slate-700">{Math.round((c.pl ?? c.bel ?? c.score ?? 0)*100)}%</span>
            </li>
          ))}
          {claims.length > 6 && <li className="text-slate-500">…</li>}
        </ul>
      ) : <div className="text-[12px] text-slate-600">No claims.</div>}
      <div className="mt-2 flex gap-1">
        {item.actions?.openRoom &&
          <button className="px-1.5 py-0.5 rounded border text-[12px]" onClick={() => window.open(item.actions!.openRoom!, '_blank', 'noopener,noreferrer')}>open room</button>}
      </div>
      <ProvenanceChip item={item} />
    </div>
  );
}

function SheetBlock({ item }: { item: TranscludeItemEnvelope }) {
  const title = item.data?.title ?? 'Sheet';
  const nodes = Array.isArray(item.data?.nodes) ? item.data.nodes : [];
  return (
    <div className="rounded border p-3 bg-white/70">
      <div className="text-sm font-medium mb-1">{title}</div>
      {nodes.length ? (
        <ul className="text-[12px] space-y-1">
          {nodes.slice(0,8).map((n:any) => (
            <li key={n.id}><b>{n.type ?? 'node'}:</b> {n.text ?? n.title ?? n.id}</li>
          ))}
          {nodes.length > 8 && <li className="text-slate-500">…</li>}
        </ul>
      ) : <div className="text-[12px] text-slate-600">No nodes.</div>}
      <div className="mt-2 flex gap-1">
        {item.actions?.openSheet &&
          <button className="px-1.5 py-0.5 rounded border text-[12px]" onClick={() => window.open(item.actions!.openSheet!, '_blank', 'noopener,noreferrer')}>open sheet</button>}
      </div>
      <ProvenanceChip item={item} />
    </div>
  );
}

function TransportBlock({ item }: { item: TranscludeItemEnvelope }) {
  const m = item.data?.claimMap ?? {};
  const entries = Object.entries(m as Record<string,string>);
  return (
    <div className="rounded border p-3 bg-white/70">
      <div className="text-sm font-medium mb-1">Transport map</div>
      <div className="text-[12px] text-slate-700 mb-2">{entries.length} mapped claims</div>
      <ul className="text-[12px] space-y-1">
        {entries.slice(0,8).map(([a,b]) => (
          <li key={a} className="grid grid-cols-2 gap-2">
            <code className="truncate">{a.slice(0,10)}…</code>
            <code className="truncate">→ {b.slice(0,10)}…</code>
          </li>
        ))}
        {entries.length > 8 && <li className="text-slate-500">…</li>}
      </ul>
      <div className="mt-2 flex gap-1">
        {item.actions?.openTransport &&
          <button className="px-1.5 py-0.5 rounded border text-[12px]" onClick={() => window.open(item.actions!.openTransport!, '_blank', 'noopener,noreferrer')}>open transport</button>}
      </div>
      <ProvenanceChip item={item} />
    </div>
  );
}

/** ---------- Plain text/image/link fallbacks ---------- */
function TextBlock({ md, html }: { md?: string; html?: string }) {
  if (html) return <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
  // tiny md shim: newline → <br/> (keep it simple for now)
  const safe = (md ?? '').split('\n').map((line, i) => <p key={i} className="mb-1">{line}</p>);
  return <div className="prose prose-sm max-w-none">{safe}</div>;
}

function ImageBlock({ src, alt }: { src?: string; alt?: string }) {
  if (!src) return <div className="text-[12px] text-slate-600">Missing image.</div>;
  return <img src={src} alt={alt ?? ''} className="rounded border max-w-full" />;
}

function LinkBlock({ href, label }: { href?: string; label?: string }) {
  if (!href) return <div className="text-[12px] text-slate-600">Missing link.</div>;
  return <a className="text-[13px] underline" href={href} target="_blank" rel="noopener noreferrer">
    {label ?? href}
  </a>;
}

/** ---------- Main page ---------- */
export default function KbPageViewer({
  params, searchParams
}: { params: { id: string }, searchParams?: Record<string, string | string[] | undefined> }) {

  const pageId = params.id;
  const { data: page, error: pageErr, mutate } = useSWR<KbPage>(`/api/kb/pages/${pageId}`, fetcher, {
    revalidateOnFocus: false
  });

  // UI eval overrides (default to page defaults)
  const [mode, setMode] = React.useState<EvalMode>('logodds');
  const [tau, setTau] = React.useState<number | null>(null);
  const [imports, setImports] = React.useState<ImportsQ>('off');
  const [at, setAt] = React.useState<string>(''); // ISO or snapshot id

  // Load defaults after first page fetch
  React.useEffect(() => {
    if (!page) return;
    const d = page.evalDefaults ?? {};
    setMode((d.mode ?? 'logodds') as EvalMode);
    setTau((d.tau ?? null) as number | null);
    setImports((d.imports ?? 'off') as ImportsQ);
  }, [page?.id]);

  // Prepare transclusion request
  const needsHydrate = React.useMemo(() => {
    if (!page) return null;
    const items: any[] = [];
    for (const b of page.blocks) {
      if (b.kind === 'claim' && b.data?.id) items.push({ kind: 'claim', id: b.data.id, lens: b.lens ?? 'belpl' });
      else if (b.kind === 'argument' && b.data?.id) items.push({ kind: 'argument', id: b.data.id, lens: b.lens ?? 'diagram' });
      else if (b.kind === 'room_summary' && b.data?.id) items.push({ kind: 'room_summary', id: b.data.id, lens: b.lens ?? 'top_claims', limit: 5 });
      else if (b.kind === 'sheet' && b.data?.id) items.push({ kind: 'sheet', id: b.data.id, lens: b.lens ?? 'nodes' });
      else if (b.kind === 'transport' && b.data?.fromId && b.data?.toId) items.push({ kind: 'transport', fromId: b.data.fromId, toId: b.data.toId, lens: b.lens ?? 'map' });
      else items.push(null); // passthrough (text/image/link)
    }
    return { items, blocks: page.blocks };
  }, [page]);

  // Call /api/kb/transclude when page or eval knobs change
  const transKey = React.useMemo(() => {
    if (!page || !needsHydrate) return null;
    const evalQS = JSON.stringify({ mode, tau, imports });
    const atQS = at || 'live';
    return `kb:transclude:${page.spaceId}:${page.id}:${evalQS}:${atQS}`;
  }, [page?.id, needsHydrate, mode, tau, imports, at]);

  const { data: trans, error: transErr, isLoading: hydrating } = useSWR<TranscludeResponse | null>(
    transKey,
    async () => {
      if (!page || !needsHydrate) return null;
      const req: TranscludeRequest = {
        spaceId: page.spaceId,
        eval: { mode, tau, imports },
        at: at ? at : null,
        items: (needsHydrate.items as any[]).filter(Boolean)
      };
      const r = await fetch('/api/kb/transclude', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(req) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `Transclude HTTP ${r.status}`);
      return j as TranscludeResponse;
    },
    { revalidateOnFocus: false }
  );

  // Helper: pick the hydrated envelope matching a block (by order)
  const pickItem = (() => {
    if (!trans?.items) return () => null;
    let i = 0;
    return (b: KbPage['blocks'][number]) => {
      if (b.kind==='text' || b.kind==='image' || b.kind==='link') return null;
      const env = trans!.items[i++];
      return env ?? null;
    };
  })();

  // Errors / loading
  if (pageErr) return <div className="p-4 text-sm text-red-600">Failed to load page.</div>;
  if (!page)    return <div className="p-4 text-sm text-slate-500">Loading page…</div>;

  const liveCount = page.blocks.filter(b => b.kind!=='text' && b.kind!=='image' && b.kind!=='link').length;
  const errCount  = trans?.errors?.length ?? 0;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{page.title}</h1>
          {page.summary && <p className="text-sm text-slate-600 mt-0.5">{page.summary}</p>}
          {page.tags?.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {page.tags.slice(0,6).map(t => <Chip key={t}>{t}</Chip>)}
              {page.tags.length>6 && <span className="text-[11px] text-slate-500">+{page.tags.length-6}</span>}
            </div>
          ) : null}
        </div>
        <div className="text-[11px] text-slate-600">
          blocks {page.blocks.length}{liveCount ? <> • structured {liveCount}</> : null}
        </div>
      </div>

      {/* Eval controls */}
      <Section
        title="Evaluation"
        right={<button className="text-[11px] underline" onClick={()=>mutate()}>reload page</button>}
      >
        <div className="flex flex-wrap items-center gap-3 text-[12px]">
          <label className="inline-flex items-center gap-1">
            mode
            <select value={mode} onChange={e=>setMode(e.target.value as EvalMode)} className="px-1 py-0.5 rounded border bg-white/70">
              <option value="product">product</option>
              <option value="min">min</option>
              <option value="logodds">logodds</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-1">
            τ
            <input
              type="number" step="0.05" min="0" max="1"
              value={tau ?? ''} placeholder="—"
              onChange={e => setTau(e.target.value === '' ? null : Math.max(0, Math.min(1, Number(e.target.value))))}
              className="w-16 px-1 py-0.5 rounded border bg-white/70"
            />
          </label>
          <label className="inline-flex items-center gap-1">
            imports
            <select value={imports} onChange={e=>setImports(e.target.value as ImportsQ)} className="px-1 py-0.5 rounded border bg-white/70">
              <option value="off">off</option>
              <option value="materialized">materialized</option>
              <option value="virtual">virtual</option>
              <option value="all">all</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-1">
            as‑of
            <input
              type="text" value={at} placeholder="snapshotId or ISO…"
              onChange={e=>setAt(e.target.value)} className="px-1 py-0.5 rounded border bg-white/70 w-56"
            />
          </label>
          <div className="ml-auto text-[11px] text-slate-600">
            {hydrating ? 'hydrating…' : errCount ? `errors ${errCount}` : 'ready'}
          </div>
        </div>
      </Section>

      {/* Blocks */}
      <Section title="Content">
        <div className="space-y-3">
          {page.blocks.map((b, idx) => {
            const env = pickItem(b);

            // Plain blocks
            if (b.kind === 'text') {
              return <div key={b.id}><TextBlock md={b.data?.md} html={b.data?.html} /></div>;
            }
            if (b.kind === 'image') {
              return <div key={b.id}><ImageBlock src={b.data?.src} alt={b.data?.alt} /></div>;
            }
            if (b.kind === 'link') {
              return <div key={b.id}><LinkBlock href={b.data?.href} label={b.data?.label} /></div>;
            }

            // Structured blocks (hydrated)
            if (!env) {
              return <div key={b.id} className="rounded border p-3 bg-white/60 text-[12px] text-slate-600">
                ({b.kind}) awaiting transclusion…
              </div>;
            }
            if (env.ok === false) {
              return <div key={b.id} className="rounded border p-3 bg-rose-50 text-[12px] text-rose-700">
                {b.kind} • could not load (forbidden or missing)
              </div>;
            }

            if (b.kind === 'claim')        return <ClaimBlock       key={b.id} item={env} evalMode={mode} tau={tau} imports={imports} />;
            if (b.kind === 'argument')     return <ArgumentBlock    key={b.id} item={env} evalMode={mode} tau={tau} />;
            if (b.kind === 'room_summary') return <RoomSummaryBlock key={b.id} item={env} evalMode={mode} tau={tau} imports={imports} />;
            if (b.kind === 'sheet')        return <SheetBlock       key={b.id} item={env} />;
            if (b.kind === 'transport')    return <TransportBlock   key={b.id} item={env} />;

            // fallback
            return <div key={b.id} className="rounded border p-3 text-[12px]">({b.kind}) unsupported</div>;
          })}
        </div>
      </Section>

      {/* Footer actions */}
      <div className="flex items-center gap-2">
        <button className="px-2 py-1 rounded border text-[12px]" onClick={() => window.open(`/api/kb/pages/${pageId}/export?as=md${at ? `&at=${encodeURIComponent(at)}`:''}`, '_blank', 'noopener,noreferrer')}>export md</button>
        <button className="px-2 py-1 rounded border text-[12px]" onClick={() => window.open(`/api/kb/pages/${pageId}/export?as=pdf${at ? `&at=${encodeURIComponent(at)}`:''}`, '_blank', 'noopener,noreferrer')}>export pdf</button>
        <div className="ml-auto text-[11px] text-slate-600">
          Tip: links open in a new tab; change eval knobs to see live values update.
        </div>
      </div>
    </div>
  );
}
