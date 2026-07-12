/**
 * Phase 5.1: Detailed view of an academic field
 */

"use client";

import { useField, useConceptsByField } from "@/lib/crossfield/hooks";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Link2, FileText } from "lucide-react";
import { ConceptCard } from "./ConceptCard";

interface FieldDetailProps {
  fieldId: string;
  onConceptSelect?: (conceptId: string) => void;
}

export function FieldDetail({ fieldId, onConceptSelect }: FieldDetailProps) {
  const { data: field, isLoading: fieldLoading } = useField(fieldId);
  const { data: concepts, isLoading: conceptsLoading } =
    useConceptsByField(fieldId);

  if (fieldLoading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="h-4 bg-gray-200 rounded w-full mb-2" />
        <div className="h-4 bg-gray-200 rounded w-2/3" />
      </div>
    );
  }

  if (!field) {
    return (
      <div className="p-6 text-center text-gray-500">
        Select a field to view details
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-2xl font-bold text-gray-900">{field.name}</h2>
          <EpistemicBadge style={field.epistemicStyle} />
        </div>

        {field.description && (
          <p className="text-gray-600">{field.description}</p>
        )}

        {field.parent && (
          <p className="text-sm text-gray-500 mt-2">
            Part of: <span className="font-medium">{field.parent.name}</span>
          </p>
        )}

        {/* Key terms */}
        {field.keyTerms.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {field.keyTerms.map((term) => (
              <Badge key={term} variant="outline" className="text-xs">
                {term}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="concepts">
        <TabsList className="mb-4">
          <TabsTrigger value="concepts" className="gap-2">
            <BookOpen className="w-4 h-4" />
            Concepts ({concepts?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="subfields" className="gap-2">
            <FileText className="w-4 h-4" />
            Subfields ({field.subFields.length})
          </TabsTrigger>
          <TabsTrigger value="related" className="gap-2">
            <Link2 className="w-4 h-4" />
            Related ({field.relatedFields.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="concepts">
          {conceptsLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-100 rounded" />
              ))}
            </div>
          ) : concepts && concepts.length > 0 ? (
            <div className="space-y-3">
              {concepts.map((concept) => (
                <ConceptCard
                  key={concept.id}
                  concept={concept}
                  onClick={() => onConceptSelect?.(concept.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No concepts defined yet for this field
            </p>
          )}
        </TabsContent>

        <TabsContent value="subfields">
          {field.subFields.length > 0 ? (
            <div className="grid gap-3">
              {field.subFields.map((sub) => (
                <div
                  key={sub.id}
                  className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <div className="font-medium">{sub.name}</div>
                  <div className="text-sm text-gray-500">
                    {sub.claimCount} claims · {sub.conceptCount} concepts
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No subfields</p>
          )}
        </TabsContent>

        <TabsContent value="related">
          {field.relatedFields.length > 0 ? (
            <div className="grid gap-3">
              {field.relatedFields.map((rel) => (
                <div
                  key={rel.field.id}
                  className="p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{rel.field.name}</span>
                    <Badge variant="outline">
                      {formatRelationType(rel.relationType)}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Strength: {Math.round(rel.strength * 100)}%
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No related fields mapped
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EpistemicBadge({ style }: { style: string }) {
  const colors: Record<string, string> = {
    EMPIRICAL: "bg-green-100 text-green-800",
    INTERPRETIVE: "bg-purple-100 text-purple-800",
    FORMAL: "bg-blue-100 text-blue-800",
    NORMATIVE: "bg-orange-100 text-orange-800",
    HISTORICAL: "bg-amber-100 text-amber-800",
    MIXED: "bg-gray-100 text-gray-800",
  };

  return (
    <Badge className={colors[style] || colors.MIXED}>
      {style.toLowerCase()}
    </Badge>
  );
}

function formatRelationType(type: string): string {
  return type.replace(/_/g, " ").toLowerCase();
}
