'use client';
import useSWR from 'swr';

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export function WhyThis({ deliberationId, reason, ledgerEventId }: { deliberationId: string; reason: string; ledgerEventId?: string }) {
  return (
    <span className="text-xs">
      Why this is here: {reason}
      {ledgerEventId && (
        <a className="underline ml-1" href={`/ledger/${ledgerEventId}`} target="_blank" rel="noreferrer">
          View ledger
        </a>
      )}
    </span>
  );
}
