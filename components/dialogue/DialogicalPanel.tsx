// components/dialogue/DialogicalPanel.tsx
'use client';

import * as React from 'react';
import type { AFNode, AFEdge } from '@/lib/argumentation';
import {
  projectToAF,
  grounded,
  preferred,
  labelingFromExtension,
} from '@/lib/argumentation';
import {
  inferSchemesFromText,
  questionsForScheme,
  cqUndercuts,
} from '@/lib/argumentation/criticalQuestions';
import { useDialogueMoves, useOpenCqs } from '@/components/dialogue/useDialogueMoves';
import { WinningnessBadge } from './WinningnessBadge';
import MapCanvas from '@/components/map/MapCanvas';
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader,
  DialogTitle, DialogClose
} from "@/components/ui/dialog";
import useSWR from 'swr';
import CriticalQuestions from '@/components/claims/CriticalQuestions';

/* ------------------------------- Types ---------------------------------- */
type Props = {
  deliberationId: string;
  nodes: AFNode[];
  edges: AFEdge[];
};

type MoveSuggestion = {
  kind: 'ASSERT'|'WHY'|'GROUNDS'|'RETRACT'|'CONCEDE'|'CLOSE'|'THEREFORE'|'SUPPOSE'|'DISCHARGE';
  label: string;
  payload?: any;
  disabled?: boolean;
  reason?: string;
  force?: 'ATTACK'|'SURRENDER'|'NEUTRAL';
  relevance?: 'likely'|'unlikely'|null;
  verdict?: { code: string; context?: Record<string, any> };
  postAs?: { targetType: 'argument'|'claim'|'card'; targetId: string };
};


type DesignsRes = { designs: Array<{ id: string; participantId: 'Proponent'|'Opponent'|string; acts?: any[] }> };
type StepLike = {
  status?: 'ONGOING'|'CONVERGENT'|'DIVERGENT'|'STUCK';
  pairs?: Array<{ posActId?: string; negActId?: string; ts: number }>;
  trace?: { status?: string; pairs?: any[] };
};

type OrthoRes = StepLike & { ok?: boolean };

/* -------------------------- Small local helpers ------------------------- */
const fetchJSON = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const r = await fetch(url, { cache: 'no-store', ...(init ?? {}) });
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try { msg += `: ${JSON.stringify(await r.json())}`; } catch {}
    throw new Error(msg);
  }
  return r.json() as Promise<T>;
};

const normId = (v: unknown) => {
  const s = String(Array.isArray(v) ? v[0] : v ?? '').trim();
  return s && s !== 'undefined' && s !== 'null' ? s : '';
};

const hoursLeft = (iso?: string) => {
  if (!iso) return null;
  const ms = Date.parse(iso) - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 36e5));
};

// Stable stable-extension enumerator (only for small AFs; falls back when large)
function computeStableExtension(A: string[], R: Array<[string, string]>): Set<string> | null {
  const ids = A;
  if (ids.length > 18) return null;
  const attacks = new Set(R.map(([x, y]) => `${x}→${y}`));
  const n = ids.length, total = 1 << n;
  for (let mask = 0; mask < total; mask++) {
    const E = new Set<string>();
    for (let i = 0; i < n; i++) if (mask & (1 << i)) E.add(ids[i]);

    // conflict-free
    let ok = true;
    outer: for (const a of E) for (const b of E) {
      if (a !== b && attacks.has(`${a}→${b}`)) { ok = false; break outer; }
    }
    if (!ok) continue;

    // attacks every outside node
    const outside = ids.filter((x) => !E.has(x));
    for (const y of outside) {
      let attacked = false;
      for (const a of E) if (attacks.has(`${a}→${y}`)) { attacked = true; break; }
      if (!attacked) { ok = false; break; }
    }
    if (ok) return E;
  }
  return null;
}

/* ---------- Glassy UI helpers (match your style; minimal deps) ---------- */
function ChipBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-slate-200/80 bg-white/70 px-2.5 py-1 text-xs backdrop-blur">
      {children}
    </div>
  );
}

const FancyScroller = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function FancyScroller({ className = '', children, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={'relative overflow-y-auto ' + className}
        {...props}
        style={{
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent, black 18px, black calc(100% - 18px), transparent)',
          maskImage:
            'linear-gradient(to bottom, transparent, black 18px, black calc(100% - 18px), transparent)',
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-white/75 to-transparent dark:from-slate-900/60"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-white/80 to-transparent dark:from-slate-900/60"
        />
        {children}
      </div>
    );
  }
);

const verdictHelp: Record<string, string> = {
  R3_SELF_REPLY: 'You cannot answer your own challenge.',
  R2_NO_OPEN_CQ: 'No open WHY with this key at the selected locus.',
  R5_AFTER_SURRENDER: 'This branch was conceded or closed (†).',
  H1_SHAPE_ATTACK_SUGGESTION: 'Based on the claim shape, this is a likely attack.',
  H2_CLOSABLE: 'This locus is convergent; you can close it (†).',
};
function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value?: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex rounded-md border border-slate-200/80 bg-white/70 p-0.5 backdrop-blur"
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={String(o.value)}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={[
              'px-2.5 py-1 text-xs rounded',
              active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-white',
            ].join(' ')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-600" /> IN</span>
      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-600" /> UNDEC</span>
      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-600" /> OUT</span>
    </div>
  );
}

function DefaultRuleLegend() {
  return (
    <div className="inline-flex flex-wrap items-center gap-2 text-[11px]">
      {/* default-rule trio */}
      <span
        className="inline-flex items-center gap-1 rounded border px-2 py-0.5 bg-white/70"
        title="Default rule: SUPPOSE α; UNLESS ¬β; THEREFORE γ"
      >
        ⟨<i>α</i>, ¬<i>β</i>⟩ ⟹ <i>γ</i>
        <span className="ml-1 opacity-70">[SUPPOSE/UNLESS/THEREFORE]</span>
      </span>

      {/* justificatory vs explanatory labels */}
      <span
        className="inline-flex items-center gap-1 rounded border px-2 py-0.5 bg-emerald-50 border-emerald-200 text-emerald-700"
        title="Justificatory answer to a WHY"
      >
        GROUNDS
      </span>
      <span
        className="inline-flex items-center gap-1 rounded border px-2 py-0.5 bg-sky-50 border-sky-200 text-sky-700"
        title="Explanatory answer (BECAUSE …)"
      >
        BECAUSE
      </span>
    </div>
  );
}



function StatusPill({ st, title }: { st: 'IN' | 'OUT' | 'UNDEC'; title?: string }) {
  const cls = st === 'IN' ? 'bg-emerald-600' : st === 'OUT' ? 'bg-rose-600' : 'bg-amber-600';
  return (
    <span
      title={title}
      className={'inline-flex min-w-[44px] justify-center rounded text-[10px] text-white px-1.5 py-0.5 ' + cls}
    >
      {st}
    </span>
  );
}

/* ----------------------------- Main panel ------------------------------- */
export default function DialogicalPanel({ deliberationId, nodes, edges }: Props) {
  const did = normId(deliberationId);

  const [semantics, setSemantics] = React.useState<'grounded' | 'preferred' | 'stable'>('grounded');
  const [supportProp, setSupportProp] = React.useState(true);

  const [selected, setSelected] = React.useState<string | null>(null);
  const selectedNode = nodes.find((n) => n.id === selected) || null;

  const [q, setQ] = React.useState('');
  const [onlyWhy, setOnlyWhy] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'IN' | 'UNDEC' | 'OUT'>('all');

  const [modalOpen, setModalOpen] = React.useState(false);

  const [locusPath, setLocusPath] = React.useState('0');


const lmKey = selected && did
  ? (['legal-moves', did, selected, locusPath] as const)
  : null;

const { data: lmRes, mutate: refetchLegal } = useSWR(
  lmKey,
  async ([, dlg, target, locus]) =>
    fetchJSON<{ ok: boolean; moves: MoveSuggestion[] }>(
      `/api/dialogue/legal-moves?deliberationId=${encodeURIComponent(dlg)}&targetType=argument&targetId=${encodeURIComponent(target)}&locusPath=${encodeURIComponent(locus)}`
    ),
  { revalidateOnFocus: false }
);
const legalMoves = lmRes?.moves ?? [];

async function doMove(s: MoveSuggestion) {
  if (!did || !selected) return;
  const target = s.postAs ?? { targetType: 'argument' as const, targetId: selected };
  try {
    const res = await fetch('/api/dialogue/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deliberationId: did,
        targetType: target.targetType,
        targetId: target.targetId,
        kind: s.kind,
        payload: { locusPath, ...(s.payload ?? {}) },
        autoCompile: true,
        autoStep: true,
      })
    });
    // Even on 409 (validator), refresh so UI reflects latest open CQs / †
    window.dispatchEvent(new CustomEvent('dialogue:moves:refresh'));
  } finally {
    await Promise.allSettled([refetchMoves(), refetchLegal()]);
  }
}

  // Designs (Proponent/Opponent)
  const designsKey = did ? (['ludics-designs', did] as const) : null;
  const { data: des } = useSWR<DesignsRes>(
    designsKey,
    async ([, id]) => fetchJSON<DesignsRes>(`/api/ludics/designs?deliberationId=${encodeURIComponent(String(id))}`),
    { revalidateOnFocus: false }
  );

  const { posId, negId } = React.useMemo(() => {
    const arr = des?.designs ?? [];
    const pos = arr.find(d => d.participantId === 'Proponent') ?? arr[0];
    const neg = arr.find(d => d.participantId === 'Opponent')  ?? arr[1] ?? arr[0];
    return { posId: pos?.id, negId: neg?.id };
  }, [des]);

  // One-step orthogonality/trace view (use POST /api/ludics/step for freshest)
  const stepKey = did && posId && negId ? (['ludics-step', did, posId, negId, 'neutral'] as const) : null;
  const { data: stepRes } = useSWR<OrthoRes>(
    stepKey,
    async ([, id, p, n, phase]) => fetchJSON<OrthoRes>(
      '/api/ludics/step',
      { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dialogueId: id, posDesignId: p, negDesignId: n, phase, maxPairs: 4096 })
      }
    ),
    { revalidateOnFocus: false }
  );

  // Fallback-friendly status/pairs for the header chip
  const traceStatus = (stepRes?.trace?.status ?? stepRes?.status) as string | undefined;
  const tracePairs  = (stepRes?.trace?.pairs ?? stepRes?.pairs) as any[] | undefined;

  // Moves + open WHYs
  const { moves, unresolvedByTarget, mutate: refetchMoves } = useDialogueMoves(did);
  const openCqIds = useOpenCqs(did, selectedNode?.id ?? '');

  // Refresh hook
  // React.useEffect(() => {
  //   const h = () => refetchMoves();
  //   window.addEventListener('dialogue:moves:refresh', h as any);
  //   return () => window.removeEventListener('dialogue:moves:refresh', h as any);
  // }, [refetchMoves]);

  // Auto-select first node for quicker flow
  React.useEffect(() => {
    if (!selected && nodes.length) setSelected(nodes[0].id);
  }, [selected, nodes]);

  // Virtual attackers from unresolved WHY + locally toggled CQs
  const [openCQsLocal, setOpenCQsLocal] = React.useState<Record<string, string[]>>({});
  const cqVirtual = React.useMemo(() => {
    const n: AFNode[] = [];
    const e: AFEdge[] = [];

    for (const [targetId, entry] of unresolvedByTarget.entries()) {
      const latest = Array.isArray(entry) ? entry[entry.length - 1] : entry;
      if (!latest) continue;
      const u = cqUndercuts(targetId, [{ id: `WHY-${latest.id}`, text: latest.payload?.note || 'Open WHY challenge' }]);
      n.push(...u.nodes);
      e.push(...u.edges);
    }

    for (const argId of Object.keys(openCQsLocal)) {
      const u = cqUndercuts(
        argId,
        (openCQsLocal[argId] || []).map((id) => ({ id, text: id }))
      );
      n.push(...u.nodes);
      e.push(...u.edges);
    }
    return { nodes: n, edges: e };
  }, [unresolvedByTarget, openCQsLocal]);

  // Build AF with optional Support→Defense propagation
  const AF = React.useMemo(() => {
    const mergedNodes = [...nodes, ...cqVirtual.nodes];
    const mergedEdges = [...edges, ...cqVirtual.edges];
    return projectToAF(mergedNodes, mergedEdges, { supportDefensePropagation: supportProp, supportClosure: false });
  }, [nodes, edges, supportProp, cqVirtual]);

  // Labeling under chosen semantics
  const labeling = React.useMemo(() => {
    if (semantics === 'grounded') {
      const E = grounded(AF.A, AF.R);
      return labelingFromExtension(AF.A, AF.R, E);
    }
    if (semantics === 'preferred') {
      const prefs = preferred(AF.A, AF.R);
      const INunion = new Set<string>();
      for (const E of prefs) for (const a of E) INunion.add(a);
      return labelingFromExtension(AF.A, AF.R, INunion);
    }
    // stable (fallback to grounded if none)
    const ext = computeStableExtension(AF.A, AF.R) || grounded(AF.A, AF.R);
    return labelingFromExtension(AF.A, AF.R, ext);
  }, [AF, semantics]);

  const status = React.useCallback((id: string): 'IN' | 'OUT' | 'UNDEC' => {
    if (labeling.IN.has(id)) return 'IN';
    if (labeling.OUT.has(id)) return 'OUT';
    return 'UNDEC';
  }, [labeling]);

  const attackersOf = React.useCallback(
    (a: string) => AF.R.filter(([x, y]) => y === a).map(([x]) => x),
    [AF]
  );

  const explain = React.useCallback((id: string) => {
    const st = status(id);
    if (st === 'IN')   return 'Accepted (all attackers are counterattacked)';
    if (st === 'OUT')  {
      const atks = attackersOf(id);
      return atks.length ? `Out: attacked by ${atks.length} accepted attackers` : 'Out: attacked';
    }
    return 'Undecided';
  }, [status, attackersOf]);

  // Filter + sort list
  const list = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    let arr = nodes.slice();

    if (term) arr = arr.filter((n) => (n.text || n.label || '').toLowerCase().includes(term));
    if (onlyWhy) arr = arr.filter((n) => unresolvedByTarget.has(n.id));
    if (statusFilter !== 'all') arr = arr.filter((n) => status(n.id) === statusFilter);

    const order: Record<'IN' | 'UNDEC' | 'OUT', number> = { IN: 0, UNDEC: 1, OUT: 2 };
    arr.sort((a, b) => {
      const entA: any = unresolvedByTarget.get(a.id);
      const entB: any = unresolvedByTarget.get(b.id);
      const la = Array.isArray(entA) ? entA.at(-1) : entA;
      const lb = Array.isArray(entB) ? entB.at(-1) : entB;
      const dueA = hoursLeft(la?.payload?.deadlineAt) ?? Infinity;
      const dueB = hoursLeft(lb?.payload?.deadlineAt) ?? Infinity;
      if (dueA !== dueB) return dueA - dueB;
      const sA = order[status(a.id)];
      const sB = order[status(b.id)];
      if (sA !== sB) return sA - sB;
      return (a.text || a.label || '').localeCompare(b.text || b.label || '');
    });

    return arr;
  }, [nodes, q, onlyWhy, statusFilter, unresolvedByTarget, labeling, status]);

  // Quick row actions (WHY/GROUNDS)
  const [postingId, setPostingId] = React.useState<string | null>(null);
  const postMove = React.useCallback(async (targetId: string, kind: 'WHY' | 'GROUNDS', payload: any) => {
    if (postingId === targetId) return; // per-row idempotency
    setPostingId(targetId);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      await fetch('/api/dialogue/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliberationId: did,
          targetType: 'argument',
          targetId,
          kind,
          payload,
          autoCompile: true,
          autoStep: true,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      window.dispatchEvent(new CustomEvent('dialogue:moves:refresh'));
    } catch {
      // no-op
    } finally {
      setPostingId(null);
    }
  }, [postingId, did]);

  /* ----------------------------- Render ---------------------------------- */
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-slate-50/70 p-3 shadow-sm backdrop-blur space-y-3">
      <div className="pointer-events-none absolute inset-x-2 top-1 h-px bg-gradient-to-b from-white/70 to-transparent" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChipBar>
            <span className="text-[11px] text-neutral-600">|A| {AF.A.length}</span>
            <span className="text-[11px] text-neutral-600">|R| {AF.R.length}</span>
            {traceStatus && (
              <span className="text-[11px] text-neutral-600">
                trace {String(traceStatus).toLowerCase()}
                {Array.isArray(tracePairs) ? ` · ${tracePairs.length} pairs` : ''}
              </span>
            )}
          </ChipBar>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            ariaLabel="Semantics"
            value={semantics}
            onChange={(v) => setSemantics(v)}
            options={[
              { value: 'grounded', label: 'Grounded' },
              { value: 'preferred', label: 'Preferred' },
              { value: 'stable', label: 'Stable' },
            ]}
          />
          <label
            className="flex items-center gap-1 text-xs rounded-md border py-1.5 px-2 bg-white/70"
            title="Treat supporters of a node as defenders against its attackers"
          >
            <input
              type="checkbox"
              checked={supportProp}
              onChange={(e) => setSupportProp(e.target.checked)}
            />
            Support→Defense
          </label>
          <button className="bg-white/70 rounded-md btnv2--ghost btnv2--sm" onClick={() => refetchMoves()}>
            Refresh
          </button>
        </div>
      </div>

      {/* Legend + filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Legend />
          <div className="mt-2">
  <DefaultRuleLegend />
</div>
          <label className="text-xs flex items-center gap-1">
            Status:
            <select
              className="border rounded px-1 py-0.5 text-xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="IN">IN</option>
              <option value="UNDEC">UNDEC</option>
              <option value="OUT">OUT</option>
            </select>
          </label>
          <label className="text-xs flex items-center gap-1">
  Locus:
  <input
    className="border rounded px-1 py-0.5 text-xs w-[84px]"
    value={locusPath}
    onChange={(e) => setLocusPath(e.target.value)}
    placeholder="0"
  />
</label>
          <label className="text-xs flex items-center gap-1">
            <input type="checkbox" checked={onlyWhy} onChange={(e) => setOnlyWhy(e.target.checked)} />
            With open WHY
          </label>
        </div>
        <input
          className="w-56 rounded border border-slate-200 px-2 py-1 text-xs"
          placeholder="Search arguments…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Two-pane layout */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-[320px_1fr]">
        {/* List */}
        <div className="rounded-lg border border-slate-200 bg-white/60">
          <FancyScroller className="max-h-[300px]">
            {list.map((n) => {
              const st = status(n.id);
              const isSel = selected === n.id;
              const entry: any = unresolvedByTarget.get(n.id);
              const latest = Array.isArray(entry) ? entry?.[entry.length - 1] : entry;
              const due = hoursLeft(latest?.payload?.deadlineAt);
              const openWhy = unresolvedByTarget.has(n.id);
              const acceptedAttackers = attackersOf(n.id).filter(id => labeling.IN.has(id)).slice(0,2);

              return (
                <div
                  key={n.id}
                  className={
                    'group relative border-b last:border-0 p-2 cursor-pointer transition-colors ' +
                    (isSel ? 'bg-slate-50' : 'hover:bg-white/70')
                  }
                  onClick={() => setSelected(n.id)}
                >
                  <div className="pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-b from-white/70 to-transparent" />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusPill st={st} title={explain(n.id)} />
                        {/* {st==='OUT' && acceptedAttackers.length>0 && (
                          <div className="inline-block ml-2 relative group">
                            <button className="text-[10px] underline decoration-dotted" type="button">why?</button>
                            <div className="absolute z-20 hidden group-hover:block mt-1 rounded border bg-white p-2 shadow text-[11px] w-[220px]">
                              <div className="font-medium mb-1">Out because:</div>
                              <ul className="list-disc ml-4">
                                {acceptedAttackers.map(a => (
                                  <li key={a}>
                                    <span className="font-mono">{a.slice(0,8)}</span> attacks this node
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )} */}
                        <div className="truncate text-sm text-slate-800">
                          {(n.text || n.label || '').slice(0, 180)}
                        </div>
                      </div>
                      <div className="mt-1 hidden md:flex items-center gap-2 text-[11px]">
                        <span className="text-neutral-500">ID: {n.id.slice(0, 8)}</span>
                        {openWhy && (
                          <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-rose-700">
                            WHY{typeof due === 'number' ? ` · ⏱ ${due}h` : ''}
                          </span>
                        )}
                        <WinningnessBadge moves={moves} targetId={n.id} />
                      </div>
                    </div>

                {/* Quick actions */}
<div className="invisible group-hover:visible flex items-center gap-1">
  {/* keep your fast WHY/GROUNDS if you want */}
  <button
    className="btnv2--ghost btnv2--sm"
    disabled={postingId === n.id}
    onClick={() => postMove(n.id, 'WHY', { locusPath, note: 'Please address this point' })}
  >
    WHY
  </button>
  <button
    className="btnv2--ghost btnv2--sm"
    disabled={postingId === n.id}
    onClick={() => postMove(n.id, 'GROUNDS', { locusPath, note: 'Providing grounds' })}
  >
    Grounds
  </button>

  {/* NEW: legal-move chips (only on the selected row) */}
  {isSel && legalMoves.length > 0 && (
    <div className="ml-1 flex flex-wrap gap-1">
      {legalMoves.map((m) => (
        <button
          key={`${m.kind}-${m.label}`}
          className="btnv2--ghost btnv2--sm"
          disabled={m.disabled}
          title={
            m.verdict
              ? `${verdictHelp[m.verdict.code] ?? m.verdict.code}${m.verdict.context ? ' — ' + JSON.stringify(m.verdict.context) : ''}`
              : (m.reason || '')
          }
          onClick={() => doMove(m)}
        >
          <span className={`chip chip-${(m.force || 'NEUTRAL').toLowerCase()}`}>{m.force || 'NEUTRAL'}</span>
          {m.label}
          {m.relevance && <span className={`chip chip-rel-${m.relevance}`}>{m.relevance}</span>}
        </button>
      ))}
    </div>
  )}
</div>
                  </div>
                </div>
              );
            })}
            {!list.length && (
              <div className="p-3 text-xs text-neutral-500">No items match the current filters.</div>
            )}
          </FancyScroller>
        </div>

        {/* Inspector */}
        <div className="rounded-lg border border-slate-200 bg-white/60 p-2">
          {!selectedNode ? (
            <div className="p-3 text-xs text-neutral-500">
              Select an argument to inspect its critical questions and status.
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusPill st={status(selectedNode.id)} title={explain(selectedNode.id)} />
                  <div className="text-sm font-medium text-slate-800 truncate max-w-[48ch]">
                    {(selectedNode.text || selectedNode.label || '').slice(0, 160)}
                  </div>
                </div>
                <WinningnessBadge moves={moves} targetId={selectedNode.id} />
              </div>

              <ArgumentInspector
                deliberationId={did}
                node={selectedNode}
                openCqIds={openCqIds}
                onCqToggle={(cqId, on) =>
                  setOpenCQsLocal((prev) => {
                    const arr = new Set(prev[selectedNode.id] || []);
                    on ? arr.add(cqId) : arr.delete(cqId);
                    return { ...prev, [selectedNode.id]: Array.from(arr) };
                  })
                }
              />

              {/* Attacker peek */}
              {(() => {
                const atks = attackersOf(selectedNode.id);
                if (!atks.length) return null;
                return (
                  <div className="mt-2 text-[11px] text-neutral-700">
                    Attackers:{' '}
                    {atks.slice(0, 4).map((id) => (
                      <span
                        key={id}
                        className="mr-2 rounded-full border border-slate-200 bg-white/70 px-2 py-0.5"
                      >
                        {id.slice(0, 8)}
                      </span>
                    ))}
                    {atks.length > 4 && <span>… +{atks.length - 4}</span>}
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {/* Map modal */}
        <div className="rounded border bg-white p-2">
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="mb-2 text-sm font-semibold"
                aria-label="Open argument map"
              >
                Argument Map
              </button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl bg-slate-50 rounded-xl p-0 overflow-hidden">
              <DialogHeader className="px-4 pt-4 pb-2 border-b">
                <DialogTitle>Argument Map</DialogTitle>
              </DialogHeader>

              <div className="p-4 max-h-[500px] overflow-y-auto">
                <MapCanvas deliberationId={did} height={420} />
              </div>

              <div className="px-4 pb-4 pt-2 border-t flex justify-end">
                <DialogClose asChild>
                  <button id="closemap" type="button" className="btnv2">
                    Close
                  </button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

// /* --------------------------- ArgumentInspector -------------------------- */

// function ArgumentInspector({
//   deliberationId,
//   node,
//   onCqToggle,
//   openCqIds,                       // server-observed open WHYs for this node (by cqId)
// }: {
//   deliberationId: string;
//   node: AFNode;
//   onCqToggle: (cqId: string, on: boolean) => void;
//   openCqIds?: Set<string>;
// }) {
//   const schemes = inferSchemesFromText(node.text || node.label || '');
//   const [scheme, setScheme] = React.useState(schemes[0] || 'Consequences');
//   const cqs = questionsForScheme(scheme);

//   // Per-row posting + UI-open state
//   const [postingMap, setPostingMap] = React.useState<Record<string, boolean>>({});
//   const [okSig, setOkSig] = React.useState<string | null>(null);
//   const [uiOpen, setUiOpen] = React.useState<Set<string>>(new Set());

//   const isRowPosting = React.useCallback(
//     (sig: string) => !!postingMap[sig],
//     [postingMap]
//   );
//   const setRowPosting = React.useCallback((sig: string, v: boolean) => {
//     setPostingMap((prev) => (v ? { ...prev, [sig]: true } : (() => {
//       const n = { ...prev }; delete n[sig]; return n;
//     })()));
//   }, []);

//   // keep UI checkboxes in sync with server open WHYs
//   const openKey = React.useMemo(
//     () => [...(openCqIds ?? new Set<string>())].sort().join('|'),
//     [openCqIds]
//   );
//   React.useEffect(() => {
//     setUiOpen(new Set(openCqIds ?? []));
//   }, [openKey, scheme, openCqIds]);

//   // Also fetch directly (belt & suspenders) and accept server truth
//   const { data: openFromServer } = useSWR(
//     node?.id
//       ? `/api/dialogue/open-cqs?deliberationId=${encodeURIComponent(deliberationId)}&targetId=${encodeURIComponent(node.id)}`
//       : null,
//     (u) => fetchJSON<{ ok: boolean; cqOpen: string[] }>(u),
//     { revalidateOnFocus: false }
//   );
//   React.useEffect(() => {
//     if (openFromServer?.ok && Array.isArray(openFromServer.cqOpen)) {
//       setUiOpen(new Set(openFromServer.cqOpen));
//     }
//   }, [openFromServer?.ok, openFromServer?.cqOpen]);

//   async function postMove(kind: 'WHY'|'GROUNDS', payload: any, sig: string) {
//     if (isRowPosting(sig)) return true; // ignore duplicates while in flight
//     setRowPosting(sig, true);

//     let ok = false;
//     try {
//       const controller = new AbortController();
//       const timer = setTimeout(() => controller.abort(), 12000);
//       const res = await fetch('/api/dialogue/move', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           deliberationId,
//           targetType: 'argument',
//           targetId: node.id,
//           kind,
//           payload,                 // includes { schemeKey, cqId }
//           autoCompile: true,
//           autoStep: true,
//         }),
//         signal: controller.signal,
//       });
//       clearTimeout(timer);
//       ok = res.ok;
//       window.dispatchEvent(new CustomEvent('dialogue:moves:refresh'));
//       if (ok) {
//         setOkSig(sig);
//         setTimeout(() => setOkSig((s) => (s === sig ? null : s)), 900);
//       }
//     } catch {
//       // no-op
//     } finally {
//       setRowPosting(sig, false);
//     }
//     return ok;
//   }

//   // also clear any lingering "posting" on global refresh (extra safety)
//   React.useEffect(() => {
//     const h = () => setPostingMap({});
//     window.addEventListener('dialogue:moves:refresh', h as any);
//     return () => window.removeEventListener('dialogue:moves:refresh', h as any);
//   }, []);

//   // Idempotent toggle with scheme + cq in payload
//   const onToggleCQ = async (schemeKey: string, cqId: string, on: boolean) => {
//     const sig = `${schemeKey}:${cqId}`;
//     const serverOpen = openCqIds?.has(cqId) ?? false;
//     const locallyOpen = uiOpen.has(cqId);

//     if (on) {
//       setUiOpen((s) => new Set(s).add(cqId));
//       onCqToggle(cqId, true);

//       // Only send WHY if not already open (server or local)
//       if (serverOpen || locallyOpen) return;
//       await postMove('WHY', { schemeKey, cqId }, sig);
//     } else {
//       setUiOpen((s) => {
//         const n = new Set(s); n.delete(cqId); return n;
//       });
//       onCqToggle(cqId, false);

//       // Only GROUNDS if server had it open (prevents noisy closes)
//       if (serverOpen) await postMove('GROUNDS', { schemeKey, cqId }, sig);
//     }
//   };

//   // Claim lookup → enable full, guarded CQ flow
//   const { data: argRes, mutate: refetchArg } = useSWR(
//     node?.id ? `/api/arguments/${encodeURIComponent(node.id)}` : null,
//     (u) => fetchJSON<any>(u),
//     { revalidateOnFocus: false }
//   );

//   const [claimIdOverride, setClaimIdOverride] = React.useState<string | null>(null);
//   const claimId: string | undefined = claimIdOverride ?? argRes?.argument?.claimId ?? undefined;

//   // Open claim-level panel
//   const [fullOpen, setFullOpen] = React.useState(false);
//   const [promoting, setPromoting] = React.useState(false);
//   const prefilterKeys = React.useMemo(() => {
//     const open = new Set<string>([...(openCqIds ?? new Set()), ...uiOpen]);
//     return cqs.filter(q => open.has(q.id)).map(q => ({ schemeKey: scheme, cqKey: q.id }));
//   }, [openCqIds, uiOpen, cqs, scheme]);
//  async function promoteThenOpen() {
//       if (promoting) return;
//       setPromoting(true);
//       const res = await fetch('/api/claims/quick-create', {
//       method: 'POST',
//       headers: { 'content-type':'application/json' },
//       body: JSON.stringify({
//         targetArgumentId: node.id,
//         text: node.text ?? node.label ?? '',
//         deliberationId
//       }),
//     });
//          try {
//         const json = await res.json().catch(() => ({} as any));
//         const newId = json?.claimId ?? json?.existsClaimId ?? argRes?.argument?.claimId;
//         if (newId) {
//           setClaimIdOverride(newId);
//           setFullOpen(true);
//           refetchArg().catch(() => {});
//         } else {
//           console.error('quick-create did not return a claimId');
//         }
//       } finally {
//         setPromoting(false);
//     }
//   }
// React.useEffect(() => {
//   if (!fullOpen && claimId && promoting === false) setFullOpen(true);
// }, [claimId, fullOpen, promoting]);
//   return (
//     <div className="rounded border border-slate-200 bg-white/70 p-2 space-y-2">
//       {/* Tier explainer + full CQ action */}
//       <div className="flex items-center justify-between gap-2">
//         <div className="text-[11px] text-neutral-600">
//           These CQs <b>simulate</b> attacks in the graph (WHY = attack, GROUNDS = release).
//           For official, guarded resolution, open the <b>claim-level</b> panel.
//         </div>
//           {claimId ? (
//      <button className="btnv2--ghost btnv2--sm" onClick={() => setFullOpen(true)}>
//        Open full CQs
//      </button>
//    ) : (
//      <button
//        className="btnv2--ghost btnv2--sm"
//        onClick={promoteThenOpen}
//        disabled={promoting}
//        title={promoting ? 'Promoting…' : 'Promote argument to claim and open full CQs'}
//      >
//        {promoting ? 'Promoting…' : 'Promote → Open full CQs'}
//      </button>
//  )}
//       </div>

//       {/* Scheme picker */}
//       <div className="flex items-center gap-2">
//         <div className="font-medium text-sm">Critical questions</div>
//         <select
//           className="border rounded px-1 py-0.5 text-xs"
//           value={scheme}
//           onChange={(e) => setScheme(e.target.value as any)}
//         >
//           {schemes.concat(scheme).filter((v, i, a) => a.indexOf(v) === i).map((s) => (
//             <option key={s} value={s}>{s}</option>
//           ))}
//         </select>
//       </div>

//       {/* Checklist (controlled; pre-checked from open WHYs) */}
//       <div className="space-y-1">
//         {cqs.map((q) => {
//           const checked = (openCqIds?.has(q.id) ?? false) || uiOpen.has(q.id);
//           const sig = `${scheme}:${q.id}`;
//           return (
//             <label key={q.id} className="flex items-center gap-2 text-sm">
//               <input
//                 type="checkbox"
//                 checked={checked}
//                 onChange={(e) => onToggleCQ(scheme, q.id, e.target.checked)}
//                 disabled={isRowPosting(sig)}
//               />
//               <span>{q.text}</span>
//               {okSig === sig && <span className="text-[10px] text-emerald-700">✓</span>}
//               {q.severity && (
//                 <span className={
//                   'ml-1 text-[10px] px-1 rounded ' +
//                   (q.severity === 'high'
//                     ? 'bg-rose-100 text-rose-700'
//                     : q.severity === 'med'
//                     ? 'bg-amber-100 text-amber-700'
//                     : 'bg-slate-100 text-slate-700')
//                 }>
//                   {q.severity}
//                 </span>
//               )}
//             </label>
//           );
//         })}
//       </div>

//       {/* Quick WHY / GROUNDS on selected scheme */}
//       <div className="flex gap-2">
//         <button
//           className="btnv2--ghost btnv2--sm"
//           onClick={() => postMove('WHY', { note: 'Please address open critical questions', schemeKey: scheme }, `${scheme}:__bulk`)}
//           disabled={isRowPosting(`${scheme}:__bulk`)}
//         >
//           {isRowPosting(`${scheme}:__bulk`) ? 'Posting…' : 'Challenge (WHY)'}
//         </button>
//         <button
//           className="btnv2--ghost btnv2--sm"
//           onClick={() => postMove('GROUNDS', { note: 'Grounds submitted', schemeKey: scheme }, `${scheme}:__bulkG`)}
//           disabled={isRowPosting(`${scheme}:__bulkG`)}
//         >
//           {isRowPosting(`${scheme}:__bulkG`) ? 'Posting…' : 'Provide grounds'}
//         </button>
//       </div>

//       {/* Claim-level CQ modal */}
//       {claimId && (
//         <Dialog open={fullOpen} onOpenChange={setFullOpen}>
//           <DialogContent className="bg-white rounded-xl sm:max-w-[880px]">
//             <DialogHeader>
//               <DialogTitle>Claim-level Critical Questions</DialogTitle>
//             </DialogHeader>
//             <div className="mt-2">
//               <CriticalQuestions
//                 targetType="claim"
//                 targetId={claimId}
//                 deliberationId={deliberationId}
//                 prefilterKeys={prefilterKeys}
//               />
//             </div>
//           </DialogContent>
//         </Dialog>
//       )}
//     </div>
//   );
// }
/* --------------------------- ArgumentInspector -------------------------- */

function ArgumentInspector({
  deliberationId,
  node,
  onCqToggle,
  openCqIds, // server-observed open WHYs for this node (by cqId)
}: {
  deliberationId: string;
  node: AFNode;
  onCqToggle: (cqId: string, on: boolean) => void;
  openCqIds?: Set<string>;
}) {
  const schemes = inferSchemesFromText(node.text || node.label || '');
  const [scheme, setScheme] = React.useState(schemes[0] || 'Consequences');
  const cqs = questionsForScheme(scheme);

  // 🔒 Robust target resolution: prefer explicit ids if parent provided them
  const argumentId = React.useMemo<string | null>(() => {
    // prefer explicit fields if the graph node carries them
    const n: any = node ?? {};
    return n.argumentId ?? n.meta?.argumentId ?? n.id ?? null;
  }, [node]);

  const claimIdFromNode = React.useMemo<string | null>(() => {
    const n: any = node ?? {};
    return n.claimId ?? n.meta?.claimId ?? null;
  }, [node]);

  // Per-row posting + UI-open state
  const [postingMap, setPostingMap] = React.useState<Record<string, boolean>>({});
  const [okSig, setOkSig] = React.useState<string | null>(null);
  const [uiOpen, setUiOpen] = React.useState<Set<string>>(new Set());

  const isRowPosting = React.useCallback(
    (sig: string) => !!postingMap[sig],
    [postingMap]
  );
  const setRowPosting = React.useCallback((sig: string, v: boolean) => {
    setPostingMap((prev) =>
      v ? { ...prev, [sig]: true } : (() => { const n = { ...prev }; delete n[sig]; return n; })()
    );
  }, []);

  // keep UI checkboxes in sync with server open WHYs
  const openKey = React.useMemo(
    () => [...(openCqIds ?? new Set<string>())].sort().join('|'),
    [openCqIds]
  );
  React.useEffect(() => {
    setUiOpen(new Set(openCqIds ?? []));
  }, [openKey, scheme, openCqIds]);

  // ✅ Pull server truth for this *argument* (not claim)
  const { data: openFromServer } = useSWR(
    argumentId
      ? `/api/dialogue/open-cqs?deliberationId=${encodeURIComponent(deliberationId)}&targetId=${encodeURIComponent(argumentId)}`
      : null,
    (u) => fetchJSON<{ ok: boolean; cqOpen: string[] }>(u),
    { revalidateOnFocus: false }
  );
  React.useEffect(() => {
    if (openFromServer?.ok && Array.isArray(openFromServer.cqOpen)) {
      setUiOpen(new Set(openFromServer.cqOpen));
    }
  }, [openFromServer?.ok, openFromServer?.cqOpen]);

  async function postMove(kind: 'WHY' | 'GROUNDS', payload: any, sig: string) {
    if (!argumentId) return false;         // 🚫 No argument id, no move.
    if (isRowPosting(sig)) return true;    // ignore duplicates while in flight
    setRowPosting(sig, true);

    let ok = false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const res = await fetch('/api/dialogue/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliberationId,
          targetType: 'argument',
          targetId: argumentId,           // 🔒 always the argument id
          kind,
          payload,                         // includes { schemeKey, cqId }
          autoCompile: true,
          autoStep: true,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      ok = res.ok;
      if (ok) {
        setOkSig(sig);
        setTimeout(() => setOkSig((s) => (s === sig ? null : s)), 900);
        // Hint: if you coalesce fetches elsewhere, you may not need this dispatch:
        window.dispatchEvent(new CustomEvent('dialogue:moves:refresh'));
      }
    } catch {
      // no-op
    } finally {
      setRowPosting(sig, false);
    }
    return ok;
  }

  // also clear any lingering "posting" on global refresh (extra safety)
  React.useEffect(() => {
    const h = () => setPostingMap({});
    window.addEventListener('dialogue:moves:refresh', h as any);
    return () => window.removeEventListener('dialogue:moves:refresh', h as any);
  }, []);

  // Idempotent toggle with scheme + cq in payload
  const onToggleCQ = async (schemeKey: string, cqId: string, on: boolean) => {
    const sig = `${schemeKey}:${cqId}`;
    const serverOpen = openCqIds?.has(cqId) ?? false;
    const locallyOpen = uiOpen.has(cqId);

    if (on) {
      setUiOpen((s) => new Set(s).add(cqId));
      onCqToggle(cqId, true);
      // Only send WHY if not already open (server or local)
      if (!serverOpen && !locallyOpen) await postMove('WHY', { schemeKey, cqId }, sig);
    } else {
      setUiOpen((s) => { const n = new Set(s); n.delete(cqId); return n; });
      onCqToggle(cqId, false);
      // Only GROUNDS if server had it open (prevents noisy closes)
      if (serverOpen) await postMove('GROUNDS', { schemeKey, cqId }, sig);
    }
  };

  // 🎯 Claim lookup: prefer what the parent/graph already knows; otherwise promote
  const [claimIdOverride, setClaimIdOverride] = React.useState<string | null>(null);
  const claimId: string | undefined = claimIdOverride ?? claimIdFromNode ?? undefined;

  // Open claim-level panel
  const [fullOpen, setFullOpen] = React.useState(false);
  const [promoting, setPromoting] = React.useState(false);
  const prefilterKeys = React.useMemo(() => {
    const open = new Set<string>([...(openCqIds ?? new Set()), ...uiOpen]);
    return cqs.filter(q => open.has(q.id)).map(q => ({ schemeKey: scheme, cqKey: q.id }));
  }, [openCqIds, uiOpen, cqs, scheme]);

  const promoteThenOpen = React.useCallback(async () => {
    if (promoting || !argumentId) return;
    setPromoting(true);
    try {
      const res = await fetch('/api/claims/quick-create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          targetArgumentId: argumentId,
          text: node.text ?? node.label ?? '',
          deliberationId,
        }),
      });
      const json = await res.json().catch(() => ({} as any));
      const newId = json?.claimId ?? json?.existsClaimId ?? null;
      if (newId) {
        setClaimIdOverride(newId);
        setFullOpen(true);
      } else {
        console.error('quick-create did not return a claimId');
      }
    } finally {
      setPromoting(false);
    }
  }, [promoting, argumentId, node?.text, node?.label, deliberationId]);

  React.useEffect(() => {
    if (!fullOpen && claimId && promoting === false) setFullOpen(true);
  }, [claimId, fullOpen, promoting]);

  const disabledAll = !argumentId;

  return (
    <div className="rounded border border-slate-200 bg-white/70 p-2 space-y-2">
      {/* Tier explainer + full CQ action */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-neutral-600">
          These CQs <b>simulate</b> attacks in the graph (WHY = attack, GROUNDS = release).
          For official, guarded resolution, open the <b>claim-level</b> panel.
        </div>
        {claimId ? (
          <button className="btnv2--ghost btnv2--sm" onClick={() => setFullOpen(true)}>
            Open full CQs
          </button>
        ) : (
          <button
            className="btnv2--ghost btnv2--sm"
            onClick={promoteThenOpen}
            disabled={promoting || disabledAll}
            title={disabledAll ? 'No argument selected' : (promoting ? 'Promoting…' : 'Promote argument to claim and open full CQs')}
          >
            {promoting ? 'Promoting…' : 'Promote → Open full CQs'}
          </button>
        )}
      </div>

      {/* Scheme picker */}
      <div className="flex items-center gap-2">
        <div className="font-medium text-sm">Critical questions</div>
        <select
          className="border rounded px-1 py-0.5 text-xs"
          value={scheme}
          onChange={(e) => setScheme(e.target.value as any)}
        >
          {schemes.concat(scheme).filter((v, i, a) => a.indexOf(v) === i).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Checklist (controlled; pre-checked from open WHYs) */}
      <div className="space-y-1 opacity-[var(--oi,1)]" style={{ ['--oi' as any]: disabledAll ? 0.5 : 1 }}>
        {cqs.map((q) => {
          const checked = (openCqIds?.has(q.id) ?? false) || uiOpen.has(q.id);
          const sig = `${scheme}:${q.id}`;
          return (
            <label key={q.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onToggleCQ(scheme, q.id, e.target.checked)}
                disabled={disabledAll || isRowPosting(sig)}
                title={disabledAll ? 'No argument id to target' : undefined}
              />
              <span>{q.text}</span>
              {okSig === sig && <span className="text-[10px] text-emerald-700">✓</span>}
              {q.severity && (
                <span className={
                  'ml-1 text-[10px] px-1 rounded ' +
                  (q.severity === 'high'
                    ? 'bg-rose-100 text-rose-700'
                    : q.severity === 'med'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-700')
                }>
                  {q.severity}
                </span>
              )}
            </label>
          );
        })}
      </div>

      {/* Quick WHY / GROUNDS on selected scheme */}
      <div className="flex gap-2">
        <button
          className="btnv2--ghost btnv2--sm"
          onClick={() => postMove('WHY', { note: 'Please address open critical questions', schemeKey: scheme }, `${scheme}:__bulk`)}
          disabled={disabledAll || isRowPosting(`${scheme}:__bulk`)}
          title={disabledAll ? 'No argument id to target' : undefined}
        >
          {isRowPosting(`${scheme}:__bulk`) ? 'Posting…' : 'Challenge (WHY)'}
        </button>
        <button
          className="btnv2--ghost btnv2--sm"
          onClick={() => postMove('GROUNDS', { note: 'Grounds submitted', schemeKey: scheme }, `${scheme}:__bulkG`)}
          disabled={disabledAll || isRowPosting(`${scheme}:__bulkG`)}
          title={disabledAll ? 'No argument id to target' : undefined}
        >
          {isRowPosting(`${scheme}:__bulkG`) ? 'Posting…' : 'Provide grounds'}
        </button>
      </div>

      {/* Claim-level CQ modal */}
      {claimId && (
        <Dialog open={fullOpen} onOpenChange={setFullOpen}>
          <DialogContent className="bg-white rounded-xl sm:max-w-[880px]">
            <DialogHeader>
              <DialogTitle>Claim-level Critical Questions</DialogTitle>
            </DialogHeader>
            <div className="mt-2">
              <CriticalQuestions
                targetType="claim"
                targetId={claimId}
                deliberationId={deliberationId}
                prefilterKeys={prefilterKeys}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
