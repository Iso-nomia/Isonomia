"use client";

import React, { useState } from "react";
import type { LudicsInsights } from "@/lib/ludics/computeInsights";

/**
 * InsightsTooltip - Detailed Ludics metrics popover
 * Phase 1: Task 2.2
 */

interface InsightsTooltipProps {
  insights: LudicsInsights;
  children: React.ReactNode;
}

export function InsightsTooltip({ insights, children }: InsightsTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        tabIndex={0}
        className="cursor-help"
      >
        {children}
      </div>

      {isOpen && (
        <div
          className="absolute z-50 w-80 p-4 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl
                     left-0 top-full"
          role="tooltip"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 text-sm">
              Ludics Interaction Metrics
            </h3>
            <span
              className={`
                px-2 py-0.5 rounded-full text-xs font-medium
                ${
                  insights.interactionComplexity >= 70
                    ? "bg-red-100 text-red-700"
                    : insights.interactionComplexity >= 40
                    ? "bg-amber-100 text-amber-700"
                    : "bg-green-100 text-green-700"
                }
              `}
            >
              {insights.interactionComplexity}/100
            </span>
          </div>

          {/* Metrics Grid */}
          <div className="space-y-3 text-sm">
            {/* Structure Metrics */}
            <div>
              <div className="font-medium text-gray-700 mb-1.5 text-xs uppercase tracking-wide">
                Structure
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MetricItem label="Total Acts" value={insights.totalActs} />
                <MetricItem label="Loci" value={insights.totalLoci} />
                <MetricItem label="Max Depth" value={insights.maxDepth} />
                <MetricItem
                  label="Avg Branches"
                  value={insights.branchFactor.toFixed(2)}
                />
              </div>
            </div>

            {/* Polarity Distribution */}
            <div>
              <div className="font-medium text-gray-700 mb-1.5 text-xs uppercase tracking-wide">
                Polarity
              </div>
              <div className="flex gap-2">
                <div className="flex-1 bg-sky-50 rounded px-2 py-1.5">
                  <div className="text-sky-600 font-semibold">
                    ⊕ {insights.polarityDistribution.positive}
                  </div>
                  <div className="text-xs text-sky-500">Positive</div>
                </div>
                <div className="flex-1 bg-purple-50 rounded px-2 py-1.5">
                  <div className="text-purple-600 font-semibold">
                    ⊖ {insights.polarityDistribution.negative}
                  </div>
                  <div className="text-xs text-purple-500">Negative</div>
                </div>
                {insights.polarityDistribution.neutral > 0 && (
                  <div className="flex-1 bg-gray-50 rounded px-2 py-1.5">
                    <div className="text-gray-600 font-semibold">
                      • {insights.polarityDistribution.neutral}
                    </div>
                    <div className="text-xs text-gray-500">Neutral</div>
                  </div>
                )}
              </div>
            </div>

            {/* Role Distribution */}
            <div>
              <div className="font-medium text-gray-700 mb-1.5 text-xs uppercase tracking-wide">
                Roles
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MetricItem
                  label="Opener"
                  value={insights.locusRoleDistribution.opener}
                  color="sky"
                />
                <MetricItem
                  label="Responder"
                  value={insights.locusRoleDistribution.responder}
                  color="purple"
                />
                <MetricItem
                  label="Daimon"
                  value={insights.daimonCount}
                  color="gray"
                />
                {insights.hasOrthogonality && (
                  <div className="col-span-2 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                    Contains orthogonality
                  </div>
                )}
              </div>
            </div>

            {/* Top Active Loci */}
            {insights.topLociByActivity.length > 0 && (
              <div>
                <div className="font-medium text-gray-700 mb-1.5 text-xs uppercase tracking-wide">
                  Most Active Loci
                </div>
                <div className="space-y-1">
                  {insights.topLociByActivity.slice(0, 3).map((locus, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-gray-50 rounded px-2 py-1"
                    >
                      <span className="font-mono text-xs text-gray-700">
                        {locus.path}
                      </span>
                      <span className="text-xs text-gray-500">
                        {locus.actCount} acts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
            Computed from Ludics interaction tree
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Helper component for metric display
 */
interface MetricItemProps {
  label: string;
  value: string | number;
  color?: "sky" | "purple" | "gray" | "amber";
}

function MetricItem({ label, value, color }: MetricItemProps) {
  const colorClasses = {
    sky: "text-sky-600",
    purple: "text-purple-600",
    gray: "text-gray-600",
    amber: "text-amber-600",
  };

  return (
    <div className="bg-gray-50 rounded px-2 py-1.5">
      <div className={`font-semibold ${color ? colorClasses[color] : "text-gray-900"}`}>
        {value}
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
