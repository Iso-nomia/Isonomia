"use client";

/**
 * ClaimExtractionPanel - AI-Assisted Claim Extraction UI
 * 
 * Phase 1.1: Paper-to-Claim Pipeline
 * 
 * Provides interface for extracting claims from sources using AI,
 * with review, edit, and batch creation capabilities.
 */

import * as React from "react";
import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AcademicClaimType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Edit2,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
  FileText,
  Quote,
  DollarSign,
} from "lucide-react";
import { ClaimTypeSelector, ClaimTypeBadge, CLAIM_TYPE_INFO } from "./ClaimTypeSelector";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────
// AlertDialog (shadcn-style wrappers over Radix; the shared
// @/components/ui/alert-dialog module is not present in this repo)
// ─────────────────────────────────────────────────────────
const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Portal>
    <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-white p-6 shadow-lg rounded-lg",
        className,
      )}
      {...props}
    />
  </AlertDialogPrimitive.Portal>
));
AlertDialogContent.displayName = "AlertDialogContent";

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
));
AlertDialogTitle.displayName = "AlertDialogTitle";

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
AlertDialogDescription.displayName = "AlertDialogDescription";

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn("inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground", className)} {...props} />
));
AlertDialogAction.displayName = "AlertDialogAction";

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel ref={ref} className={cn("mt-2 inline-flex h-9 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium sm:mt-0", className)} {...props} />
));
AlertDialogCancel.displayName = "AlertDialogCancel";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface ExtractedClaim {
  text: string;
  claimType: AcademicClaimType;
  supportingQuote?: string;
  pageNumber?: number;
  sectionName?: string;
  confidence: number;
  reasoning: string;
}

interface ClaimExtractionPanelProps {
  sourceId: string;
  sourceTitle: string;
  hasAbstract: boolean;
  abstractText?: string;
  onClaimsCreated?: (claimIds: string[]) => void;
}

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────

export function ClaimExtractionPanel({
  sourceId,
  sourceTitle,
  hasAbstract,
  abstractText,
  onClaimsCreated,
}: ClaimExtractionPanelProps) {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [extractionMode, setExtractionMode] = useState<"abstract" | "fulltext">("abstract");
  const [fulltext, setFulltext] = useState("");
  const [suggestions, setSuggestions] = useState<ExtractedClaim[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showCostWarning, setShowCostWarning] = useState(false);
  const queryClient = useQueryClient();

  // ─────────────────────────────────────────────────────────
  // AI Extraction Mutation
  // ─────────────────────────────────────────────────────────

  const extractMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/claims/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId,
          mode: extractionMode,
          fulltext: extractionMode === "fulltext" ? fulltext : undefined,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Extraction failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions);
      // Auto-select high-confidence claims (>= 0.7)
      const highConfidence = new Set<number>();
      data.suggestions.forEach((s: ExtractedClaim, i: number) => {
        if (s.confidence >= 0.7) highConfidence.add(i);
      });
      setSelectedIndices(highConfidence);
    },
  });

  // ─────────────────────────────────────────────────────────
  // Create Claims Mutation
  // ─────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (claims: ExtractedClaim[]) => {
      const response = await fetch("/api/claims/academic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId,
          claims: claims.map((c) => ({
            text: c.text,
            academicClaimType: c.claimType,
            sectionName: c.sectionName,
            pageNumber: c.pageNumber,
            supportingQuote: c.supportingQuote,
            extractedByAI: true,
            aiConfidence: c.confidence,
          })),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create claims");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["source", sourceId] });
      queryClient.invalidateQueries({ queryKey: ["claims", sourceId] });
      onClaimsCreated?.(data.claims.map((c: any) => c.id));
      setSuggestions([]);
      setSelectedIndices(new Set());
    },
  });

  // ─────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────

  const handleExtract = useCallback(() => {
    // Show cost warning before extraction
    setShowCostWarning(true);
  }, []);

  const confirmExtraction = useCallback(() => {
    setShowCostWarning(false);
    extractMutation.mutate();
  }, [extractMutation]);

  const handleToggleSuggestion = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIndices(new Set(suggestions.map((_, i) => i)));
  }, [suggestions]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const handleEditSuggestion = useCallback((index: number, updates: Partial<ExtractedClaim>) => {
    setSuggestions((prev) => {
      const newSuggestions = [...prev];
      newSuggestions[index] = { ...newSuggestions[index], ...updates };
      return newSuggestions;
    });
    setEditingIndex(null);
  }, []);

  const handleRemoveSuggestion = useCallback((index: number) => {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndices((prev) => {
      const newSet = new Set<number>();
      prev.forEach((i) => {
        if (i < index) newSet.add(i);
        else if (i > index) newSet.add(i - 1);
      });
      return newSet;
    });
  }, []);

  const handleCreateSelected = useCallback(() => {
    const selectedClaims = suggestions.filter((_, i) => selectedIndices.has(i));
    if (selectedClaims.length > 0) {
      createMutation.mutate(selectedClaims);
    }
  }, [suggestions, selectedIndices, createMutation]);

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          Extract Claims from Source
        </CardTitle>
        <CardDescription>
          Use AI to identify claims or add them manually
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mode Selection */}
        <div className="flex gap-2">
          <Button
            variant={mode === "ai" ? "default" : "outline"}
            onClick={() => setMode("ai")}
            size="sm"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            AI-Assisted
          </Button>
          <Button
            variant={mode === "manual" ? "default" : "outline"}
            onClick={() => setMode("manual")}
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Manual Entry
          </Button>
        </div>

        {mode === "ai" && (
          <AIExtractionSection
            sourceId={sourceId}
            sourceTitle={sourceTitle}
            hasAbstract={hasAbstract}
            abstractText={abstractText}
            extractionMode={extractionMode}
            setExtractionMode={setExtractionMode}
            fulltext={fulltext}
            setFulltext={setFulltext}
            suggestions={suggestions}
            selectedIndices={selectedIndices}
            editingIndex={editingIndex}
            setEditingIndex={setEditingIndex}
            extractMutation={extractMutation}
            createMutation={createMutation}
            onExtract={handleExtract}
            onToggleSuggestion={handleToggleSuggestion}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onEditSuggestion={handleEditSuggestion}
            onRemoveSuggestion={handleRemoveSuggestion}
            onCreateSelected={handleCreateSelected}
          />
        )}

        {mode === "manual" && (
          <ManualClaimForm 
            sourceId={sourceId} 
            onSuccess={(ids) => {
              queryClient.invalidateQueries({ queryKey: ["source", sourceId] });
              queryClient.invalidateQueries({ queryKey: ["claims", sourceId] });
              onClaimsCreated?.(ids);
            }} 
          />
        )}
      </CardContent>

      {/* Cost Warning Dialog */}
      <AlertDialog open={showCostWarning} onOpenChange={setShowCostWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-amber-500" />
              AI Extraction Cost
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will use the OpenAI API to extract claims from the {extractionMode}.
              <br /><br />
              <strong>Estimated cost:</strong> ~${extractionMode === "abstract" ? "0.01-0.02" : "0.03-0.10"}
              <br />
              <span className="text-sm text-muted-foreground">
                (Abstract extraction is cheaper and usually sufficient)
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExtraction}>
              Proceed with Extraction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// AI Extraction Section
// ─────────────────────────────────────────────────────────

interface AIExtractionSectionProps {
  sourceId: string;
  sourceTitle: string;
  hasAbstract: boolean;
  abstractText?: string;
  extractionMode: "abstract" | "fulltext";
  setExtractionMode: (mode: "abstract" | "fulltext") => void;
  fulltext: string;
  setFulltext: (text: string) => void;
  suggestions: ExtractedClaim[];
  selectedIndices: Set<number>;
  editingIndex: number | null;
  setEditingIndex: (index: number | null) => void;
  extractMutation: any;
  createMutation: any;
  onExtract: () => void;
  onToggleSuggestion: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onEditSuggestion: (index: number, updates: Partial<ExtractedClaim>) => void;
  onRemoveSuggestion: (index: number) => void;
  onCreateSelected: () => void;
}

function AIExtractionSection({
  hasAbstract,
  abstractText,
  extractionMode,
  setExtractionMode,
  fulltext,
  setFulltext,
  suggestions,
  selectedIndices,
  editingIndex,
  setEditingIndex,
  extractMutation,
  createMutation,
  onExtract,
  onToggleSuggestion,
  onSelectAll,
  onDeselectAll,
  onEditSuggestion,
  onRemoveSuggestion,
  onCreateSelected,
}: AIExtractionSectionProps) {
  const canExtract = extractionMode === "abstract" 
    ? hasAbstract 
    : fulltext.trim().length > 100;

  return (
    <div className="space-y-4">
      {/* Extraction Mode Selection */}
      <div className="space-y-3">
        <Label>Extract from:</Label>
        <div className="flex gap-2">
          <Button
            variant={extractionMode === "abstract" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setExtractionMode("abstract")}
            disabled={!hasAbstract}
            className="flex-1"
          >
            <FileText className="mr-2 h-4 w-4" />
            Abstract
            {!hasAbstract && <span className="ml-1 text-xs">(N/A)</span>}
          </Button>
          <Button
            variant={extractionMode === "fulltext" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setExtractionMode("fulltext")}
            className="flex-1"
          >
            <Quote className="mr-2 h-4 w-4" />
            Full Text
          </Button>
        </div>
      </div>

      {/* Abstract Preview */}
      {extractionMode === "abstract" && abstractText && (
        <div className="p-3 rounded-md bg-muted/50 text-sm">
          <p className="line-clamp-4 text-muted-foreground">{abstractText}</p>
        </div>
      )}

      {/* Fulltext Input */}
      {extractionMode === "fulltext" && (
        <div className="space-y-2">
          <Label htmlFor="fulltext-input">Paste paper text:</Label>
          <Textarea
            id="fulltext-input"
            placeholder="Paste the full text or relevant sections of the paper..."
            value={fulltext}
            onChange={(e) => setFulltext(e.target.value)}
            className="min-h-[150px] font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {fulltext.length} characters
            {fulltext.length < 100 && " (minimum 100 required)"}
          </p>
        </div>
      )}

      {/* Extract Button */}
      <Button
        onClick={onExtract}
        disabled={!canExtract || extractMutation.isPending}
        className="w-full"
      >
        {extractMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Extracting claims...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Extract Claims with AI
          </>
        )}
      </Button>

      {/* Error */}
      {extractMutation.isError && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Extraction failed</p>
            <p>{extractMutation.error?.message}</p>
          </div>
        </div>
      )}

      {/* Suggestions List */}
      {suggestions.length > 0 && (
        <div className="space-y-4">
          <Separator />
          
          {/* Header with selection controls */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium">
              Extracted Claims ({suggestions.length})
            </h4>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onSelectAll}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={onDeselectAll}>
                Deselect All
              </Button>
            </div>
          </div>

          {/* Suggestion Cards */}
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <SuggestionCard
                key={index}
                suggestion={suggestion}
                index={index}
                isSelected={selectedIndices.has(index)}
                isEditing={editingIndex === index}
                onToggle={() => onToggleSuggestion(index)}
                onEdit={(updates) => onEditSuggestion(index, updates)}
                onRemove={() => onRemoveSuggestion(index)}
                onStartEdit={() => setEditingIndex(index)}
                onCancelEdit={() => setEditingIndex(null)}
              />
            ))}
          </div>

          {/* Create Selected Button */}
          <Button
            onClick={onCreateSelected}
            disabled={selectedIndices.size === 0 || createMutation.isPending}
            className="w-full"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating claims...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Create {selectedIndices.size} Selected Claim{selectedIndices.size !== 1 ? "s" : ""}
              </>
            )}
          </Button>

          {createMutation.isError && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              {createMutation.error?.message || "Failed to create claims"}
            </div>
          )}
        </div>
      )}

      {/* Success - show extraction stats */}
      {extractMutation.isSuccess && suggestions.length === 0 && (
        <div className="p-4 rounded-md bg-amber-50 text-amber-700 text-sm">
          <p>No claims were extracted. The text may not contain clear academic claims, or try using fulltext mode with more content.</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Suggestion Card
// ─────────────────────────────────────────────────────────

interface SuggestionCardProps {
  suggestion: ExtractedClaim;
  index: number;
  isSelected: boolean;
  isEditing: boolean;
  onToggle: () => void;
  onEdit: (updates: Partial<ExtractedClaim>) => void;
  onRemove: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
}

function SuggestionCard({
  suggestion,
  index,
  isSelected,
  isEditing,
  onToggle,
  onEdit,
  onRemove,
  onStartEdit,
  onCancelEdit,
}: SuggestionCardProps) {
  const [editText, setEditText] = useState(suggestion.text);
  const [editType, setEditType] = useState(suggestion.claimType);
  const [showDetails, setShowDetails] = useState(false);

  // Edit mode
  if (isEditing) {
    return (
      <Card className="border-2 border-blue-300">
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-2">
            <Label>Claim Text</Label>
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Claim Type</Label>
            <ClaimTypeSelector value={editType} onChange={setEditType} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancelEdit}>
              <X className="mr-1 h-4 w-4" />
              Cancel
            </Button>
            <Button 
              size="sm" 
              onClick={() => onEdit({ text: editText, claimType: editType })}
            >
              <Check className="mr-1 h-4 w-4" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Normal display mode
  return (
    <Card
      className={cn(
        "transition-all cursor-pointer",
        isSelected
          ? "border-2 border-green-500 bg-green-50/30"
          : "hover:border-gray-300"
      )}
    >
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggle()}
            onClick={(e) => e.stopPropagation()}
            className="mt-1"
          />
          <div className="flex-1 space-y-2" onClick={onToggle}>
            {/* Claim text */}
            <p className="text-sm">{suggestion.text}</p>

            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2">
              <ClaimTypeBadge type={suggestion.claimType} size="sm" />
              <ConfidenceBadge confidence={suggestion.confidence} />
              {suggestion.sectionName && (
                <Badge variant="outline" className="text-xs">
                  {suggestion.sectionName}
                </Badge>
              )}
            </div>

            {/* Expandable details */}
            {(suggestion.supportingQuote || suggestion.reasoning) && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDetails(!showDetails);
                  }}
                >
                  {showDetails ? (
                    <ChevronUp className="mr-1 h-3 w-3" />
                  ) : (
                    <ChevronDown className="mr-1 h-3 w-3" />
                  )}
                  Details
                </Button>
                
                {showDetails && (
                  <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                    {suggestion.supportingQuote && (
                      <div>
                        <span className="font-medium">Quote: </span>
                        <span className="italic">"{suggestion.supportingQuote}"</span>
                      </div>
                    )}
                    {suggestion.reasoning && (
                      <div>
                        <span className="font-medium">Reasoning: </span>
                        {suggestion.reasoning}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartEdit();
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit claim</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// Confidence Badge
// ─────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);
  let colorClass = "bg-gray-100 text-gray-600";
  
  if (percentage >= 80) {
    colorClass = "bg-green-100 text-green-700";
  } else if (percentage >= 60) {
    colorClass = "bg-yellow-100 text-yellow-700";
  } else {
    colorClass = "bg-red-100 text-red-700";
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`${colorClass} text-xs`} variant="secondary">
            {percentage}%
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          AI confidence in this extraction
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─────────────────────────────────────────────────────────
// Manual Claim Form
// ─────────────────────────────────────────────────────────

interface ManualClaimFormProps {
  sourceId: string;
  onSuccess?: (claimIds: string[]) => void;
}

function ManualClaimForm({ sourceId, onSuccess }: ManualClaimFormProps) {
  const [text, setText] = useState("");
  const [claimType, setClaimType] = useState<AcademicClaimType>(AcademicClaimType.THESIS);
  const [supportingQuote, setSupportingQuote] = useState("");
  const [pageNumber, setPageNumber] = useState("");
  const [sectionName, setSectionName] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/claims/academic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          sourceId,
          academicClaimType: claimType,
          supportingQuote: supportingQuote || undefined,
          pageNumber: pageNumber ? parseInt(pageNumber) : undefined,
          sectionName: sectionName || undefined,
          extractedByAI: false,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create claim");
      }
      return response.json();
    },
    onSuccess: (data) => {
      onSuccess?.([data.claim.id]);
      // Reset form
      setText("");
      setSupportingQuote("");
      setPageNumber("");
      setSectionName("");
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="claim-text">Claim Text *</Label>
        <Textarea
          id="claim-text"
          placeholder="Enter the specific claim from this source..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[100px]"
        />
        <p className="text-xs text-muted-foreground">
          {text.length} characters {text.length < 10 && "(minimum 10 required)"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Claim Type *</Label>
          <ClaimTypeSelector 
            value={claimType} 
            onChange={setClaimType}
            className="w-full" 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="page-number">Page Number</Label>
          <Input
            id="page-number"
            type="number"
            placeholder="e.g., 42"
            value={pageNumber}
            onChange={(e) => setPageNumber(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="section-name">Section Name</Label>
        <Input
          id="section-name"
          placeholder="Introduction, Methods, Discussion..."
          value={sectionName}
          onChange={(e) => setSectionName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="supporting-quote">Supporting Quote</Label>
        <Textarea
          id="supporting-quote"
          placeholder="Exact quote from the source supporting this claim..."
          value={supportingQuote}
          onChange={(e) => setSupportingQuote(e.target.value)}
          className="min-h-[80px]"
        />
      </div>

      <Button
        onClick={() => createMutation.mutate()}
        disabled={text.length < 10 || createMutation.isPending}
        className="w-full"
      >
        {createMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <Plus className="mr-2 h-4 w-4" />
            Create Claim
          </>
        )}
      </Button>

      {createMutation.isError && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="h-4 w-4" />
          {createMutation.error?.message || "Failed to create claim"}
        </div>
      )}

      {createMutation.isSuccess && (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <Check className="h-4 w-4" />
          Claim created successfully!
        </div>
      )}
    </div>
  );
}
