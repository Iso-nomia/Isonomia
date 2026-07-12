// components/arguments/AddSchemeToArgumentModal.tsx
"use client";

import { useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { SchemeSelector } from "./SchemeSelector";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import type { SchemeRole, ExplicitnessLevel } from "@/lib/types/argument-net";

interface AddSchemeToArgumentModalProps {
  argumentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

/**
 * AddSchemeToArgumentModal - Modal dialog for adding a scheme to an argument
 * 
 * Features:
 * - Searchable scheme selector
 * - Role selection (primary/supporting/presupposed/implicit)
 * - Explicitness level (explicit/presupposed/implied)
 * - Text evidence input
 * - Justification for implicit schemes
 * - Validation (prevent duplicate schemes, ensure one primary)
 * - API integration with error handling
 */
export function AddSchemeToArgumentModal({
  argumentId,
  open,
  onOpenChange,
  onSuccess
}: AddSchemeToArgumentModalProps) {
  // Form state
  const [selectedSchemeId, setSelectedSchemeId] = useState<string | null>(null);
  const [role, setRole] = useState<SchemeRole>("supporting");
  const [explicitness, setExplicitness] = useState<ExplicitnessLevel>("explicit");
  const [textEvidence, setTextEvidence] = useState("");
  const [justification, setJustification] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch available schemes
  const { data: schemesData, isLoading: schemesLoading } = useSWR(
    "/api/schemes",
    fetcher
  );
  
  // Fetch current argument with schemes
  const { data: argumentData } = useSWR(
    open ? `/api/arguments/${argumentId}` : null,
    fetcher
  );
  
  const allSchemes = schemesData?.schemes || schemesData || [];
  const argument = argumentData?.argument || argumentData;
  
  // Check if scheme already used
  const existingSchemeIds = argument?.argumentSchemes?.map((si: any) => si.schemeId) || [];
  const availableSchemes = allSchemes.filter((s: any) => 
    !existingSchemeIds.includes(s.id)
  );
  
  // Validation
  const hasPrimaryScheme = argument?.argumentSchemes?.some((si: any) => 
    si.role === "primary" || si.isPrimary
  );
  
  const handleClose = () => {
    setSelectedSchemeId(null);
    setRole("supporting");
    setExplicitness("explicit");
    setTextEvidence("");
    setJustification("");
    setError(null);
    setIsSubmitting(false);
    onOpenChange(false);
  };
  
  const handleSubmit = async () => {
    if (!selectedSchemeId) {
      setError("Please select a scheme");
      return;
    }
    
    if (role === "primary" && hasPrimaryScheme) {
      setError("This argument already has a primary scheme");
      return;
    }
    
    if ((role === "presupposed" || role === "implicit") && !justification.trim()) {
      setError("Justification is required for presupposed and implicit schemes");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/arguments/${argumentId}/schemes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemeId: selectedSchemeId,
          role,
          explicitness,
          textEvidence: textEvidence.trim() || undefined,
          justification: justification.trim() || undefined
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add scheme");
      }
      
      // Refresh data
      globalMutate(`/api/arguments/${argumentId}`);
      globalMutate(`/api/arguments/${argumentId}/schemes`);
      
      onSuccess?.();
      handleClose();
    } catch (err: any) {
      setError(err.message || "Failed to add scheme");
      setIsSubmitting(false);
    }
  };
  
  const canSubmit = selectedSchemeId && !isSubmitting;
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Argumentation Scheme</DialogTitle>
          <DialogDescription>
            Add another scheme to enrich this argument&apos;s structure. Multi-scheme arguments better reflect complex reasoning.
          </DialogDescription>
        </DialogHeader>
        
        {schemesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Error alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <div className="ml-2">{error}</div>
              </Alert>
            )}
            
            {/* Scheme selector */}
            <div className="space-y-2">
              <Label>Select Scheme *</Label>
              <SchemeSelector
                schemes={availableSchemes}
                selectedSchemeIds={selectedSchemeId ? [selectedSchemeId] : []}
                onSchemeToggle={(id) => setSelectedSchemeId(id)}
                multiSelect={false}
                placeholder="Choose an argumentation scheme..."
              />
              {existingSchemeIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {existingSchemeIds.length} scheme{existingSchemeIds.length !== 1 ? "s" : ""} already in use (filtered out)
                </p>
              )}
            </div>
            
            {/* Role selection */}
            <div className="space-y-3">
              <Label>Role in Argument *</Label>
              <div className="space-y-2">
                {[
                  { value: "primary", label: "Primary", desc: "Main inferential pattern (exactly one per argument)", disabled: hasPrimaryScheme },
                  { value: "supporting", label: "Supporting", desc: "Enables premises for the primary scheme", disabled: false },
                  { value: "presupposed", label: "Presupposed", desc: "Taken for granted, necessary for reconstruction", disabled: false },
                  { value: "implicit", label: "Implicit", desc: "Recoverable from context or common knowledge", disabled: false }
                ].map(({ value, label, desc, disabled }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => !disabled && setRole(value as SchemeRole)}
                    disabled={disabled}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      role === value
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-slate-200 hover:border-slate-300"
                    } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        role === value ? "border-indigo-600 bg-indigo-600" : "border-slate-300"
                      }`}>
                        {role === value && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {label} {disabled && "(Already set)"}
                        </p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Explicitness level */}
            <div className="space-y-3">
              <Label>Explicitness Level *</Label>
              <div className="space-y-2">
                {[
                  { value: "explicit", label: "Explicit", border: "Solid border", desc: "Clearly stated in the argument text" },
                  { value: "presupposed", label: "Presupposed", border: "Dashed border", desc: "Assumed background knowledge" },
                  { value: "implied", label: "Implied", border: "Dotted border", desc: "Inferred from context" }
                ].map(({ value, label, border, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setExplicitness(value as ExplicitnessLevel)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      explicitness === value
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        explicitness === value ? "border-indigo-600 bg-indigo-600" : "border-slate-300"
                      }`}>
                        {explicitness === value && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{label} <span className="text-muted-foreground">({border})</span></p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Text evidence (optional) */}
            <div className="space-y-2">
              <Label htmlFor="textEvidence">Text Evidence (Optional)</Label>
              <Textarea
                id="textEvidence"
                placeholder="Quote from the argument that indicates this scheme..."
                value={textEvidence}
                onChange={(e) => setTextEvidence(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Specific text that supports using this scheme
              </p>
            </div>
            
            {/* Justification (required for implicit/presupposed) */}
            {(role === "presupposed" || role === "implicit") && (
              <div className="space-y-2">
                <Label htmlFor="justification">
                  Justification * <span className="text-xs text-muted-foreground">(Required for {role} schemes)</span>
                </Label>
                <Textarea
                  id="justification"
                  placeholder="Explain why this scheme should be reconstructed as part of the argument..."
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Why should analysts include this implicit scheme?
                </p>
              </div>
            )}
          </div>
        )}
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Add Scheme
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
