"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function StylingLegend() {
  return (
    <Card className="p-4 space-y-4">
      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Scheme Roles</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <Badge className="bg-sky-100 text-sky-800 border-sky-300">Primary</Badge>
            <span className="text-gray-600">Main conclusion</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-800 border-green-300">
              Supporting
            </Badge>
            <span className="text-gray-600">Supports main</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-100 text-purple-800 border-purple-300">
              Subordinate
            </Badge>
            <span className="text-gray-600">Sub-argument</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Dependency Types</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-red-500"></div>
            <span className="text-gray-600">Prerequisite</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-green-500"></div>
            <span className="text-gray-600">Supporting</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-sky-500"></div>
            <span className="text-gray-600">Enabling</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-gray-400 border-dashed border-t-2"></div>
            <span className="text-gray-600">Background</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Explicitness</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-600">Explicit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-gray-600">Semi-explicit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-gray-600">Implicit</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Special Markers</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-yellow-700">⭐</span>
            <span className="text-gray-600">Critical path</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-red-600">⚠️</span>
            <span className="text-gray-600">In cycle</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
