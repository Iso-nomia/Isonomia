// components/arguments/EditSchemeInstanceModal.tsx
"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Loader2, AlertCircle, Save } from "lucide-react";
import type { SchemeRole, ExplicitnessLevel, ArgumentSchemeInstanceWithScheme } from "@/lib/types/argument-net";

interface EditSchemeInstanceModalProps {
  argumentId: string;
  schemeInstance: ArgumentSchemeInstanceWithScheme | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

/**
 * EditSchemeInstanceModal - Modal for editing an existing scheme instance
 * 
 * Features:
 * - Edit role (with validation for primary)
 * - Edit explicitness level
 * - Edit confidence (0-1 scale)
 * - Edit order (position in list)
 * - Edit text evidence
 * - Edit justification
 * - Validation to prevent multiple primary schemes
 * - API integration with error handling
 */
export function EditSchemeInstanceModal({
  argumentId,
  schemeInstance,
  open,
  onOpenChange,
  onSuccess
}: EditSchemeInstanceModalProps) {
  // Form state
  const [role, setRole] = useState<SchemeRole>("supporting");
  const [explicitness, setExplicitness] = useState<ExplicitnessLevel>("explicit");
  const [confidence, setConfidence] = useState<number>(1.0);
  const [order, setOrder] = useState<number>(0);
  const [textEvidence, setTextEvidence] = useState("");
  const [justification, setJustification] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch current argument to check for primary scheme
  const { data: argumentData } = useSWR(
    open ? `/api/arguments/${argumentId}` : null,
    fetcher
  );
  
  const argument = argumentData?.argument || argumentData;
  
  // Initialize form from schemeInstance
  useEffect(() => {
    if (schemeInstance) {
      setRole((schemeInstance as any).role || "supporting");
      setExplicitness((schemeInstance as any).explicitness || "explicit");
      setConfidence(schemeInstance.confidence || 1.0);
      setOrder((schemeInstance as any).order || 0);
      setTextEvidence((schemeInstance as any).textEvidence || "");
      setJustification((schemeInstance as any).justification || "");
    }
  }, [schemeInstance]);
  
  const handleClose = () => {
    setError(null);
    setIsSubmitting(false);
    onOpenChange(false);
  };
  
  const handleSubmit = async () => {
    if (!schemeInstance) return;
    
    // Validation: check if changing to primary when another primary exists
    const otherPrimaryExists = argument?.argumentSchemes?.some((si: any) => 
      si.id !== schemeInstance.id && (si.role === "primary" || si.isPrimary)
    );
    
    if (role === "primary" && otherPrimaryExists) {
      setError("This argument already has a primary scheme. Remove or change the existing primary first.");
      return;
    }
    
    if ((role === "presupposed" || role === "implicit") && !justification.trim()) {
      setError("Justification is required for presupposed and implicit schemes");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/arguments/${argumentId}/schemes/${schemeInstance.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          explicitness,
          confidence,
          order,
          textEvidence: textEvidence.trim() || undefined,
          justification: justification.trim() || undefined
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update scheme");
      }
      
      // Refresh data
      globalMutate(`/api/arguments/${argumentId}`);
      globalMutate(`/api/arguments/${argumentId}/schemes`);
      
      onSuccess?.();
      handleClose();
    } catch (err: any) {
      setError(err.message || "Failed to update scheme");
      setIsSubmitting(false);
    }
  };
  
  if (!schemeInstance) return null;
  
  const schemeName = schemeInstance.scheme?.name || "Unknown Scheme";
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Scheme Instance</DialogTitle>
          <DialogDescription>
            Modify how <span className="font-semibold">{schemeName}</span> is used in this argument.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Error alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <div className="ml-2">{error}</div>
            </Alert>
          )}
          
          {/* Scheme name (read-only) */}
          <div className="space-y-2">
            <Label>Argumentation Scheme</Label>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="font-medium text-sm">{schemeName}</p>
              {schemeInstance.scheme?.summary && (
                <p className="text-xs text-muted-foreground mt-1">
                  {schemeInstance.scheme.summary}
                </p>
              )}
            </div>
          </div>
          
          {/* Role selection */}
          <div className="space-y-3">
            <Label>Role in Argument *</Label>
            <div className="space-y-2">
              {[
                { value: "primary", label: "Primary", desc: "Main inferential pattern" },
                { value: "supporting", label: "Supporting", desc: "Enables premises for the primary scheme" },
                { value: "presupposed", label: "Presupposed", desc: "Taken for granted, necessary for reconstruction" },
                { value: "implicit", label: "Implicit", desc: "Recoverable from context or common knowledge" }
              ].map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRole(value as SchemeRole)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    role === value
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      role === value ? "border-indigo-600 bg-indigo-600" : "border-slate-300"
                    }`}>
                      {role === value && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{label}</p>
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
                { value: "explicit", label: "Explicit", border: "Solid", desc: "Clearly stated in the argument text" },
                { value: "presupposed", label: "Presupposed", border: "Dashed", desc: "Assumed background knowledge" },
                { value: "implied", label: "Implied", border: "Dotted", desc: "Inferred from context" }
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
          
          {/* Confidence level */}
          <div className="space-y-2">
            <Label htmlFor="confidence">Confidence Level</Label>
            <div className="space-y-2">
              <Input
                id="confidence"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={confidence}
                onChange={(e) => setConfidence(parseFloat(e.target.value) || 0)}
                className="w-full"
              />
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${
                      confidence >= 0.8 ? "bg-green-500" :
                      confidence >= 0.5 ? "bg-amber-500" :
                      "bg-red-500"
                    }`}
                    style={{ width: `${confidence * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold w-12 text-right">
                  {Math.round(confidence * 100)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                How confident are you that this scheme applies? (0.0 - 1.0)
              </p>
            </div>
          </div>
          
          {/* Order */}
          <div className="space-y-2">
            <Label htmlFor="order">Display Order</Label>
            <Input
              id="order"
              type="number"
              min="0"
              value={order}
              onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Position in the scheme list (0 = first). Schemes with the same role are ordered by this value.
            </p>
          </div>
          
          {/* Text evidence */}
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
          <div className="space-y-2">
            <Label htmlFor="justification">
              Justification {(role === "presupposed" || role === "implicit") && <span className="text-red-600">*</span>}
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
              {(role === "presupposed" || role === "implicit") 
                ? "Required: Why should analysts include this implicit scheme?"
                : "Optional: Additional notes about this scheme instance"
              }
            </p>
          </div>
        </div>
        
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
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
