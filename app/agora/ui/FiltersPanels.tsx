"use client";
export function FiltersPanel() {
  // Expand with real filters later (discipline, method, time)
  return (
    <div className="rounded-xl border bg-white/70 p-3 space-y-2">
      <div className="text-sm font-medium">Filters</div>
      <div className="text-[12px] text-slate-600">Discipline (soon)</div>
      <div className="text-[12px] text-slate-600">Method (soon)</div>
      <div className="text-[12px] text-slate-600">Time: Now / 24h / 7d</div>
    </div>
  );
}
