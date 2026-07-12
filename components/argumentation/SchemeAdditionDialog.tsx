"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Plus, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ArgumentSchemeInstance {
  id: string;
  schemeId: string;
  role: "primary" | "supporting" | "presupposed" | "implicit";
  explicitness: "explicit" | "presupposed" | "implied";
  isPrimary: boolean;
  confidence: number;
  order: number;
  textEvidence?: string | null;
  justification?: string | null;
  scheme: {
    id: string;
    name: string;
    description?: string;
  };
}

interface Scheme {
  id: string;
  name: string;
  description?: string;
  category?: string;
  materialRelation?: string;
  reasoningType?: string;
}

interface SchemeAdditionDialogProps {
  open: boolean;
  onClose: () => void;
  argumentId: string;
  deliberationId: string;
  existingSchemes: ArgumentSchemeInstance[];
  onSchemeAdded: (schemeInstanceId: string) => void;
}

export function SchemeAdditionDialog({
  open,
  onClose,
  argumentId,
  deliberationId,
  existingSchemes,
  onSchemeAdded,
}: SchemeAdditionDialogProps) {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [filteredSchemes, setFilteredSchemes] = useState<Scheme[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>("");
  const [role, setRole] = useState<"supporting" | "presupposed" | "implicit">("supporting");
  const [explicitness, setExplicitness] = useState<"explicit" | "presupposed" | "implied">("explicit");
  const [confidence, setConfidence] = useState<number>(0.75);
  const [textEvidence, setTextEvidence] = useState("");
  const [justification, setJustification] = useState("");

  // Fetch available schemes
  useEffect(() => {
    if (open) {
      fetchSchemes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Filter schemes based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSchemes(schemes);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = schemes.filter(
      (scheme) =>
        scheme.name.toLowerCase().includes(query) ||
        scheme.description?.toLowerCase().includes(query) ||
        scheme.category?.toLowerCase().includes(query) ||
        scheme.materialRelation?.toLowerCase().includes(query) ||
        scheme.reasoningType?.toLowerCase().includes(query)
    );
    setFilteredSchemes(filtered);
  }, [searchQuery, schemes]);

  async function fetchSchemes() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/schemes/all");
      if (!response.ok) {
        throw new Error("Failed to fetch schemes");
      }
      const data = await response.json();
      
      // Filter out schemes that are already added
      const existingSchemeIds = existingSchemes.map((s) => s.schemeId);
      const availableSchemes = data.filter(
        (scheme: Scheme) => !existingSchemeIds.includes(scheme.id)
      );
      
      setSchemes(availableSchemes);
      setFilteredSchemes(availableSchemes);
    } catch (err) {
      console.error("Error fetching schemes:", err);
      setError("Failed to load schemes. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!selectedSchemeId) {
      setError("Please select a scheme");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/arguments/${argumentId}/schemes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemeId: selectedSchemeId,
          role,
          explicitness,
          isPrimary: false,
          confidence,
          order: existingSchemes.length + 1,
          textEvidence: textEvidence.trim() || null,
          justification: justification.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add scheme");
      }

      const data = await response.json();

      // Dispatch event for UI refresh
      window.dispatchEvent(
        new CustomEvent("arguments:changed", {
          detail: { deliberationId, argumentId },
        })
      );

      // Reset form
      resetForm();
      
      // Call callback
      onSchemeAdded(data.id);
      
      // Close dialog
      onClose();
    } catch (err) {
      console.error("Error adding scheme:", err);
      setError(err instanceof Error ? err.message : "Failed to add scheme");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSelectedSchemeId("");
    setRole("supporting");
    setExplicitness("explicit");
    setConfidence(0.75);
    setTextEvidence("");
    setJustification("");
    setSearchQuery("");
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  const selectedScheme = schemes.find((s) => s.id === selectedSchemeId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Add Supporting Scheme</DialogTitle>
          <DialogDescription>
            Add an additional argumentation scheme to this argument to create a multi-scheme net.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step 1: Select Scheme */}
          <div className="space-y-3">
            <Label htmlFor="scheme-search">
              Select Scheme <span className="text-destructive">*</span>
            </Label>
            
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="scheme-search"
                placeholder="Search by name, description, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Scheme selector */}
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSchemes.length === 0 ? (
              <div className="text-center p-8 text-sm text-muted-foreground">
                {searchQuery ? "No schemes found matching your search" : "No available schemes to add"}
              </div>
            ) : (
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {filteredSchemes.map((scheme) => (
                  <button
                    key={scheme.id}
                    type="button"
                    onClick={() => setSelectedSchemeId(scheme.id)}
                    className={`w-full text-left p-3 border-b last:border-b-0 hover:bg-accent transition-colors ${
                      selectedSchemeId === scheme.id ? "bg-accent" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{scheme.name}</div>
                        {scheme.description && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {scheme.description}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {scheme.category && (
                            <Badge variant="outline" className="text-xs">
                              {scheme.category}
                            </Badge>
                          )}
                          {scheme.materialRelation && (
                            <Badge variant="secondary" className="text-xs">
                              {scheme.materialRelation}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {selectedSchemeId === scheme.id && (
                        <div className="flex-shrink-0">
                          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedScheme && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Selected: <strong>{selectedScheme.name}</strong>
                  {selectedScheme.description && ` — ${selectedScheme.description}`}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Step 2: Configure Role */}
          <div className="space-y-2">
            <Label htmlFor="role">
              Role in Argument <span className="text-destructive">*</span>
            </Label>
            <Select value={role} onValueChange={(value: any) => setRole(value)}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="supporting">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Supporting</span>
                    <span className="text-xs text-muted-foreground">
                      Strengthens the primary argument
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="presupposed">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Presupposed</span>
                    <span className="text-xs text-muted-foreground">
                      Assumed by the primary argument
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="implicit">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Implicit</span>
                    <span className="text-xs text-muted-foreground">
                      Not stated but implied
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Step 3: Explicitness */}
          <div className="space-y-2">
            <Label htmlFor="explicitness">
              Explicitness <span className="text-destructive">*</span>
            </Label>
            <Select value={explicitness} onValueChange={(value: any) => setExplicitness(value)}>
              <SelectTrigger id="explicitness">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="explicit">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Explicit</span>
                    <span className="text-xs text-muted-foreground">
                      Clearly stated in argument text
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="presupposed">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Presupposed</span>
                    <span className="text-xs text-muted-foreground">
                      Assumed as background knowledge
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="implied">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Implied</span>
                    <span className="text-xs text-muted-foreground">
                      Can be inferred but not stated
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Step 4: Confidence */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="confidence">Confidence Level</Label>
              <span className="text-sm font-medium">
                {Math.round(confidence * 100)}%
              </span>
            </div>
            <Slider
              id="confidence"
              value={[confidence]}
              onValueChange={(value) => setConfidence(value[0])}
              min={0}
              max={1}
              step={0.01}
              className="py-2"
            />
            <p className="text-xs text-muted-foreground">
              How strongly this scheme applies to the argument
            </p>
          </div>

          {/* Step 5: Text Evidence (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="textEvidence">Text Evidence (Optional)</Label>
            <Textarea
              id="textEvidence"
              placeholder="Quote or passage that shows this scheme being used..."
              value={textEvidence}
              onChange={(e) => setTextEvidence(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Specific text from the argument that demonstrates this scheme
            </p>
          </div>

          {/* Step 6: Justification (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="justification">Justification (Optional)</Label>
            <Textarea
              id="justification"
              placeholder="Explain why this scheme applies to this argument..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Your reasoning for adding this scheme
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="btnv2" onClick={handleSubmit} disabled={!selectedSchemeId || submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Scheme
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
