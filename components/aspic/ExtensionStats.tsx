// components/aspic/ExtensionStats.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface ExtensionStatsProps {
  inCount: number;
  outCount: number;
  undecCount: number;
  totalCount: number;
}

export function ExtensionStats({ inCount, outCount, undecCount, totalCount }: ExtensionStatsProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{totalCount}</span> total arguments
          </div>
          
          <div className="flex items-center gap-6">
            {/* IN Arguments */}
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-green-600">{inCount}</div>
                <div className="text-xs text-gray-500">Justified</div>
              </div>
            </div>

            {/* OUT Arguments */}
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <div className="text-2xl font-bold text-red-600">{outCount}</div>
                <div className="text-xs text-gray-500">Defeated</div>
              </div>
            </div>

            {/* UNDEC Arguments */}
            {undecCount > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <div>
                  <div className="text-2xl font-bold text-amber-600">{undecCount}</div>
                  <div className="text-xs text-gray-500">Undecided</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
