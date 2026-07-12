//This is a legacy, obselete file kept for reference. Please do not edit or use this file.
"use client";
import { useEffect, useState, useMemo } from "react";
import DeliberationComposer from "./DeliberationComposer";
import { RepresentativeViewpoints } from "./RepresentativeViewpoints";
import ArgumentsList from "./ArgumentsList";
import CardComposerTab from "@/components/deepdive/CardComposerTab";
import StatusChip from "@/components/governance/StatusChip";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "../ui/tabs";
import CegMiniMap from "./CegMiniMap";
import TopologyWidget from "./TopologyWidget";
import HelpModal from "@/components/help/HelpModal";
import DiscusHelpPage from "../help/HelpPage";
import ApprovalsHeatStrip from "@/components/deepdive/ApprovalsHeatStrip";
import CardList from "@/components/deepdive/CardList";
import { ViewControls } from "./RepresentativeViewpoints";
import GraphPanel from "@/components/graph/GraphPanel";
import { RhetoricProvider, useRhetoric } from '@/components/rhetoric/RhetoricContext';
import RhetoricControls from '@/components/rhetoric/RhetoricControls';
import WorksRail from "../work/WorksRail";
import WorksList from "../work/WorksList";
import LudicsPanel from "./LudicsPanel";
import DiagramView from "../map/DiagramView";
import BehaviourInspectorCard from '@/components/ludics/BehaviourInspectorCard';
import { scrollIntoViewById } from "@/lib/client/scroll";
import { CommandCard, performCommand } from '@/components/dialogue/command-card/CommandCard';
import { movesToActions } from "@/lib/dialogue/movesToActions"; // ✅ Use newer adapter
import { computeFogForNodes } from "../dialogue/FogForNodesClient";
 import { useMinimapData } from '@/lib/client/minimap/useMinimapData';
import useSWR, { mutate as swrMutate } from "swr";
import DebateSheetReader from "../agora/DebateSheetReader";
import { AIFArgumentWithSchemeComposer } from "../arguments/AIFArgumentWithSchemeComposer";
import { AIFAuthoringPanel } from "./AIFAuthoringPanel";
import { AIFList } from "./ArgumentsList";
import React from "react";
import clsx from "clsx";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { CommandCardAction } from "@/components/dialogue/command-card/types";
import CardListVirtuoso from "@/components/deepdive/CardListVirtuoso";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/AuthContext";
import AIFArgumentsListPro from '@/components/arguments/AIFArgumentsListPro';
import PropositionsList from "../propositions/PropositionsList";
 import { AFMinimap } from '@/components/dialogue/minimap/AFMinimap';
 import type { MinimapNode, MinimapEdge } from '@/components/dialogue/minimap/types';
import { use } from "chai";
import { auth } from "googleapis/build/src/apis/abusiveexperiencereport";
import PropositionComposer from "../propositions/PropositionComposer";
const fetcher = (u:string)=>fetch(u,{cache:'no-store'}).then(r=>r.json());

const LazyGraphPanel = dynamic(() => import("@/components/graph/GraphPanel"), {
  ssr: false,
});


type PrefProfile = 'community' | 'policy' | 'scientific';
type PrefState = { profile: PrefProfile };

type Selection = {
  id: string;
  deliberationId: string; // ✅ selection now includes this
  rule: "utilitarian" | "harmonic" | "maxcov";
  k: number;
  coverageAvg: number;
  coverageMin: number;
  jrSatisfied: boolean;
  views: {
    index: number;
    arguments: { id: string; text: string; confidence?: number | null }[];
  }[];
};
export function ScrollBody({
  children,
  maxH = '28rem',
}: { children: React.ReactNode; maxH?: string }) {
  return (
    <div
      className="overflow-auto [mask-image:linear-gradient(to_bottom,transparent,black_12px,black_calc(100%-12px),transparent)]"
      style={{ maxHeight: maxH }}
    >
      {children}
    </div>
  );
}
function useCompileStep(deliberationId: string|undefined) {
  const [state, setState] = React.useState<{
    proId?: string;
    oppId?: string;
    trace?: any;
    loading: boolean;
  }>({ loading: true });

  React.useEffect(() => {
    if (!deliberationId) return;
    setState({ loading: true });
    (async () => {
      const r = await fetch('/api/ludics/compile-step', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deliberationId }),
      }).then(res => res.json());
      setState({ proId: r.proId, oppId: r.oppId, trace: r.trace, loading: false });
    })();
  }, [deliberationId]);

  return state;
}

function ActivityFeed({ deliberationId, authorId }:{ deliberationId:string; authorId:string }) {
  const { data, error, isLoading } = useSWR(
    `/api/deliberations/${encodeURIComponent(deliberationId)}/activity?authorId=${encodeURIComponent(authorId)}&limit=100`,
    fetcher
  );
  if (isLoading) return <div className="text-xs text-neutral-500">Loading…</div>;
  if (error)     return <div className="text-xs text-rose-600">Failed to load</div>;
  const items = data?.items ?? [];
  if (!items.length) return <div className="text-xs text-neutral-500">No recent activity</div>;

  return (
    <ul className="space-y-2">
      {items.map((ev:any) => (
        <li key={ev.id} className="text-sm flex justify-between border-b pb-1">
          <span>
            {ev.type === 'WHY' && <>❓ WHY on <b>{ev.targetType}</b></>}
            {ev.type === 'GROUNDS' && <>💡 Grounds on <b>{ev.targetType}</b></>}
            {ev.type === 'RETRACT' && <>🗑 Retracted <b>{ev.targetType}</b></>}
            {ev.type === 'CONCEDE' && <>✅ Conceded on <b>{ev.targetType}</b></>}
            {ev.type === 'APPROVAL' && <>👍 Approved your <b>argument</b></>}
            {ev.type === 'CLAIM_SUPPORTED' && <>🧩 Support for your <b>claim</b></>}
            {ev.type === 'CLAIM_REBUTTED' && <>⚔️ Rebuttal to your <b>claim</b></>}
            {ev.type === 'ISSUE_LINK' && <>🔗 Issue linked to your <b>argument</b></>}
          </span>
          <span className="text-[11px] text-neutral-500">
            {new Date(ev.createdAt).toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

function WorksCounts({ deliberationId }:{ deliberationId:string }) {
  const [counts, setCounts] = useState<{DN:number;IH:number;TC:number;OP:number}>({DN:0,IH:0,TC:0,OP:0});
  useEffect(() => {
    if (!deliberationId) return;
    (async () => {
      const res = await fetch(`/api/works?deliberationId=${encodeURIComponent(deliberationId)}`, { cache:'no-store' });
      const json = await res.json();
      const tallies = { DN:0, IH:0, TC:0, OP:0 } as any;
      for (const w of (json.works ?? [])) tallies[w.theoryType] = (tallies[w.theoryType] ?? 0) + 1;
      setCounts(tallies);
    })();
  }, [deliberationId]);
  return (
    <ChipBar>
    <span className="text-[11px] text-neutral-900 py-1">
      DN <b>{counts.DN}</b> · IH <b>{counts.IH}</b> · TC <b>{counts.TC}</b> · OP <b>{counts.OP}</b>
    </span>
    </ChipBar>
  );
}
// header toggle component
function RhetoricToggle() {
  const { mode, setMode } = useRhetoric();
  return (
    
    <label className="text-xs flex  items-center gap-1">
      Lens:
      <select className="menuv2 border rounded px-1 py-0.5" value={mode} onChange={e=>setMode(e.target.value as any)}>
        <option value="content">Content</option>
        <option value="style">Style</option>
      </select>
    </label>
  );
}


function PanelCard({ deliberationId, targetType, targetId, locusPath }:{
  deliberationId:string; targetType:'argument'|'claim'|'card'; targetId:string; locusPath?:string;
}) {
  const target = { deliberationId, targetType, targetId, locusPath };
  const { data } = useSWR(`/api/dialogue/legal-moves?deliberationId=${deliberationId}&targetType=${targetType}&targetId=${targetId}${locusPath ? `&locusPath=${locusPath}` : ''}`, (u: string)=>fetch(u,{cache:'no-store'}).then(r=>r.json()));
  const actions = movesToActions(data?.moves ?? [], target); // ✅ Use newer adapter
  return <CommandCard actions={actions} onPerform={performCommand} />;
}
function onMinimapSelect(id: string, locusPath?: string | null) {
  // scroll the row into view or open the dialogical panel
  window.dispatchEvent(new CustomEvent('mesh:select-node', { detail: { id, locusPath } }));
  // or imperative scroll: document.getElementById(`row-${id}`)?.scrollIntoView({ behavior:'smooth', block:'center' });
}

// function handlePerform(a: CommandCardAction) {
//   if (a.scaffold) {
//     window.dispatchEvent(new CustomEvent('mesh:composer:insert', { detail: { template: a.scaffold.template } }));
//     return;
//   }
//   // protocol action
//   fetch('/api/dialogue/move', {
//     method:'POST', headers:{'content-type':'application/json'},
//     body: JSON.stringify({
//       deliberationId: a.target.deliberationId,
//       targetType: a.target.targetType,
//       targetId: a.target.targetId,
//       kind: a.move?.kind,
//       payload: { ...(a.move?.payload || {}), ...(a.target.locusPath ? { locusPath: a.target.locusPath } : {}) },
//       postAs: a.move?.postAs, autoCompile:true, autoStep:true
//     })
//   }).then(() => window.dispatchEvent(new CustomEvent('mesh:dialogue:refresh')));
// }


function usePersisted(key: string, def = true) {
  const [open, setOpen] = useState<boolean>(def);

  // Read from localStorage only on the client
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved != null) {
        setOpen(saved === "1");
      }
    } catch {
      // ignore if unavailable
    }
  }, [key]);

  // Write whenever it changes
  useEffect(() => {
    try {
      window.localStorage.setItem(key, open ? "1" : "0");
    } catch {
      // ignore if unavailable
    }
  }, [key, open]);

  return { open, setOpen };
}

// export function SectionCard({
//   title,
//   action,
//   children,
// }: {
//   title?: string;
//   action?: React.ReactNode;
//   children: React.ReactNode;
// }) {
//   return (
//     <section className="rounded-2xl border border-slate-200 bg-white/75  shadow-md">
//       {(title || action) && (
//         <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
//           <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
//           {action}
//         </div>
//       )}
//       <div className="px-3 py-4">{children}</div>
//     </section>
//   );
// }
export function SectionCard({
  id,
  title,
  subtitle,
  icon,
  action,
  footer,
  children,
  className = "",
  dense = false,
  stickyHeader = false,
  busy = false,

  isLoading = false,
  emptyText,
  tone = "default",
  padded = true,
}: {
  id?: string;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** compact padding */
  dense?: boolean;
  /** make header sticky inside the card */
  stickyHeader?: boolean;
  busy?: boolean;
  /** quick skeleton state */
  isLoading?: boolean;
  /** dashed empty-state box message */
  emptyText?: string;
  /** accent ring/stripe */
  tone?: "default" | "info" | "success" | "warn" | "danger";
  /** remove inner padding entirely (e.g., for full-bleed graphs) */
  padded?: boolean;
}) {
  const ringClass =
    tone === "info"
      ? "ring-sky-200/60 dark:ring-sky-400/40"
      : tone === "success"
      ? "ring-emerald-200/60 dark:ring-emerald-400/40"
      : tone === "warn"
      ? "ring-amber-200/60 dark:ring-amber-400/50"
      : tone === "danger"
      ? "ring-rose-200/60 dark:ring-rose-400/40"
      : "ring-slate-200/60 dark:ring-slate-800/60";

  const stripeClass =
    tone === "info"
      ? "bg-sky-400/60"
      : tone === "success"
      ? "bg-emerald-400/60"
      : tone === "warn"
      ? "bg-amber-400/70"
      : tone === "danger"
      ? "bg-rose-400/60"
      : "";

  const bodyPad = padded ? (dense ? "px-3 py-3" : "px-5 py-4") : "";

  return (
    <section
      id={id}
      className={[
        "group relative  overflow-hidden rounded-2xl",
        "panel-edge dark:border-slate-800/60",
        "bg-white/50 dark:bg-slate-900/50",
        "backdrop-blur-md supports-[backdrop-filter]:bg-white/50",
        "shadow-sm hover:shadow-md transition-shadow",
        className,
      ].join(" ")}
    >
{busy && (
  <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-t-2xl">
    <div
      className="h-full w-[45%] animate-[mesh-indeterminate_1.6s_infinite_cubic-bezier(0.4,0,0.2,1)]
                 bg-[linear-gradient(90deg,theme(colors.indigo.400),theme(colors.fuchsia.400),theme(colors.sky.400))]"
    />
  </div>
)}
      {/* soft ring on hover/focus */}
      <div
        className={[
          "pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset",
          ringClass,
          "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity",
        ].join(" ")}
        aria-hidden
      />

      {/* thin tone stripe */}
      {tone !== "default" && (
        <div
          className={
            "pointer-events-none absolute left-0 top-0 h-10 w-1.5 rounded-tr-md " +
            stripeClass
          }
          aria-hidden
        />
      )}

      {(title || action || subtitle || icon) && (
        <div
        onMouseMove={(e) => {
          const t = e.currentTarget as HTMLElement;
          const r = t.getBoundingClientRect();
          t.style.setProperty('--mx', `${e.clientX - r.left}px`);
          t.style.setProperty('--my', `${e.clientY - r.top}px`);
        }}
          className={[
            stickyHeader ? "sticky top-0 z-10 -mx-px px-5 py-3" : "px-5 py-3",
            "flex items-center justify-between gap-3",
            "border-b border-slate-100/80 dark:border-slate-800/70",
            "bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm",
            "relative before:pointer-events-none before:absolute before:inset-0",
    "before:bg-[radial-gradient(120px_80px_at_var(--mx)_var(--my),rgba(99,102,241,0.10),transparent_70%)]",
    "before:opacity-0 hover:before:opacity-100 before:transition-opacity"
          ].join(" ")}
        >
          <div className="min-w-0 flex items-center gap-2">
            {icon && (
              <div className="grid size-6 shrink-0 place-items-center rounded-md bg-slate-100 dark:bg-slate-800">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="truncate text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-100">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}

      <div className={bodyPad}>
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-3/5 rounded bg-slate-200/70 dark:bg-slate-700/60" />
            <div className="h-4 w-full rounded bg-slate-200/70 dark:bg-slate-700/60" />
            <div className="h-4 w-4/5 rounded bg-slate-200/70 dark:bg-slate-700/60" />
          </div>
        ) : emptyText ? (
          <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {emptyText}
          </div>
        ) : (
          children
        )}
      </div>

      {footer && (
        <div className="border-t border-slate-100/80 dark:border-slate-800/70 px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
          {footer}
        </div>
      )}
    </section>
  );
}


function ChipBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border-[.5px] border-indigo-200 bg-slate-50 px-1.5 py-1 text-xs">
      {children}
    </div>
  );
}

export default function DeepDivePanel({
  deliberationId,
  containerClassName,   // ⬅️ NEW: controls outer width/centering
  className, 
}: {
  deliberationId: string;
  containerClassName?: string;
  className?: string;
}) {
  const { proId, oppId, trace, loading } = useCompileStep(deliberationId);

  const [sel, setSel] = useState<Selection | null>(null);
  const [pending, setPending] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [tab, setTab] = useState<'arguments'|'works'|'card'|'viewcard'>('arguments');
 const [hudTarget, setHudTarget] = useState<{ type:'claim'; id:string; locusPath?:string|null }|null>(null);

const [confidenceMode, setConfidenceMode] = useState<'min'|'product'>('product');

const [confMode, setConfMode] = React.useState<'product'|'min'>('product');

  const [rule, setRule] = useState<"utilitarian" | "harmonic" | "maxcov">(
    "utilitarian"
  );
  const { user } = useAuth();                // e.g., { userId?: string | number | bigint | null }
  const authorId = user?.userId != null ? String(user.userId) : undefined;
  const [rhetoricSample, setRhetoricSample] = useState<string>('');

const [pref, setPref] = useState<PrefState>({ profile: 'community' });
const [prefLoading, setPrefLoading] = useState(false);
  const [replyTargetId, setReplyTargetId] = React.useState<string|null>(null);
const [replyTarget, setReplyTarget] = React.useState<{id:string; preview?:string} | null>(null);

  const [replyPreview, setReplyPreview] = React.useState<string>("");

  // function handleReplyTo(id: string, preview?: string) {
  //   setReplyTargetId(id);
  //   if (preview) setReplyPreview(preview);
  //   // after state commits, scroll + focus
  //   requestAnimationFrame(() => {
  //     scrollIntoViewById("delib-composer-anchor", 80);
  //     window.dispatchEvent(new CustomEvent('mesh:composer:focus', { detail: { deliberationId } }));
  //   });
  // }
function handleReplyTo(id: string, preview?: string) {
  setReplyTarget({ id, preview });
  requestAnimationFrame(() => {
    scrollIntoViewById("delib-composer-anchor", 80);
    window.dispatchEvent(new CustomEvent("mesh:composer:focus", { detail: { deliberationId } }));
  });
}

function handleReplyToAIF(opts: { argumentId: string; preview?: string }) {
  setReplyTarget({ id: opts.argumentId, preview: opts.preview });
  requestAnimationFrame(() => {
    scrollIntoViewById("delib-composer-anchor", 80);
    window.dispatchEvent(new CustomEvent("mesh:composer:focus", { detail: { deliberationId } }));
  });
}

//   React.useEffect(() => {
//   const fn = (e:any) => {
//     if (e?.detail?.deliberationId && e.detail.deliberationId !== deliberationId) return;
//     setReplyTargetId(null);
//   };
//   window.addEventListener('mesh:composer:clear-reply', fn);
//   return () => window.removeEventListener('mesh:composer:clear-reply', fn);
// }, [deliberationId]);

  // Defer gating of UI until render; always call hooks above.
  const ready = !loading && !!proId && !!oppId;
  const graphState = usePersisted(`dd:graph:${deliberationId}`, false);


  const compute = async (
    forcedRule?: "utilitarian" | "harmonic" | "maxcov",
    forcedK?: number
  ) => {
    setPending(true);
    try {
      const res = await fetch(
        `/api/deliberations/${deliberationId}/viewpoints/select`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rule: forcedRule ?? rule,
            k: forcedK ?? sel?.k ?? 3, // ✅ preserve current k unless overridden
          }),
          cache: "no-store",
        }
      );
      if (!res.ok) {
        console.error("Viewpoints select failed", res.status);
        return;
      }
      const data = await res.json().catch(() => null);
      if (data?.selection) setSel(data.selection);
    } finally {
      setPending(false);
    }
  };
  useEffect(() => {
    fetch(
      `/api/content-status?targetType=deliberation&targetId=${deliberationId}`
    )
      .then((r) => r.json())
      .then((d) => setStatus(d.status))
      .catch(() => {});
  }, [deliberationId]);



  useEffect(() => { compute(); }, [deliberationId]); // remove eslint-disable comment


// Load current prefs
useEffect(() => {
  let alive = true;
  (async () => {
    try {
      setPrefLoading(true);
      const r = await fetch(`/api/deliberations/${encodeURIComponent(deliberationId)}/prefs`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`GET prefs ${r.status}`);
      const j = await r.json();
      if (alive && j?.ok) setPref({ profile: j.profile as PrefProfile });
    } catch {
      // fall back to default 'community'
    } finally {
      if (alive) setPrefLoading(false);
    }
  })();
  return () => { alive = false; };
}, [deliberationId]);

async function updatePref(next: PrefProfile) {
  setPref(prev => ({ ...prev, profile: next })); // optimistic
  try {
    const r = await fetch(`/api/deliberations/${encodeURIComponent(deliberationId)}/prefs`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: next }),
    });
    if (!r.ok) throw new Error(`PUT prefs ${r.status}`);
    // if your backend returns computed thresholds, you could merge them here
  } catch (e) {
    // revert on error (optional)
    // setPref(prev => ({ ...prev, profile: 'community' }));
    console.error('Update prefs failed', e);
  }
}

   // 1) Debates graph (nodes/edges)
   const { data: graphData } = useSWR(
     `/api/deliberations/${encodeURIComponent(deliberationId)}/graph`,
     fetcher
   );
  
   // 2) Dialogue moves (WHY/GROUNDS etc.) for fog
   const { data: movesData } = useSWR(
     `/api/dialogue/moves?deliberationId=${encodeURIComponent(deliberationId)}`,
     fetcher
   );
  
const ftch = (u:string)=>fetch(u,{cache:'no-store'}).then(r=>r.json());

const { data: topArg } = useSWR(
  hudTarget?.type === 'claim' ? `/api/claims/${encodeURIComponent(hudTarget.id)}/top-argument` : null,
  ftch
);

const { data: diag } = useSWR(
  topArg?.top?.id ? `/api/arguments/${encodeURIComponent(topArg.top.id)}?view=diagram` : null,
  ftch
);
   // Listen for minimap → panel selections
   useEffect(() => {
     const onSelect = (e: any) => {
       const { id, locusPath } = e?.detail || {};
       if (!id) return;
        setHudTarget({ type: 'claim', id, locusPath: locusPath ?? null });
       // optional: scroll the row into view if your rows have ids like row-<id>
       document.getElementById(`row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
     };
     window.addEventListener('mesh:select-node', onSelect as any);
     return () => window.removeEventListener('mesh:select-node', onSelect as any);
   }, []);


   // Minimap data (grounded labeling    support-as-defense on)
   const { nodes, edges } = useMinimapData(deliberationId, {
     semantics: 'grounded',
     supportDefense: true,
     radius: 1,
     maxNodes: 400,
 });


   // Command card actions for the selected claim
   const targetRef = hudTarget
     ? { deliberationId, targetType: 'claim' as const, targetId: hudTarget.id, locusPath: hudTarget.locusPath }
     : null;
   const { data: legalMoves } = useSWR(
     targetRef
       ? `/api/dialogue/legal-moves?deliberationId=${encodeURIComponent(deliberationId)}&targetType=claim&targetId=${encodeURIComponent(hudTarget!.id)}${hudTarget?.locusPath ? `&locusPath=${encodeURIComponent(hudTarget!.locusPath!)}` : ''}`
       : null,
     fetcher,
     { revalidateOnFocus: false }
   );
 const cardActions = targetRef ? movesToActions(legalMoves?.moves ?? [], targetRef) : []; // ✅ Use newer adapter
  
   // Revalidate SWR caches after protocol moves
   useEffect(() => {
     const onRefresh = () => {
       swrMutate((key: any) => typeof key === 'string' && key.startsWith('/api/dialogue/'), undefined, { revalidate: true });
     };
     window.addEventListener('mesh:dialogue:refresh', onRefresh);
     return () => window.removeEventListener('mesh:dialogue:refresh', onRefresh);
   }, []);

   // persist/restore from room rulesetJson.confidence.mode (optional)
useEffect(() => {
  (async () => {
    const r = await fetch(`/api/deliberations/${encodeURIComponent(deliberationId)}/prefs`, { cache:'no-store' });
    const j = await r.json().catch(()=>null);
    const m = j?.rulesetJson?.confidence?.mode;
    if (m === 'min' || m === 'product') setConfidenceMode(m);
  })();
}, [deliberationId]);


//    // Map your backend payloads into MinimapNodes/Edges
//    const nodes: MinimapNode[] = useMemo(() => {
//      const claims = graphData?.claims ?? [];
//      const args   = graphData?.arguments ?? [];
//      // Build base nodes (you can refine: status/closable from your APIs)
//      const base: MinimapNode[] = [
//        ...claims.map((c: any) => ({ id: c.id, kind:'claim',  label: c.text?.slice(0,60), status: 'UNDEC' as const })),
//        ...args.map((a: any)   => ({ id: a.id, kind:'argument', label: a.text?.slice(0,60), status: 'UNDEC' as const })),
//      ];
//      // Fog
//      const nodeIds = base.map(n => n.id);
//      const fogMap = computeFogForNodes(nodeIds, (movesData?.items ?? []).map((m: any) => ({
//        kind: m.kind, targetId: m.targetId, fromId: m.fromId, toId: m.toId
//      })));
//      return base.map(n => ({ ...n, fogged: fogMap[n.id] ?? true }));
//    }, [graphData, movesData]);
  
//    const edges: MinimapEdge[] = useMemo(() => {
//      const es = graphData?.edges ?? [];
//      return es.map((e: any, idx: number) => ({
//        id: e.id ?? `e${idx}`,
//        from: e.fromArgumentId ?? e.fromClaimId ?? e.fromId,
//        to:   e.toArgumentId   ?? e.toClaimId   ?? e.toId,
//        kind: (e.type ?? 'support') as any,
//      }));
//  }, [graphData]);

//    // Command card actions for the current target (or noop if none selected yet)
//    const targetRef = hudTarget
//      ? { deliberationId, targetType: hudTarget.type, targetId: hudTarget.id, locusPath: hudTarget.locusPath }
//      : null;
  
//    const { data: legalMoves } = useSWR(
//      targetRef
//        ? `/api/dialogue/legal-moves?deliberationId=${encodeURIComponent(deliberationId)}&targetType=${targetRef.targetType}&targetId=${targetRef.targetId}${targetRef.locusPath ? `&locusPath=${encodeURIComponent(targetRef.locusPath)}` : ''}`
//        : null,
//      fetcher,
//      { revalidateOnFocus: false }
//    );
  
//    const cardActions = useMemo(() => (
//      targetRef ? legalMovesToCommandCard(legalMoves?.moves ?? [], targetRef, /* includeScaffolds */ true) : []
//  ), [legalMoves, targetRef]);
      
      const inner = (
        <div className={clsx("space-y-5 py-3 px-6 relative", className)}>
          {/* Header controls */}
      {/* Arguments + Composer */}
      <SectionCard busy={pending}>
        <div className="relative flex items-center gap-4 mx-auto mb-2 ">
          <div className="flex items-center gap-2">
            {status && <StatusChip status={status} />}
                   <ChipBar >
            <label className="text-xs text-neutral-600 b flex items-center gap-1">
              Rule:
              <select
                className="text-xs menuv2--lite  rounded px-2 mx-2 py-.5 "
                value={rule}
                onChange={(e) => {
                  setRule(e.target.value as any);
                  compute(e.target.value as any);
                }}
              >
                <option value="utilitarian">Utilitarian</option>
                <option value="harmonic">Harmonic</option>
                <option value="maxcov">MaxCov</option>
              </select>
            </label>
            
            </ChipBar>
            <ChipBar>
<label className="text-xs text-neutral-600 flex items-center gap-1">
  Confidence:
  <select
    className="text-xs menuv2--lite rounded px-2 mx-2 py-.5"
    value={confMode}
    onChange={(e)=> setConfMode(e.target.value as any)}
  >
    <option value="product">Product (prob. OR)</option>
    <option value="min">Min (weakest link)</option>
  </select>
</label>
</ChipBar>

            {/* <HelpModal /> */}
            <DiscusHelpPage />
          </div>
          <div className="flex gap-4">
          <RhetoricControls sample={rhetoricSample} />
          <div className="flex gap-2">
          <button
    className="menuv2--lite px-2 text-[11px] rounded py-1"
    onClick={() => {
      setTab('works');
    // double-RAF ensures tab state has applied before we scroll
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById('deepdive-tabs-anchor')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }}
>
  Open Models
</button>
  <WorksCounts deliberationId={deliberationId} />
  </div>
          {/* <div id="work-composer" /> 
      WorksRail deliberationId={deliberationId} /> */}
          <div className="flex px-3 py-2">

              {pending && <div className="text-[8px] text-neutral-500">Computing…</div>}
            </div>
        </div>

        </div>
        

      <ArgumentsList
          deliberationId={deliberationId}
          onVisibleTextsChanged={(texts)=>setRhetoricSample(texts.join(' '))}

          // onReplyTo={(id) => setReplyTo(id)}
               onReplyTo={handleReplyTo}
          onChanged={() => compute(sel?.rule)}
        />


</SectionCard>
      <SectionCard>
      
{/*       
        <DeliberationComposer
        id="delib-composer-anchor"
          deliberationId={deliberationId}
            isReplyMode={!!replyTarget}    
           targetArgumentId={replyTargetId ?? undefined}
                     targetPreviewText={replyPreview}
onClearReply={() => setReplyTarget(null)}
          onPosted={() => {
       setReplyTarget(null); 
            compute(sel?.rule);
          }}
 
        /> */}
        <DeliberationComposer
  id="delib-composer-anchor"
  deliberationId={deliberationId}
  isReplyMode={!!replyTarget}           
  targetArgumentId={replyTarget?.id}
  targetPreviewText={replyTarget?.preview}
  onClearReply={() => setReplyTarget(null)}  
  onPosted={() => {
    setReplyTarget(null);             
    compute(sel?.rule);
  }}
/>
      </SectionCard>

   
{/* was: <Tabs defaultValue="arguments"> */}
<div id="deepdive-tabs-anchor" className="scroll-mt-24" /> 
<SectionCard>
<Tabs  value={tab} onValueChange={(v)=>setTab(v as any)}>
  <hr className="w-full border border-white" />
  <div id="work-composer" /> 

  <TabsList >
    <TabsTrigger className="hover:rounded-xl hover:bg-slate-200" value="arguments">Arguments</TabsTrigger>
    <TabsTrigger className="hover:bg-slate-200" value="works">Works</TabsTrigger>
    <TabsTrigger className="hover:bg-slate-200" value="ludics">Ludics</TabsTrigger> {/* NEW */}

    <TabsTrigger className="hover:bg-slate-200" value="card">Create Card</TabsTrigger>
    <TabsTrigger className="hover:bg-slate-200" value="viewcard">View Cards</TabsTrigger>
    <TabsTrigger className="hover:bg-slate-200" value="activity">My Activity</TabsTrigger>

  </TabsList>
  <TabsContent value="arguments">{/* (keep empty or future) */}</TabsContent>

  {/* Works tab content — move it here (no extra wrapping div outside Tabs) */}
  <TabsContent value="works">
    <SectionCard title="Theory Works">
      <WorksList deliberationId={deliberationId} currentUserId={authorId} />
    </SectionCard>
  </TabsContent>
  <TabsContent value="ludics">
  {proId && oppId ? (
    <div >
      <LudicsPanel
        deliberationId={deliberationId}
        proDesignId={proId}   // now narrowed to string
        oppDesignId={oppId}
      />
      <div className="mt-3">
        <BehaviourInspectorCard deliberationId={deliberationId} />
      </div>
    </div>
  ) : (
    <SectionCard title="Ludics">
      <div className="text-xs text-neutral-500">Preparing designs…</div>
    </SectionCard>
  )}
</TabsContent>
  <TabsContent value="card">
    <SectionCard title="Create Card">
      <CardComposerTab deliberationId={deliberationId} />
    </SectionCard>
  </TabsContent>

  <TabsContent value="viewcard">
    <SectionCard title="View Cards">
      <div className="mt-0">
        <CardListVirtuoso
          deliberationId={deliberationId}
          filters={{
            status: 'published',
            authorId,
            since: '2025-08-01T00:00:00Z',
            sort: 'createdAt:desc',
          }}
        />
      </div>
    </SectionCard>
  </TabsContent>
  <TabsContent value="activity">
  <SectionCard title="Activity on my contributions">
  {authorId && (
  <SectionCard title="Activity on my contributions">
    <ActivityFeed deliberationId={deliberationId} authorId={authorId} />
  </SectionCard>
)}
  </SectionCard>
</TabsContent>
</Tabs>
</SectionCard>
      {/* Views + CEG widgets */}
      <SectionCard>
        <RepresentativeViewpoints
          selection={sel}
          onReselect={(nextRule, nextK) => compute(nextRule, nextK)}
        />
      </SectionCard>

      <SectionCard >

      <CegMiniMap deliberationId={deliberationId} />
      </SectionCard>
      {/* <SectionCard>
        <Collapsible open={graphState.open} onOpenChange={graphState.setOpen}>
          <div className="relative flex items-center justify-between px-1">
            <CollapsibleTrigger
              aria-expanded={graphState.open}
              className="text-sm font-semibold btnv2 px-8 py-1 tracking-wider
               rounded-md "
            >
              {graphState.open ? "Collapse Graph" : "Expand Graph"}
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="relative pt-2">
            {graphState.open && (
              <LazyGraphPanel deliberationId={deliberationId} />
            )}
          </CollapsibleContent>
        </Collapsible>
      </SectionCard> */}
      <SectionCard>
        <ApprovalsHeatStrip deliberationId={deliberationId} />
      </SectionCard>
      <SectionCard>
        <TopologyWidget deliberationId={deliberationId} />
      </SectionCard>
           <SectionCard title="Map & Controls">
     <div className="grid grid-cols-12 gap-4 items-start">
       <div className="col-span-5">
         <AFMinimap
           nodes={nodes}
           edges={edges}
           selectedId={hudTarget?.id ?? null}
           onSelectNode={(id, locusPath) => {
             window.dispatchEvent(new CustomEvent('mesh:select-node', { detail: { id, locusPath } }));
           }}
           width={260}
           height={180}
         />
       </div>
       <div className="col-span-7">
         <CommandCard
           actions={cardActions}
           onPerform={performCommand}
         />
         {!hudTarget && (
           <div className="mt-2 text-[11px] text-neutral-600">
             Select a claim (minimap or list) to enable controls.
           </div>
         )}
       </div>
     </div>
 </SectionCard>
   {/* <SectionCard title="Dialogue Diagram">
     {diag?.diagram
       ? <DiagramView diagram={diag.diagram} />

       : <div className="text-xs text-neutral-500">Select a claim (minimap) to load its top argument.</div>}
   </SectionCard> */}
   {/* <SectionCard title="Scheme Composer">
    <AIFArgumentWithSchemeComposer schemeKey={1}  />
   </SectionCard> */}
   <SectionCard title="Scheme Composer">
<AIFAuthoringPanel
  deliberationId={deliberationId}
  authorId={authorId || ''} // or 'current' if you enable server fallback
  conclusionClaim={hudTarget?.id
    ? { id: hudTarget.id, text: topArg?.top?.text ?? '' }
    : { id: '', text: '' } // panel will prompt to choose
  }

/>
  </SectionCard>
  <SectionCard title="AIF LIST">
 <AIFArgumentsListPro
        deliberationId={deliberationId}
        onVisibleTextsChanged={(texts)=> {
          // keep existing analytics / summarizers in sync
          window.dispatchEvent(new CustomEvent('mesh:texts:visible', { detail: { deliberationId, texts } }));
        }}
      />

</SectionCard>
<SectionCard >
  <PropositionComposer deliberationId={deliberationId} />
</SectionCard>  

<SectionCard title="Proposition List">
  <PropositionsList deliberationId={deliberationId} />
</SectionCard>

      </div>
   );

   // If a containerClassName is provided, clamp & center the whole panel.
   // Otherwise, behave exactly as before (no breaking change).
     const placeholder = (
        <div className="text-xs text-neutral-500 px-4 py-2">
          {loading ? 'Loading…' : 'No designs found'}
        </div>
      );
      const content = ready ? inner : placeholder;
      return containerClassName
        ? <div className={clsx(containerClassName)}>{content}</div>
        : content;
  }