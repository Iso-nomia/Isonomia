'use client';
import { useState } from 'react';
import SchemePicker from '@/components/cite/SchemePicker';
import CriticalQuestions from '@/components/claims/CriticalQuestions';
import ToulminMini from '@/components/deepdive/ToulminMini';
import useSWR, { mutate } from 'swr';
import { AddGround, AddRebut } from './AddGroundRebut';
import { ChallengeWarrantCard } from './ChallengeWarrantCard';
const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json());


export default function CardList({ deliberationId }: { deliberationId: string }) {
  const { data, isLoading } = useSWR(`/api/deliberations/${deliberationId}/cards?status=published`, fetcher);
  if (isLoading) return <div className="text-xs text-neutral-500">Loading cards…</div>;
  const cards = data?.cards ?? [];
  if (!cards.length) return <div className="text-xs text-neutral-500">No published cards yet.</div>;

  return (
    <div className="space-y-3">
      {cards.map((c: any) => (
        <div key={c.id} className="border rounded p-3 space-y-2">
          <div className="text-xs text-neutral-500">
            {new Date(c.createdAt).toLocaleString()} · by {c.authorId}
          </div>

          {/* Claim */}
          <div className="text-sm font-medium">{c.claimText}</div>

          {/* Reasons */}
          {Array.isArray(c.reasonsText) && c.reasonsText.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-neutral-700">Reasons</div>
              <ul className="list-disc ml-5 text-sm">
                {c.reasonsText.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}

          {/* Evidence */}
          {Array.isArray(c.evidenceLinks) && c.evidenceLinks.length > 0 && (
            <div className="text-xs text-neutral-600">
              <span className="font-semibold text-neutral-700">Evidence: </span>
              {c.evidenceLinks.map((u: string) => (
                <a key={u} href={u} className="underline mr-2" target="_blank" rel="noreferrer">
                  {u}
                </a>
              ))}
            </div>
          )}

          {/* Anticipated objections */}
          {Array.isArray(c.anticipatedObjectionsText) && c.anticipatedObjectionsText.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-neutral-700">Anticipated objections</div>
              <ul className="list-disc ml-5 text-sm">
                {c.anticipatedObjectionsText.map((o: string, i: number) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}

          {/* Warrant (if present) */}
          {c.warrantText && (
            <div className="text-sm">
              <span className="text-xs font-semibold text-neutral-700">Warrant: </span>
              <span>{c.warrantText}</span>
            </div>
          )}
          {/* Challenge warrant */}
           {c.claimId && (
   <ChallengeWarrantCard
     cardId={c.id}
     claimId={c.claimId}
     deliberationId={c.deliberationId}
   />
 )}

          {/* Counter (if present) */}
          {c.counterText && (
            <div className="text-sm">
              <span className="text-xs font-semibold text-neutral-700">Counter: </span>
              <span>{c.counterText}</span>
            </div>
          )}

          {/* Confidence */}
          {typeof c.confidence === 'number' && (
            <div className="text-[11px] text-neutral-500">
              How sure: {Math.round(c.confidence * 100)}%
            </div>
          )}
           {/* Schemes & Critical Questions */}
           <div className="mt-2 rounded border border-slate-200 p-2 bg-white">
  <div className="flex items-center justify-start gap-8">
    <div className="text-sm font-semibold text-neutral-700">Schemes</div>
    {c.claimId && (
  <SchemePicker
    targetType="claim"
    targetId={c.claimId}
    createdById={c.authorId}
    onAttached={() => mutate(`/api/claims/${c.claimId}/toulmin`)}
  />
)}

  </div>

  {c.claimId && <ToulminMini claimId={c.claimId} />}
  <div className="mt-2 grid gap-2">
  {c.claimId && (
    <>
      <AddGround claimId={c.claimId} deliberationId={c.deliberationId} createdById={c.authorId} />
      <AddRebut  claimId={c.claimId} deliberationId={c.deliberationId} createdById={c.authorId} />
    </>
  )}
</div>


  <div className="mt-2">
    {c.claimId && (
      <CriticalQuestions
        targetType="claim"     // ✅ fix
        targetId={c.claimId}   // ✅ fix
        createdById={c.authorId}
        deliberationId={c.deliberationId}   // 👈 now passed properly

      />
    )}
  </div>
</div>

        </div>
        
      ))}
     
    </div>
  );
}
