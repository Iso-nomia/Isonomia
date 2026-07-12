"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import type { ArgumentScheme } from "@prisma/client";
import type { Purpose, Source } from "@/lib/schemes/dichotomic-tree";
import {
  filterSchemesByPurposeAndSource,
  getMatchReason,
  purposeOptions,
  sourceOptions
} from "@/lib/schemes/dichotomic-tree";

interface ResultsStepProps {
  purpose: Purpose;
  source: Source;
  onSchemeSelect: (scheme: ArgumentScheme) => void;
  onBack: () => void;
  onReset: () => void;
  compact?: boolean;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ResultsStep({
  purpose,
  source,
  onSchemeSelect,
  onBack,
  onReset,
  compact = false
}: ResultsStepProps) {
  const { data: schemes, isLoading, error } = useSWR<ArgumentScheme[]>(
    "/api/schemes/all",
    fetcher
  );

  const filteredSchemes = useMemo(() => {
    if (!schemes) return [];
    return filterSchemesByPurposeAndSource(schemes, purpose, source);
  }, [schemes, purpose, source]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600" />
        <p className="mt-4 text-gray-600">Loading schemes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">Error loading schemes</div>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (filteredSchemes.length === 0) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <Card className="p-8 text-center">
          <div className="text-6xl mb-4">🤔</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No schemes found
          </h3>
          <p className="text-gray-600 mb-6">
            We couldn&apos;t find any schemes matching your selections. Try different options.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={onBack} variant="outline">
              Change Evidence Type
            </Button>
            <Button onClick={onReset} variant="default">
              Start Over
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button variant="ghost" onClick={onReset} className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4" />
          Start Over
        </Button>
      </div>

      {/* Results header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-50 rounded-full">
            <span className="text-xl">{purposeOptions[purpose].icon}</span>
            <span className="text-sm font-medium text-sky-700">
              {purposeOptions[purpose].label}
            </span>
          </div>
          <span className="text-gray-400">+</span>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-50 rounded-full">
            <span className="text-xl">{sourceOptions[source].icon}</span>
            <span className="text-sm font-medium text-sky-700">
              {sourceOptions[source].label}
            </span>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900">
          Found {filteredSchemes.length} matching scheme{filteredSchemes.length !== 1 ? "s" : ""}
        </h2>
        <p className="mt-2 text-gray-600">
          Select a scheme to use in your argument
        </p>
      </div>

      {/* Results list */}
      <div className="space-y-4">
        {filteredSchemes.map(scheme => (
          <SchemeResultCard
            key={scheme.id}
            scheme={scheme}
            purpose={purpose}
            source={source}
            onSelect={onSchemeSelect}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

interface SchemeResultCardProps {
  scheme: ArgumentScheme;
  purpose: Purpose;
  source: Source;
  onSelect: (scheme: ArgumentScheme) => void;
  compact?: boolean;
}

function SchemeResultCard({
  scheme,
  purpose,
  source,
  onSelect,
  compact = false
}: SchemeResultCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const matchReason = getMatchReason(scheme, purpose, source);

  // Determine match quality
  const isPerfectMatch = scheme.purpose === purpose && scheme.source === source;
  const matchColor = isPerfectMatch ? "green" : "sky";

  return (
    <Card className="p-5 cardv2  transition-shadow">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              {scheme.name || scheme.key}
            </h3>
            {scheme.description && (
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                {scheme.description}
              </p>
            )}
          </div>

          <Badge
            variant={isPerfectMatch ? "default" : "secondary"}
            className={isPerfectMatch ? "bg-green-600" : ""}
          >
            {isPerfectMatch ? "Perfect Match" : "Good Match"}
          </Badge>
        </div>

        {/* Match reason */}
        <div className={`text-xs px-3 py-1.5 rounded-md bg-${matchColor}-50 text-${matchColor}-700`}>
          {matchReason}
        </div>

        {/* Details toggle */}
        {!compact && scheme.summary && (
          <div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700"
            >
              {showDetails ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show Details
                </>
              )}
            </button>

            {showDetails && (
              <div className="mt-3 p-4 bg-white rounded-md">
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {scheme.summary}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Select button */}
        <button
          onClick={() => onSelect(scheme)}
          className="w-full tracking-wide bg-white menuv2--lite px-3 py-2 text-sm rounded-lg"
          
        >
          Select This Scheme
        </button>
      </div>
    </Card>
  );
}
