/**
 * Phase 5.1: Detailed concept view with equivalences
 */

"use client";

import { useState } from "react";
import {
  useConcept,
  useSimilarConcepts,
  useProposeEquivalence,
} from "@/lib/crossfield/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ArrowRight, Loader2 } from "lucide-react";
import {
  ConceptEquivalenceType,
  ConceptSummary,
} from "@/lib/crossfield/types";
import { ConceptCard } from "./ConceptCard";

interface ConceptDetailProps {
  conceptId: string;
}

export function ConceptDetail({ conceptId }: ConceptDetailProps) {
  const { data: concept, isLoading } = useConcept(conceptId);
  const { data: similarConcepts } = useSimilarConcepts(conceptId);

  if (isLoading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="h-4 bg-gray-200 rounded w-full mb-2" />
        <div className="h-4 bg-gray-200 rounded w-2/3" />
      </div>
    );
  }

  if (!concept) {
    return (
      <div className="p-6 text-center text-gray-500">Concept not found</div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <span>{concept.field.name}</span>
          <Badge variant="outline" className="text-xs">
            {concept.field.epistemicStyle.toLowerCase()}
          </Badge>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">{concept.name}</h2>

        <p className="text-gray-700 mt-3">{concept.definition}</p>

        {/* Aliases */}
        {concept.aliases.length > 0 && (
          <div className="mt-4">
            <span className="text-sm text-gray-500 mr-2">Also known as:</span>
            <div className="inline-flex flex-wrap gap-1">
              {concept.aliases.map((alias) => (
                <Badge key={alias} variant="outline">
                  {alias}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Related terms */}
        {concept.relatedTerms.length > 0 && (
          <div className="mt-2">
            <span className="text-sm text-gray-500 mr-2">Related terms:</span>
            <span className="text-sm text-gray-700">
              {concept.relatedTerms.join(", ")}
            </span>
          </div>
        )}
      </div>

      {/* Equivalences */}
      <div className="border-t pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Cross-Field Equivalences</h3>
          <ProposeEquivalenceDialog
            sourceConcept={{
              id: concept.id,
              name: concept.name,
              definition: concept.definition,
              fieldId: concept.field.id,
              fieldName: concept.field.name,
              aliases: concept.aliases,
              equivalenceCount: concept.equivalences.length,
              claimCount: 0,
            }}
          />
        </div>

        {concept.equivalences.length > 0 ? (
          <div className="space-y-3">
            {concept.equivalences.map((eq, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {eq.targetConcept.name}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {eq.targetConcept.fieldName}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                    {eq.targetConcept.definition}
                  </p>
                </div>
                <div className="text-right">
                  <Badge className={getEquivalenceColor(eq.equivalenceType)}>
                    {eq.equivalenceType.toLowerCase().replace("_", " ")}
                  </Badge>
                  <div className="text-xs text-gray-500 mt-1">
                    {Math.round(eq.confidence * 100)}% confidence
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-6">
            No cross-field equivalences established yet
          </p>
        )}
      </div>

      {/* Similar concepts (suggestions) */}
      {similarConcepts && similarConcepts.length > 0 && (
        <div className="border-t pt-6 mt-6">
          <h3 className="font-semibold text-lg mb-4">
            Potentially Related Concepts
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Concepts from other fields with similar embeddings
          </p>
          <div className="space-y-3">
            {similarConcepts.slice(0, 5).map((sim) => (
              <div
                key={sim.concept.id}
                className="flex items-center gap-4 p-3 border rounded-lg bg-blue-50/50"
              >
                <div className="flex-1">
                  <ConceptCard concept={sim.concept} showField />
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-medium text-blue-600">
                    {Math.round(sim.similarity * 100)}% similar
                  </div>
                  <div className="mt-1">
                    <ProposeEquivalenceDialog
                      sourceConcept={{
                        id: concept.id,
                        name: concept.name,
                        definition: concept.definition,
                        fieldId: concept.field.id,
                        fieldName: concept.field.name,
                        aliases: concept.aliases,
                        equivalenceCount: concept.equivalences.length,
                        claimCount: 0,
                      }}
                      targetConcept={sim.concept}
                      suggestedType={getSuggestedType(sim.similarity)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getEquivalenceColor(type: ConceptEquivalenceType): string {
  const colors: Record<ConceptEquivalenceType, string> = {
    IDENTICAL: "bg-green-100 text-green-800",
    SIMILAR: "bg-blue-100 text-blue-800",
    OVERLAPPING: "bg-purple-100 text-purple-800",
    RELATED: "bg-gray-100 text-gray-800",
    TRANSLATES_TO: "bg-amber-100 text-amber-800",
    CONTRASTING: "bg-red-100 text-red-800",
  };
  return colors[type];
}

function getSuggestedType(similarity: number): ConceptEquivalenceType {
  if (similarity >= 0.95) return "IDENTICAL";
  if (similarity >= 0.85) return "SIMILAR";
  if (similarity >= 0.75) return "OVERLAPPING";
  return "RELATED";
}

// ============================================================
// Propose Equivalence Dialog
// ============================================================

interface ProposeEquivalenceDialogProps {
  sourceConcept: ConceptSummary;
  targetConcept?: ConceptSummary;
  suggestedType?: ConceptEquivalenceType;
}

function ProposeEquivalenceDialog({
  sourceConcept,
  targetConcept,
  suggestedType = "SIMILAR",
}: ProposeEquivalenceDialogProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ConceptEquivalenceType>(suggestedType);
  const [justification, setJustification] = useState("");

  const { mutate: propose, isPending } = useProposeEquivalence();

  const handleSubmit = () => {
    if (!targetConcept) return;

    propose(
      {
        sourceConceptId: sourceConcept.id,
        targetConceptId: targetConcept.id,
        equivalenceType: type,
        justification,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setJustification("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-1" />
          {targetConcept ? "Link" : "Propose Link"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Propose Concept Equivalence</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Source */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Source Concept</div>
            <div className="font-medium">{sourceConcept.name}</div>
            <div className="text-sm text-gray-500">
              {sourceConcept.fieldName}
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>

          {/* Target */}
          {targetConcept ? (
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Target Concept</div>
              <div className="font-medium">{targetConcept.name}</div>
              <div className="text-sm text-gray-500">
                {targetConcept.fieldName}
              </div>
            </div>
          ) : (
            <div className="p-3 border-2 border-dashed rounded-lg text-center text-gray-400">
              Select a target concept
            </div>
          )}

          {/* Equivalence type */}
          <div>
            <label className="text-sm font-medium block mb-2">
              Equivalence Type
            </label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as ConceptEquivalenceType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IDENTICAL">
                  Identical (same concept)
                </SelectItem>
                <SelectItem value="SIMILAR">
                  Similar (minor differences)
                </SelectItem>
                <SelectItem value="OVERLAPPING">
                  Overlapping (partial)
                </SelectItem>
                <SelectItem value="RELATED">
                  Related (linked but distinct)
                </SelectItem>
                <SelectItem value="TRANSLATES_TO">
                  Translates to (with caveats)
                </SelectItem>
                <SelectItem value="CONTRASTING">
                  Contrasting (intentionally different)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Justification */}
          <div>
            <label className="text-sm font-medium block mb-2">
              Justification
            </label>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain why these concepts are equivalent..."
              rows={4}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!targetConcept || !justification || isPending}
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Propose
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
