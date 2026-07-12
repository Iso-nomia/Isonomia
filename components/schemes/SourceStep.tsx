"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { Purpose, Source } from "@/lib/schemes/dichotomic-tree";
import { sourceOptions, purposeOptions, getPurposeExplanation } from "@/lib/schemes/dichotomic-tree";

interface SourceStepProps {
  purpose: Purpose;
  onSelect: (source: Source) => void;
  onBack: () => void;
  compact?: boolean;
}

export default function SourceStep({ purpose, onSelect, onBack, compact = false }: SourceStepProps) {
  const purposeContext = getPurposeExplanation(purpose);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={onBack}
        className="flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Purpose
      </Button>

      {/* Step header with context */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-sky-50 rounded-full mb-4">
          <span className="text-2xl">{purposeOptions[purpose].icon}</span>
          <span className="text-sm font-medium text-sky-700">
            {purposeOptions[purpose].label}
          </span>
        </div>

        <h2 className="text-2xl font-bold text-gray-900">
          What kind of evidence are you using?
        </h2>
        <p className="mt-2 text-gray-600">
          {purposeContext}
        </p>
      </div>

      {/* Source options */}
      <div className={`grid gap-4 ${compact ? "grid-cols-1" : "md:grid-cols-2"}`}>
        {(Object.entries(sourceOptions) as [Source, typeof sourceOptions[Source]][]).map(
          ([key, option]) => (
            <Card
              key={key}
              className="p-6 cardv2 cursor-pointer group"
              onClick={() => onSelect(key)}
            >
              <div className="flex flex-col h-full">
                {/* Icon and label */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-3xl">{option.icon}</div>
                  <h3 className="text-xl font-semibold text-gray-900 group-hover:text-sky-600">
                    {option.label}
                  </h3>
                </div>

                {/* Help text */}
                <p className="text-sm text-gray-600 mb-2 flex-grow">
                  {option.helpText}
                </p>

                {/* Examples */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-500 uppercase">
                    Examples:
                  </div>
                  <ul className="space-y-1.5">
                    {option.examples.map((example, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-sky-500 mt-1">•</span>
                        <span className="italic">&ldquo;{example}&rdquo;</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Select button (appears on hover) */}
                <div className="mt-4 opacity-90 group-hover:opacity-100 transition-opacity">
                  <button className="w-full text-sm rounded-xl px-3 py-2  bg-indigo-100/60" >
                    Select: {option.label}
                  </button>
                </div>
              </div>
            </Card>
          )
        )}
      </div>

      {/* Help text */}
      {!compact && (
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">
            <strong>Not sure?</strong> Think about where your argument&apos;s strength comes from:
            <ul className="mt-2 ml-4 space-y-1">
              <li>• Choose <strong>Internal</strong> if your argument relies on logic, definitions, analogies, or consequences</li>
              <li>• Choose <strong>External</strong> if your argument relies on experts, witnesses, tradition, or empirical data</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
