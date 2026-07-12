"use client";
import useSWR from "swr";

type Receipt = {
  id: string;
  v: number;
  version_hash?: string;   // depending on your API
  versionHash?: string;
  merged_at?: string;
  mergedAt?: string;
  signature?: string | null;
};

type ApiResp = { ok?: boolean; items?: Receipt[] };

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
    return r.json() as Promise<ApiResp>;
  });

export function useReceipts(messageId?: string | number | null) {
  const id = messageId != null ? String(messageId) : null;

  // SWR v1/v2 compatible loading flag
  const { data, mutate, error, isValidating }: any = useSWR(
    id ? `/api/messages/${encodeURIComponent(id)}/receipts?latest=1` : null,
    fetcher
  );

  const list = data?.items ?? [];
  const latest = list[0] ?? null;
  // v1 compatibility: treat "no data and no error" as loading
  const isLoading = typeof (data as any) === "undefined" && !error ? true : !!(data as any)?.isLoading;

  return {
    latest,
    list,
    refreshReceipts: mutate,
    isLoading,
    error,
  };
}
