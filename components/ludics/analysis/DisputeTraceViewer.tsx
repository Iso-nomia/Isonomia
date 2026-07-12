"use client";

import * as React from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Dispute {
  id: string;
  length: number;
  status?: string;
  pairs?: Array<{
    posAction?: { focus?: string; ramification?: string[] };
    negAction?: { focus?: string; ramification?: string[] };
  }>;
}

function DisputePairView({
  dispute,
  position,
}: {
  dispute: Dispute;
  position: number;
}) {
  const pair = dispute.pairs?.[position];

  if (!pair) {
    return <div className="text-xs text-slate-500">No pair data</div>;
  }

  return (
    <div className="dispute-pair border rounded p-4 bg-white">
      <div className="grid grid-cols-2 gap-4">
        {/* Positive action */}
        <div className="pos-action">
          <div className="text-xs font-semibold text-sky-700 mb-2">
            ⊕ Positive Action
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600">Focus:</span>
              <span className="font-mono text-slate-800">
                {pair.posAction?.focus}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Ramification:</span>
              <span className="font-mono text-slate-800">
                [{pair.posAction?.ramification?.join(", ")}]
              </span>
            </div>
          </div>
        </div>

        {/* Negative action */}
        <div className="neg-action">
          <div className="text-xs font-semibold text-rose-700 mb-2">
            ⊖ Negative Action
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600">Focus:</span>
              <span className="font-mono text-slate-800">
                {pair.negAction?.focus}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Ramification:</span>
              <span className="font-mono text-slate-800">
                [{pair.negAction?.ramification?.join(", ")}]
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DisputeTraceViewer({ designId }: { designId: string }) {
  const [selectedDispute, setSelectedDispute] = React.useState<Dispute | null>(
    null
  );
  const [playbackPosition, setPlaybackPosition] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);

  const { data } = useSWR(
    designId ? `/api/ludics/dds/correspondence/disp?designId=${designId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const disputes = (data?.disputes || []) as Dispute[];

  // Auto-play effect
  React.useEffect(() => {
    if (!isPlaying || !selectedDispute) return;

    const interval = setInterval(() => {
      setPlaybackPosition((pos) => {
        if (pos >= selectedDispute.length - 1) {
          setIsPlaying(false);
          return pos;
        }
        return pos + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, selectedDispute]);

  return (
    <div className="dispute-trace-viewer border rounded-lg bg-white">
      {/* Header */}
      <div className="viewer-header p-3 border-b bg-slate-50">
        <h3 className="text-sm font-bold text-slate-800">Dispute Trace Viewer</h3>
      </div>

      <div className="viewer-content flex h-96">
        {/* Disputes list */}
        <div className="disputes-sidebar w-64 border-r overflow-y-auto">
          <div className="p-2 border-b bg-slate-50">
            <div className="text-xs font-semibold text-slate-700">
              Disputes ({disputes.length})
            </div>
          </div>
          <div className="space-y-1 p-2">
            {disputes.map((dispute, idx) => (
              <button
                key={dispute.id || idx}
                onClick={() => {
                  setSelectedDispute(dispute);
                  setPlaybackPosition(0);
                  setIsPlaying(false);
                }}
                className={`w-full text-left p-2 rounded text-xs transition ${
                  selectedDispute?.id === dispute.id
                    ? "bg-violet-100 border border-violet-300 text-violet-800"
                    : "bg-slate-50 hover:bg-slate-100 border border-transparent"
                }`}
              >
                <div className="font-mono font-semibold">Dispute {idx + 1}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  {dispute.length} pairs
                </div>
                <div
                  className={`text-[10px] mt-1 px-1.5 py-0.5 rounded inline-block ${
                    dispute.status === "CONVERGED"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {dispute.status || "ONGOING"}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Trace visualization */}
        <div className="flex-1 p-4 overflow-y-auto">
          {selectedDispute ? (
            <div className="trace-content space-y-4">
              {/* Playback controls */}
              <div className="playback-controls flex items-center gap-3">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="px-3 py-1.5 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700 font-medium"
                >
                  {isPlaying ? "⏸ Pause" : "▶ Play"}
                </button>

                <button
                  onClick={() => setPlaybackPosition(0)}
                  className="px-2 py-1 text-xs rounded bg-slate-600 text-white hover:bg-slate-700"
                >
                  ⏮ Reset
                </button>

                <div className="flex-1">
                  <input
                    type="range"
                    min="0"
                    max={selectedDispute.length - 1}
                    value={playbackPosition}
                    onChange={(e) => setPlaybackPosition(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-xs text-slate-600 text-center mt-1">
                    Position {playbackPosition + 1} / {selectedDispute.length}
                  </div>
                </div>
              </div>

              {/* Current pair visualization */}
              <DisputePairView
                dispute={selectedDispute}
                position={playbackPosition}
              />

              {/* Full trace timeline */}
              <div className="trace-timeline border rounded p-3 bg-slate-50">
                <div className="text-xs font-semibold text-slate-700 mb-2">
                  Full Trace
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {selectedDispute.pairs?.map((pair: any, idx: number) => (
                    <div
                      key={idx}
                      className={`text-[10px] p-1.5 rounded ${
                        idx === playbackPosition
                          ? "bg-indigo-100 text-indigo-800 font-semibold"
                          : "text-slate-600"
                      }`}
                    >
                      {idx + 1}. {pair.posAction?.focus} ⟷{" "}
                      {pair.negAction?.focus}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic text-center py-16">
              Select a dispute to view trace
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
