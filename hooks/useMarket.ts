"use client";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useMarket(id?: string, fallbackData?: unknown) {
  const { data, mutate } = useSWR(
    id ? `/api/market/${id}` : null,
    fetcher,
    {
      fallbackData: fallbackData ? { market: fallbackData, canResolve: false } : undefined,
      refreshInterval: 5000,
    }
  );

  const merged = data?.market ? { ...data.market, canResolve: data.canResolve ?? false } : fallbackData;

  return { data: merged, mutate };
}
