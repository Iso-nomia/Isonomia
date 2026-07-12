// components/work/WorkDetailClient.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { TheoryFraming } from '@/components/compose/TheoryFraming';
import EvaluationSheet from './EvaluationSheet';
import WorkStatusRail from '@/components/work/WorkStatusRail';
import { useAuth } from '@/lib/AuthContext'; // already used in other views
import WorkTitleEditor from '@/components/work/WorkTitleEditor';
import WorkHeaderBar from './WorkHeaderBar';
import SupplyDrawer from './SupplyDrawer';
import { IntegrityBadge } from '../integrity/IntegrityBadge';
export default function WorkDetailClient(props: {
  id: string;
  deliberationId: string;
  title: string;
  theoryType: 'DN'|'IH'|'TC'|'OP';
  standardOutput?: string;
  backHref?: string;
}) {
  const { id, deliberationId, title, theoryType, standardOutput } = props;
  const router = useRouter();
  const { user } = useAuth();
  const me = user?.userId ? String(user.userId) : null;
  const [authorId, setAuthorId] = React.useState<string | null>(null);
  const canEdit = !!me && !!authorId && me === authorId;

  const [computedBackHref, setComputedBackHref] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/deliberations/${deliberationId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const hostType = data.hostType ?? data.deliberation?.hostType;
        const hostId   = data.hostId   ?? data.deliberation?.hostId;
        const href = computeBackHref(hostType, hostId, deliberationId);
        if (!cancelled) setComputedBackHref(href);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [deliberationId]);

    React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/works/${id}`, { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          if (!cancelled) setAuthorId(j?.work?.authorId ?? null);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [id]);

  function computeBackHref(hostType?: string, hostId?: string, delibId?: string) {
    if (hostType && hostId) {
      switch (hostType) {
        case 'article':        return `/article/${hostId}`;
        case 'post':           return `/p/${hostId}`;
        case 'room_thread':    return `/rooms/${hostId}`;
        case 'library_stack':  return `/stacks/${hostId}`;
        case 'site':           return `/site/${hostId}`;
        case 'inbox_thread':   return `/inbox/thread/${hostId}`;
      }
    }
    return `/deepdive/${delibId ?? deliberationId}`;
  }

  const [framing, setFraming] = React.useState<{
    theoryType: 'DN'|'IH'|'TC'|'OP';
    standardOutput?: string;
  }>({ theoryType, standardOutput });

    const [localTitle, setLocalTitle] = React.useState(title);


  return (
    <div className="min-h-screen backdrop-blur-lg  bg-gradient-to-br from-neutral-50/20 rounded-3xl via-slate-100/60 to-neutral-50/30">
      <div className="container mx-auto px-6 py-6 space-y-6" style={{ maxWidth: 'min(100%, 90rem)' }}>
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push(props.backHref ?? computedBackHref ?? `/works/`)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </button>
        </div>

        {/* Header */}
        <div className="bg-white w-full rounded-lg border shadow-sm p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* <h1 className="text-xl font-bold text-neutral-900 leading-tight">
                {title}
              </h1> */}
              <WorkTitleEditor
                id={id}
                title={localTitle}
                canEdit={!canEdit}
                onUpdated={(t) => setLocalTitle(t)}
              />
              <p className="text-sm text-neutral-500 mt-2">
                Work ID: <span className="font-mono text-xs">{id}</span>
              </p>
            </div>
            <span className="flex-shrink-0 px-3 py-1 rounded-lg text-xs font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
              {theoryType}
            </span>
            <IntegrityBadge workId={id} theoryType={theoryType} />
          </div>
        </div>
        {/* Main Content Grid */}
        <div className=" grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(min-content,20rem)] gap-3 ">
          {/* Main Column */}
          <div className="space-y-6 min-w-0">
            <TheoryFraming
              value={framing}
              onChange={setFraming}
              workId={id}
              canEditPractical={true}
              defaultOpenBuilder={true}
            />
          </div>

          {/* Sidebar */}
          <div className="w-full  min-w-0">
            <div className="sticky  top-6 self-start">
              <WorkStatusRail
                workId={id}
                deliberationId={deliberationId}
                                decoupled={true}  // ✅ default to decoupled UX

                onPublished={() => {
                  // Optional: handle post-publish actions
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <EvaluationSheet />
    </div>
  );
}