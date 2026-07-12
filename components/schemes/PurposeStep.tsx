"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Purpose } from "@/lib/schemes/dichotomic-tree";
import { purposeOptions } from "@/lib/schemes/dichotomic-tree";

interface PurposeStepProps {
  onSelect: (purpose: Purpose) => void;
  compact?: boolean;
}

export default function PurposeStep({ onSelect, compact = false }: PurposeStepProps) {
  return (
    <div className="space-y-5">
      {/* Step header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          What are you trying to do?
        </h2>
        <p className="mt-2 text-gray-600">
          Select the primary goal of your argument
        </p>
      </div>

      {/* Purpose options */}
      <div className={`grid gap-4 ${compact ? "grid-cols-1" : "md:grid-cols-2"}`}>
        {(Object.entries(purposeOptions) as [Purpose, typeof purposeOptions[Purpose]][]).map(
          ([key, option]) => (
            <Card
              key={key}
              className="p-6 cardv2 transition-all cursor-pointer group"
              onClick={() => onSelect(key)}
            >
              <div className="flex flex-col h-full">
                {/* Icon and label */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-4xl">{option.icon}</div>
                  <h3 className="text-xl font-semibold text-gray-900 group-hover:text-sky-600">
                    {option.label}
                  </h3>
                </div>

                {/* Help text */}
                <p className="text-sm text-gray-600 mb-4 flex-grow">
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
            <strong>Not sure?</strong> Think about what you want your audience to do after hearing your argument:
            <ul className="mt-2 ml-4 space-y-1">
              <li>• If you want them to <strong>take action</strong> or make a <strong>decision</strong>, choose &ldquo;Justify an Action&rdquo;</li>
              <li>• If you want them to <strong>understand</strong> or <strong>believe</strong> something, choose &ldquo;Describe a State of Affairs&rdquo;</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
