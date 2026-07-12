"use client";

/**
 * DisagreementTagger — B3.1
 *
 * Inline tag affordance attached to a deliberation target (claim / argument /
 * edge). Renders existing tags grouped by axis with confirm / retract
 * controls, plus a popover form for proposing a new tag.
 *
 * Auth gating is best-effort UI only; the server enforces the canonical
 * `canConfirmTag` / `canRetractTag` rules from `lib/typology/auth.ts`.
 */

import * as React from "react";
import { mutate } from "swr";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Plus, Tag as TagIcon, Check, X } from "lucide-react";

import { AxisBadge } from "./AxisBadge";
import {
  AXIS_CLASSES,
  AXIS_LABEL,
  fmtConfidence,
  typologyApi,
  useAxisIdToKey,
  useTags,
  type DisagreementAxisKey,
  type DisagreementTagDTO,
  type DisagreementTagTargetType,
} from "./hooks";

const AXES: DisagreementAxisKey[] = ["VALUE", "EMPIRICAL", "FRAMING", "INTEREST"];

export interface DisagreementTaggerProps {
  deliberationId: string;
  targetType: DisagreementTagTargetType;
  targetId: string;
  sessionId?: string | null;
  /** Hide the trigger if the viewer is not allowed to propose. */
  canPropose?: boolean;
  canConfirm?: boolean;
  canRetract?: boolean;
  /** Render only the trigger + popover, suppressing the inline tag list. */
  compact?: boolean;
  className?: string;
}

export function DisagreementTagger(props: DisagreementTaggerProps) {
  const {
    deliberationId,
    targetType,
    targetId,
    sessionId,
    canPropose = true,
    canConfirm = true,
    canRetract = true,
    compact = false,
    className,
  } = props;

  const { data, error, isLoading } = useTags(deliberationId, {
    targetType,
    targetId,
  });
  const tags = React.useMemo(() => data?.tags ?? [], [data]);
  const axisIdToKey = useAxisIdToKey();

  const grouped = React.useMemo(() => {
    const m = new Map<DisagreementAxisKey, DisagreementTagDTO[]>();
    for (const t of tags) {
      const axis = axisIdToKey.get(t.axisId);
      if (!axis) continue;
      const arr = m.get(axis) ?? [];
      arr.push(t);
      m.set(axis, arr);
    }
    return m;
  }, [tags, axisIdToKey]);

  const tagsKey = `/api/deliberations/${deliberationId}/typology/tags`;
  const revalidate = React.useCallback(() => {
    void mutate(
      (key) =>
        typeof key === "string" && key.startsWith(tagsKey),
      undefined,
      { revalidate: true },
    );
  }, [tagsKey]);

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      {!compact && (
        <div className="flex flex-wrap items-center gap-1.5">
          {Array.from(grouped.entries()).map(([axis, items]) => (
            <AxisBadge key={axis} axisKey={axis} count={items.length} />
          ))}
          {!tags.length && !isLoading && !error && (
            <span className="text-[11px] text-slate-500">No disagreement tags yet.</span>
          )}
          {error && (
            <span className="text-[11px] text-rose-600">Couldn&apos;t load tags.</span>
          )}
          {canPropose && (
            <PropP
              {...{ deliberationId, targetType, targetId, sessionId }}
              onProposed={revalidate}
            />
          )}
        </div>
      )}

      {!compact && tags.length > 0 && (
        <div className="space-y-1.5" role="list" aria-label="Disagreement tags">
          {Array.from(grouped.entries()).map(([axis, items]) => (
            <AxisGroup
              key={axis}
              axisKey={axis}
              tags={items}
              canConfirm={canConfirm}
              canRetract={canRetract}
              onMutated={revalidate}
            />
          ))}
        </div>
      )}

      {compact && canPropose && (
        <PropP
          {...{ deliberationId, targetType, targetId, sessionId }}
          onProposed={revalidate}
        />
      )}
    </div>
  );
}

// ─── Axis group + per-tag row ───────────────────────────────────────────

function AxisGroup({
  axisKey,
  tags,
  canConfirm,
  canRetract,
  onMutated,
}: {
  axisKey: DisagreementAxisKey;
  tags: DisagreementTagDTO[];
  canConfirm: boolean;
  canRetract: boolean;
  onMutated: () => void;
}) {
  const palette = AXIS_CLASSES[axisKey];
  return (
    <Card
      className={`border ${palette.border} ${palette.bg} p-2`}
      role="listitem"
      aria-label={`${AXIS_LABEL[axisKey]} disagreement, ${tags.length} tag${tags.length === 1 ? "" : "s"}`}
    >
      <div className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${palette.text}`}>
        {AXIS_LABEL[axisKey]}
      </div>
      <ul className="space-y-1">
        {tags.map((t) => (
          <TagRow
            key={t.id}
            tag={t}
            canConfirm={canConfirm}
            canRetract={canRetract}
            onMutated={onMutated}
          />
        ))}
      </ul>
    </Card>
  );
}

function TagRow({
  tag,
  canConfirm,
  canRetract,
  onMutated,
}: {
  tag: DisagreementTagDTO;
  canConfirm: boolean;
  canRetract: boolean;
  onMutated: () => void;
}) {
  const [retractOpen, setRetractOpen] = React.useState(false);
  const [retractReason, setRetractReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const isRetracted = !!tag.retractedAt;
  const isConfirmed = !!tag.confirmedAt;

  const onConfirm = async () => {
    setBusy(true);
    try {
      await typologyApi.confirmTag(tag.id);
      toast.success("Tag confirmed");
      onMutated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onRetract = async () => {
    if (!retractReason.trim()) return;
    setBusy(true);
    try {
      await typologyApi.retractTag(tag.id, { reasonText: retractReason });
      toast.success("Tag retracted");
      setRetractOpen(false);
      setRetractReason("");
      onMutated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-start gap-2 text-xs text-slate-700">
      <TagIcon className="mt-0.5 h-3 w-3 flex-shrink-0 text-slate-400" />
      <div className="flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="font-medium">conf {fmtConfidence(tag.confidence)}</span>
          {isRetracted && (
            <span className="text-[10px] uppercase tracking-wide text-rose-700">retracted</span>
          )}
          {isConfirmed && !isRetracted && (
            <span className="text-[10px] uppercase tracking-wide text-emerald-700">confirmed</span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-600">{tag.evidenceText}</p>
      </div>
      {!isRetracted && (
        <div className="flex items-center gap-1">
          {!isConfirmed && canConfirm && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-1.5"
              disabled={busy}
              onClick={onConfirm}
              aria-label="Confirm tag"
            >
              <Check className="h-3 w-3" />
            </Button>
          )}
          {canRetract && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-1.5 text-rose-700"
              disabled={busy}
              onClick={() => setRetractOpen(true)}
              aria-label="Retract tag"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
      <Dialog open={retractOpen} onOpenChange={setRetractOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retract disagreement tag</DialogTitle>
            <DialogDescription>
              Retraction is recorded on the meta-consensus chain. Provide a brief reason.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={retractReason}
            onChange={(e) => setRetractReason(e.target.value)}
            placeholder="Reason for retraction…"
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRetractOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onRetract} disabled={busy || !retractReason.trim()}>
              Retract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

// ─── Propose popover ─────────────────────────────────────────────────────

function PropP({
  deliberationId,
  targetType,
  targetId,
  sessionId,
  onProposed,
}: {
  deliberationId: string;
  targetType: DisagreementTagTargetType;
  targetId: string;
  sessionId?: string | null;
  onProposed: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [axis, setAxis] = React.useState<DisagreementAxisKey>("VALUE");
  const [confidence, setConfidence] = React.useState(0.5);
  const [evidence, setEvidence] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const reset = () => {
    setAxis("VALUE");
    setConfidence(0.5);
    setEvidence("");
  };

  const submit = async () => {
    if (!evidence.trim()) return;
    setBusy(true);
    try {
      await typologyApi.proposeTag(deliberationId, {
        targetType,
        targetId,
        axisKey: axis,
        confidence,
        evidenceText: evidence.trim(),
        sessionId: sessionId ?? undefined,
      });
      toast.success("Tag proposed");
      reset();
      setOpen(false);
      onProposed();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button


        className="h-6 gap-1 px-2 text-[11px] btnv2"
        aria-label="Tag a disagreement"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3 w-3" />
        Tag disagreement
      </Button>
      <DialogContent className="bg-white max-w-lg">
        <DialogHeader>
          <DialogTitle>Tag disagreement</DialogTitle>
          <DialogDescription>
            Classify the kind of disagreement so facilitators can synthesize meta-consensus later.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-3">
          <legend className="sr-only">Tag disagreement</legend>

          <div className="space-y-1" role="radiogroup" aria-label="Disagreement axis">
            <span className="text-[11px] font-medium text-slate-700">Axis</span>
            <div className="grid grid-cols-2 gap-1">
              {AXES.map((a) => {
                const palette = AXIS_CLASSES[a];
                const selected = a === axis;
                return (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setAxis(a)}
                    className={`rounded border px-2 py-1 text-left text-xs ${palette.bg} ${palette.border} ${palette.text} ${
                      selected ? "ring-2 ring-offset-1 ring-slate-400" : ""
                    }`}
                  >
                    {AXIS_LABEL[a]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="tag-confidence"
              className="flex items-center justify-between text-[11px] font-medium text-slate-700"
            >
              <span>Confidence</span>
              <span className="font-mono">{confidence.toFixed(2)}</span>
            </label>
            <Slider
              id="tag-confidence"
              value={[confidence]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={(v) => setConfidence(v[0] ?? 0.5)}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="tag-evidence"
              className="text-[11px] font-medium text-slate-700"
            >
              Evidence
            </label>
            <Textarea
              id="tag-evidence"
              rows={3}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="What signals this disagreement?"
              maxLength={4000}
            />
          </div>
        </fieldset>
        <DialogFooter>
          <Button variant="ghost" className="bg-slate-50" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="bg-sky-50 btnv2" onClick={submit} disabled={busy || !evidence.trim()}>
            Propose
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

