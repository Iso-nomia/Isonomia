"use client";

/**
 * MetaConsensusSummaryCard — B3.4
 *
 * Read-only render of a published (or draft) meta-consensus summary. Driven
 * entirely by `bodyJson` (or `snapshotJson` for a published summary), so it
 * can be embedded in pathway reports without re-fetching live tags.
 *
 * Includes a `ChainValidityBadge` to surface end-to-end chain attestation.
 */

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, FileCheck } from "lucide-react";

import { ChainValidityBadge } from "@/components/facilitation/ChainValidityBadge";
import { AxisBadge } from "./AxisBadge";
import {
  AXIS_CLASSES,
  AXIS_LABEL,
  fmtConfidence,
  useSummaryDetail,
  type DisagreementAxisKey,
  type DisagreementTagDTO,
  type MetaConsensusSummaryBody,
  type MetaConsensusSummaryDTO,
} from "./hooks";

export interface MetaConsensusSummaryCardProps {
  summary: MetaConsensusSummaryDTO;
  /** When true, fetches `/api/typology/summaries/[id]` for chain status + supporting tag dereference. */
  hydrate?: boolean;
  className?: string;
}

export function MetaConsensusSummaryCard({
  summary,
  hydrate = false,
  className,
}: MetaConsensusSummaryCardProps) {
  const { data: detail } = useSummaryDetail(hydrate ? summary.id : null);

  // For published summaries the canonical view is the frozen snapshot. For
  // drafts we render the live bodyJson.
  const body =
    summary.status === "PUBLISHED" && summary.snapshotJson
      ? ((summary.snapshotJson as { body: MetaConsensusSummaryBody }).body ??
        (summary.bodyJson as MetaConsensusSummaryBody))
      : (summary.bodyJson as MetaConsensusSummaryBody);

  const supportingTags = React.useMemo(() => detail?.supportingTags ?? [], [detail]);
  const tagsById = React.useMemo(() => {
    const m = new Map<string, DisagreementTagDTO>();
    for (const t of supportingTags) m.set(t.id, t);
    return m;
  }, [supportingTags]);

  const isRetracted = summary.status === "RETRACTED";

  return (
    <Card
      className={`space-y-3 p-4 ${isRetracted ? "opacity-60" : ""} ${className ?? ""}`}
      role="article"
      aria-labelledby={`meta-summary-${summary.id}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
          <h3
            id={`meta-summary-${summary.id}`}
            className="text-sm font-semibold text-slate-800"
          >
            Meta-consensus · v{summary.version}
          </h3>
          <StatusBadge status={summary.status} />
        </div>
        {hydrate && (
          <ChainValidityBadge
            valid={detail?.hashChainValid ?? null}
            failedIndex={null}
            chainLabel="meta-consensus chain"
          />
        )}
      </header>

      {summary.publishedAt && (
        <p className="text-[11px] text-slate-500">
          Published {new Date(summary.publishedAt).toLocaleString()}
        </p>
      )}
      {isRetracted && summary.retractedReasonText && (
        <p className="text-[11px] text-rose-700">
          Retracted: {summary.retractedReasonText}
        </p>
      )}

      {summary.narrativeText && (
        <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
          {summary.narrativeText}
        </p>
      )}

      {body.agreedOn?.length > 0 && (
        <Section title="Agreed on" tone="emerald">
          <ul className="space-y-1 text-sm text-slate-700">
            {body.agreedOn.map((s, i) => (
              <li key={i} className="list-disc pl-1">{s}</li>
            ))}
          </ul>
        </Section>
      )}

      {body.disagreedOn?.length > 0 && (
        <Section title="Typed disagreements" tone="slate">
          <ul className="space-y-2">
            {body.disagreedOn.map((d, i) => (
              <DisagreementRow
                key={i}
                row={d}
                tagsById={tagsById}
                hydrate={hydrate}
              />
            ))}
          </ul>
        </Section>
      )}

      {body.blockers?.length > 0 && (
        <Section title="Blockers" tone="rose">
          <ul className="space-y-1 text-sm text-slate-700">
            {body.blockers.map((s, i) => (
              <li key={i} className="list-disc pl-1">{s}</li>
            ))}
          </ul>
        </Section>
      )}

      {body.nextSteps?.length > 0 && (
        <Section title="Next steps" tone="sky">
          <ul className="space-y-1 text-sm text-slate-700">
            {body.nextSteps.map((s, i) => (
              <li key={i} className="list-disc pl-1">{s}</li>
            ))}
          </ul>
        </Section>
      )}
    </Card>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MetaConsensusSummaryDTO["status"] }) {
  if (status === "PUBLISHED") {
    return (
      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
        Published
      </Badge>
    );
  }
  if (status === "RETRACTED") {
    return (
      <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-700">
        Retracted
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-600">
      Draft
    </Badge>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "emerald" | "rose" | "sky" | "slate";
  children: React.ReactNode;
}) {
  const cls = {
    emerald: "border-emerald-200",
    rose: "border-rose-200",
    sky: "border-sky-200",
    slate: "border-slate-200",
  }[tone];
  return (
    <section className={`rounded border ${cls} bg-white p-2`}>
      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {title}
      </h4>
      {children}
    </section>
  );
}

function DisagreementRow({
  row,
  tagsById,
  hydrate,
}: {
  row: MetaConsensusSummaryBody["disagreedOn"][number];
  tagsById: Map<string, DisagreementTagDTO>;
  hydrate: boolean;
}) {
  const palette = AXIS_CLASSES[row.axisKey];
  const [open, setOpen] = React.useState(false);
  return (
    <li className={`rounded border ${palette.border} ${palette.bg} p-2`}>
      <div className="flex flex-wrap items-center gap-2">
        <AxisBadge axisKey={row.axisKey} count={row.supportingTagIds.length} />
        <span className="flex-1 text-sm text-slate-800">{row.summary}</span>
      </div>
      {hydrate && row.supportingTagIds.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1.5 text-[11px] text-slate-600"
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
              />
              {open ? "Hide" : "Show"} {row.supportingTagIds.length} supporting tag
              {row.supportingTagIds.length === 1 ? "" : "s"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 space-y-1">
            {row.supportingTagIds.map((id) => {
              const t = tagsById.get(id);
              if (!t) {
                return (
                  <p key={id} className="text-[11px] text-slate-400">
                    Tag {id.slice(0, 8)} (unavailable)
                  </p>
                );
              }
              return (
                <div
                  key={id}
                  className="rounded border border-slate-200 bg-white/70 p-1.5 text-[11px] text-slate-700"
                >
                  <div className="mb-0.5 font-medium">conf {fmtConfidence(t.confidence)}</div>
                  <p className="line-clamp-2">{t.evidenceText}</p>
                </div>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      )}
    </li>
  );
}
