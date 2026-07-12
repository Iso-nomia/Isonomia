// components/arguments/SchemeBreakdown.tsx
"use client";

import * as React from "react";
import useSWR from "swr";
import { Loader2, Target, TrendingUp } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Premise = {
  id: string;
  type: "major" | "minor";
  text: string;
  variables: string[];
};

type ConclusionTemplate = {
  text: string;
  variables: string[];
};

type Scheme = {
  schemeId: string;
  schemeKey: string;
  schemeName: string;
  schemeSummary: string;
  premises?: Premise[] | null;
  conclusion?: ConclusionTemplate | null;
  confidence: number;
  isPrimary: boolean;
};

export function SchemeBreakdown({ argumentId }: { argumentId: string }) {
  const { data, error, isLoading } = useSWR(
    argumentId ? `/api/arguments/${argumentId}/schemes` : null,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600 bg-red-50 rounded-md">
        Failed to load scheme information
      </div>
    );
  }

  const schemes: Scheme[] = data?.schemes || [];

  if (schemes.length === 0) {
    return (
      <div className="p-4 text-sm text-slate-500">
        No argumentation schemes assigned to this argument yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-600">
        This argument matches <strong>{schemes.length}</strong> argumentation scheme{schemes.length > 1 ? "s" : ""}:
      </div>

      <div className="space-y-2">
        {schemes.map((scheme, index) => (
          <div
            key={scheme.schemeId}
            className={`relative p-2 rounded-lg border-2 transition-all ${
              scheme.isPrimary
                ? "bg-indigo-50 border-indigo-300"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            {/* Primary badge */}
            {scheme.isPrimary && (
              <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-bold px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
                <Target className="h-3 w-3" />
                PRIMARY
              </div>
            )}

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Rank indicator */}
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${
                      scheme.isPrimary
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-300 text-slate-300"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <div className={`font-semibold ${
                      scheme.isPrimary ? "text-indigo-900" : "text-slate-900"
                    }`}>
                      {scheme.schemeName}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      {scheme.schemeKey}
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <p className="text-sm text-slate-700 mt-2 leading-relaxed">
                  {scheme.schemeSummary}
                </p>

                {/* Formal Structure (if present) */}
                {(scheme.premises || scheme.conclusion) && (
                  <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-3">
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Formal Structure
                    </div>

                    {/* Premises */}
                    {scheme.premises && scheme.premises.length > 0 && (
                      <div className="space-y-2">
                        {scheme.premises.map((premise) => (
                          <div
                            key={premise.id}
                            className="bg-white border border-sky-200 w-full rounded-lg px-3 py-2"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs font-bold text-slate-700">
                                {premise.id}:
                              </span>
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {premise.type} premise
                              </span>
                            </div>
                            <p className="text-sm text-slate-800 leading-relaxed">
                              {premise.text}
                            </p>
                            {premise.variables && premise.variables.length > 0 && (
                              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-slate-500">Variables:</span>
                                {premise.variables.map((v, idx) => (
                                  <span
                                    key={idx}
                                    className="font-mono text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded"
                                  >
                                    {v}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Conclusion */}
                    {scheme.conclusion && (
                      <div className="bg-sky-50 border border-indigo-200 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-indigo-700 font-bold">∴</span>
                          <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                            Therefore
                          </span>
                        </div>
                        <p className="text-sm text-indigo-900 leading-relaxed font-medium">
                          {scheme.conclusion.text}
                        </p>
                        {scheme.conclusion.variables && scheme.conclusion.variables.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-indigo-600">Variables:</span>
                            {scheme.conclusion.variables.map((v, idx) => (
                              <span
                                key={idx}
                                className="font-mono text-xs bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded"
                              >
                                {v}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="pt-3 border-t text-xs text-slate-500 space-y-1">
        <div className="flex items-center gap-2">
          <span>
            <strong>Primary scheme:</strong> Highest confidence score, used for CQ generation priority
          </span>
                    <Target className="h-3 w-3" />

        </div>
        <div>
          <strong>Confidence:</strong> How well the argument text matches the scheme&apos;s taxonomy and patterns
        </div>
      </div>
    </div>
  );
}


              // {/* Confidence meter */}
              // <div className="flex flex-col items-end gap-1 shrink-0">
              //   <div className="flex items-center gap-1.5">
              //     <TrendingUp className={`h-4 w-4 ${
              //       scheme.isPrimary ? "text-indigo-600" : "text-slate-500"
              //     }`} />
              //     <span className={`text-lg font-bold ${
              //       scheme.isPrimary ? "text-indigo-900" : "text-slate-700"
              //     }`}>
              //       {Math.round(scheme.confidence * 100)}%
              //     </span>
              //   </div>
              //   <div className="text-xs text-slate-700 tracking-wider">confidence</div>

              //   {/* Visual confidence bar */}
              //   <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden mt-1">
              //     <div
              //       className={`h-full transition-all ${
              //         scheme.isPrimary ? "bg-indigo-600" : "bg-slate-400"
              //       }`}
              //       style={{ width: `${scheme.confidence * 100}%` }}
              //     />
              //   </div>
              // </div>