"use client";

import * as React from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function AnalysisSummaryRow({
  design,
}: {
  design: { id: string; name: string };
}) {
  const { data: innocenceData } = useSWR(
    `/api/ludics/dds/strategy/innocence?designId=${design.id}`,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const { data: propagationData } = useSWR(
    `/api/ludics/dds/strategy/propagation?designId=${design.id}`,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const { data: correspondenceData } = useSWR(
    `/api/ludics/dds/correspondence/verify?designId=${design.id}`,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const { data: viewsData } = useSWR(
    `/api/ludics/dds/views?designId=${design.id}`,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const { data: chroniclesData } = useSWR(
    `/api/ludics/dds/chronicles?designId=${design.id}`,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const { data: disputesData } = useSWR(
    `/api/ludics/dds/correspondence/disp?designId=${design.id}`,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  return (
    <tr className="border-b hover:bg-slate-50 transition">
      <td className="p-2 font-mono text-slate-700">{design.name}</td>
      <td className="p-2 text-center">
        {innocenceData?.isInnocent !== undefined ? (
          <span
            className={
              innocenceData.isInnocent ? "text-emerald-600" : "text-amber-600"
            }
          >
            {innocenceData.isInnocent ? "✓" : "✗"}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="p-2 text-center">
        {propagationData?.satisfiesPropagation !== undefined ? (
          <span
            className={
              propagationData.satisfiesPropagation
                ? "text-sky-600"
                : "text-rose-600"
            }
          >
            {propagationData.satisfiesPropagation ? "✓" : "✗"}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="p-2 text-center">
        {correspondenceData?.isVerified !== undefined ? (
          <span
            className={
              correspondenceData.isVerified
                ? "text-indigo-600"
                : "text-slate-400"
            }
          >
            {correspondenceData.isVerified ? "≅" : "○"}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="p-2 text-right text-slate-700">
        {viewsData?.views?.length || viewsData?.count || "—"}
      </td>
      <td className="p-2 text-right text-slate-700">
        {chroniclesData?.chronicles?.length || chroniclesData?.count || "—"}
      </td>
      <td className="p-2 text-right text-slate-700">
        {disputesData?.disputes?.length || disputesData?.count || "—"}
      </td>
    </tr>
  );
}

export function AnalysisSummaryTable({
  designs,
}: {
  designs: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="analysis-summary-table border rounded-lg overflow-hidden">
      <div className="bg-slate-100 border-b px-3 py-2">
        <h3 className="text-xs font-bold text-slate-800">Analysis Summary</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left p-2 font-semibold text-slate-700">
                Design
              </th>
              <th className="text-center p-2 font-semibold text-slate-700">
                Innocent
              </th>
              <th className="text-center p-2 font-semibold text-slate-700">
                Propagation
              </th>
              <th className="text-center p-2 font-semibold text-slate-700">
                Verified
              </th>
              <th className="text-right p-2 font-semibold text-slate-700">
                Views
              </th>
              <th className="text-right p-2 font-semibold text-slate-700">
                Chronicles
              </th>
              <th className="text-right p-2 font-semibold text-slate-700">
                Disputes
              </th>
            </tr>
          </thead>
          <tbody>
            {designs.map((design) => (
              <AnalysisSummaryRow key={design.id} design={design} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
