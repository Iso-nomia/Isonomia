//components/arguments/AIFArgumentsListPro.tsx
'use client';

import * as React from 'react';
import { mutate as swrMutate } from 'swr';
import useSWRInfinite from 'swr/infinite';
import useSWR from 'swr';
import { Virtuoso } from 'react-virtuoso';
import { EntityPicker } from '../kb/EntityPicker';
import { LetterQOctagon } from "@mynaui/icons-react";

import dynamic from 'next/dynamic';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Search,
  Swords,
  Filter,
  Link2,
  TrendingUp,
  ArrowRightFromLine,
  FerrisWheel,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  HelpCircle,
  Triangle,
  ExternalLink,
  Scale,
  Network, // Week 5 Task 5.1: For ArgumentNetAnalyzer button
} from 'lucide-react';

import { listSchemes, askCQ, exportAif } from '@/lib/client/aifApi';
import PromoteToClaimButton from '@/components/claims/PromoteToClaimButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { ClaimPicker } from '@/components/claims/ClaimPicker';
import { ConfidenceProvider, useConfidence } from '@/components/agora/useConfidence';
import { set } from 'lodash';
import { ArgumentCard } from './ArgumentCard';
import { ArgumentCardV2 } from './ArgumentCardV2';
import { SchemeComposerPicker } from '../SchemeComposerPicker';
import { PreferenceAttackModal } from '@/components/agora/PreferenceAttackModal';
import { DialogueMoveKind } from "@/components/aif/DialogueMoveNode";
import { getUserFromCookies } from "@/lib/server/getUser";
import { ChainParticipationBadge } from '@/components/chains/ChainParticipationBadge';


const AttackMenuProV2 = dynamic(() => import('@/components/arguments/AttackMenuProV2').then(m => m.AttackMenuProV2), { ssr: false });
const CommunityDefenseMenu = dynamic(() => import('@/components/agora/CommunityDefenseMenu').then(m => m.CommunityDefenseMenu), { ssr: false });
const ClarificationRequestButton = dynamic(() => import('@/components/issues/ClarificationRequestButton').then(m => m.ClarificationRequestButton), { ssr: false });
const SchemeSpecificCQsModal = dynamic(() => import('@/components/arguments/SchemeSpecificCQsModal').then(m => m.SchemeSpecificCQsModal), { ssr: false });
// LegalMoveToolbar - Not needed in argument browsing context. See COMPONENT_ANALYSIS_LMT_vs_AMP.md
// const LegalMoveToolbar = dynamic(() => import('@/components/dialogue/LegalMoveToolbar').then(m => m.LegalMoveToolbar), { ssr: false });

// ============================================================================
// TYPES
// ============================================================================

type Arg = {
  id: string;
  text: string;
  createdAt: string;
  authorId: string;
  mediaType?: 'text' | 'image' | 'video' | 'audio' | null;
  mediaUrl?: string | null;
  claimId?: string | null;
  schemeId?: string | null;
  approvalsCount?: number;
};

type AifMeta = {
  // Legacy single scheme (for backwards compatibility)
  scheme?: { id: string; key: string; name: string; slotHints?: any } | null;
  // Phase 4+: Multi-scheme support
  schemes?: Array<{
    id: string;
    key: string;
    name: string;
    slotHints?: any;
    role: string;
    isPrimary: boolean;
    confidence: number;
    explicitness: string;
  }>;
  // Phase 5: SchemeNet indicator
  schemeNet?: { id: string; overallConfidence: number } | null;
  conclusion?: { id: string; text: string } | null;
  premises?: { id: string; text: string }[] | null;
  implicitWarrant?: { text: string } | null;
  attacks?: { REBUTS: number; UNDERCUTS: number; UNDERMINES: number } | null;
  cq?: { required: number; satisfied: number };
  preferences?: { preferredBy: number; dispreferredBy: number };
  provenance?: {
    kind: string;
    sourceDeliberationId: string;
    sourceDeliberationName: string;
    fingerprint?: string;
  } | null; // Phase 5A: Cross-deliberation import provenance
};

type AifRow = {
  id: string;
  deliberationId: string;
  authorId: string;
  createdAt: string;
  updatedAt?: string; // Phase 2: For temporal decay
  text: string;
  mediaType: 'text' | 'image' | 'video' | 'audio' | null;
  aif: AifMeta;
  claimId?: string | null;
  confidence?: number; // Phase 2: For confidence display
  // Phase 3: Dialogue Provenance
  dialogueProvenance?: {
    moveId: string;
    moveKind: DialogueMoveKind;
    speakerName?: string;
  } | null;
};

// ============================================================================
// CONSTANTS & UTILITIES
// ============================================================================

const PAGE = 40;

const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(async r => {
  const j = await r.json().catch(() => ({}));
  if (!r.ok || (j && j.ok === false)) throw new Error(j?.error || `HTTP ${r.status}`);
  return j;
});

// Memoized metadata signature for efficient change detection
const metaSigCache = new Map<string, string>();

function metaSig(m?: AifMeta) {
  if (!m) return '';
  
  // Use conclusion ID as cache key for stable memoization
  const cacheKey = m.conclusion?.id || '';
  if (cacheKey && metaSigCache.has(cacheKey)) {
    const cached = metaSigCache.get(cacheKey)!;
    // Verify cache is still valid by checking attacks/cq/prefs
    const a = m.attacks || { REBUTS: 0, UNDERCUTS: 0, UNDERMINES: 0 };
    const cq = m.cq || { required: 0, satisfied: 0 };
    const p = m.preferences || { preferredBy: 0, dispreferredBy: 0 };
    const sig = [
      m.scheme?.key || '',
      cacheKey,
      (m.premises?.length || 0),
      a.REBUTS, a.UNDERCUTS, a.UNDERMINES,
      cq.required, cq.satisfied,
      p.preferredBy || 0, p.dispreferredBy || 0,
    ].join('|');
    
    if (cached === sig) return cached;
    metaSigCache.set(cacheKey, sig);
    return sig;
  }
  
  const a = m.attacks || { REBUTS: 0, UNDERCUTS: 0, UNDERMINES: 0 };
  const cq = m.cq || { required: 0, satisfied: 0 };
  const p = m.preferences || { preferredBy: 0, dispreferredBy: 0 };
  const sig = [
    m.scheme?.key || '',
    m.conclusion?.id || '',
    (m.premises?.length || 0),
    a.REBUTS, a.UNDERCUTS, a.UNDERMINES,
    cq.required, cq.satisfied,
    p.preferredBy || 0, p.dispreferredBy || 0,
  ].join('|');
  
  if (cacheKey) metaSigCache.set(cacheKey, sig);
  return sig;
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

function SupportBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className="h-2 w-28 rounded bg-slate-200 overflow-hidden">
      <div className="h-full bg-emerald-500" style={{ width: `${(v * 100).toFixed(1)}%` }} />
    </div>
  );
}

function SchemeBadge({ scheme }: { scheme?: AifMeta['scheme'] }) {
  if (!scheme) return null;

  return (
    <div
      className="
        inline-flex items-center gap-1.5 px-3 py-1 rounded-full
        bg-gradient-to-r from-indigo-50 to-purple-50
        border border-indigo-200 text-indigo-700
        text-xs font-medium shadow-sm
        transition-all duration-200 hover:shadow-md
      "
      title={scheme?.slotHints?.premises?.length ? scheme.slotHints.premises.map((p: any) => p.label).join(' · ') : scheme?.name}
    >
      {scheme.name}
    </div>
  );
}

// Memoized to prevent unnecessary re-renders
const MemoizedSchemeBadge = React.memo(SchemeBadge, (prev, next) => {
  return prev.scheme?.id === next.scheme?.id && prev.scheme?.key === next.scheme?.key;
});

function PreferenceCounts({ p }: { p?: { preferredBy?: number; dispreferredBy?: number } }) {
  if (!p || (p.preferredBy === 0 && p.dispreferredBy === 0)) return null;

  return (
    <div className="inline-flex items-center gap-1.5">
      {p.preferredBy !== 0 && (
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
          <ArrowUp className="w-3 h-3" />
          {"preferred by " + p.preferredBy}
        </div>
      )}
      {p.dispreferredBy !== 0 && (
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          <ArrowDown className="w-3 h-3" />
          {"dispreferred by " + p.dispreferredBy}
        </div>
      )}
    </div>
  );
}

// Memoized to prevent unnecessary re-renders
const MemoizedPreferenceCounts = React.memo(PreferenceCounts, (prev, next) => {
  return prev.p?.preferredBy === next.p?.preferredBy && prev.p?.dispreferredBy === next.p?.dispreferredBy;
});

function CqMeter({ cq }: { cq?: { required: number; satisfied: number } }) {
  const r = cq?.required ?? 0;
  const s = cq?.satisfied ?? 0;
  const pct = r ? Math.round((s / r) * 100) : 0;

  const colorClass =
    pct === 100 ? 'bg-emerald-100 border-emerald-300 text-emerald-700' :
      pct >= 50 ? 'bg-amber-100 border-amber-300 text-amber-700' :
        pct > 0 ? 'bg-orange-100 border-orange-300 text-orange-700' :
          'bg-slate-100 border-slate-300 text-slate-600';

  const Icon = pct === 100 ? CheckCircle2 : pct > 0 ? AlertTriangle : AlertTriangle;

  return (
    <div
      className={`
        inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium
        transition-all duration-200
        ${colorClass}
      `}
      title={r ? `${s}/${r} Critical Questions satisfied` : 'No CQs yet'}
    >
      <Icon className="w-3 h-3" />
      CQ {pct}%
    </div>
  );
}

// Memoized to prevent unnecessary re-renders
const MemoizedCqMeter = React.memo(CqMeter, (prev, next) => {
  return prev.cq?.required === next.cq?.required && prev.cq?.satisfied === next.cq?.satisfied;
});

// ASPIC+ Attack Counts - Split by target level
// - Claim-level attacks (REBUTS/UNDERMINES) shown in header with other metadata
// - Argument-level attacks (UNDERCUTS) shown in footer (attacks inference/scheme)

function ClaimLevelAttackCounts({ a }: { a?: AifMeta['attacks'] }) {
  if (!a || (a.REBUTS === 0 && a.UNDERMINES === 0)) return null;

  return (
    <div className="inline-flex items-center gap-1.5">
      {a.REBUTS > 0 && (
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium"
          title="Rebuts (attacks conclusion claim)">
          {a.REBUTS} Rebuts
        </div>
      )}
      {a.UNDERMINES > 0 && (
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium"
          title="Undermines (attacks premise claims)">
          {a.UNDERMINES} Undermines
        </div>
      )}
    </div>
  );
}

// Memoized to prevent unnecessary re-renders
const MemoizedClaimLevelAttackCounts = React.memo(ClaimLevelAttackCounts, (prev, next) => {
  return prev.a?.REBUTS === next.a?.REBUTS && prev.a?.UNDERMINES === next.a?.UNDERMINES;
});

function ArgumentLevelAttackCounts({ a }: { a?: AifMeta['attacks'] }) {
  if (!a || a.UNDERCUTS === 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5">
      {a.UNDERCUTS > 0 && (
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium"
          title="Undercuts (attacks inference/scheme of this argument)">
          <Swords className="w-3 h-3" />
          {a.UNDERCUTS} Undercuts
        </div>
      )}
    </div>
  );
}

// Memoized to prevent unnecessary re-renders
const MemoizedArgumentLevelAttackCounts = React.memo(ArgumentLevelAttackCounts, (prev, next) => {
  return prev.a?.UNDERCUTS === next.a?.UNDERCUTS;
});

// Legacy component - kept for compatibility but use split versions above
function AttackCounts({ a }: { a?: AifMeta['attacks'] }) {
  if (!a || (a.REBUTS === 0 && a.UNDERCUTS === 0 && a.UNDERMINES === 0)) return null;

  return (
    <div className="inline-flex items-center gap-1.5">
      {a.REBUTS > 0 && (
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium"
          title="Rebuts (attacks conclusion)">
          {a.REBUTS} Rebuts
        </div>
      )}
      {a.UNDERCUTS > 0 && (
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium"
          title="Undercuts (attacks inference)">
          {a.UNDERCUTS} Undercuts
        </div>
      )}
      {a.UNDERMINES > 0 && (
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium"
          title="Undermines (attacks premise)">
          {a.UNDERMINES} Undermines
        </div>
      )}
    </div>
  );
}

function ClampedBody({ text, lines = 4, onOpen }: { text: string; lines?: number; onOpen: () => void }) {
  return (
    <div className="relative">
      <div className={`text-sm leading-relaxed text-slate-700 whitespace-pre-wrap line-clamp-${lines}`}>
        {text}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none" />
      <button
        className="
          absolute bottom-0 right-0 px-3 py-1 text-xs font-medium
          bg-white border border-slate-200 rounded-full
          text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50
          transition-all duration-200 shadow-sm hover:shadow
          flex items-center gap-1
        "
        onClick={onOpen}
      >
        Read more
        <ChevronDown className="w-3 h-3" />
      </button>
    </div>
  );
}

// ============================================================================
// PREFERENCE ATTACK WIDGET
// ============================================================================

function PreferenceQuick({
  deliberationId,
  argumentId,
  authorId,
  onDone,
}: {
  deliberationId: string;
  argumentId: string;
  authorId: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btnv2--violet inline-flex items-center gap-2 px-2 py-2 rounded-lg text-xs"
      >
        <Scale className="w-3 h-3" />
        Preference
      </button>

      <PreferenceAttackModal
        open={open}
        onOpenChange={setOpen}
        deliberationId={deliberationId}
        sourceArgumentId={argumentId}
        onSuccess={() => {
          setOpen(false);
          onDone?.();
        }}
      />
    </>
  );
}

// ============================================================================
// FILTER CONTROLS
// ============================================================================

function Controls({
  schemes,
  schemeKey,
  setSchemeKey,
  q,
  setQ,
  showPremises,
  setShowPremises,
  onExport,
}: {
  schemes: Array<{ key: string; name: string }>;
  schemeKey: string;
  setSchemeKey: (k: string) => void;
  q: string;
  setQ: (s: string) => void;
  showPremises: boolean;
  setShowPremises: (v: boolean) => void;
  onExport: () => void;
}) {
  const [showFilters, setShowFilters] = React.useState(false);
  const activeFilters = (schemeKey || q.trim()) ? 1 : 0;

  return (
    <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <h2 className="text-lg font-semibold text-slate-900">Arguments</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onExport}
            className="inline-flex btnv2--ghost bg-white items-center gap-2 px-2 py-2 font-medium rounded-lg text-xs "
            title="Download AIF JSON‑LD export"
          >
            Export
          </button>
          <button
            onClick={() => setShowPremises(!showPremises)}
            className={`
              inline-flex  btnv2--ghost  items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium
              transition-all duration-200
              ${showPremises
                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }
            `}
            title={showPremises ? 'Hide premises' : 'Show premises'}
          >
            {showPremises ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            Premises
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`
             inline-flex btnv2--ghost items-center gap-2 px-2 py-2 font-medium rounded-lg text-xs
              ${showFilters || activeFilters > 0
                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                : 'bg-white text-slate-600 '
              }
            `}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilters > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold">
                {activeFilters}
              </span>
            )}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200 animate-in slide-in-from-top duration-200">
          <div className="flex flex-wrap gap-3">
            <label className="flex-1 min-w-[240px]">
              <span className="block text-xs font-medium text-slate-700 mb-1">Search</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search conclusion or premise…"
                  className="
                    w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300
                    focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100
                    transition-all duration-200 text-sm
                  "
                  aria-label="Search arguments"
                />
              </div>
            </label>

            <label className="min-w-[200px]">
              <span className="block text-xs font-medium text-slate-700 mb-1">Scheme</span>
              <select
                value={schemeKey}
                onChange={e => setSchemeKey(e.target.value)}
                className="
                  w-full px-3 py-2 rounded-lg border border-slate-300
                  focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100
                  transition-all duration-200 text-sm bg-white
                "
                aria-label="Filter by scheme"
              >
                <option value="">All Schemes</option>
                {schemes.map(s => (
                  <option key={s.key} value={s.key}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ROW COMPONENT
// ============================================================================

function RowImpl({
  a,
  meta,
  deliberationId,
  currentUserId,
  showPremises,
  onPromoted,
  onRefreshRow,
  isVisible,
  support,
  accepted,
  dsMode = false,
  onArgumentClick,
  onViewDialogueMove,
  onAnalyzeArgument, // Week 5 Task 5.1: ArgumentNetAnalyzer callback
  onGenerateAttack, // Week 6 Task 6.1: Attack generation callback
  onViewChain, // Task 1.6: Chain participation - view chain thread
  onViewChainGraph, // Task 1.6: Chain participation - view chain graph
}: {
  a: AifRow;
  meta?: AifMeta;
  deliberationId: string;
  currentUserId?: string | null;
  showPremises: boolean;
  onPromoted: () => void;
  onRefreshRow: (id: string) => void;
  isVisible: boolean;
  support?: number;
  accepted?: boolean;
  dsMode?: boolean;
  onArgumentClick?: (argument: { 
    id: string; 
    text?: string;
    conclusionText?: string; 
    conclusionClaimId?: string;
    schemeKey?: string;
    schemeId?: string;
    schemeName?: string;
    premises?: Array<{ id: string; text: string; isImplicit?: boolean }>;
  }) => void;
  onViewDialogueMove?: (moveId: string, deliberationId: string) => void;
  onAnalyzeArgument?: (argumentId: string) => void; // Week 5 Task 5.1: ArgumentNetAnalyzer callback
  onGenerateAttack?: (argumentId: string, claimId: string) => void; // Week 6 Task 6.1: Attack generation callback - receives both IDs
  onViewChain?: (chainId: string) => void; // Task 1.6: Chain participation callback
  onViewChainGraph?: (chainId: string) => void; // Task 1.6: Chain participation graph callback
}) {
  const [open, setOpen] = React.useState(false);
  const [cqs, setCqs] = React.useState<Array<{ cqKey: string; text: string; status: 'open' | 'answered'; attackType: string; targetScope: string; premiseType?: string | null }>>([]);
  const [cqAuthorId, setCqAuthorId] = React.useState<string | null>(null);
  const [showCopied, setShowCopied] = React.useState(false);
  const [cqsLoaded, setCqsLoaded] = React.useState(false);

  // Lazy load CQs when modal opens. Uses the standardized argument-CQ endpoint
  // (`/api/arguments/[id]/cqs`) so the shape matches the SchemeSpecificCQsModal
  // CQItem contract (cqKey/text/status/attackType/targetScope/premiseType).
  const loadCQs = React.useCallback(async () => {
    if (cqsLoaded) return;
    try {
      const res = await fetch(`/api/arguments/${a.id}/cqs`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({ items: [] }));
      setCqs(j.items || []);
      // Prefer the real Argument.authorId returned by the endpoint for role
      // detection (the AIF row's authorId can differ in format/value).
      if (j.authorId != null) setCqAuthorId(String(j.authorId));
      setCqsLoaded(true);
    } catch (err) {
      console.error('[AIFArgumentsListPro] Failed to load CQs:', err);
    }
  }, [cqsLoaded, a.id]);

  const conclusionText = meta?.conclusion?.text || a.text || '';
  const created = new Date(a.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const copyLink = () => {
    const url = `${location.origin}${location.pathname}#arg-${a.id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
      })
      .catch(() => { });
  };

  return (
    <article
      id={`arg-${a.id}`}
      className="
        group relative py-5 px-8 about-flow-lite w-full border border-indigo-400 shadow-md shadow-slate-400/50 rounded-xl
        hover:shadow-slate-500/60 transition-all duration-100
  
      "
      aria-label={`Argument ${a.id}`}
    >
      {meta?.conclusion?.id && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-emerald-500 to-transparent" />
      )}

      <div className="flex flex-col gap-4">
        {/* Header section */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className='flex gap-2 mb-3'>
            <span className="flex text-base font-medium tracking-wide text-slate-900 flex items-center gap-2">
              Conclusion: 
                </span>
                <span
                  className="flex text-xs px-2 py-1 tracking-wide menuv2--lite bg-white text-slate-800 font-medium leading-snug 
                  max-w-[100%] overflow-hidden text-ellipsis whitespace-nowrap "
                  title={conclusionText}
                >
                  {conclusionText}
                </span>
</div>
            {showPremises && meta?.premises && meta.premises.length > 0 && (
              <ul className="flex flex-wrap  tracking-wide font-semibold gap-1.5 mb-2" aria-label="Premises">
                Premises: 
                {meta.premises.map(p => (
                  <li
                    key={p.id}
                    className="
                      inline-flex items-center gap-1 font-normal px-2.5 py-1 rounded-lg
                      menuv2--lite text-slate-900
                      text-xs transition-all duration-200
                      hover:bg-slate-200
                    "
                  >
                    {p.text || p.id}
                  </li>
                ))}
              </ul>
            )}

            {meta?.implicitWarrant?.text && (
              <div className="mt-3 px-3 py-1 rounded-lg bg-orange-50/50 border border-orange-400 w-fit">
                <div className="flex items-center gap-2">
                  <ArrowRightFromLine className="w-4 h-4 text-orange-600  " />
                  <div className='flex gap-1'>
                    <div className="text-xs font-medium tracking-wide text-orange-900 ">Implicit Warrant:</div>
                    <div className="text-xs text-orange-800">{meta.implicitWarrant.text}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Metadata badges */}
          <div className="shrink-0 flex flex-col items-end gap-2">
            <div className="flex items-center flex-wrap gap-1.5 justify-end">
              <time className="text-xs text-slate-500 font-medium">{created}</time>
              <MemoizedSchemeBadge scheme={meta?.scheme} />
              
              {/* Task 1.6: Chain Participation Badge */}
              <ChainParticipationBadge
                argumentId={a.id}
                onViewChain={onViewChain}
                onViewChainGraph={onViewChainGraph}
              />
             
              {typeof support === 'number' && (
                <div className="inline-flex items-center gap-2 ml-1">
                  <SupportBar value={support} />
                  {accepted && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
                      Accepted
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center flex-wrap gap-1.5 justify-end">
                <MemoizedPreferenceCounts p={meta?.preferences} />
                <MemoizedClaimLevelAttackCounts a={meta?.attacks} />
              </div>
            </div>
          </div>
        </div>

        {/* Body text */}
        {a.text && (
          <section className="p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200">
            {a.text.length > 240 ? (
              <ClampedBody text={a.text} onOpen={() => setOpen(true)} />
            ) : (
              <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{a.text}</div>
            )}
          </section>
        )}

        {/* ArgumentCardV2 - shows interactive argument structure with improved UX */}
        {meta?.conclusion && (
          <div
            onClick={() => {
              if (onArgumentClick && meta?.conclusion) {
                onArgumentClick({
                  id: a.id,
                  text: a.text,
                  conclusionText: conclusionText,
                  conclusionClaimId: meta.conclusion.id,
                  schemeKey: meta?.scheme?.key,
                  schemeId: meta?.scheme?.id,
                  schemeName: meta?.scheme?.name,
                  premises: (meta?.premises as any[] || []).map(p => ({
                    id: p.id,
                    text: p.text,
                    isImplicit: p.isImplicit,
                  })),
                });
              }
            }}
            className="cursor-pointer hover:bg-slate-50/50 transition-colors rounded-lg"
          >
            <ArgumentCardV2 
              deliberationId={deliberationId} 
              authorId={a.authorId} 
              id={a.id} 
              conclusion={meta.conclusion}
              premises={meta.premises || []}
              schemeKey={meta.scheme?.key}
              schemeName={meta.scheme?.name}
              onAnyChange={() => onRefreshRow(a.id)}
              currentUserId={currentUserId || undefined}
              createdAt={a.createdAt}
              updatedAt={a.updatedAt || a.createdAt}
              confidence={a.confidence}
              dsMode={dsMode}
              provenance={meta.provenance}
              dialogueProvenance={a.dialogueProvenance ? {
                moveId: a.dialogueProvenance.moveId,
                moveKind: a.dialogueProvenance.moveKind as DialogueMoveKind,
                speakerName: a.dialogueProvenance.speakerName
              } : null}
              onViewDialogueMove={onViewDialogueMove}
            />
          </div>
        )}



        <footer className="flex flex-wrap items-center gap-2">
          {/* Argument-Level Attacks (UNDERCUTS) - Attacks the inference/scheme */}
          <MemoizedArgumentLevelAttackCounts a={meta?.attacks} />
          
          <PreferenceQuick deliberationId={deliberationId} argumentId={a.id} authorId={a.authorId} onDone={() => onRefreshRow(a.id)} />

          {/* <AttackMenuProV2
            deliberationId={deliberationId}
            authorId={a.authorId ?? 'current'}
            target={{
              id: a.id,
              conclusion: { id: meta?.conclusion?.id ?? '', text: conclusionText ?? '' },
              premises: meta?.premises ?? [],
            }}
            onDone={() => onRefreshRow(a.id)}
          /> */}

          <CommunityDefenseMenu
            deliberationId={deliberationId}
            authorId={a.authorId ?? 'current'}
            target={{
              id: a.id,
              conclusion: { id: meta?.conclusion?.id ?? '', text: conclusionText ?? '' },
              premises: meta?.premises ?? [],
            }}
            onDone={() => onRefreshRow(a.id)}
          />

          <ClarificationRequestButton
            deliberationId={deliberationId}
            targetType="argument"
            targetId={a.id}
            targetLabel={conclusionText ?? `Argument ${a.id.slice(0, 8)}`}
            onSuccess={(issueId) => {
              console.log('Clarification request created:', issueId);
              // Optionally refresh or show success message
            }}
          />

          {/* Scheme-specific Critical Questions Modal */}
          <SchemeSpecificCQsModal
            argumentId={a.id}
            deliberationId={deliberationId}
            authorId={cqAuthorId ?? a.authorId}
            currentUserId={currentUserId || undefined}
            cqs={cqs}
            meta={meta}
            onRefresh={() => {
              onRefreshRow(a.id);
              setCqsLoaded(false); // Force reload CQs next time
            }}
            triggerButton={
              <button
                onClick={loadCQs}
                className="
                  inline-flex items-center gap-2 px-3 py-1.5 btnv2 rounded-lg text-xs font-medium
                  bg-white text-slate-600 border border-slate-200
                  hover:border-slate-300 hover:bg-slate-50
                  transition-all duration-200
                "
                title="View and answer critical questions for this argument scheme"
              >
                <HelpCircle className="w-4 h-4" />
                Critical Questions
                {meta?.cq && meta.cq.required > 0 && (
                  <span className=" px-1.5 py-0.5 rounded-full bg-indigo-100 text-slate-700 text-[10px] font-bold">
                    {meta.cq.satisfied}/{meta.cq.required}
                  </span>
                )}
              </button>
            }
          />

          {/* Week 5 Task 5.1: ArgumentNetAnalyzer button */}
          {meta?.scheme && onAnalyzeArgument && (
            <button
              onClick={() => onAnalyzeArgument(a.id)}
              className="
                inline-flex items-center gap-2 px-3 py-1.5 btnv2 rounded-lg text-xs font-medium
                bg-indigo-50 text-indigo-700 border border-indigo-200 
                hover:bg-indigo-100 transition-all duration-200 shadow-sm hover:shadow
              "
              title="Analyze argument network and dependencies"
            >
              <Network className="w-4 h-4" />
              Analyze Net
            </button>
          )}

          {/* Week 6 Task 6.1: Generate Attack button */}
          {onGenerateAttack && meta?.conclusion?.id && (
            <button
              onClick={() => onGenerateAttack(a.id, meta.conclusion!.id)}
              className="
                inline-flex items-center gap-2 px-3 py-1.5 btnv2--rose rounded-lg text-xs
                    bg-white text-slate-600 
                    
                    transition-all duration-200
              "
              title="Generate strategic attacks for this argument"
            >
              <Swords className="w-4 h-4" />
              Generate Attack
            </button>
          )}

          <div className="flex-1" />

          {meta?.conclusion?.id ? (
            <a
              href={`/claim/${meta.conclusion.id}`}
              className="
                inline-flex items-center gap-2 px-2 py-2 btnv2--amber rounded-lg text-xs font-medium
               text-slate-600  bg-yellow-50
                 transition-all duration-200 shadow-sm hover:shadow
              "
            >
              <ExternalLink className="w-3 h-3" />
              {/* <TrendingUp className="w-4 h-4" /> */}
              View Claim
            </a>
          ) : (
            <PromoteToClaimButton
              deliberationId={deliberationId}
              target={{ type: 'argument', id: a.id }}
              onClaim={async () => {
                onPromoted();
                onRefreshRow(a.id);
              }}
            />
          )}

          <button
            className="
                inline-flex items-center gap-1 px-2 py-2 btnv2 rounded-lg text-xs font-medium
              bg-white text-slate-600 border border-slate-200
              hover:border-slate-300 hover:bg-slate-50
              transition-all duration-200
            "
            onClick={copyLink}
            title="Copy link to this argument"
          >
            <Link2 className="w-3 h-3" />
            {showCopied ? 'Copied!' : 'Share'}
          </button>
        </footer>
      </div>

      {/* Full text dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[60vh] bg-white rounded-xl overflow-y-auto p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Full Argument</DialogTitle>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 mt-4">{a.text}</div>
          <div className="mt-6 flex justify-end">
            <DialogClose className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-all">
              Close
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}

export const Row = React.memo(RowImpl, (prev, next) => {
  return (
    prev.a.id === next.a.id &&
    prev.showPremises === next.showPremises &&
    metaSig(prev.meta) === metaSig(next.meta)
  );
});

// ============================================================================
// MAIN LIST COMPONENT
// ============================================================================

export default function AIFArgumentsListPro({
  deliberationId,
  onVisibleTextsChanged,
  dsMode = false,
  onArgumentClick,
  onViewDialogueMove,
  onAnalyzeArgument, // Week 5 Task 5.1: ArgumentNetAnalyzer callback
  onGenerateAttack, // Week 6 Task 6.1: Attack generation callback
  onViewChain, // Task 1.6: Chain participation - view chain thread
  onViewChainGraph, // Task 1.6: Chain participation - view chain graph
}: {
  deliberationId: string;
  onVisibleTextsChanged?: (texts: string[]) => void;
  dsMode?: boolean;
  onArgumentClick?: (argument: { 
    id: string; 
    text?: string;
    conclusionText?: string; 
    conclusionClaimId?: string;
    schemeKey?: string;
    schemeId?: string;
    schemeName?: string;
    premises?: Array<{ id: string; text: string; isImplicit?: boolean }>;
  }) => void;
  onViewDialogueMove?: (moveId: string, deliberationId: string) => void;
  onAnalyzeArgument?: (argumentId: string) => void; // Week 5 Task 5.1: ArgumentNetAnalyzer callback
  onGenerateAttack?: (argumentId: string, claimId: string) => void; // Week 6 Task 6.1: Attack generation callback - receives both argument ID and claim ID
  onViewChain?: (chainId: string) => void; // Task 1.6: Chain participation callback
  onViewChainGraph?: (chainId: string) => void; // Task 1.6: Chain participation graph callback
}) {
  // Fetch current user ID for permission checks (using same approach as DeepDivePanelV2)
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  React.useEffect(() => {
    getUserFromCookies()
      .then((u) => {
        const userId = u?.userId != null ? String(u.userId) : null;
        console.log('[AIFArgumentsListPro] Fetched current user from cookies:', { userId, rawUser: u });
        setCurrentUserId(userId);
      })
      .catch((err) => {
        console.error('[AIFArgumentsListPro] Failed to fetch current user:', err);
        setCurrentUserId(null);
      });
  }, []);

  // Confidence settings
  const { mode, tau } = useConfidence();
  const apiMode = mode === 'product' ? 'prod' : mode;
  const [sortBySupport, setSortBySupport] = React.useState<boolean>(false);

  // Schemes
  const [schemes, setSchemes] = React.useState<Array<{ key: string; name: string }>>([]);
  React.useEffect(() => {
    let cancelled = false;
    listSchemes()
      .then(items => {
        if (!cancelled) setSchemes((items || []).map((s: any) => ({ key: s.key, name: s.name })));
      })
      .catch(() => setSchemes([]));
    return () => { cancelled = true; };
  }, []);

  // AIF metadata map
  const [aifMap, setAifMap] = React.useState<Record<string, AifMeta>>({});
  const [refreshing, setRefreshing] = React.useState<Set<string>>(new Set());
  const aifMapRef = React.useRef(aifMap);
  React.useEffect(() => { aifMapRef.current = aifMap; }, [aifMap]);

  const refreshAifForId = React.useCallback(async (id: string) => {
    try {
      setRefreshing(prev => new Set(prev).add(id));
      const one = await fetch(`/api/arguments/${id}/aif`).then(r => (r.ok ? r.json() : null));
      if (one?.aif) {
        setAifMap(prev => ({
          ...prev,
          [id]: {
            scheme: one.aif.scheme ?? null,
            conclusion: one.aif.conclusion ?? null,
            premises: one.aif.premises ?? [],
            implicitWarrant: one.aif.implicitWarrant ?? null,
            attacks: one.aif.attacks ?? { REBUTS: 0, UNDERCUTS: 0, UNDERMINES: 0 },
            cq: one.aif.cq ?? { required: 0, satisfied: 0 },
            preferences: one.aif.preferences ?? { preferredBy: 0, dispreferredBy: 0 },
            provenance: one.provenance ?? null, // Phase 5A: Cross-deliberation import provenance
          }
        }));
      }
    } catch {/* ignore */ }
    finally {
      setRefreshing(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }, []);

  // Filters
  const [schemeKey, setSchemeKey] = React.useState('');
  const [q, setQ] = React.useState('');
  const dq = React.useDeferredValue(q);
  const [showPremises, setShowPremises] = React.useState(false);
  const [visibleRange, setVisibleRange] = React.useState({ startIndex: 0, endIndex: 20 });

  // Base list with pagination
  const getKey = (_idx: number, prev: any) => {
    if (prev && !prev.nextCursor) return null;
    const cursor = prev?.nextCursor ? `&cursor=${encodeURIComponent(prev.nextCursor)}` : '';
    return `/api/deliberations/${encodeURIComponent(deliberationId)}/arguments/aif?limit=${PAGE}${cursor}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite(getKey, fetcher, {
      revalidateOnFocus: false,
      keepPreviousData: true,
      dedupingInterval: 1500,
    });

  const pages = data ?? [];
  const rows: AifRow[] = pages.flatMap(p => p?.items ?? []);

  // Build stable key from row IDs
  const rowIdsKey = React.useMemo(() => rows.map(r => r.id).join(','), [rows]);

  // Hydrate AIF metadata for rows using batch endpoint (Performance Optimization)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      performance.mark('aif-fetch-start');
      
      const byId: Record<string, AifMeta> = {};
      const pending = rows
        .filter(r => !r.aif && !aifMapRef.current[r.id])
        .map(r => r.id);

      if (pending.length === 0) return;

      try {
        // Batch fetch all metadata in a single request (eliminates N+1 problem)
        const batchResponse = await fetch(
          `/api/arguments/aif/batch?ids=${pending.join(',')}&deliberationId=${encodeURIComponent(deliberationId)}`
        )
          .then(r => (r.ok ? r.json() : null))
          .catch(() => null);

        if (batchResponse?.items) {
          for (const item of batchResponse.items) {
            byId[item.id] = {
              scheme: item.aif.scheme ?? null,
              conclusion: item.aif.conclusion ?? null,
              premises: item.aif.premises ?? [],
              implicitWarrant: item.aif.implicitWarrant ?? null,
              attacks: item.aif.attacks ?? { REBUTS: 0, UNDERCUTS: 0, UNDERMINES: 0 },
              cq: item.aif.cq ?? { required: 0, satisfied: 0 },
              preferences: item.aif.preferences ?? { preferredBy: 0, dispreferredBy: 0 },
              provenance: item.provenance ? {
                kind: item.provenance.kind ?? 'imported',
                sourceDeliberationId: item.provenance.sourceDeliberationId,
                sourceDeliberationName: item.provenance.sourceDeliberationName ?? item.provenance.sourceDeliberationTitle ?? '',
                fingerprint: item.provenance.fingerprint
              } : null,
            };
          }
        }
      } catch (error) {
        console.error('[AIFArgumentsListPro] Batch fetch failed:', error);
      }

      if (!cancelled) {
        setAifMap(m => ({ ...m, ...byId }));
        performance.mark('aif-fetch-end');
        performance.measure('aif-fetch', 'aif-fetch-start', 'aif-fetch-end');
        
        if (process.env.NODE_ENV === 'development') {
          const measure = performance.getEntriesByName('aif-fetch')[0];
          console.log(`[Performance] AIF batch fetch: ${measure?.duration.toFixed(2)}ms for ${pending.length} arguments`);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowIdsKey, deliberationId]);

  // Search bucket cache - memoized for performance
  const bucketRef = React.useRef<Record<string, string>>({});
  const bucketSigRef = React.useRef<Record<string, string>>({});
  
  const searchBuckets = React.useMemo(() => {
    const buckets: Record<string, string> = {};
    const sigs: Record<string, string> = {};
    
    for (const r of rows) {
      const m = r.aif || aifMap[r.id];
      const sig = `${m?.conclusion?.id || ''}:${m?.premises?.length || 0}`;
      const key = `${r.id}::${sig}`;

      // Check if we can reuse cached bucket
      if (bucketSigRef.current[r.id] === key && bucketRef.current[r.id]) {
        buckets[r.id] = bucketRef.current[r.id];
        sigs[r.id] = key;
      } else {
        buckets[r.id] = [
          m?.conclusion?.text || r.text || '',
          ...(m?.premises?.map(p => p.text || '') ?? []),
          m?.implicitWarrant?.text || '',
        ].join(' ').toLowerCase();
        sigs[r.id] = key;
      }
    }
    
    bucketRef.current = buckets;
    bucketSigRef.current = sigs;
    return buckets;
  }, [rows, aifMap]);

  // Filtering - optimized with memoized search buckets
  const filtered: AifRow[] = React.useMemo(() => {
    performance.mark('filter-start');
    
    const lower = dq.trim().toLowerCase();
    const result = rows.filter(a => {
      const m = a.aif || aifMap[a.id];
      const schemeOk = !schemeKey || m?.scheme?.key === schemeKey;
      const bucket = searchBuckets[a.id] || '';
      const qOk = !lower || bucket.includes(lower);
      return schemeOk && qOk;
    });
    
    performance.mark('filter-end');
    performance.measure('filter', 'filter-start', 'filter-end');
    
    if (process.env.NODE_ENV === 'development') {
      const measure = performance.getEntriesByName('filter')[0];
      console.log(`[Performance] Filter: ${measure?.duration.toFixed(2)}ms for ${rows.length} rows → ${result.length} filtered`);
    }
    
    return result;
  }, [rows, aifMap, schemeKey, dq, searchBuckets]);

  // Conclusion IDs for score fetching
  const conclusionIds = React.useMemo(() => {
    const s = new Set<string>();
    for (const r of filtered) {
      const id = r.aif?.conclusion?.id || aifMap[r.id]?.conclusion?.id;
      if (id) s.add(id);
    }
    return Array.from(s);
  }, [filtered, aifMap]);

  // Fetch evidential scores
  const scoreKey = conclusionIds.length
    ? `/api/evidential/score?${new URLSearchParams({
      deliberationId,
      mode: apiMode,
      ...(tau != null ? { tau: String(tau) } : {}),
      ids: conclusionIds.join(',')
    }).toString()}`
    : null;

  const { data: scoreDoc } = useSWR<{ ok: boolean; items: Array<{ id: string; score?: number; bel?: number; accepted?: boolean }> }>(
    scoreKey,
    (u) => fetch(u, { cache: 'no-store' }).then(r => r.json()),
    { revalidateOnFocus: false }
  );

  const byClaimScore = React.useMemo(() => {
    const m = new Map<string, { v: number; acc: boolean }>();
    for (const it of (scoreDoc?.items ?? [])) {
      const v = (typeof it.score === 'number' ? it.score : (typeof (it as any).bel === 'number' ? (it as any).bel : 0)) || 0;
      m.set(it.id, { v, acc: !!it.accepted });
    }
    return m;
  }, [scoreDoc]);

  // Sorting by support
  const sorted = React.useMemo(() => {
    if (!sortBySupport) return filtered;
    const cp = [...filtered];
    cp.sort((a, b) => {
      const aid = a.aif?.conclusion?.id || aifMap[a.id]?.conclusion?.id || '';
      const bid = b.aif?.conclusion?.id || aifMap[b.id]?.conclusion?.id || '';
      const av = byClaimScore.get(aid)?.v ?? 0;
      const bv = byClaimScore.get(bid)?.v ?? 0;
      return (bv - av) || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
    return cp;
  }, [filtered, aifMap, sortBySupport, byClaimScore]);

  // Notify parent of visible texts
  React.useEffect(() => {
    if (!onVisibleTextsChanged || sorted.length === 0) return;
    const start = Math.max(0, visibleRange.startIndex);
    const end = Math.min(sorted.length - 1, visibleRange.endIndex);
    const texts: string[] = [];
    for (let i = start; i <= end; i++) {
      const r = sorted[i];
      const t = r.aif?.conclusion?.text ?? aifMap[r.id]?.conclusion?.text ?? r.text ?? '';
      if (t) texts.push(t);
    }
    onVisibleTextsChanged(texts);
  }, [onVisibleTextsChanged, visibleRange, sorted, aifMap]);

  // Loading state
  if (isLoading && rows.length === 0) {
    return (
      <section className="w-full rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-8 text-center">
          <div className="inline-block w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-slate-600">Loading arguments...</p>
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className="w-full rounded-xl border border-rose-200 bg-rose-50 shadow-sm">
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-100 mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-sm font-medium text-rose-900 mb-2">Failed to load arguments</h3>
          <p className="text-xs text-rose-700 mb-4">{String(error?.message || 'Unknown error')}</p>
          <button
            onClick={() => swrMutate(getKey, undefined, { revalidate: true })}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white hover:bg-rose-700 transition-all duration-200 shadow-sm hover:shadow"
          >
            Try Again
          </button>
        </div>
      </section>
    );
  }

  // Empty state
  if (!rows.length) {
    return (
      <section className="w-full rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm">
        <div className="p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-4">
            <Shield className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No arguments yet</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">Arguments will appear here as they are created with structured reasoning using AIF format.</p>
        </div>
      </section>
    );
  }

  const nextCursor = data?.[data.length - 1]?.nextCursor ?? null;

  return (

    <section aria-label="AIF arguments list" className="w-full rounded-xl bg-white/10 backdrop-blur-md panel-edge border border-zinc-500/50 overflow-hidden flex flex-col h-full">
      <Controls
        schemes={schemes}
        schemeKey={schemeKey}
        setSchemeKey={setSchemeKey}
        q={q}
        setQ={setQ}
        showPremises={showPremises}
        setShowPremises={setShowPremises}
        onExport={async () => {
          try {
            const doc = await exportAif(deliberationId, { includeLocutions: false, includeCQs: true });
            const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/ld+json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `aif-${deliberationId}.jsonld`;
            a.click();
            URL.revokeObjectURL(url);
          } catch (e) { console.error(e); }
        }}
      />

      {/* Confidence & sorting toolbar */}
      <div className="px-4 py-2 border-b-2 border-b-zinc-400 rounded-b-xl  bg-zinc-100/70 shadow-md flex items-center justify-between ">
        <div className="text-xs text-slate-600">
          Confidence: <b>{mode.toUpperCase()}</b>
          {tau != null && <span> · τ={tau.toFixed(2)}</span>}
        </div>
        <button
          className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
          onClick={() => setSortBySupport(v => !v)}
          title="Sort list by support of each row's conclusion"
        >
          {sortBySupport ? 'Sort: Default' : 'Sort: Support'}
        </button>
      </div>

      {/* Virtualized list - optimized for performance */}
      <div className="h-[1000px]">
        <Virtuoso
          data={sorted}
          computeItemKey={(_i, a) => a.id}
          increaseViewportBy={{ top: 400, bottom: 800 }} // Increased for smoother scrolling
          overscan={5} // Render 5 extra items above/below viewport
          itemContent={(index, a) => {
            const meta = a.aif || aifMap[a.id];
            const cid = meta?.conclusion?.id;
            const sRec = cid ? byClaimScore.get(cid) : undefined;
            const isVisible = index >= visibleRange.startIndex - 2 && index <= visibleRange.endIndex + 2;
            const isRefreshing = refreshing.has(a.id);

            return (
              <div className='px-3 relative'>
                {isRefreshing && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <hr className='border-slate-300 h-1 my-3' />
              <Row
                a={a}
                meta={meta}
                deliberationId={deliberationId}
                currentUserId={currentUserId}
                showPremises={showPremises}
                onPromoted={() => window.dispatchEvent(new CustomEvent('claims:changed', { detail: { deliberationId } } as any))}
                onRefreshRow={refreshAifForId}
                isVisible={isVisible}
                support={sRec?.v}
                accepted={sRec?.acc}
                dsMode={dsMode}
                onArgumentClick={onArgumentClick}
                onViewDialogueMove={onViewDialogueMove}
                onAnalyzeArgument={onAnalyzeArgument}
                onGenerateAttack={onGenerateAttack}
                onViewChain={onViewChain}
                onViewChainGraph={onViewChainGraph}
              />
              </div>
            );
          }}
          rangeChanged={(r) => setVisibleRange(r)}
          endReached={() => !isValidating && nextCursor && setSize(s => s + 1)}
          components={{
            Footer: () => (
              <div className="py-6 text-center border-t border-slate-100">
                {isLoading ? (
                  <div className="inline-flex items-center gap-2 text-sm text-slate-600">
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                    Loading more...
                  </div>
                ) : nextCursor ? (
                  <p className="text-sm text-slate-500">Scroll to load more</p>
                ) : (
                  <p className="text-sm text-slate-400">You&#39;ve reached the end</p>
                )}
              </div>
            ),
          }}
        />
      </div>
        {/* <Controls
          schemes={schemes}
          schemeKey={schemeKey}
          setSchemeKey={setSchemeKey}
          q={q}
          setQ={setQ}
          showPremises={showPremises}
          setShowPremises={setShowPremises}
          onExport={async () => {
            try {
              const doc = await exportAif(deliberationId, { includeLocutions: false, includeCQs: true });
              const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/ld+json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `aif-${deliberationId}.jsonld`;
              a.click();
              URL.revokeObjectURL(url);
            } catch (e) { console.error(e); }
          }}
        /> */}
    </section>

  );
}
