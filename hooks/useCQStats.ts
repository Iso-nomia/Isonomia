// hooks/useCQStats.ts
"use client";

import useSWR from "swr";
import { useMemo } from "react";
import type { CQStatusBadge, CQDataResponse } from "@/types/dialogue";
import { TargetType } from "@prisma/client";

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => r.json());

/**
 * Hook to fetch and calculate CQ (Critical Questions) statistics
 * 
 * Usage:
 * ```tsx
 * const cqStats = useCQStats({ targetType: "claim", targetId: claimId });
 * if (cqStats) {
 *   console.log(`${cqStats.satisfied}/${cqStats.total} CQs answered`);
 * }
 * ```
 */
export function useCQStats(params: {
  targetType: TargetType;
  targetId: string;
  enabled?: boolean;
}): CQStatusBadge | null {
  const { targetType, targetId, enabled = true } = params;

  // Only fetch for claims (arguments use different CQ structure)
  const shouldFetch = enabled && targetType === "claim";
  const cqKey = shouldFetch
    ? `/api/cqs?targetType=claim&targetId=${targetId}`
    : null;

  const { data } = useSWR<CQDataResponse>(cqKey, fetcher, {
    revalidateOnFocus: false,
  });

  const stats = useMemo(() => {
    if (!data?.schemes) return null;

    const allCqs = data.schemes.flatMap((s) => s.cqs);
    if (allCqs.length === 0) return null;

    return {
      total: allCqs.length,
      satisfied: allCqs.filter((cq) => cq.satisfied).length,
    };
  }, [data]);

  return stats;
}
