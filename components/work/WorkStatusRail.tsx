// components/work/WorkStatusRail.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTheoryWorkChecklist } from '@/hooks/useTheoryWorkChecklist';

function ProgressBar({ value, color = 'neutral' }: { value: number; color?: 'neutral' | 'emerald' | 'amber' }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  
  const colorClasses = {
    neutral: 'bg-neutral-700',
    emerald: 'bg-emerald-600',
    amber: 'bg-amber-600',
  };

  return (
    <div className="relative h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
      <div 
        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${colorClasses[color]}`}
        style={{ width: `${pct}%` }} 
      />
    </div>
  );
}

const THEORY_LABELS = {
  DN: 'Descriptive–Nomological',
  IH: 'Idealizing–Hermeneutic',
  TC: 'Technical–Constructive',
  OP: 'Ontic–Practical',
};

export default function WorkStatusRail({
  workId,
  deliberationId,
  className,
  onPublished,
  decoupled=true,
}: {
  workId: string;
  deliberationId: string;
  className?: string;
  onPublished?: (snapshotId: string) => void;
  decoupled?: boolean;
}) {
  const router = useRouter();
  const { data, isLoading, error, structureProgress, activeOpen, cqProgress } =
    useTheoryWorkChecklist(workId);

  const [publishing, setPublishing] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);
  
  // DECOUPLING LOGIC:
  // Decoupled mode (works live in KB, not inside debate):
  //   - Gate publishability on structure completeness + adequacy/MCDA (for IH/TC/OP)
  //   - CQs become optional, soft checks with link-out to dialogue
  // Coupled mode (traditional debate-embedded works):
  //   - Gate on both structure and CQ completion (hard requirement)
  const publishable = decoupled 
    ? structureProgress >= 1 // && !!data?.work?.integrityValid // structure + integrity for decoupled
    : !!data?.publishable; // original behavior: requires structure + CQs

  async function publish(to: 'sheet'|'kb'|'aif' = 'sheet') {
    try {
      setPublishing(true);
      const res = await fetch(`/api/works/${workId}/publish`, {
        method: 'POST',
        headers: { 'content-type':'application/json' },
        body: JSON.stringify({ to })
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg);
      }
      const json = await res.json();
      onPublished?.(json?.snapshotId);
      
      if (to === 'sheet') {
        router.push(`/deepdive/${deliberationId}?sheet=1`);
      } else {
        router.refresh();
      }
    } catch (e: any) {
      alert(`Publish failed: ${e?.message ?? 'Unknown error'}`);
    } finally {
      setPublishing(false);
    }
  }

  async function postMove(kind: 'WHY'|'GROUNDS') {
    const target =
      data?.dialogue?.legalMoves?.find((m: any) => m.kind === kind && m.targetId)?.targetId ??
      data?.dialogue?.sampleTargetId ??
      data?.claims?.ids?.[0];

    if (!target) {
      router.push(`/deepdive/${deliberationId}#cqs`);
      return;
    }
    try {
      const res = await fetch('/api/dialogue/moves', {
        method: 'POST',
        headers: { 'content-type':'application/json' },
        body: JSON.stringify({ kind, targetType: 'claim', targetId: target })
      });
      if (!res.ok) throw new Error(await res.text());
      router.push(`/deepdive/${deliberationId}#claim-${target}`);
    } catch (e: any) {
      alert(`Failed to post ${kind}: ${e?.message ?? 'Unknown error'}`);
    }
  }

  const theory = data?.work?.theoryType ?? 'DN';
  const openList = activeOpen.slice(0, 3);
  const hasClaims = (data?.claims?.count ?? 0) > 0;
  const hasOpenCQs = (data?.claims?.cq?.openByScheme?.length ?? 0) > 0;

  return (
    <aside className={['rounded-lg max-w-[500px] w-full border bg-white shadow-sm', className].filter(Boolean).join(' ')}>
      {/* Header */}
      <div className="rounded-xl px-4 py-3 border-b bg-gradient-to-r from-neutral-50 to-white">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Work Status</h3>
          {isLoading && (
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 bg-neutral-400 rounded-full animate-pulse" />
              <span className="text-[10px] text-neutral-500">Loading</span>
            </div>
          )}
          {error && (
            <span className="text-[10px] text-rose-600 font-medium">Failed to load</span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Structure Progress */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-neutral-900">Structure</h4>
              <p className="text-xs text-neutral-500 mt-1">
                {THEORY_LABELS[theory as keyof typeof THEORY_LABELS]}
              </p>
            </div>
            <span className="text-lg font-bold text-neutral-900 tabular-nums">
              {Math.round(structureProgress * 100)}%
            </span>
          </div>
          <ProgressBar value={structureProgress} color={structureProgress >= 1 ? 'emerald' : 'neutral'} />
          {!!openList.length && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-semibold">Missing:</span> {openList.join(', ')}
                {activeOpen.length > openList.length && ' …'}
              </p>
            </div>
          )}
        </div>

        <div className="h-px bg-neutral-200" />

        {/* Claims & CQs Section - Conditional based on decoupled mode */}
        {decoupled ? (
          // DECOUPLED MODE: Soft check with link-out
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-neutral-900">Claims</h4>
                {typeof data?.claims?.count === 'number' && (
                  <p className="text-xs text-neutral-500 mt-1">
                    {data.claims.count} claim{data.claims.count !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
            
            {/* Optional CQ status indicator */}
            {hasClaims && hasOpenCQs && (
              <div className="mt-3 p-3 rounded-lg bg-sky-50 border border-sky-200">
                <p className="text-xs text-sky-800 leading-relaxed mb-2">
                  <span className="font-semibold">Optional:</span> Critical questions can be addressed in the dialogue panel to stress-test your claims.
                </p>
                <button
                  onClick={() => router.push(`/deepdive/${deliberationId}#dialogue`)}
                  className="text-xs font-medium text-sky-700 hover:text-sky-900 underline"
                >
                  → Address in dialogue panel
                </button>
              </div>
            )}

            {/* Simple dialogue link button */}
            <button
              className="w-full px-3 py-2 text-xs font-medium rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors"
              onClick={() => router.push(`/deepdive/${deliberationId}#dialogue`)}
              title="Open dialogue panel to discuss claims"
            >
              Open Dialogue Panel
            </button>
          </div>
        ) : (
          // COUPLED MODE: Full CQ workflow with hard requirements
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-neutral-900">Claims & CQs</h4>
                {typeof data?.claims?.count === 'number' && (
                  <p className="text-xs text-neutral-500 mt-1">
                    {data.claims.count} claim{data.claims.count !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <span className="text-lg font-bold text-neutral-900 tabular-nums">
                {Math.round((cqProgress ?? 0) * 100)}%
              </span>
            </div>
            <ProgressBar value={cqProgress ?? 0} color={cqProgress >= 1 ? 'emerald' : 'amber'} />
            
            {/* CQ Details (Collapsible) */}
            {hasOpenCQs && (
              <div className="mt-3">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-neutral-50 transition-colors"
                >
                  <span className="text-xs font-medium text-neutral-600">
                    {showDetails ? '− Hide' : '+ Show'} CQ details
                  </span>
                </button>
                {showDetails && (
                  <div className="mt-2 space-y-2 px-3 py-2 bg-neutral-50 rounded-md">
                    {data?.claims?.cq?.openByScheme?.slice(0, 3).map((s: any) => (
                      <div key={s.schemeKey} className="flex justify-between text-xs">
                        <span className="font-medium text-neutral-700">{s.schemeKey}:</span>
                        <span className="text-neutral-600">
                          {s.satisfied}/{s.required}
                          {s.open.length > 0 && (
                            <span className="ml-1.5 text-amber-600">({s.open.length} open)</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <button
                className="px-3 py-2 text-xs font-medium rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-50 transition-colors"
                onClick={() => postMove('WHY')}
                title="Ask for grounds (attack)"
                disabled={!data}
              >
                WHY
              </button>
              <button
                className="px-3 py-2 text-xs font-medium rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-50 transition-colors"
                onClick={() => postMove('GROUNDS')}
                title="Provide grounds (defend)"
                disabled={!data}
              >
                GROUNDS
              </button>
              <button
                className="px-3 py-2 text-xs font-medium rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors"
                onClick={() => router.push(`/deepdive/${deliberationId}#dialogue`)}
                title="Open dialogue panel"
              >
                Dialogue
              </button>
            </div>
          </div>
        )}

        <div className="h-px bg-neutral-200" />

        {/* Evidence & Dialogue Status */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-neutral-900">Evidence & Dialogue</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200">
              <div className="text-lg font-bold text-neutral-900 tabular-nums">
                {data?.claims?.evidence?.count ?? 0}
              </div>
              <div className="text-xs text-neutral-600 mt-1">
                Evidence items
              </div>
            </div>
            <div className={`p-3 rounded-lg border ${
              data?.dialogue?.hasClosableLoci 
                ? 'bg-emerald-50 border-emerald-200' 
                : 'bg-neutral-50 border-neutral-200'
            }`}>
              <div className={`text-xs font-semibold ${
                data?.dialogue?.hasClosableLoci ? 'text-emerald-700' : 'text-neutral-600'
              }`}>
                {data?.dialogue?.hasClosableLoci ? '✓ Closable' : 'No closable'}
              </div>
              <div className="text-xs text-neutral-600 mt-1">
                Dialogue loci
              </div>
            </div>
          </div>

          {/* Legal Moves - Only show in coupled mode */}
          {!decoupled && data?.dialogue?.legalMoves?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.dialogue.legalMoves.slice(0, 6).map((m: any, i: number) => (
                <span
                  key={i}
                  className={`
                    px-2 py-1 rounded-md text-[10px] font-medium border
                    ${m.force === 'ATTACK' 
                      ? 'border-rose-200 bg-rose-50 text-rose-700' 
                      : m.force === 'SURRENDER'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-700'
                    }
                  `}
                  title={m.relevance ? `Relevance: ${m.relevance}` : undefined}
                >
                  {m.kind}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="h-px bg-neutral-200" />

        {/* Publish Section */}
        <div className="space-y-3">
          <div className="p-4 rounded-lg bg-sky-50/50 border border-sky-200">
            <p className="text-xs text-neutral-700 leading-relaxed">
              {decoupled 
                ? 'Publishing creates a KB page from your work. Structure and adequacy checks must be complete.'
                : 'Publishing sends claims and edges to the debate and stores a snapshot for review.'
              }
            </p>
          </div>
          
          <button
            className="w-full px-4 py-3 rounded-lg text-sm font-semibold bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={async () => {
              const spaceId = prompt('Publish to which KB spaceId?');
              if (!spaceId) return;
              const r = await fetch(`/api/works/${workId}/publish`, {
                method: 'POST',
                headers: { 'content-type':'application/json' },
                body: JSON.stringify({ spaceId, display: 'summary', live: false }) // pinned snapshot
              });
              const j = await r.json();
              if (!r.ok) return alert(j?.error || 'Publish failed');
              location.href = `/kb/pages/${j.pageId}/view`;
            }}
            disabled={!publishable || publishing}
            title={
              decoupled
                ? (publishable ? 'Publish to Knowledge Base' : 'Complete structure and adequacy checks to enable')
                : (publishable ? 'Publish to debate sheet' : 'Complete required fields & CQs to enable')
            }
          >
            {publishing ? 'Publishing…' : 'Publish'}
          </button>
          
          {!publishable && (
            <p className="text-xs text-amber-700 text-center leading-relaxed">
              {decoupled
                ? 'Complete structure and adequacy checks to enable publishing'
                : 'Complete all required fields and CQs to enable publishing'
              }
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}