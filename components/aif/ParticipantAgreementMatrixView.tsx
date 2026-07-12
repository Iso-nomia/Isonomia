"use client";

import React, { useState } from "react";
import { ParticipantAgreementMatrix } from "@/lib/aif/commitment-analytics";

interface ParticipantAgreementMatrixViewProps {
  agreementMatrix: ParticipantAgreementMatrix;
}

type MetricType = "jaccard" | "overlap";

export default function ParticipantAgreementMatrixView({
  agreementMatrix,
}: ParticipantAgreementMatrixViewProps) {
  const [metricType, setMetricType] = useState<MetricType>("jaccard");
  const [hoveredCell, setHoveredCell] = useState<{ i: number; j: number } | null>(null);

  const { participants, matrix, coalitions, avgAgreement, maxAgreement, minAgreement } = agreementMatrix;

  // Helper to get color for agreement score
  const getHeatmapColor = (score: number): string => {
    // Color gradient: cool blue (0) -> neutral (0.5) -> warm red (1)
    if (score === 0) return "bg-gray-100";
    if (score < 0.2) return "bg-blue-100";
    if (score < 0.4) return "bg-blue-200";
    if (score < 0.6) return "bg-yellow-100";
    if (score < 0.8) return "bg-orange-200";
    return "bg-red-300";
  };

  // Helper to format percentage
  const formatPercent = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  if (participants.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Participant Agreement Matrix
        </h3>
        <p className="text-gray-500 text-sm">
          No participant data available. Start a deliberation to see agreement patterns.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Participant Agreement Matrix
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Pairwise agreement based on shared active commitments
          </p>
        </div>

        {/* Metric Toggle */}
        <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setMetricType("jaccard")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              metricType === "jaccard"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Jaccard
          </button>
          <button
            onClick={() => setMetricType("overlap")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              metricType === "overlap"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Overlap
          </button>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-600 font-medium">Avg Agreement</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatPercent(avgAgreement)}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-600 font-medium">Max Agreement</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {formatPercent(maxAgreement)}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-600 font-medium">Min Agreement</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {formatPercent(minAgreement)}
          </p>
        </div>
      </div>

      {/* Coalitions Summary */}
      {coalitions.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">
            Detected Coalitions
          </h4>
          <div className="space-y-2">
            {coalitions.map((coalition, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">
                    {coalition.memberNames.join(", ")}
                  </p>
                  <p className="text-xs text-blue-700">
                    {coalition.size} members • Internal agreement: {formatPercent(coalition.avgInternalAgreement)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border border-gray-300 bg-gray-100 p-2 text-xs font-semibold text-gray-700 text-left min-w-[150px]">
                Participant
              </th>
              {participants.map((p, idx) => (
                <th
                  key={idx}
                  className="border border-gray-300 bg-gray-100 p-2 text-xs font-semibold text-gray-700 text-center min-w-[80px]"
                  title={p.name}
                >
                  <div className="truncate">{p.name}</div>
                  <div className="text-gray-500 font-normal">({p.activeCommitmentCount})</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {participants.map((p1, i) => (
              <tr key={i}>
                <td className="border border-gray-300 bg-gray-50 p-2 text-xs font-medium text-gray-900">
                  <div className="truncate" title={p1.name}>
                    {p1.name}
                  </div>
                  <div className="text-gray-500 text-xs">
                    {p1.activeCommitmentCount} commitments
                  </div>
                </td>
                {participants.map((p2, j) => {
                  const agreement = matrix[i][j];
                  const score =
                    metricType === "jaccard"
                      ? agreement.agreementScore
                      : agreement.overlapCoefficient;
                  const isDiagonal = i === j;

                  return (
                    <td
                      key={j}
                      className={`border border-gray-300 p-2 text-center text-xs font-medium cursor-pointer transition-all ${
                        isDiagonal
                          ? "bg-gray-200"
                          : getHeatmapColor(score)
                      } ${
                        hoveredCell?.i === i && hoveredCell?.j === j
                          ? "ring-2 ring-blue-500 ring-inset"
                          : ""
                      }`}
                      onMouseEnter={() => setHoveredCell({ i, j })}
                      onMouseLeave={() => setHoveredCell(null)}
                      title={
                        isDiagonal
                          ? "Self"
                          : `${p1.name} ↔ ${p2.name}\n${agreement.sharedClaims} shared / ${agreement.totalClaims} total\nJaccard: ${formatPercent(agreement.agreementScore)}\nOverlap: ${formatPercent(agreement.overlapCoefficient)}`
                      }
                    >
                      {isDiagonal ? "—" : formatPercent(score)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip for hovered cell */}
      {hoveredCell !== null && hoveredCell.i !== hoveredCell.j && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">
            {participants[hoveredCell.i].name} ↔ {participants[hoveredCell.j].name}
          </h4>
          {(() => {
            const agreement = matrix[hoveredCell.i][hoveredCell.j];
            return (
              <div className="space-y-1 text-xs text-gray-700">
                <p>
                  <span className="font-medium">Shared claims:</span> {agreement.sharedClaims}
                </p>
                <p>
                  <span className="font-medium">Total unique claims:</span> {agreement.totalClaims}
                </p>
                <p>
                  <span className="font-medium">Jaccard similarity:</span>{" "}
                  {formatPercent(agreement.agreementScore)}
                </p>
                <p>
                  <span className="font-medium">Overlap coefficient:</span>{" "}
                  {formatPercent(agreement.overlapCoefficient)}
                </p>
                {agreement.sharedClaimIds.length > 0 && (
                  <p className="mt-2">
                    <span className="font-medium">Shared claim IDs:</span>{" "}
                    <span className="text-gray-600">
                      {agreement.sharedClaimIds.slice(0, 3).join(", ")}
                      {agreement.sharedClaimIds.length > 3 && "..."}
                    </span>
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs font-medium text-gray-700 mb-2">Color Legend:</p>
        <div className="flex items-center space-x-4 text-xs text-gray-600">
          <div className="flex items-center space-x-1">
            <div className="w-4 h-4 bg-blue-100 border border-gray-300 rounded"></div>
            <span>0-20%</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-4 h-4 bg-blue-200 border border-gray-300 rounded"></div>
            <span>20-40%</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-4 h-4 bg-yellow-100 border border-gray-300 rounded"></div>
            <span>40-60%</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-4 h-4 bg-orange-200 border border-gray-300 rounded"></div>
            <span>60-80%</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-4 h-4 bg-red-300 border border-gray-300 rounded"></div>
            <span>80-100%</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          <span className="font-medium">Note:</span> Jaccard similarity = shared / union; 
          Overlap coefficient = shared / min(size₁, size₂)
        </p>
      </div>
    </div>
  );
}
