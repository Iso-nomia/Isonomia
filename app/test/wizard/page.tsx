"use client";

import React, { useState } from "react";
import DichotomicTreeWizard from "@/components/schemes/DichotomicTreeWizard";
import type { ArgumentScheme } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

/**
 * Test page for the Dichotomic Tree Wizard
 * Navigate to /test/wizard to view
 */
export default function WizardTestPage() {
  const [selectedScheme, setSelectedScheme] = useState<ArgumentScheme | null>(null);
  const [compactMode, setCompactMode] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Dichotomic Tree Wizard - Test Page
          </h1>
          <p className="text-gray-600">
            Test the argument scheme selection wizard (Phase 2, Week 5)
          </p>
          
          {/* Controls */}
          <div className="mt-4 flex gap-3">
            <Button
              variant={compactMode ? "default" : "outline"}
              onClick={() => setCompactMode(!compactMode)}
              size="sm"
            >
              {compactMode ? "Compact Mode ✓" : "Normal Mode"}
            </Button>
            
            {selectedScheme && (
              <Badge variant="secondary" className="flex items-center gap-2">
                Selected: {selectedScheme.name || selectedScheme.key}
              </Badge>
            )}
          </div>
        </div>

        {/* Wizard */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <DichotomicTreeWizard
            onSchemeSelect={(scheme) => {
              setSelectedScheme(scheme);
              console.log("Scheme selected:", scheme);
            }}
            compactMode={compactMode}
          />
        </div>

        {/* Selected scheme details */}
        {selectedScheme && (
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Selected Scheme Details
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedScheme(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-500">Scheme Key</div>
                <div className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded">
                  {selectedScheme.key}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-500">Name</div>
                <div className="mt-1 text-sm text-gray-900">
                  {selectedScheme.name || "N/A"}
                </div>
              </div>

              {selectedScheme.description && (
                <div>
                  <div className="text-sm font-medium text-gray-500">Description</div>
                  <div className="mt-1 text-sm text-gray-900">
                    {selectedScheme.description}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">Purpose</div>
                  <div className="mt-1">
                    <Badge variant={selectedScheme.purpose ? "default" : "secondary"}>
                      {selectedScheme.purpose || "Not set"}
                    </Badge>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-500">Source</div>
                  <div className="mt-1">
                    <Badge variant={selectedScheme.source ? "default" : "secondary"}>
                      {selectedScheme.source || "Not set"}
                    </Badge>
                  </div>
                </div>
              </div>

              {selectedScheme.summary && (
                <div>
                  <div className="text-sm font-medium text-gray-500">Summary</div>
                  <div className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded">
                    {selectedScheme.summary}
                  </div>
                </div>
              )}

              {/* JSON dump for debugging */}
              <details className="mt-4">
                <summary className="text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700">
                  View Full Scheme Data (JSON)
                </summary>
                <pre className="mt-2 text-xs bg-gray-900 text-gray-100 p-4 rounded overflow-auto max-h-96">
                  {JSON.stringify(selectedScheme, null, 2)}
                </pre>
              </details>
            </div>
          </Card>
        )}

        {/* Debug info */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            Development Notes
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• The wizard filters schemes by <code className="bg-blue-100 px-1 rounded">purpose</code> and <code className="bg-blue-100 px-1 rounded">source</code> fields</li>
            <li>• If no schemes appear, run the seed script to populate purpose/source data</li>
            <li>• Check console for selected scheme data</li>
            <li>• API endpoint: <code className="bg-blue-100 px-1 rounded">GET /api/schemes/all</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
