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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, Network, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ArgumentSchemeInstance {
  id: string;
  schemeId: string;
  role: "primary" | "supporting" | "presupposed" | "implicit";
  explicitness: "explicit" | "presupposed" | "implied";
  isPrimary: boolean;
  confidence: number;
  order: number;
  scheme: {
    id: string;
    name: string;
    description?: string;
  };
}

interface Dependency {
  from: string; // scheme instance ID
  to: string; // scheme instance ID
  type: "none" | "sequential" | "presuppositional" | "support" | "justificational";
  explanation?: string;
}

interface DependencyEditorProps {
  open: boolean;
  onClose: () => void;
  argumentId: string;
  schemes: ArgumentSchemeInstance[];
  onDependenciesUpdated: () => void;
}

const DEPENDENCY_TYPES = [
  {
    value: "none",
    label: "No dependency",
    description: "These schemes are independent",
  },
  {
    value: "sequential",
    label: "Sequential",
    description: "First scheme's conclusion feeds into second scheme's premise",
  },
  {
    value: "presuppositional",
    label: "Presuppositional",
    description: "Second scheme assumes first scheme is true",
  },
  {
    value: "support",
    label: "Support",
    description: "First scheme strengthens the second scheme's argument",
  },
  {
    value: "justificational",
    label: "Justificational",
    description: "First scheme justifies the second scheme's warrant",
  },
];

export function DependencyEditor({
  open,
  onClose,
  argumentId,
  schemes,
  onDependenciesUpdated,
}: DependencyEditorProps) {
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate all possible scheme pairs
  const schemePairs: [ArgumentSchemeInstance, ArgumentSchemeInstance][] = [];
  for (let i = 0; i < schemes.length; i++) {
    for (let j = i + 1; j < schemes.length; j++) {
      schemePairs.push([schemes[i], schemes[j]]);
    }
  }

  // Fetch existing dependencies
  useEffect(() => {
    if (open && argumentId) {
      fetchDependencies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, argumentId]);

  async function fetchDependencies() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/arguments/${argumentId}/dependencies`);
      if (!response.ok) {
        if (response.status === 404) {
          // No dependencies yet, that's okay
          setDependencies([]);
          return;
        }
        throw new Error(`Failed to fetch dependencies: ${response.statusText}`);
      }
      const data = await response.json();
      setDependencies(data.dependencies || []);
    } catch (err) {
      console.error("[DependencyEditor] Error fetching dependencies:", err);
      setError(err instanceof Error ? err.message : "Failed to load dependencies");
    } finally {
      setLoading(false);
    }
  }

  function getDependency(fromId: string, toId: string): Dependency | undefined {
    // Check both directions since order may vary
    return dependencies.find(
      (dep) =>
        (dep.from === fromId && dep.to === toId) || (dep.from === toId && dep.to === fromId)
    );
  }

  function setDependency(fromId: string, toId: string, type: string, explanation?: string) {
    setDependencies((prev) => {
      // Remove any existing dependency between these two schemes
      const filtered = prev.filter(
        (dep) =>
          !((dep.from === fromId && dep.to === toId) || (dep.from === toId && dep.to === fromId))
      );

      // If type is "none", don't add a new dependency
      if (type === "none") {
        return filtered;
      }

      // Add the new dependency
      return [
        ...filtered,
        {
          from: fromId,
          to: toId,
          type: type as Dependency["type"],
          explanation: explanation || getDependency(fromId, toId)?.explanation,
        },
      ];
    });
  }

  function updateExplanation(fromId: string, toId: string, explanation: string) {
    setDependencies((prev) =>
      prev.map((dep) => {
        if (
          (dep.from === fromId && dep.to === toId) ||
          (dep.from === toId && dep.to === fromId)
        ) {
          return { ...dep, explanation };
        }
        return dep;
      })
    );
  }

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/arguments/${argumentId}/dependencies`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependencies }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Failed to save dependencies: ${response.statusText}`);
      }

      console.log("[DependencyEditor] Dependencies saved successfully");
      onDependenciesUpdated();
      onClose();
    } catch (err) {
      console.error("[DependencyEditor] Error saving dependencies:", err);
      setError(err instanceof Error ? err.message : "Failed to save dependencies");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] bg-white overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Edit Scheme Dependencies
          </DialogTitle>
          <DialogDescription>
            Specify how schemes relate to each other in this argument. Dependencies help clarify
            the logical flow and structure of multi-scheme arguments.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Scheme Dependencies</h4>
              <Badge variant="outline">
                {schemes.length} schemes, {dependencies.filter((d) => d.type !== "none").length}{" "}
                dependencies
              </Badge>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Define how schemes connect logically. Sequential means one feeds into another,
                presuppositional means one assumes another, support means one strengthens another,
                and justificational means one justifies another&apos;s warrant.
              </AlertDescription>
            </Alert>

            {schemePairs.length === 0 ? (
              <Alert>
                <AlertDescription>
                  Need at least 2 schemes to define dependencies. Add more schemes first.
                </AlertDescription>
              </Alert>
            ) : (
              schemePairs.map(([schemeA, schemeB]) => {
                const currentDep = getDependency(schemeA.schemeId, schemeB.schemeId);
                const currentType = currentDep?.type || "none";

                return (
                  <div
                    key={`${schemeA.schemeId}-${schemeB.schemeId}`}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    {/* Scheme pair header */}
                    <div className="flex items-center gap-2">
                      <Badge variant={schemeA.isPrimary ? "default" : "secondary"}>
                        {schemeA.scheme.name}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <Badge variant={schemeB.isPrimary ? "default" : "secondary"}>
                        {schemeB.scheme.name}
                      </Badge>
                    </div>

                    {/* Dependency type selector */}
                    <div className="space-y-2">
                      <Label>Relationship Type</Label>
                      <Select
                        value={currentType}
                        onValueChange={(type) => setDependency(schemeA.schemeId, schemeB.schemeId, type)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPENDENCY_TYPES.map((depType) => (
                            <SelectItem key={depType.value} value={depType.value}>
                              <div className="flex flex-col">
                                <span className="font-medium">{depType.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  {depType.description}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Explanation field (only show if dependency is set) */}
                    {currentType !== "none" && (
                      <div className="space-y-2">
                        <Label>Explanation (Optional)</Label>
                        <Textarea
                          placeholder="Explain how these schemes connect..."
                          value={currentDep?.explanation || ""}
                          onChange={(e) =>
                            updateExplanation(schemeA.schemeId, schemeB.schemeId, e.target.value)
                          }
                          rows={2}
                        />
                        <p className="text-xs text-muted-foreground">
                          Describe the logical connection between these two schemes.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={submitting || loading}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Dependencies
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
