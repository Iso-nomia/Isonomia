// components/aif/PreferenceBadge.tsx
"use client";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

type PreferenceBadgeProps = {
  preferredBy: number;
  dispreferredBy: number;
  argumentId?: string;
  deliberationId?: string;
  className?: string;
};

interface DefeatDetails {
  defeatsBy: Array<{ id: string; label: string }>;
  defeatedBy: Array<{ id: string; label: string }>;
  preferenceStats: {
    preferred: number;
    dispreferred: number;
  };
  // Phase 3: preference-aware grounded standing (distinct from the confidence
  // float and from the count-based dialectical-standing taxonomy).
  standing?: { status: "in" | "out" | "undec" | "unknown"; preferenceApplied: boolean };
  // §7.1: un-ratified (PROPOSED) attacks targeting this argument. Surfaced as a
  // provisional "contested · pending k/N" label — distinct from a real defeat.
  pending?: { count: number; threshold: number; topSignoffs: number };
}

export function PreferenceBadge({ 
  preferredBy, 
  dispreferredBy, 
  argumentId,
  deliberationId,
  className = "" 
}: PreferenceBadgeProps) {
  const [details, setDetails] = React.useState<DefeatDetails | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch defeat details when tooltip is opened
  const fetchDetails = React.useCallback(() => {
    if (!argumentId || !deliberationId || details) return;
    
    setLoading(true);
    setError(null);
    
    fetch(`/api/arguments/${argumentId}/defeats?deliberationId=${deliberationId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        setDetails({
          defeatsBy: data.defeatsBy || [],
          defeatedBy: data.defeatedBy || [],
          preferenceStats: {
            preferred: data.preferenceStats?.preferred ?? preferredBy,
            dispreferred: data.preferenceStats?.dispreferred ?? dispreferredBy,
          },
          standing: data.standing,
          pending: data.pending,
        });
      })
      .catch(err => {
        console.error("Failed to fetch defeat details:", err);
        setError("Failed to load details");
      })
      .finally(() => setLoading(false));
  }, [argumentId, deliberationId, details, preferredBy, dispreferredBy]);

  if (preferredBy === 0 && dispreferredBy === 0) return null;

  const netPreference = preferredBy - dispreferredBy;
  const bgColor = netPreference > 0 
    ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
    : netPreference < 0
    ? "bg-red-50 text-red-700 border-red-200"
    : "bg-neutral-100 text-neutral-700 border-neutral-200";

  const badgeContent = (
    <>
      {preferredBy > 0 && <span>↑{preferredBy}</span>}
      {preferredBy > 0 && dispreferredBy > 0 && <span className="mx-0.5">/</span>}
      {dispreferredBy > 0 && <span>↓{dispreferredBy}</span>}
    </>
  );

  // If no argumentId or deliberationId, render simple badge without tooltip
  if (!argumentId || !deliberationId) {
    return (
      <Badge 
        variant="outline" 
        className={`text-[10px] ${bgColor} ${className}`}
        title={`${preferredBy} preferred, ${dispreferredBy} dispreferred`}
      >
        {badgeContent}
      </Badge>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip onOpenChange={(open) => { if (open) fetchDetails(); }}>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`text-[10px] ${bgColor} ${className} cursor-help`}
          >
            {badgeContent}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm p-4 bg-white border border-slate-200 shadow-lg">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading details...
            </div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : details ? (
            <div className="space-y-3 text-sm">
              <div className="font-semibold text-slate-900 border-b border-slate-200 pb-2">
                Preference Summary
              </div>

              {/* Phase 3: preference-aware grounded standing (in/out/undec) */}
              {details.standing && details.standing.status !== "unknown" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-700">Standing</span>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                      details.standing.status === "in"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : details.standing.status === "out"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                    title="Grounded-extension standing — reflects stored preferences. Distinct from the confidence score."
                  >
                    {details.standing.status === "in"
                      ? "IN"
                      : details.standing.status === "out"
                      ? "OUT"
                      : "UNDECIDED"}
                  </span>
                  {details.standing.preferenceApplied && (
                    <span className="text-[10px] text-violet-600" title="A stored preference gated a defeat involving this argument.">
                      · preference applied
                    </span>
                  )}
                </div>
              )}

              {/* §7.1: provisional "contested" label for un-ratified attacks.
                  These are NOT yet defeats — they await ratification. */}
              {details.pending && details.pending.count > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-700">Contested</span>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200"
                    title="Un-ratified attack(s) on this argument. They do not count as a defeat until they reach the deliberation's ratification threshold."
                  >
                    PENDING {details.pending.topSignoffs}/{details.pending.threshold}
                  </span>
                  {details.pending.count > 1 && (
                    <span className="text-[10px] text-slate-500">
                      · {details.pending.count} pending attacks
                    </span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-emerald-700">Preferred by</div>
                  <div className="text-lg font-bold text-emerald-800">{details.preferenceStats.preferred}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-red-700">Dispreferred by</div>
                  <div className="text-lg font-bold text-red-800">{details.preferenceStats.dispreferred}</div>
                </div>
              </div>

              {(details.defeatsBy.length > 0 || details.defeatedBy.length > 0) && (
                <div className="border-t border-slate-200 pt-3 space-y-2">
                  <div className="font-semibold text-slate-900">Defeat Information</div>
                  
                  {details.defeatsBy.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-slate-700">
                        Defeats {details.defeatsBy.length} argument{details.defeatsBy.length !== 1 ? "s" : ""}
                      </div>
                      {details.defeatsBy.length <= 3 && (
                        <ul className="mt-1 space-y-1 text-xs text-slate-600">
                          {details.defeatsBy.map(arg => (
                            <li key={arg.id} className="truncate">• {arg.label}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  
                  {details.defeatedBy.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-slate-700">
                        Defeated by {details.defeatedBy.length} argument{details.defeatedBy.length !== 1 ? "s" : ""}
                      </div>
                      {details.defeatedBy.length <= 3 && (
                        <ul className="mt-1 space-y-1 text-xs text-slate-600">
                          {details.defeatedBy.map(arg => (
                            <li key={arg.id} className="truncate">• {arg.label}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="text-xs text-slate-500 italic border-t border-slate-100 pt-2">
                Net preference: {netPreference > 0 ? "+" : ""}{netPreference}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-600">
              <div className="font-semibold text-slate-900 mb-2">Preference Summary</div>
              <div>Preferred by: {preferredBy}</div>
              <div>Dispreferred by: {dispreferredBy}</div>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
