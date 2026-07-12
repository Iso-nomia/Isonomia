"use client";

import * as React from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function DesignAnalysisBadges({
  designId,
  compact = false,
}: {
  designId: string;
  compact?: boolean;
}) {
  // Fetch analysis results
  const { data: innocenceData } = useSWR(
    designId ? `/api/ludics/dds/strategy/innocence?designId=${designId}` : null,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const { data: propagationData } = useSWR(
    designId ? `/api/ludics/dds/strategy/propagation?designId=${designId}` : null,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const { data: correspondenceData } = useSWR(
    designId ? `/api/ludics/dds/correspondence/verify?designId=${designId}` : null,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const isInnocent = innocenceData?.isInnocent;
  const satisfiesPropagation = propagationData?.satisfiesPropagation;
  const isVerified = correspondenceData?.isVerified;

  const hasAnalysis =
    innocenceData !== undefined ||
    propagationData !== undefined ||
    correspondenceData !== undefined;

  if (!hasAnalysis) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {isInnocent && (
          <span className="text-xs" title="Innocent Strategy">
            ✓
          </span>
        )}
        {satisfiesPropagation && (
          <span className="text-xs" title="Satisfies Propagation">
            ⚡
          </span>
        )}
        {isVerified && (
          <span className="text-xs" title="Correspondence Verified">
            ≅
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="design-analysis-badges flex flex-wrap gap-1">
      {isInnocent !== undefined && (
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            isInnocent
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {isInnocent ? "✓ Innocent" : "⚠ Not Innocent"}
        </span>
      )}

      {satisfiesPropagation !== undefined && (
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            satisfiesPropagation
              ? "bg-sky-100 text-sky-700"
              : "bg-rose-100 text-rose-700"
          }`}
        >
          {satisfiesPropagation ? "⚡ Propagation" : "✗ No Propagation"}
        </span>
      )}

      {isVerified !== undefined && (
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            isVerified
              ? "bg-indigo-100 text-indigo-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {isVerified ? "≅ Verified" : "○ Unverified"}
        </span>
      )}
    </div>
  );
}
