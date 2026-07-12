"use client";

import * as React from "react";
import type { Dispute } from "@/packages/ludics-core/dds";
import type { DispResult } from "@/packages/ludics-core/dds/correspondence";

interface DisputesListProps {
  designId: string;
  disputes?: Dispute[];
  isLoading?: boolean;
  cached?: boolean;
  onSelectDispute?: (dispute: Dispute) => void;
  onRefresh?: () => void;
}

export function DisputesList({
  designId,
  disputes = [],
  isLoading = false,
  cached = false,
  onSelectDispute,
  onRefresh,
}: DisputesListProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const handleSelect = (dispute: Dispute) => {
    setSelectedId(dispute.id);
    onSelectDispute?.(dispute);
  };

  return (
    <div className="disputes-list border rounded-lg p-4 bg-white/70 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-800">Disp(D)</h3>
          {cached && (
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
              cached
            </span>
          )}
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="text-xs text-slate-600 hover:text-slate-800 disabled:opacity-50"
          >
            ↻ Refresh
          </button>
        )}
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="text-xs text-slate-500 py-4 text-center">
          Computing disputes...
        </div>
      ) : disputes.length === 0 ? (
        <div className="text-xs text-slate-500 italic py-4 text-center">
          No disputes found
          <div className="text-[10px] mt-1">
            Design may not have orthogonal counter-designs
          </div>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="text-xs text-slate-600">
            {disputes.length} dispute{disputes.length !== 1 ? "s" : ""} found
          </div>

          {/* Disputes list */}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {disputes.map((dispute, idx) => (
              <button
                key={dispute.id}
                onClick={() => handleSelect(dispute)}
                className={`w-full text-left p-2 rounded border transition text-xs ${
                  selectedId === dispute.id
                    ? "bg-indigo-50 border-indigo-200"
                    : "bg-white hover:bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-slate-700">
                    Dispute {idx + 1}
                  </span>
                  <StatusBadge status={dispute.status} />
                </div>
                <div className="text-[10px] text-slate-500 space-y-0.5">
                  <div>Length: {dispute.length} pairs</div>
                  {dispute.pairs.length > 0 && (
                    <div className="font-mono truncate">
                      Path: {dispute.pairs.map((p) => p.locusPath).join(" → ")}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Design ID reference */}
      <div className="text-[10px] text-slate-400 border-t pt-2">
        Design:{" "}
        <code className="bg-slate-100 px-1 rounded">{designId}</code>
      </div>
    </div>
  );
}

interface StatusBadgeProps {
  status: Dispute["status"];
}

function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    CONVERGENT: "bg-emerald-100 text-emerald-700",
    DIVERGENT: "bg-rose-100 text-rose-700",
    ONGOING: "bg-amber-100 text-amber-700",
    STUCK: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
        styles[status] || styles.ONGOING
      }`}
    >
      {status}
    </span>
  );
}

export default DisputesList;
