'use client';
import * as React from 'react';
import useSWR from 'swr';
import { SCHEME_SPECS, scanCues, densityPer100, SchemeKey } from './schemeSignals';
import { useCQSummaryBatch } from '@/components/cq/useCQSummaryBatch';
import CriticalQuestions from '@/components/claims/CriticalQuestionsV2';

const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json());

type ToulminMiniShape = {
  claim?: { id: string; text: string };
  // adapt to your actual shape; we try a couple common keys:
  schemes?: Array<{ key: string }> | string[];
};

export default function SchemeCues({
  deliberationId,
  claimId,
  // optional: if you already know which schemes are attached
  schemeKeys,
}: {
  deliberationId: string;
  claimId: string;
  schemeKeys?: string[];
}) {
  // 1) load claim text + attached schemes (robust to shape differences)
  const { data } = useSWR<ToulminMiniShape>(`/api/claims/${claimId}/toulmin`, fetcher);
  const text =
    (data as any)?.claim?.text ??
    (data as any)?.claimText ??
    ''; // soft fallback

  const attached: string[] = React.useMemo(() => {
    if (Array.isArray(schemeKeys) && schemeKeys.length) return schemeKeys;
    const s = (data as any)?.schemes;
    if (Array.isArray(s)) {
      if (typeof s[0] === 'string') return s as string[];
      return (s as any[]).map(x => x.key).filter(Boolean);
    }
    return [];
  }, [data, schemeKeys]);

  // 2) current CQ status for this claim (to pre-filter CriticalQuestions)
  const { byId } = useCQSummaryBatch(deliberationId, [claimId]);
  const cq = byId.get(claimId);

  // 3) compute scheme-aware cues
  const analyses = attached
    .map((raw) => {
      // normalize some common keys
      const key = normalizeSchemeKey(raw);
      const spec = key ? SCHEME_SPECS[key] : undefined;
      if (!spec) return null;
      const hits = scanCues(text, spec);
      return { key, spec, hits, density: densityPer100(text, hits) };
    })
    .filter(Boolean) as Array<{ key: SchemeKey; spec: any; hits: any[]; density: number }>;

  // 4) local UI state
  const [openScheme, setOpenScheme] = React.useState<SchemeKey | null>(null);

  if (!attached.length) return null; // nothing to show if no schemes attached

  return (
    <div className="mt-2 rounded border p-2 bg-white">
      <div className="text-xs font-semibold text-neutral-700">Scheme cues</div>
      {!text && <div className="text-[11px] text-neutral-500">No text available.</div>}

      <ul className="mt-1 space-y-2">
        {analyses.map(({ key, spec, hits, density }) => {
          const openKeys = collectOpenKeysFor(key, cq?.openByScheme);
          const canOpen = openKeys.length > 0;
          return (
            <li key={key} className="text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{spec.title}</span>
                  <span className="ml-2 text-[11px] text-neutral-500">
                    {hits.length ? `${hits.length} cue${hits.length === 1 ? '' : 's'}` : 'no cues'} ·
                    density {density.toFixed(2)} / 100w
                  </span>
                  {spec.suggest && (
                    <div className="text-[11px] text-neutral-600">{spec.suggest}</div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="text-[11px] px-2 py-1 rounded border"
                    onClick={() => setOpenScheme(openScheme === key ? null : key)}
                    disabled={!canOpen}
                    title={canOpen ? 'Address open critical questions' : 'No open critical questions'}
                  >
                    Address CQs
                  </button>
                </div>
              </div>

              {/* token preview (optional, collapsible) */}
              {hits.length > 0 && (
                <div className="mt-1 text-[11px] text-neutral-600">
                  {previewHits(text, hits).map((frag, i) => (
                    <React.Fragment key={i}>{frag}</React.Fragment>
                  ))}
                </div>
              )}

              {openScheme === key && canOpen && (
                <div className="mt-2">
                  <CriticalQuestions
                    targetType="claim"
                    targetId={claimId}
                    createdById={'system'}          // unused, parity
                    deliberationId={deliberationId} // needed by your toggle route
                    prefilterKeys={openKeys}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// --- helpers ---

function normalizeSchemeKey(s: string): SchemeKey | null {
  const k = s.toLowerCase();
  if (k.includes('expert')) return 'ExpertOpinion';
  if (k.includes('authority')) return 'ExpertOpinion';
  if (k.includes('analogy')) return 'Analogy';
  if (k.includes('pragmat') || k.includes('consequence')) return 'Pragmatic';
  if (k.includes('cause')) return 'Causal';
  if (k.includes('sign') || k.includes('symptom') || k.includes('indicator')) return 'Sign';
  if (k.includes('popular') || k.includes('ad populum') || k.includes('consensus')) return 'PopularOpinion';
  return null;
}

// Build CQ prefilter for a single scheme from your aggregated status
function collectOpenKeysFor(scheme: SchemeKey, openBy?: Record<string, string[]>): Array<{schemeKey: string; cqKey: string}> {
  if (!openBy) return [];
  // find a scheme bucket matching our normalized name
  const entries = Object.entries(openBy);
  const match = entries.find(([sk]) => normalizeSchemeKey(sk) === scheme) || entries.find(([sk]) => sk === scheme);
  if (!match) return [];
  const [schemeKey, cqArr] = match;
  return (cqArr || []).map(k => ({ schemeKey, cqKey: k }));
}

// Tiny preview with soft highlights
function previewHits(text: string, hits: {start:number; end:number}[]) {
  if (!text) return [];
  const parts: React.ReactNode[] = [];
  let i = 0;
  const sorted = [...hits].sort((a,b)=>a.start-b.start).slice(0, 6); // cap preview
  for (const h of sorted) {
    if (h.start > i) parts.push(<span key={`plain-${i}`}>{text.slice(i, h.start)}</span>);
    parts.push(<mark key={`hit-${h.start}`} className="bg-yellow-100 px-0.5">{text.slice(h.start, h.end)}</mark>);
    i = h.end;
  }
  if (i < text.length) parts.push(<span key={`tail-${i}`}>{text.slice(i)}</span>);
  return parts;
}
