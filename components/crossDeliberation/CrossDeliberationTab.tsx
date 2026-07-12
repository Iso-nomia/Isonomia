"use client";

import React, { useState } from "react";
import { Globe, Users, ArrowRight, FileText, Link2, Loader2 } from "lucide-react";
import CrossRoomSearchPanel from "@/components/crossDeliberation/CrossRoomSearchPanel";
import ArgumentImportModal from "@/components/crossDeliberation/ArgumentImportModal";
import { useRelatedDeliberations, useClaimCrossRoomStatus } from "@/lib/crossDeliberation/hooks";
import { CrossRoomSearchResult } from "@/lib/crossDeliberation/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface CrossDeliberationTabProps {
  deliberationId: string;
  currentUserId?: string;
}

export function CrossDeliberationTab({
  deliberationId,
  currentUserId,
}: CrossDeliberationTabProps) {
  const [selectedImportSource, setSelectedImportSource] = useState<{
    argumentId: string;
    argumentText: string;
    authorName: string;
    deliberationId: string;
    deliberationTitle: string;
  } | null>(null);

  const handleClaimSelect = (result: CrossRoomSearchResult) => {
    // When a claim is selected from cross-room search, we could:
    // 1. Show the instances in different deliberations
    // 2. Allow importing arguments that use this claim
    console.log("Selected cross-room result:", result);
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-600" />
          Search Across Deliberations
        </h3>
        <CrossRoomSearchPanel
          currentDeliberationId={deliberationId}
          onSelectClaim={handleClaimSelect}
        />
      </section>

      {/* Related Deliberations Section */}
      <section>
        <RelatedDeliberationsSection deliberationId={deliberationId} />
      </section>

      {/* Import Modal */}
      {selectedImportSource && (
        <ArgumentImportModal
          isOpen={!!selectedImportSource}
          onClose={() => setSelectedImportSource(null)}
          sourceArgument={{
            id: selectedImportSource.argumentId,
            summary: selectedImportSource.argumentText,
            author: { name: selectedImportSource.authorName },
            deliberation: {
              id: selectedImportSource.deliberationId,
              title: selectedImportSource.deliberationTitle,
            },
          }}
          targetDeliberationId={deliberationId}
        />
      )}
    </div>
  );
}

function RelatedDeliberationsSection({
  deliberationId,
}: {
  deliberationId: string;
}) {
  const { data: related, isLoading } = useRelatedDeliberations(deliberationId);

  if (isLoading) {
    return (
      <div className="p-4 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading related deliberations...</span>
        </div>
      </div>
    );
  }

  if (!related || related.length === 0) {
    return (
      <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="w-4 h-4 text-gray-400" />
          <h4 className="text-sm font-medium text-gray-700">
            Related Deliberations
          </h4>
        </div>
        <p className="text-sm text-gray-500">
          No related deliberations found. As claims in this deliberation are
          linked to the canonical registry, related deliberations will appear
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-semibold text-gray-900">
            Related Deliberations
          </h4>
          <span className="text-xs text-gray-500 ml-auto">
            {related.length} found
          </span>
        </div>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {related.map(
          (item: {
            deliberation: { id: string; title: string };
            sharedClaimCount: number;
            sharedClaims: Array<{ id: string; text: string }>;
            relationshipStrength: number;
          }) => (
            <AccordionItem
              key={item.deliberation.id}
              value={item.deliberation.id}
            >
              <AccordionTrigger className="px-4 py-2 hover:no-underline hover:bg-gray-50">
                <div className="flex items-center justify-between w-full pr-2">
                  <span className="text-sm font-medium text-gray-900 text-left">
                    {item.deliberation.title}
                  </span>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {item.sharedClaimCount} shared
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded ${
                        item.relationshipStrength > 0.7
                          ? "bg-green-100 text-green-700"
                          : item.relationshipStrength > 0.3
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {(item.relationshipStrength * 100).toFixed(0)}% related
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3">
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium">
                    Shared claims:
                  </p>
                  <ul className="space-y-1">
                    {item.sharedClaims.slice(0, 5).map((claim) => (
                      <li
                        key={claim.id}
                        className="text-xs text-gray-700 p-2 bg-gray-50 rounded"
                      >
                        {claim.text}
                      </li>
                    ))}
                    {item.sharedClaims.length > 5 && (
                      <li className="text-xs text-gray-500 italic">
                        ...and {item.sharedClaims.length - 5} more
                      </li>
                    )}
                  </ul>
                  <a
                    href={`/room/${item.deliberation.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2"
                  >
                    Visit deliberation
                    <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        )}
      </Accordion>
    </div>
  );
}

export default CrossDeliberationTab;
