"use client";

/**
 * Quote Modals
 * 
 * Phase 2.3: Quote Nodes & Argument Quality Gates
 * 
 * Modal components for quote operations:
 * - CreateQuoteModal: Create a new quote from a source
 * - QuoteLinkModal: Link a quote to a claim or argument
 * - CreateInterpretationModal: Add an interpretation to a quote
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Quote,
  BookOpen,
  Link2,
  MessageSquare,
  Loader2,
  Search,
  Sparkles,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  LocatorType,
  QuoteUsageType,
  LOCATOR_TYPE_LABELS,
  QUOTE_USAGE_LABELS,
  QUOTE_USAGE_COLORS,
} from "@/lib/quotes/types";

// ─────────────────────────────────────────────────────────
// Common Frameworks
// ─────────────────────────────────────────────────────────

const COMMON_FRAMEWORKS = [
  "Marxist",
  "Feminist",
  "Poststructuralist",
  "Phenomenological",
  "Psychoanalytic",
  "Historicist",
  "Deconstructionist",
  "Hermeneutic",
  "Postcolonial",
  "Queer Theory",
  "New Historicism",
  "Formalist",
];

// ─────────────────────────────────────────────────────────
// CreateQuoteModal
// ─────────────────────────────────────────────────────────

export interface CreateQuoteModalProps {
  open: boolean;
  sourceId?: string;
  sourceName?: string;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (quote: { id: string; text: string }) => void;
}

export function CreateQuoteModal({
  open,
  sourceId,
  sourceName,
  onOpenChange,
  onSuccess,
}: CreateQuoteModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [text, setText] = React.useState("");
  const [locator, setLocator] = React.useState("");
  const [locatorType, setLocatorType] = React.useState<LocatorType>("PAGE");
  const [context, setContext] = React.useState("");
  const [language, setLanguage] = React.useState("en");

  const resetForm = () => {
    setText("");
    setLocator("");
    setLocatorType("PAGE");
    setContext("");
    setLanguage("en");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !sourceId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          sourceId,
          locator: locator.trim() || undefined,
          locatorType,
          context: context.trim() || undefined,
          language,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create quote");
      }

      const quote = await res.json();
      resetForm();
      onOpenChange(false);
      onSuccess?.(quote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Quote className="h-5 w-5" />
              Create Quote
            </DialogTitle>
            <DialogDescription>
              Extract a quote from {sourceName ? `"${sourceName}"` : "a source"} to use in your arguments.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Quote text */}
            <div className="space-y-2">
              <Label htmlFor="quote-text">Quote text *</Label>
              <Textarea
                id="quote-text"
                placeholder="Enter the exact text of the quote..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                required
              />
            </div>

            {/* Locator */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="locator-type">Location type</Label>
                <Select
                  value={locatorType}
                  onValueChange={(v) => setLocatorType(v as LocatorType)}
                >
                  <SelectTrigger id="locator-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LOCATOR_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="locator">Location</Label>
                <Input
                  id="locator"
                  placeholder="e.g., 42, 3:16, 01:23:45"
                  value={locator}
                  onChange={(e) => setLocator(e.target.value)}
                />
              </div>
            </div>

            {/* Context */}
            <div className="space-y-2">
              <Label htmlFor="context">
                Surrounding context <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="context"
                placeholder="Add surrounding text for context..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={2}
              />
            </div>

            {/* Language */}
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="it">Italian</SelectItem>
                  <SelectItem value="la">Latin</SelectItem>
                  <SelectItem value="el">Greek</SelectItem>
                  <SelectItem value="he">Hebrew</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                  <SelectItem value="zh">Chinese</SelectItem>
                  <SelectItem value="ja">Japanese</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !text.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Quote
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────
// QuoteLinkModal
// ─────────────────────────────────────────────────────────

export interface QuoteLinkTarget {
  type: "claim" | "argument";
  id: string;
  label: string;
}

export interface QuoteLinkModalProps {
  open: boolean;
  quoteId: string;
  quoteText: string;
  target: QuoteLinkTarget;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function QuoteLinkModal({
  open,
  quoteId,
  quoteText,
  target,
  onOpenChange,
  onSuccess,
}: QuoteLinkModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [usageType, setUsageType] = React.useState<QuoteUsageType>("EVIDENCE");
  const [annotation, setAnnotation] = React.useState("");

  const resetForm = () => {
    setUsageType("EVIDENCE");
    setAnnotation("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    setError(null);

    try {
      const body: Record<string, any> = {
        type: target.type,
        usageType,
        annotation: annotation.trim() || undefined,
      };

      if (target.type === "claim") {
        body.claimId = target.id;
      } else {
        body.argumentId = target.id;
      }

      const res = await fetch(`/api/quotes/${quoteId}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to link quote");
      }

      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const truncatedQuote = quoteText.length > 100
    ? quoteText.slice(0, 100) + "..."
    : quoteText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Link Quote to {target.type === "claim" ? "Claim" : "Argument"}
            </DialogTitle>
            <DialogDescription>
              Specify how this quote relates to &ldquo;{target.label}&rdquo;
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Quote preview */}
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-sm italic">&ldquo;{truncatedQuote}&rdquo;</p>
            </div>

            {/* Usage type */}
            <div className="space-y-3">
              <Label>How is this quote used?</Label>
              <RadioGroup
                value={usageType}
                onValueChange={(v) => setUsageType(v as QuoteUsageType)}
                className="grid gap-2"
              >
                {Object.entries(QUOTE_USAGE_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <RadioGroupItem value={key} id={`usage-${key}`} />
                    <Label
                      htmlFor={`usage-${key}`}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          QUOTE_USAGE_COLORS[key as QuoteUsageType]
                        )}
                      >
                        {label}
                      </Badge>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Annotation */}
            <div className="space-y-2">
              <Label htmlFor="annotation">
                Annotation <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="annotation"
                placeholder="Explain how this quote supports or relates to the target..."
                value={annotation}
                onChange={(e) => setAnnotation(e.target.value)}
                rows={2}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Link Quote
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────
// CreateInterpretationModal
// ─────────────────────────────────────────────────────────

export interface CreateInterpretationModalProps {
  open: boolean;
  quoteId: string;
  quoteText: string;
  replyTo?: {
    id: string;
    type: "support" | "challenge";
    authorName?: string;
  };
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateInterpretationModal({
  open,
  quoteId,
  quoteText,
  replyTo,
  onOpenChange,
  onSuccess,
}: CreateInterpretationModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [content, setContent] = React.useState("");
  const [framework, setFramework] = React.useState("");
  const [customFramework, setCustomFramework] = React.useState("");

  const resetForm = () => {
    setContent("");
    setFramework("");
    setCustomFramework("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const finalFramework = framework === "custom"
        ? customFramework.trim()
        : framework || undefined;

      const body: Record<string, any> = {
        content: content.trim(),
        framework: finalFramework,
      };

      if (replyTo) {
        if (replyTo.type === "support") {
          body.supportsInterpretationId = replyTo.id;
        } else {
          body.challengesInterpretationId = replyTo.id;
        }
      }

      const res = await fetch(`/api/quotes/${quoteId}/interpretations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create interpretation");
      }

      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const truncatedQuote = quoteText.length > 150
    ? quoteText.slice(0, 150) + "..."
    : quoteText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {replyTo
                ? `${replyTo.type === "support" ? "Support" : "Challenge"} Interpretation`
                : "Add Interpretation"}
            </DialogTitle>
            <DialogDescription>
              {replyTo
                ? `${replyTo.type === "support" ? "Support" : "Challenge"} ${replyTo.authorName || "another"}'s interpretation with your reading.`
                : "Share your reading and analysis of this passage."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Quote preview */}
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-start gap-2">
                <Quote className="h-4 w-4 mt-0.5 text-primary/60 flex-shrink-0" />
                <p className="text-sm italic">&ldquo;{truncatedQuote}&rdquo;</p>
              </div>
            </div>

            {/* Reply indicator */}
            {replyTo && (
              <div className="flex items-center gap-2 text-sm">
                {replyTo.type === "support" ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">
                      Supporting another interpretation
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">
                      Challenging another interpretation
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Interpretation content */}
            <div className="space-y-2">
              <Label htmlFor="interpretation">Your interpretation *</Label>
              <Textarea
                id="interpretation"
                placeholder="Share your reading and analysis of this passage..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                required
              />
            </div>

            {/* Framework */}
            <div className="space-y-2">
              <Label htmlFor="framework" className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Interpretive framework <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Select value={framework} onValueChange={setFramework}>
                <SelectTrigger id="framework">
                  <SelectValue placeholder="Select a framework..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {COMMON_FRAMEWORKS.map((fw) => (
                    <SelectItem key={fw} value={fw}>
                      {fw}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom...</SelectItem>
                </SelectContent>
              </Select>
              {framework === "custom" && (
                <Input
                  placeholder="Enter custom framework..."
                  value={customFramework}
                  onChange={(e) => setCustomFramework(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !content.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {replyTo ? `${replyTo.type === "support" ? "Support" : "Challenge"}` : "Add Interpretation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
