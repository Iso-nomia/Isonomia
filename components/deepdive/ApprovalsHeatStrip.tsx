// components/deepdive/ApprovalsHeatStrip.tsx
'use client';
import useSWR from 'swr';

const fetcher = (u: string) =>
  fetch(u, { cache: 'no-store' }).then(async (r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

type Summary = {
  totals: Record<string, number>;
  byArgument: Record<string, Record<string, string[]>>;
};

export default function ApprovalsHeatStrip({
  deliberationId,
  topN = 6,
}: {
  deliberationId: string;
  topN?: number;
}) {
  // 1) Summary — ALWAYS called
  const {
    data: summary,
    error: sumErr,
    isLoading: sumLoading,
  } = useSWR<Summary>(
    `/api/deliberations/${deliberationId}/approvals/summary?cohorts=all,authors`,
    fetcher
  );

  // 2) Derive cohorts/topIds with safe fallbacks (no early returns yet!)
  const cohorts = summary?.totals ? Object.keys(summary.totals) : [];
  const keyCohort = cohorts.includes('all') ? 'all' : cohorts[0];

  const topIds: string[] = (() => {
    if (!summary?.totals || !summary?.byArgument || !keyCohort) return [];
    const rows = Object.keys(summary.byArgument).map((argId) => {
      const covered = summary.byArgument[argId]?.[keyCohort]?.length ?? 0;
      const total = summary.totals[keyCohort] || 0;
      const pct = total > 0 ? covered / total : 0;
      return { id: argId, pct };
    });
    return rows.sort((a, b) => b.pct - a.pct).slice(0, topN).map((r) => r.id);
  })();

  // 3) Batch texts — ALWAYS called; key becomes null until ready
  const textsKey =
    topIds.length > 0
      ? `/api/arguments/batch?ids=${encodeURIComponent(
          topIds.join(',')
        )}&deliberationId=${encodeURIComponent(deliberationId)}`
      : null;

  const { data: texts } = useSWR<{ items: { id: string; text: string }[] }>(
    textsKey,
    fetcher
  );
  const textById = new Map<string, string>(
    (texts?.items ?? []).map((i) => [i.id, i.text])
  );

  // 4) NOW it’s safe to early-return — hooks already ran this render
  if (sumLoading) return null;
  if (sumErr || !summary?.totals || !summary?.byArgument) return null;
  if (!cohorts.length || !keyCohort) return null;

  // Build rows for table
  const rows = topIds.map((id) => {
    const columns: Record<string, number> = {};
    for (const c of cohorts) {
      const covered = summary.byArgument[id]?.[c]?.length ?? 0;
      const total = summary.totals[c] || 0;
      columns[c] = total > 0 ? covered / total : 0;
    }
    const full = (textById.get(id) ?? id).trim();
    const short = full.length > 90 ? `${full.slice(0, 90)}…` : full;
    return { id, full, short, columns };
  });

  return (
    <div className="rounded border p-3 text-sm">
      <div className="mb-2 font-medium">Approvals (top arguments × cohorts)</div>
      <div className="overflow-x-auto">
        <table className="min-w-[420px] text-xs">
          <thead>
            <tr>
              <th className="text-left pr-3 py-1">Argument</th>
              {cohorts.map((c) => (
                <th key={c} className="text-center px-2 py-1 capitalize">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className=" py-1 align-top w-fit max-w-[50%]">
                  <span title={r.full || r.id}>{r.short || r.id}</span>
                </td>
                {cohorts.map((c) => (
                  <td key={c} className=" align-center justify-center px-5 py-1">
                    <Cell pct={r.columns[c]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[11px] text-neutral-500 mt-2">
        Percent approvals per cohort (aggregated; identities hidden).
      </div>
    </div>
  );
}

function Cell({ pct }: { pct: number }) {
  const p = Math.round((pct || 0) * 100);
  const bg = `hsl(${120 * (pct || 0)} 70% 85%)`;
  return (
    <div
      className="w-12 h-5 rounded border text-[11px] grid place-items-center"
      style={{ background: bg }}
      title={`${p}%`}
    >
      {p}%
    </div>
  );
}
