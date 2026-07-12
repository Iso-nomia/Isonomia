"use client";

/**
 * CreateCitationModal Component
 *
 * Phase 3.3: Argument-Level Citations
 *
 * Modal for creating citations between arguments:
 * - Search/browse arguments to cite
 * - Select citation type
 * - Add optional annotation
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  X,
  Check,
  MessageSquare,
  ArrowRight,
  Loader2,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArgumentCitationBadge,
  CitationTypeSelector,
} from "./ArgumentCitationBadge";
import { useCreateCitation } from "@/lib/citations/argumentCitationHooks";
import type { ArgCitationType } from "@/lib/citations/argumentCitationTypes";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface CreateCitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  citingArgumentId: string;
  citingArgumentText?: string;
  onSuccess?: () => void;
}

interface SearchableArgument {
  id: string;
  text: string;
  deliberationId?: string;
  deliberationTitle?: string;
  authorName?: string;
}

// ─────────────────────────────────────────────────────────
// Mock search function (replace with real API call)
// ─────────────────────────────────────────────────────────

async function searchArguments(query: string): Promise<SearchableArgument[]> {
  // TODO: Implement actual search API call
  // For now, return empty array - integrate with existing argument search
  if (!query.trim()) return [];
  
  // This would call your actual search API
  // const response = await fetch(`/api/arguments/search?q=${encodeURIComponent(query)}`);
  // return response.json();
  
  return [];
}

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export function CreateCitationModal({
  isOpen,
  onClose,
  citingArgumentId,
  citingArgumentText,
  onSuccess,
}: CreateCitationModalProps) {
  const [step, setStep] = React.useState<"search" | "details">("search");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<SearchableArgument[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [selectedArgument, setSelectedArgument] = React.useState<SearchableArgument | null>(null);
  const [citationType, setCitationType] = React.useState<ArgCitationType>("SUPPORT");
  const [annotation, setAnnotation] = React.useState("");

  const createMutation = useCreateCitation();

  // Search effect
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchArguments(searchQuery);
        // Filter out the citing argument itself
        setSearchResults(results.filter((r) => r.id !== citingArgumentId));
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, citingArgumentId]);

  // Reset on close
  React.useEffect(() => {
    if (!isOpen) {
      setStep("search");
      setSearchQuery("");
      setSearchResults([]);
      setSelectedArgument(null);
      setCitationType("SUPPORT");
      setAnnotation("");
    }
  }, [isOpen]);

  const handleSelectArgument = (arg: SearchableArgument) => {
    setSelectedArgument(arg);
    setStep("details");
  };

  const handleBack = () => {
    setStep("search");
    setSelectedArgument(null);
  };

  const handleSubmit = async () => {
    if (!selectedArgument) return;

    createMutation.mutate(
      {
        citingArgumentId,
        citedArgumentId: selectedArgument.id,
        citationType,
        annotation: annotation.trim() || undefined,
      },
      {
        onSuccess: () => {
          onSuccess?.();
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "search" ? "Cite an Argument" : "Citation Details"}
          </DialogTitle>
        </DialogHeader>

        {/* Source argument preview */}
        {citingArgumentText && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              From your argument:
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
              {citingArgumentText}
            </p>
          </div>
        )}

        {step === "search" ? (
          <div className="space-y-4">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search arguments to cite..."
                className="pl-9"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
              )}
            </div>

            {/* Search results */}
            <div className="min-h-[200px] max-h-[300px] overflow-y-auto">
              {searchResults.length === 0 && searchQuery.length >= 2 && !isSearching ? (
                <div className="py-8 text-center text-gray-500">
                  <p className="text-sm">No arguments found</p>
                  <p className="text-xs mt-1">Try a different search term</p>
                </div>
              ) : searchQuery.length < 2 ? (
                <div className="py-8 text-center text-gray-500">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Start typing to search arguments</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((arg) => (
                    <button
                      key={arg.id}
                      onClick={() => handleSelectArgument(arg)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-colors",
                        "border-gray-200 hover:border-blue-300 hover:bg-blue-50",
                        "dark:border-gray-700 dark:hover:border-blue-600 dark:hover:bg-blue-900/20"
                      )}
                    >
                      <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                        {arg.text}
                      </p>
                      {arg.deliberationTitle && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          in {arg.deliberationTitle}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Selected argument */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-1">
                <ArrowRight className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  Citing:
                </span>
              </div>
              <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                {selectedArgument?.text}
              </p>
              {selectedArgument?.deliberationTitle && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  in {selectedArgument.deliberationTitle}
                </p>
              )}
            </div>

            {/* Citation type */}
            <div className="space-y-2">
              <Label>Citation Type</Label>
              <CitationTypeSelector
                value={citationType}
                onChange={setCitationType}
                size="sm"
              />
            </div>

            {/* Annotation */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Annotation
                <span className="text-xs text-gray-400">(optional)</span>
              </Label>
              <Textarea
                value={annotation}
                onChange={(e) => setAnnotation(e.target.value)}
                placeholder="Why are you citing this argument?"
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          {step === "details" && (
            <Button variant="ghost" onClick={handleBack}>
              Back
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {step === "details" && (
              <Button
                onClick={handleSubmit}
                disabled={!selectedArgument || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Create Citation
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────
// Quick Cite Button
// ─────────────────────────────────────────────────────────

export interface QuickCiteButtonProps {
  citingArgumentId: string;
  citingArgumentText?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "sm" | "md";
  className?: string;
}

export function QuickCiteButton({
  citingArgumentId,
  citingArgumentText,
  variant = "ghost",
  size = "sm",
  className,
}: QuickCiteButtonProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        title="Quickly cite another argument from this one"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-all cursor-pointer text-xs font-medium text-indigo-700 ${className ?? ""}`}
      >
        <Quote className="w-3 h-3" />
        Quick Cite
      </button>

      <CreateCitationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        citingArgumentId={citingArgumentId}
        citingArgumentText={citingArgumentText}
      />
    </>
  );
}

export default CreateCitationModal;
