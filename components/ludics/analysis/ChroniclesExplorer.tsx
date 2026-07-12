"use client";

import * as React from "react";
import useSWR from "swr";

// Chronicle type matching API response format
type Chronicle = {
  id: string;
  designId: string;
  sequence: Array<{
    focus: string;
    polarity: string;
    ramification: number[];
    actId?: string;
    order?: number;
  }>;
  length: number;
  isMaximal: boolean;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function ChronicleCard({
  chronicle,
  index,
  selected,
  onSelect,
}: {
  chronicle: Chronicle;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`chronicle-card w-full text-left p-3 rounded border transition ${
        selected
          ? "bg-violet-50 border-violet-300 ring-2 ring-violet-200"
          : "bg-white hover:bg-slate-50 border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono font-semibold text-slate-700">
          Chronicle {index + 1}
        </span>
        {chronicle.isMaximal && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
            MAXIMAL
          </span>
        )}
      </div>
      <div className="text-[10px] text-slate-500">
        {chronicle.sequence?.length || chronicle.length || 0} actions
      </div>
    </button>
  );
}

export function ChroniclesExplorer({
  designId,
  deliberationId,
  selectedChronicle,
  onSelectChronicle,
}: {
  designId?: string;
  deliberationId?: string;
  selectedChronicle: Chronicle | null;
  onSelectChronicle: (chronicle: Chronicle) => void;
}) {
  // Prefer deliberationId for deliberation-wide chronicles
  const queryParam = deliberationId 
    ? `deliberationId=${deliberationId}`
    : `designId=${designId}`;
    
  const { data, isLoading, mutate } = useSWR(
    (deliberationId || designId) ? `/api/ludics/dds/chronicles?${queryParam}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const chronicles = (data?.chronicles || []) as Chronicle[];

  const computeChronicles = async () => {
    const body = deliberationId ? { deliberationId } : { designId };
    await fetch(`/api/ludics/dds/chronicles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await mutate();
  };

  return (
    <div className="chronicles-explorer space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Chronicles Explorer</h3>
        <button
          onClick={computeChronicles}
          className="px-3 py-1 text-xs rounded bg-slate-700 text-white hover:bg-slate-800"
        >
          Recompute Chronicles
        </button>
      </div>

      {/* Description */}
      <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border">
        <strong>Chronicles</strong> represent maximal branches in disputes.
        Proposition 3.6: Chronicles partition disputes into coherent paths.
      </div>

      {/* Chronicles List */}
      {isLoading ? (
        <div className="text-xs text-slate-500">Loading chronicles...</div>
      ) : (
        <div className="chronicles-list space-y-2 max-h-96 overflow-y-auto">
          {chronicles.map((chronicle, idx) => (
            <ChronicleCard
              key={chronicle.id || idx}
              chronicle={chronicle}
              index={idx}
              selected={selectedChronicle?.id === chronicle.id}
              onSelect={() => onSelectChronicle(chronicle)}
            />
          ))}
        </div>
      )}

      {!isLoading && chronicles.length === 0 && (
        <div className="text-xs text-slate-500 italic text-center py-8">
          No chronicles found. Click &quot;Recompute Chronicles&quot; to extract.
        </div>
      )}

      {/* Selected Chronicle Details */}
      {selectedChronicle && (
        <div className="selected-chronicle-details border-t pt-3 mt-3">
          <h4 className="text-xs font-semibold text-slate-700 mb-2">
            Chronicle Details
          </h4>
          <div className="bg-white border rounded p-3 space-y-2 text-xs">
            <div>
              <span className="font-semibold">Length:</span>{" "}
              {selectedChronicle.sequence?.length || selectedChronicle.length || 0} actions
            </div>
            <div>
              <span className="font-semibold">Maximal:</span>{" "}
              {selectedChronicle.isMaximal ? "Yes" : "No"}
            </div>
            <div>
              <span className="font-semibold">Sequence:</span>
              <pre className="mt-1 p-2 bg-slate-50 rounded text-[10px] overflow-x-auto">
                {JSON.stringify(selectedChronicle.sequence, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
