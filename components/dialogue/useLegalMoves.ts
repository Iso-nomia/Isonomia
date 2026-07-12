'use client';
import useSWR from 'swr';

const postJson = (url: string, body: any) =>
  fetch(url, { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify(body) })
    .then(r => r.json());

export function useLegalMoves(text?: string) {
  const key = text && text.trim() ? ['/api/dialogue/legal-attacks', text] as const : null;
  const { data, error, isLoading } = useSWR(key, ([url, t]) => postJson(url, { text: t }));
  return { data, error, isLoading };
}
