// components/evidence/SupportBar.tsx
"use client";
import * as React from "react";
import { ConfidenceBreakdown, type ExplainData } from "@/components/confidence/ConfidenceBreakdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SupportBarProps {
  value: number;
  upperBound?: number; // plausibility for DS mode
  /**
   * Cross-room transport band (Sprint C4). When present and `upperBound`
   * is not set, the bar renders `local` as a solid fill and the imported
   * delta (`total - local`) as a hatched overlay so users can see how
   * much of the score comes from other rooms via `RoomFunctor` mappings.
   */
  band?: { local: number; imported: number; total: number };
  label?: string;
  claimId?: string;
  deliberationId?: string;
  mode?: "min" | "product" | "ds" | "logodds";
  showBreakdown?: boolean;
}

export function SupportBar({ 
  value, 
  upperBound,
  band,
  label, 
  claimId,
  deliberationId,
  mode = "product",
  showBreakdown = true 
}: SupportBarProps) {
  const v = Math.max(0, Math.min(1, value ?? 0));
  const pl = upperBound !== undefined ? Math.max(0, Math.min(1, upperBound)) : undefined;
  const bandLocal = band ? Math.max(0, Math.min(1, band.local)) : undefined;
  const bandTotal = band ? Math.max(0, Math.min(1, band.total)) : undefined;
  const showBand = pl === undefined && band !== undefined && bandTotal! > bandLocal!;
  const [explain, setExplain] = React.useState<ExplainData | null>(null);
  const [loading, setLoading] = React.useState(false);

  const fetchExplanation = React.useCallback(async () => {
    if (!claimId || !deliberationId || explain) return;
    
    setLoading(true);
    try {
      const res = await fetch(
        `/api/evidential/score?deliberationId=${deliberationId}&ids=${claimId}&explain=1&mode=${mode}`
      );
      const data = await res.json();
      const item = data.items?.find((i: any) => i.id === claimId);
      if (item?.explain?.lines?.[0]) {
        setExplain({
          schemeBase: item.explain.lines[0].schemeBase,
          premiseProduct: item.explain.lines[0].premises?.reduce((a: number, b: number) => a * b, 1),
          premiseMin: item.explain.lines[0].premises ? Math.min(...item.explain.lines[0].premises) : undefined,
          cqPenalty: item.explain.lines[0].cqPenalty,
          unsatisfiedCQs: item.explain.lines[0].unsatisfiedCQs,
          final: item.score ?? value,
        });
      }
    } catch (err) {
      console.error("Failed to fetch confidence explanation:", err);
    } finally {
      setLoading(false);
    }
  }, [claimId, deliberationId, explain, mode, value]);

  const bar = (
    <div className="w-44">
      <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
        <span>{label ?? "Support"}</span>
        {pl !== undefined ? (
          <span>[{(v * 100).toFixed(0)}%, {(pl * 100).toFixed(0)}%]</span>
        ) : showBand ? (
          <span title={`local ${(bandLocal! * 100).toFixed(0)}% + imported ${(band!.imported * 100).toFixed(0)}%`}>
            {(bandLocal! * 100).toFixed(0)}% + {(band!.imported * 100).toFixed(0)}% → {(bandTotal! * 100).toFixed(0)}%
          </span>
        ) : (
          <span>{(v * 100).toFixed(0)}%</span>
        )}
      </div>
      <div className="h-2 rounded bg-slate-200/70 relative overflow-hidden">
        {pl !== undefined ? (
          <>
            {/* DS mode: show [bel, pl] interval */}
            <div 
              className="h-2 rounded bg-emerald-500" 
              style={{ width: `${v * 100}%` }}
              title={`Belief: ${(v * 100).toFixed(1)}%`}
            />
            <div 
              className="h-2 bg-emerald-300/50 absolute top-0" 
              style={{ left: `${v * 100}%`, width: `${(pl - v) * 100}%` }}
              title={`Plausibility range: ${(v * 100).toFixed(1)}% - ${(pl * 100).toFixed(1)}%`}
            />
          </>
        ) : showBand ? (
          <>
            {/* Sprint C4: local fill + hatched imported overlay */}
            <div
              className="h-2 rounded-l bg-emerald-500"
              style={{ width: `${bandLocal! * 100}%` }}
              title={`Local support: ${(bandLocal! * 100).toFixed(1)}%`}
            />
            <div
              className="h-2 absolute top-0 bg-sky-400/70"
              style={{
                left: `${bandLocal! * 100}%`,
                width: `${(bandTotal! - bandLocal!) * 100}%`,
                backgroundImage:
                  "repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 5px)",
              }}
              title={`Imported (cross-room): +${((bandTotal! - bandLocal!) * 100).toFixed(1)}% (raw imported ${(band!.imported * 100).toFixed(1)}%)`}
            />
          </>
        ) : (
          <div className="h-2 rounded bg-emerald-500" style={{ width: `${v * 100}%` }} />
        )}
      </div>
    </div>
  );

  // If no claimId/deliberationId provided, or showBreakdown disabled, just show bar
  if (!showBreakdown || !claimId || !deliberationId) {
    return bar;
  }

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) fetchExplanation(); }}>
      <DropdownMenuTrigger asChild>
        <div className="cursor-help hover:opacity-80 transition-opacity">
          {bar}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="p-3">
        {loading ? (
          <div className="text-xs text-slate-500">Loading breakdown...</div>
        ) : explain ? (
          <ConfidenceBreakdown explain={explain} mode={mode} />
        ) : (
          <div className="text-xs text-slate-500">No explanation available</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

