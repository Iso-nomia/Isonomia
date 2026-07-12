"use client";

/**
 * QuestionAuthoring — C3.2
 *
 * Compose, revise, run checks, and lock the active deliberation question.
 * Severity badges inline; lock button opens a confirmation modal that
 * surfaces every WARN-level check the facilitator is acknowledging.
 */

import * as React from "react";
import {
  facilitationApi,
  type FacilitationCheckDTO,
  type FacilitationFramingType,
  type FacilitationQuestionDTO,
} from "@/components/facilitation/hooks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Circle, CirclePlus, Lock, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

const FRAMING_OPTIONS: Array<{ value: FacilitationFramingType; label: string }> = [
  { value: "open", label: "Open" },
  { value: "choice", label: "Choice" },
  { value: "evaluative", label: "Evaluative" },
  { value: "generative", label: "Generative" },
];

function severityBadge(sev: FacilitationCheckDTO["severity"]) {
  switch (sev) {
    case "BLOCK":
      return (
        <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">BLOCK</Badge>
      );
    case "WARN":
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">WARN</Badge>
      );
    case "INFO":
    default:
      return (
        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">INFO</Badge>
      );
  }
}

interface QuestionAuthoringProps {
  deliberationId: string;
  sessionId: string | null;
  question: FacilitationQuestionDTO | null;
  parentText?: string | null;
  onMutate: () => void;
}

export function QuestionAuthoring({
  deliberationId,
  question,
  parentText,
  onMutate,
}: QuestionAuthoringProps) {
  const [text, setText] = React.useState("");
  const [framing, setFraming] = React.useState<FacilitationFramingType>("open");
  const [busy, setBusy] = React.useState(false);
  const [lockOpen, setLockOpen] = React.useState(false);
  const [acked, setAcked] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (question) {
      setText(question.text);
      setFraming(question.framingType);
      setAcked(new Set());
    } else {
      setText("");
      setFraming("open");
    }
  }, [question?.id, question?.version]);

  const checks = question?.checks ?? [];
  const warns = checks.filter((c) => c.severity === "WARN" && !c.acknowledgedAt);
  const blocks = checks.filter((c) => c.severity === "BLOCK");
  const isLocked = !!question?.lockedAt;
  const isDirty =
    !!question && (text !== question.text || framing !== question.framingType);

  const handleSave = async () => {
    if (!text.trim()) {
      toast.error("Question text required");
      return;
    }
    setBusy(true);
    try {
      if (!question) {
        await facilitationApi.authorQuestion(deliberationId, { text: text.trim(), framingType: framing });
        toast.success("Question authored");
      } else {
        await facilitationApi.reviseQuestion(question.id, {
          text: text.trim(),
          framingType: framing,
        });
        toast.success(`Revised → v${question.version + 1}`);
      }
      onMutate();
    } catch (e) {
      toast.error((e as Error).message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const handleRunChecks = async () => {
    if (!question) return;
    setBusy(true);
    try {
      await facilitationApi.runChecks(question.id);
      toast.success("Checks complete");
      onMutate();
    } catch (e) {
      toast.error((e as Error).message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const handleLockSubmit = async () => {
    if (!question) return;
    setBusy(true);
    try {
      await facilitationApi.lockQuestion(question.id, {
        acknowledgedCheckIds: Array.from(acked),
      });
      toast.success("Question locked");
      setLockOpen(false);
      onMutate();
    } catch (e) {
      const err = e as Error & { code?: string; details?: { offendingCheckIds?: string[] } };
      const ids = err.details?.offendingCheckIds ?? [];
      if (err.code === "CONFLICT_BLOCK_SEVERITY_UNRESOLVED") {
        toast.error(`Cannot lock: ${ids.length} BLOCK check(s) unresolved`);
      } else if (err.code === "VALIDATION_ERROR") {
        toast.error(err.message ?? "Validation failed");
      } else {
        toast.error(err.message ?? "Failed to lock");
      }
      onMutate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3 p-3" aria-label="Question authoring">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-800">
          Question{question ? ` · v${question.version}` : ""}
        </h3>
        {isLocked && (
          <Badge className="gap-1 bg-indigo-100 text-indigo-800 hover:bg-indigo-100">
            <Lock className="h-3 w-3" /> Locked
          </Badge>
        )}
      </header>

      <Textarea
        value={text}
        className="articlesearchfield bg-indigo-50/50"
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Frame the deliberation question…"
        disabled={isLocked || busy}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={framing}
          onValueChange={(v) => setFraming(v as FacilitationFramingType)}
          disabled={isLocked || busy}
        >
          <SelectTrigger className="w-44 mt-2 bg-indigo-100 border-indigo-300">
            <SelectValue placeholder="Framing" />
          </SelectTrigger>
          <SelectContent>
            {FRAMING_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
        className="bg-indigo-50"

          onClick={handleSave}
          disabled={busy || isLocked || (!isDirty && !!question) || !text.trim()}
        >
          {question ? "Revise" : "Author"}
        </Button>
        <Button
        className="bg-indigo-50"

          onClick={handleRunChecks}
          disabled={busy || !question || isLocked}
        >
          <Circle className="mr-1 h-3.5 w-3.5" /> Run checks
        </Button>
        <Button
        className="bg-indigo-50"
          onClick={() => setLockOpen(true)}
          disabled={busy || !question || isLocked || blocks.length > 0}
        >
          <Lock className="mr-1 h-3.5 w-3.5" /> Lock
        </Button>
      </div>

      {checks.length > 0 && (
        <ul className="space-y-1.5 border-t border-slate-100 pt-2">
          {checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-xs">
              {severityBadge(c.severity)}
              <span className="flex-1 text-slate-700">{c.messageText}</span>
              {c.acknowledgedAt && (
                <Badge variant="outline" className="text-[10px]">
                  ack
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Diff with previous version */}
      {question?.parentQuestionId && parentText && (
        <DiffPreview parentText={parentText} text={question.text} />
      )}

      <Dialog open={lockOpen} onOpenChange={setLockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lock question?</DialogTitle>
            <DialogDescription>
              Locking publishes this version. Acknowledge any unresolved WARN
              checks below; BLOCK checks must be resolved by revising first.
            </DialogDescription>
          </DialogHeader>
          {blocks.length > 0 && (
            <div className="rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800">
              {blocks.length} BLOCK check(s) unresolved. Revise before locking.
            </div>
          )}
          {warns.length === 0 && blocks.length === 0 && (
            <div className="text-xs text-slate-600">
              No outstanding warnings — safe to lock.
            </div>
          )}
          <ul className="space-y-2">
            {warns.map((c) => (
              <li
                key={c.id}
                className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2"
              >
                <Checkbox
                  checked={acked.has(c.id)}
                  onCheckedChange={(v) => {
                    setAcked((prev) => {
                      const next = new Set(prev);
                      if (v) next.add(c.id);
                      else next.delete(c.id);
                      return next;
                    });
                  }}
                  id={`ack-${c.id}`}
                />
                <label htmlFor={`ack-${c.id}`} className="flex-1 text-xs text-amber-900">
                  <span className="font-medium">{c.kind}:</span> {c.messageText}
                </label>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button className="bg-white" variant="outline" onClick={() => setLockOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-indigo-50"
              onClick={handleLockSubmit}
              disabled={
                busy || blocks.length > 0 || warns.some((w) => !acked.has(w.id))
              }
            >
              <RefreshCw
                className={`mr-1 h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`}
              />
              Lock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function DiffPreview({ parentText, text }: { parentText: string; text: string }) {
  const a = parentText.split(/\s+/);
  const b = text.split(/\s+/);
  return (
    <details className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
      <summary className="cursor-pointer text-slate-700">
        Diff vs previous version
      </summary>
      <div className="mt-1 leading-relaxed">
        {b.map((tok, i) => {
          const same = a[i] === tok;
          return (
            <span
              key={i}
              className={
                same ? "text-slate-500" : "rounded bg-emerald-100 px-0.5 text-emerald-800"
              }
            >
              {tok}{" "}
            </span>
          );
        })}
      </div>
    </details>
  );
}
