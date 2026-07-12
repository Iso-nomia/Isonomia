"use client";

/**
 * MetaConsensusEditor — B3.3
 *
 * Drafting surface for a meta-consensus summary. Lets a facilitator (or host)
 * edit `agreedOn`, `disagreedOn`, `blockers`, and `nextSteps` on a DRAFT
 * summary, then publish it (which freezes the snapshot on the chain).
 *
 * Two modes:
 *   - `mode="draft"` — collects fields and POSTs to `draftSummary`.
 *   - `mode="edit"`  — PATCHes an existing DRAFT summary.
 */

import * as React from "react";
import { mutate } from "swr";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Trash2, FileCheck } from "lucide-react";

import { AxisBadge } from "./AxisBadge";
import {
  AXIS_CLASSES,
  AXIS_LABEL,
  typologyApi,
  useAxes,
  useAxisIdToKey,
  useTags,
  type DisagreementAxisKey,
  type DisagreementTagDTO,
  type MetaConsensusSummaryBody,
  type MetaConsensusSummaryDTO,
} from "./hooks";

const AXES: DisagreementAxisKey[] = ["VALUE", "EMPIRICAL", "FRAMING", "INTEREST"];

export interface MetaConsensusEditorProps {
  deliberationId: string;
  sessionId?: string | null;
  /** When provided, the editor edits this DRAFT in place instead of creating one. */
  draft?: MetaConsensusSummaryDTO | null;
  onSaved?: (summary: MetaConsensusSummaryDTO) => void;
  onPublished?: (summary: MetaConsensusSummaryDTO) => void;
  className?: string;
}

const EMPTY_BODY: MetaConsensusSummaryBody = {
  agreedOn: [],
  disagreedOn: [],
  blockers: [],
  nextSteps: [],
};

export function MetaConsensusEditor({
  deliberationId,
  sessionId,
  draft = null,
  onSaved,
  onPublished,
  className,
}: MetaConsensusEditorProps) {
  const axes = useAxes();
  const axisIdToKey = useAxisIdToKey();
  const { data: tagsData } = useTags(deliberationId, { sessionId });
  const confirmedTags = React.useMemo(
    () => (tagsData?.tags ?? []).filter((t) => t.confirmedAt && !t.retractedAt),
    [tagsData],
  );

  const [body, setBody] = React.useState<MetaConsensusSummaryBody>(
    draft?.bodyJson ?? EMPTY_BODY,
  );
  const [narrative, setNarrative] = React.useState<string>(draft?.narrativeText ?? "");
  const [busy, setBusy] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [activeDraftId, setActiveDraftId] = React.useState<string | null>(draft?.id ?? null);

  React.useEffect(() => {
    if (draft) {
      setBody(draft.bodyJson ?? EMPTY_BODY);
      setNarrative(draft.narrativeText ?? "");
      setActiveDraftId(draft.id);
    }
  }, [draft]);

  const refresh = React.useCallback(() => {
    void mutate(
      (key) =>
        typeof key === "string" &&
        key.includes(`/api/deliberations/${deliberationId}/typology/summaries`),
      undefined,
      { revalidate: true },
    );
  }, [deliberationId]);

  const saveDraft = async () => {
    setBusy(true);
    try {
      const res = activeDraftId
        ? await typologyApi.editDraft(activeDraftId, { bodyJson: body, narrativeText: narrative || null })
        : await typologyApi.draftSummary(deliberationId, {
            sessionId: sessionId ?? null,
            bodyJson: body,
            narrativeText: narrative || null,
          });
      const summary = (res as { summary: MetaConsensusSummaryDTO }).summary;
      setActiveDraftId(summary.id);
      toast.success(activeDraftId ? "Draft saved" : "Draft created");
      onSaved?.(summary);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!activeDraftId) return;
    setBusy(true);
    try {
      const res = await typologyApi.publishSummary(activeDraftId);
      const summary = (res as { summary: MetaConsensusSummaryDTO }).summary;
      toast.success("Meta-consensus summary published");
      setPublishOpen(false);
      onPublished?.(summary);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Snapshot estimate (shown in the publish modal). Mirrors the server-side
  // canonical-JSON size cap (256 KiB).
  const estimatedBytes = React.useMemo(() => {
    return new Blob([JSON.stringify({ body, narrative })]).size;
  }, [body, narrative]);
  const SNAPSHOT_CAP = 256 * 1024;

  return (
    <Card
      className={`space-y-4 bg-white p-4 ${className ?? ""}`}
      role="region"
      aria-labelledby="meta-consensus-editor-heading"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          id="meta-consensus-editor-heading"
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"
        >
          <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
          Meta-consensus draft
        </h3>
        <div className="flex items-center gap-1.5">
          {activeDraftId && (
            <Badge variant="outline" className="text-[10px] uppercase">
              draft
            </Badge>
          )}
        </div>
      </div>

      <StringList
        label="Agreed on"
        items={body.agreedOn}
        onChange={(v) => setBody((b) => ({ ...b, agreedOn: v }))}
        placeholder="A point of broad agreement…"
      />

      <DisagreedList
        items={body.disagreedOn}
        onChange={(v) => setBody((b) => ({ ...b, disagreedOn: v }))}
        confirmedTags={confirmedTags}
        axisIdToKey={axisIdToKey}
      />

      <StringList
        label="Blockers"
        items={body.blockers}
        onChange={(v) => setBody((b) => ({ ...b, blockers: v }))}
        placeholder="What's preventing progress?"
      />

      <StringList
        label="Next steps"
        items={body.nextSteps}
        onChange={(v) => setBody((b) => ({ ...b, nextSteps: v }))}
        placeholder="Concrete next action…"
      />

      <div className="space-y-1">
        <label htmlFor="meta-narrative" className="text-xs tracking-wide font-medium text-slate-700">
          NARRATIVE
        </label>
        <Textarea
          id="meta-narrative"
          rows={1}
          value={narrative}
          className="articlesearchfield border-none text-xs"
          onChange={(e) => setNarrative(e.target.value)}
          placeholder="Any additional context, nuance, or explanation to accompany the summary? (Optional)"
          maxLength={20_000}
        />
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 pt-3">
        <span className="text-[11px] text-slate-500">
          {body.agreedOn.length} agreed · {body.disagreedOn.length} disagreed ·{" "}
          {body.blockers.length} blockers · {body.nextSteps.length} next steps
        </span>
        <div className="flex gap-4">
          <Button onClick={saveDraft} disabled={busy || !axes.data}>
            {activeDraftId ? "Save draft" : "Create draft"}
          </Button>
          <Button
          className="bg-indigo-50"
            onClick={() => setPublishOpen(true)}
            disabled={busy || !activeDraftId}
            title={activeDraftId ? "Publish & freeze snapshot" : "Save draft first"}
          >
            Publish
          </Button>
        </div>
      </div>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish meta-consensus summary</DialogTitle>
            <DialogDescription>
              Publishing freezes a canonical JSON snapshot and appends a
              SUMMARY_PUBLISHED event to the meta-consensus chain. This action
              cannot be undone (only retracted).
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 text-xs text-slate-700">
            <li>{body.disagreedOn.length} typed disagreements</li>
            <li>
              {body.disagreedOn.reduce((acc, d) => acc + d.supportingTagIds.length, 0)} supporting tags
            </li>
            <li>
              Estimated snapshot size: {estimatedBytes.toLocaleString()} B
              <span className="text-slate-500"> / cap {SNAPSHOT_CAP.toLocaleString()} B</span>
            </li>
          </ul>
          {estimatedBytes > SNAPSHOT_CAP && (
            <p className="text-xs text-rose-700" role="alert">
              Snapshot exceeds 256 KiB cap; trim narrative or supporting evidence.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button onClick={publish} disabled={busy || estimatedBytes > SNAPSHOT_CAP}>
              Publish & freeze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── String-list editor ─────────────────────────────────────────────────

function StringList({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <fieldset className="space-y-1">
      <legend className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </legend>
      <ul className="space-y-1" aria-label={label}>
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-1">
            <Input
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
              className="text-xs articlesearchfield"
            />
            <Button


              className="h-full bg-white px-2 mb-2"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label={`Remove ${label} item ${i + 1}`}
            >
              <Trash2 className=" h-3 w-3" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="text-xs articlesearchfield"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button


          className="h-5 rounded-full btnv2 px-2 mb-2 "
          onClick={add}
          aria-label={`Add ${label}`}
          disabled={!draft.trim()}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </fieldset>
  );
}

// ─── Disagreement rows ──────────────────────────────────────────────────

function DisagreedList({
  items,
  onChange,
  confirmedTags,
  axisIdToKey,
}: {
  items: MetaConsensusSummaryBody["disagreedOn"];
  onChange: (v: MetaConsensusSummaryBody["disagreedOn"]) => void;
  confirmedTags: DisagreementTagDTO[];
  axisIdToKey: Map<string, DisagreementAxisKey>;
}) {
  const tagsByAxis = React.useMemo(() => {
    const m = new Map<DisagreementAxisKey, DisagreementTagDTO[]>();
    for (const t of confirmedTags) {
      const key = axisIdToKey.get(t.axisId);
      if (!key) continue;
      const arr = m.get(key) ?? [];
      arr.push(t);
      m.set(key, arr);
    }
    return m;
  }, [confirmedTags, axisIdToKey]);

  const addRow = () => {
    onChange([...items, { axisKey: "VALUE", summary: "", supportingTagIds: [] }]);
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        Disagreed on
      </legend>
      {items.map((row, i) => {
        const palette = AXIS_CLASSES[row.axisKey];
        const candidates = tagsByAxis.get(row.axisKey) ?? [];
        const update = (next: Partial<typeof row>) => {
          const copy = [...items];
          copy[i] = { ...row, ...next };
          onChange(copy);
        };
        const toggleTag = (id: string) => {
          const has = row.supportingTagIds.includes(id);
          update({
            supportingTagIds: has
              ? row.supportingTagIds.filter((x) => x !== id)
              : [...row.supportingTagIds, id],
          });
        };
        return (
          <Card key={i} className={`space-y-2 border ${palette.border} ${palette.bg} p-2`}>
            <div className="flex items-center gap-2">
              <Select
                value={row.axisKey}
                onValueChange={(v) => update({ axisKey: v as DisagreementAxisKey, supportingTagIds: [] })}
              >
                <SelectTrigger className="h-8 w-32 btnv2--ghost text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent >
                  {AXES.map((a) => (
                    <SelectItem key={a} value={a} className="text-xs">
                      {AXIS_LABEL[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={row.summary}
                onChange={(e) => update({ summary: e.target.value })}
                placeholder="Summarize this disagreement…"
                className="text-xs articlesearchfield"
              />
              <Button

                      className="h-8 border-rose-300 bg-white px-2 mb-2"

                onClick={() => onChange(items.filter((_, j) => j !== i))}
                aria-label={`Remove disagreement ${i + 1}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                Supporting tags ({row.supportingTagIds.length})
              </div>
              {candidates.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  No confirmed tags on the {AXIS_LABEL[row.axisKey]} axis yet.
                </p>
              ) : (
                <ul className="space-y-1">
                  {candidates.map((t) => {
                    const checked = row.supportingTagIds.includes(t.id);
                    return (
                      <li key={t.id}>
                        <label className="flex items-start gap-1.5 text-[11px] text-slate-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTag(t.id)}
                            className="mt-0.5"
                            aria-label={`Toggle tag ${t.id}`}
                          />
                          <span className="flex-1 line-clamp-2">{t.evidenceText}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        );
      })}
      <Button


        className="h-7 gap-1 btnv2--ghost px-2 text-[11px]"
        onClick={addRow}
      >
        <Plus className="h-3 w-3" />
        Add disagreement
      </Button>
    </fieldset>
  );
}
