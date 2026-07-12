// components/deepdive/CardListVirtuoso.tsx
'use client';

import * as React from 'react';
import useSWRInfinite from 'swr/infinite';
import { Virtuoso } from 'react-virtuoso';
import { mutate as globalMutate } from 'swr';
 import IssuesDrawer from '@/components/issues/IssuesDrawer';

import CQBar from './CQBar';
import { useCQSummaryBatch } from '@/components/cq/useCQSummaryBatch';
import { EntailmentWidget } from '../entail/EntailmentWidget';
import { IssueBadge } from '../issues/IssueBadge';
// Detail modules
import SchemePicker from '@/components/cite/SchemePicker';
import CriticalQuestions from '@/components/claims/CriticalQuestions';
import ToulminMini from '@/components/deepdive/ToulminMini';
import { AddGround, AddRebut } from './AddGroundRebut';
import { ChallengeWarrantCard } from './ChallengeWarrantCard';
import SchemeCues from '../rhetoric/SchemeCues';

import { DecisionBanner } from '../decision/DecisionBanner';
// shadcn/ui
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import IssueComposer from '@/components/issues/IssueComposer';
  import { useRSABatch } from '@/packages/hooks/useRSABatch';
  import { RSAChip } from '@/packages/components/RSAChip';
  import { useDialecticStats } from '@/packages/hooks/useDialecticStats';
  import { DialBadge } from '@/packages/components/DialBadge';

const PAGE = 10;
const fetcher = (u: string) =>
  fetch(u, { cache: 'no-store' }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export type CardFilters = {
  status?: 'published' | 'draft';
  authorId?: string;
  since?: string;
  until?: string;
  sort?: 'createdAt:desc' | 'createdAt:asc';
};

function qs(base: string, params: Record<string, string | number | undefined>) {
  const url = new URL(base, 'http://x');
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  });
  return url.pathname + url.search + url.hash;
}

export default function CardListVirtuoso({
  deliberationId,
  filters: initialFilters = {},
}: {
  deliberationId: string;
  filters?: CardFilters;
}) {
  // filters
  const [status, setStatus] = React.useState<'published' | 'draft'>(initialFilters.status ?? 'published');
  const [author, setAuthor] = React.useState<string>(initialFilters.authorId ?? '');
  const [since, setSince] = React.useState<string>(initialFilters.since ?? '');
  const [until, setUntil] = React.useState<string>(initialFilters.until ?? '');
  const [sort, setSort] = React.useState<'createdAt:desc' | 'createdAt:asc'>(initialFilters.sort ?? 'createdAt:desc');
const [range, setRange] = React.useState<[number, number]>([0, 9]);
 const [issueCompose, setIssueCompose] = React.useState<{open:boolean; label?:string} | null>(null);
  // debounce author
  const [authorDebounced, setAuthorDebounced] = React.useState(author);
   const [issuesDrawer, setIssuesDrawer] = React.useState<{ open: boolean; claimId?: string } | null>(null);
  React.useEffect(() => {
    const id = setTimeout(() => setAuthorDebounced(author.trim() || ''), 250);
    return () => clearTimeout(id);
  }, [author]);

  // SWR Infinite
  const getKey = (index: number, prev: any) => {
    if (prev && !prev.nextCursor) return null;
    const cursor = index === 0 ? undefined : prev.nextCursor;
    return qs(`/api/deliberations/${deliberationId}/cards`, {
      page: 1,
      status,
      authorId: authorDebounced || undefined,
      since: since || undefined,
      until: until || undefined,
      sort,
      limit: PAGE,
      cursor,
    });
  };

  const { data, size, setSize, isValidating, error, mutate } = useSWRInfinite(getKey, fetcher, {
    revalidateFirstPage: false,
    keepPreviousData: true,
  });

  const items = React.useMemo(() => (data ?? []).flatMap((d) => d.items ?? []), [data]);
  const nextCursor = data?.[data.length - 1]?.nextCursor ?? null;

  // compute CQ summaries for the visible page
  const visibleClaimIds = React.useMemo(
    () => (items as any[]).map((c) => c.claimId).filter(Boolean) as string[],
    [items]
  );


  // Batch RSA for first ~20 visible claims


  const { byId: cqById } = useCQSummaryBatch(deliberationId, visibleClaimIds);
    // build RSA batch for first ~20 claimIds
  const claimTargets = React.useMemo(() => {
    return Array.from(new Set(visibleClaimIds.slice(0,20).map(id => `claim:${id}`)));
  }, [visibleClaimIds]);
  const { byTarget: rsaByTarget } = useRSABatch({ deliberationId, targets: claimTargets });
  const { stats: dialStats } = useDialecticStats(deliberationId);

  function resetFilters() {
    setStatus('published');
    setAuthor('');
    setSince('');
    setUntil('');
    setSort('createdAt:desc');
    mutate();
  }

  if (error) {
    return (
      <div className="text-xs text-rose-600">
        Failed to load cards. <button className="underline" onClick={() => mutate()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-2 rounded-md border p-2 bg-slate-50 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-600">Status</span>
          <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
            <TabsList className='gap-0 mx-0'>
              <TabsTrigger value="published">Published</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-neutral-600">Author</label>
          <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="authorId…" className="h-8 w-[160px]" />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-neutral-600">Since</label>
          <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} className="h-8" />
          <label className="text-xs text-neutral-600">Until</label>
          <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="h-8" />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-neutral-600">Sort</label>
          <Select value={sort} onValueChange={(v) => setSort(v as any)}>
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt:desc">Newest first</SelectItem>
              <SelectItem value="createdAt:asc">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button className='text-xs rounded p-1 bg-white/50 btnv2--ghost' onClick={() => mutate()}>Refresh</button>
          <button className='text-xs rounded p-1  bg-white/50 btnv2--ghost' onClick={resetFilters}>Reset</button>
        </div>
      </div>

      {/* List */}
      {!data && isValidating ? (
  <div className="space-y-2">
    {Array.from({length: 3}).map((_,i)=>(
      <div key={i} className="h-28 rounded-md border bg-white animate-pulse" />
    ))}
  </div>
) : !items.length ? (
  <div className="text-xs text-neutral-500">No cards yet.</div>
) : (
        <Virtuoso
          style={{ height: 520 }}
          className='panel-edge rounded-xl bg-transparent'
          data={items}
          overscan={200}
          endReached={() => !isValidating && nextCursor && setSize((s) => s + 1)}
          rangeChanged={({startIndex,endIndex}) => setRange([startIndex, endIndex])}
          itemContent={(i, c: any) => (
            <CardRow
              c={c}
              cqById={cqById}
              rsaByTarget={rsaByTarget}
              dialStats={dialStats}
              onOpenIssue={(claimId) => setIssuesDrawer({ open: true, claimId })}
            />
          )}
          components={{
            Footer: () => (
              <div className="py-3 text-center text-xs text-neutral-500">
                {isValidating ? "Loading…" : nextCursor ? "Scroll to load more" : "End"}
              </div>
            ),
          }}
        />
      )}
          {issuesDrawer?.open && (
      <IssuesDrawer
        deliberationId={deliberationId}
        open
        onOpenChange={(o) => !o && setIssuesDrawer(null)}
        // requires the small prop tweak in §3 below
        argumentId={issuesDrawer.claimId}
      />
  )}
      {issueCompose?.open && (
        <IssueComposer
          deliberationId={deliberationId}
          open
          onOpenChange={(o) => !o && setIssueCompose(null)}
          initialLabel={issueCompose.label}
        />
      )}
    </div>
  );
}

/** CQ section for one card (safe hooks) */
function CardCQSection({ claimId, authorId, cqSummary, deliberationId, onOpenIssue }: {
  claimId: string;
  authorId: string;
  deliberationId: string;
  cqSummary?: { satisfied: number; required: number; openByScheme: Record<string,string[]> };
  onOpenIssue?: (label?: string) => void;
  
}) {
  const [showCq, setShowCq] = React.useState(false);
  return (
    <div className="mt-2">
      {cqSummary && <CQBar satisfied={cqSummary.satisfied} required={cqSummary.required} />}
      <div className="mt-1">
        <button
         
          onClick={() => setShowCq(v => !v)}
          disabled={!cqSummary || !cqSummary.required}
          title="Address open critical questions"
          className="text-xs px-2 py-1 h-7 btnv2"
        >
          Address CQs
        </button>
                 {onOpenIssue && (
            <button
              className="text-[11px] underline decoration-dotted ml-2"
              onClick={() => {
                // Try to craft a helpful default label from the first open CQ
                let label = 'Open CQ';
                const firstScheme = cqSummary && Object.keys(cqSummary.openByScheme || {})[0];
                const firstCq = firstScheme && (cqSummary.openByScheme[firstScheme] || [])[0];
                if (firstScheme && firstCq) label = `Open CQ: ${firstScheme}:${firstCq}`;
                onOpenIssue(label);
              }}
            >
              Open as issue
            </button>
          )}
      </div>
      {showCq && (
        <div className="mt-2">
         <CriticalQuestions
  targetType="claim"
  targetId={claimId}
  createdById={authorId}
  deliberationId={deliberationId}
// selectedAttackerClaimId={preselectedCounterId} // optional
/>
        </div>
      )}
    </div>
  );
}

/** Row (memoized) */
type RSARes = { R:number; S:number; A:number };
const CardRow = React.memo(function CardRow({
  c, cqById, rsaByTarget, dialStats, onOpenIssue, onOpenIssuesFor
}:{
   c: any;
   cqById: Map<string, any>;
   rsaByTarget: Record<string, RSARes>;
   dialStats: Record<string, any>;
  onOpenIssue?: (label?: string) => void;
   onOpenIssuesFor?: (f: { claimId?: string; argumentId?: string; cardId?: string }) => void;

  }) {
  const cqSummary = c.claimId ? cqById.get(c.claimId) : undefined;

  return (
    <div className="rounded-md border border-indigo-200/70 bg-slate-50 p-3 mb-2 shadow-[0_1px_0_#f1f5f9]">

      <div className="flex  items-start gap-2">
      <div className="flex-1 ">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-medium">{c.claimText}</div>

          {c.quantifier && <span className="text-[10px] px-1.5 py-0.5 rounded border bg-slate-50">{c.quantifier}</span>}
          {c.modality && <span className="text-[10px] px-1.5 py-0.5 rounded border bg-slate-50">{c.modality}</span>}
          {c.claimId && rsaByTarget?.[`claim:${c.claimId}`] && <div className='bg-white'>  <RSAChip {...rsaByTarget[`claim:${c.claimId}`]} /> </div>}
          {c.claimId && dialStats && <DialBadge stats={dialStats} targetType="claim" targetId={c.claimId} />}
        </div>
        <div className="text-[11px] text-neutral-500 mt-0.5">
          by {c.authorId} • {new Date(c.createdAt).toLocaleString()}
        </div>
        {c.claimId && (
  <IssueBadge
    deliberationId={c.deliberationId}
    targetType="claim"
    targetId={c.claimId}
    onClick={() => onOpenIssuesFor?.({ claimId: c.claimId })}
  />
)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {typeof c.confidence === 'number' && (
          <span className="text-[11px] text-neutral-500">Sure: {Math.round((c.confidence ?? 0)*100)}%</span>
        )}
        {/* room for a dropdown menu */}
      </div>
    </div>

    {/* Reasons / Evidence / Counter (compact) */}
    {Array.isArray(c.reasonsText) && c.reasonsText.length > 0 && (
      <div className="mt-2 text-sm">
        <div className="text-xs font-semibold text-neutral-700">Reasons</div>
        <ul className="list-disc ml-5">
          {c.reasonsText.map((r: string, idx: number) => <li key={idx}>{r}</li>)}
        </ul>
      </div>
    )}
    {!!c.evidenceLinks?.length && (
      <div className="text-xs text-neutral-600 mt-1">
        <span className="font-semibold text-neutral-700">Evidence: </span>
        {c.evidenceLinks.map((u: string) => (
          <a key={u} href={u} className="underline mr-2 break-all" target="_blank" rel="noreferrer">{u}</a>
        ))}
      </div>
    )}
    {!!c.anticipatedObjectionsText?.length && (
      <div className="mt-1">
        <div className="text-xs font-semibold text-neutral-700">Anticipated objections</div>
        <ul className="list-disc ml-5 text-sm">
          {c.anticipatedObjectionsText.map((o: string, idx: number) => <li key={idx}>{o}</li>)}
        </ul>
      </div>
    )}
    {c.warrantText && (
      <div className="mt-1 text-sm">
        <span className="text-xs font-semibold text-neutral-700">Warrant: </span>
        <span>{c.warrantText}</span>
      </div>
    )}
    {c.counterText && (
      <div className="mt-1 text-sm">
        <span className="text-xs font-semibold text-neutral-700">Counter: </span>
        <span>{c.counterText}</span>
      </div>
    )}

    {c.claimId && <ChallengeWarrantCard cardId={c.id} claimId={c.claimId} deliberationId={c.deliberationId} />}

    {/* Collapsible details (keeps list light) */}
    <details className="mt-2 rounded border bg-white">
      <summary className="cursor-pointer text-xs px-2 py-2  text-neutral-600 select-none">Open analysis</summary>
      <div className="p-2 space-y-2">
        {c.claimId && <ToulminMini claimId={c.claimId} />}
        {c.claimId && (
          <div className="mt-2">
            <SchemeCues deliberationId={c.deliberationId} claimId={c.claimId} />
          </div>
        )}
        <div className="grid gap-2">
          {c.claimId && (
            <>
              <AddGround claimId={c.claimId} deliberationId={c.deliberationId} createdById={c.authorId} />
              <AddRebut claimId={c.claimId} deliberationId={c.deliberationId} createdById={c.authorId} />
            </>
          )}
        </div>
        <DecisionBanner deliberationId={c.deliberationId} subjectType="claim" subjectId={c.claimId}/>

        <EntailmentWidget
          deliberationId={c.deliberationId}
          seedSentences={Array.isArray(c.reasonsText) ? c.reasonsText : []}
          seedHypothesis={c.claimText ?? ''}
          defaultNliAssist
          defaultEmitViz={false}
          dialogueTarget={c.claimId ? { targetType: 'claim', targetId: c.claimId } : undefined}
          defaultCommitOwner="Proponent"
          defaultLocus="0"
        />

        {c.claimId && (
          <CardCQSection
            claimId={c.claimId}
            authorId={c.authorId}
            cqSummary={cqById.get(c.claimId)}
            deliberationId={c.deliberationId}
              onOpenIssue={onOpenIssue}
          />
        )}
      </div>
    </details>
  </div>
);
});
CardRow.displayName = 'CardRow';
