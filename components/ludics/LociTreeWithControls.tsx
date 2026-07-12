// components/ludics/LociTreeWithControls.tsx
'use client';

import * as React from 'react';
import useSWR from 'swr';
import { CompositionModeToggle } from '../engine/CompositionModeToggle';
import LocusControls from './LocusControls';
import { LociTreeLegacy } from 'packages/ludics-react/LociTreeLegacy';
import { mergeDesignsToTree } from '@/packages/ludics-react/mergeDesignsToTree';
import { MODE_LABEL, type Mode } from 'packages/ludics-react/modeLabels';

// helpers
const get = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json());
const post = async <T,>(u: string, body: any): Promise<T> => {
  const r = await fetch(u, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) throw new Error(String(j?.error ?? j?.reason ?? r.status));
  return j as T;
};
 type Props = {
   dialogueId: string;
   posDesignId: string;
   negDesignId: string;
   defaultMode?: Mode;
  suggestCloseDaimonAt?: (path: string) => boolean;
 };
 export default function LociTreeWithControls(props: Props) {
  const { dialogueId, posDesignId, negDesignId, defaultMode = 'assoc', suggestCloseDaimonAt } = props;

 const [mode, setMode] = React.useState<Mode>(defaultMode);
  const [version, setVersion] = React.useState(0);        // force refresh ticker
  const [selected, setSelected] = React.useState('0');    // focused base locus
  const [children, setChildren] = React.useState<string[]>([]);

  // ---- designs → tree (match panel usage) ----
  const { data: designsResp } = useSWR(
    () => (dialogueId ? `/api/ludics/designs?deliberationId=${dialogueId}` : null),
    get,
    { keepPreviousData: true, revalidateOnFocus: false }
  );

  const designsArray = React.useMemo(() => {
    if (Array.isArray(designsResp)) return designsResp;
    if (Array.isArray(designsResp?.designs)) return designsResp.designs;
    if (Array.isArray(designsResp?.data)) return designsResp.data;
    return [];
  }, [designsResp]);

  const root = React.useMemo(
    () => (designsArray.length ? mergeDesignsToTree(designsArray) : null),
    [designsArray]
  );

  // ---- derive children for controls from a base path ----
  function childPathsFor(base: string): string[] {
    if (!root) return [];
    const stack: any[] = [root];
    while (stack.length) {
      const n = stack.pop();
      if (n?.path === base) return (n?.children ?? []).map((c: any) => c.path);
      for (const c of n?.children ?? []) stack.push(c);
    }
    return [];
  }

  // ---- heatmap / stepIndex / usedAdditive from a recent step trace ----
  const [heatmap, setHeatmap] = React.useState<Record<string, number>>({});
  const [stepIndexByActId, setStepIndexByActId] = React.useState<Record<string, number>>({});
  const [usedAdditive, setUsedAdditive] = React.useState<Record<string, string> | undefined>(undefined);
  const [focusPath, setFocusPath] = React.useState<string | null>(null);

  const refreshTrace = React.useCallback(async () => {
    if (!dialogueId || !posDesignId || !negDesignId) return;
    // ask for a neutral step trace; compositionMode lets you experiment
    const j = await post<any>('/api/ludics/step', {
      dialogueId,
      posDesignId,
      negDesignId,
      phase: 'neutral',
      compositionMode: mode,
      maxPairs: 1024,
    });

    // Build actId -> index map
    const idx: Record<string, number> = {};
    const hm: Record<string, number> = {};
    const pairs: Array<{ posActId?: string; negActId?: string; locusPath?: string }> = j?.pairs ?? [];

    pairs.forEach((p, i) => {
      if (p.posActId) idx[p.posActId] = i + 1;
      if (p.negActId) idx[p.negActId] = i + 1;
      const lp = p.locusPath ?? null;
      if (lp) hm[lp] = (hm[lp] ?? 0) + 1;
    });

    setStepIndexByActId(idx);
    setHeatmap(hm);
    setUsedAdditive(j?.usedAdditive ?? undefined);

    // focus the most recent locus if present
    const last = pairs.length ? (pairs[pairs.length - 1].locusPath ?? null) : null;
    setFocusPath(last || '0');
    // also keep controls in sync
    setSelected(last || '0');
    setChildren(childPathsFor(last || '0'));
  }, [dialogueId, posDesignId, negDesignId, mode, root]);

  // initial + event-driven refreshes
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try { await refreshTrace(); } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [refreshTrace, version]);

  React.useEffect(() => {
    const bump = () => setVersion(v => v + 1);
    const onLoci = (e: any) => { if (e?.detail?.dialogueId === dialogueId) bump(); };
    window.addEventListener('mesh:loci-updated', onLoci as any);
    window.addEventListener('dialogue:moves:refresh', bump as any);
    return () => {
      window.removeEventListener('mesh:loci-updated', onLoci as any);
      window.removeEventListener('dialogue:moves:refresh', bump as any);
    };
  }, [dialogueId]);

  // manual step
  async function stepWithMode() {
    try {
      await post('/api/ludics/step', {
        dialogueId, posDesignId, negDesignId,
        compositionMode: mode, phase: 'neutral', maxPairs: 2048,
      });
    } finally {
      setVersion(v => v + 1);    // force trace + tree refresh
    }
  }

  // ---------- UI ----------
  return (
    <div className="space-y-2">
      {/* Header: matches panel controls tone */}
      <div className="flex items-center justify-between rounded border bg-white/70 px-2 py-1">
        <CompositionModeToggle value={mode} onChange={(m) => { setMode(m); setVersion(v => v + 1); }} />
        <button
          className="px-2 py-1 text-xs rounded border bg-white hover:bg-slate-50"
          onClick={stepWithMode}
          title="Run one step and refresh"
        >
          Step with composition = {MODE_LABEL[mode]}
        </button>
      </div>

      {/* Tree card — styled like the original panel host */}
      <div className="rounded border bg-white/70 backdrop-blur overflow-auto p-1"
           style={{ minHeight: 320, maxHeight: 480 }}>
        {root ? (
          <LociTreeLegacy
            key={version}
            root={root}
            usedAdditive={usedAdditive}
            
            defaultCollapsedDepth={1}
            showExpressions
            heatmap={heatmap}
            stepIndexByActId={stepIndexByActId}
            autoScrollOnFocus
            enableKeyboardNav
            onFocusPathChange={(p: string) => {
              setFocusPath(p || '0');
              setSelected(p || '0');
              setChildren(childPathsFor(p || '0'));
            }}
            suggestCloseDaimonAt={suggestCloseDaimonAt} 
          />
        ) : (
          <div className="p-3 text-xs text-neutral-500">Loading loci…</div>
        )}
      </div>

      {/* Controls for currently focused base */}
      <div className="rounded border bg-white/70 p-2">
        <div className="text-xs text-neutral-600 mb-1">
          Controls for base <code>{selected}</code>
        </div>
        <LocusControls
          dialogueId={dialogueId}
          posDesignId={posDesignId}
          negDesignId={negDesignId}
          baseLocus={selected}
          childrenPaths={children}
          onRefresh={() => setVersion(v => v + 1)}
        />
      </div>
    </div>
  );
}
