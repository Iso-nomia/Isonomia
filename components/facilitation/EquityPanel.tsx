"use client";

/**
 * EquityPanel — C3.3
 *
 * Left column of the cockpit. Renders a card per metric kind with:
 *   - Current value + threshold marker.
 *   - Inline sparkline over the session window (history endpoint).
 *   - Click → drill-down modal showing breakdownJson and full series.
 */

import * as React from "react";
import {
  useFacilitationCurrentMetrics,
  useFacilitationMetricHistory,
  type EquityMetricKind,
  type MetricSnapshotDTO,
} from "@/components/facilitation/hooks";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface MetricSpec {
  kind: EquityMetricKind;
  label: string;
  description: string;
  /** Soft threshold; values >= warn render an amber marker. */
  warn: number;
  /** Hard threshold; values >= alert render a rose marker. */
  alert: number;
  /** Lower-is-better metrics flip the threshold direction. */
  invert?: boolean;
  format: (v: number) => string;
}

export const METRIC_SPECS: MetricSpec[] = [
  {
    kind: "PARTICIPATION_GINI",
    label: "Participation Gini",
    description: "Inequality of contributions across participants (0 = even, 1 = one voice).",
    warn: 0.4,
    alert: 0.6,
    format: (v) => v.toFixed(2),
  },
  {
    kind: "CHALLENGE_CONCENTRATION",
    label: "Challenge concentration",
    description: "Share of challenges originated by the top 20% of authors.",
    warn: 0.5,
    alert: 0.7,
    format: (v) => `${(v * 100).toFixed(0)}%`,
  },
  {
    kind: "RESPONSE_LATENCY_P50",
    label: "Median response latency",
    description: "Median minutes between a reply-able post and its first response.",
    warn: 30,
    alert: 60,
    format: (v) => `${Math.round(v)}m`,
  },
  {
    kind: "ATTENTION_DEFICIT",
    label: "Attention deficit",
    description: "Share of recent claims with no engagement after the reply window opened.",
    warn: 0.3,
    alert: 0.5,
    format: (v) => `${(v * 100).toFixed(0)}%`,
  },
  {
    kind: "FACILITATOR_LOAD",
    label: "Facilitator load",
    description: "Pending interventions awaiting facilitator action.",
    warn: 5,
    alert: 10,
    format: (v) => `${Math.round(v)}`,
  },
];

function severity(spec: MetricSpec, v: number | null) {
  if (v == null) return "idle";
  if (spec.invert) {
    if (v <= spec.alert) return "alert";
    if (v <= spec.warn) return "warn";
    return "ok";
  }
  if (v >= spec.alert) return "alert";
  if (v >= spec.warn) return "warn";
  return "ok";
}

function severityClasses(sev: string) {
  switch (sev) {
    case "alert":
      return "border-rose-300 bg-rose-50";
    case "warn":
      return "border-amber-300 bg-amber-50";
    case "ok":
      return "border-emerald-200 bg-emerald-50/40";
    default:
      return "border-slate-200 bg-white";
  }
}

function severityDot(sev: string) {
  switch (sev) {
    case "alert":
      return "bg-rose-500";
    case "warn":
      return "bg-amber-500";
    case "ok":
      return "bg-emerald-500";
    default:
      return "bg-slate-300";
  }
}

interface SparklineProps {
  values: number[];
  warn: number;
  alert: number;
  invert?: boolean;
  width?: number;
  height?: number;
}

function Sparkline({
  values,
  warn,
  alert,
  invert,
  width = 120,
  height = 32,
}: SparklineProps) {
  if (values.length === 0) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke="#e2e8f0" />
      </svg>
    );
  }
  const min = Math.min(...values, warn, alert, 0);
  const max = Math.max(...values, warn, alert, 1);
  const span = max - min || 1;
  const scale = (v: number) => height - ((v - min) / span) * height;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${scale(v).toFixed(1)}`)
    .join(" ");
  const last = values[values.length - 1];
  return (
    <svg width={width} height={height} aria-hidden="true">
      <line
        x1={0}
        x2={width}
        y1={scale(warn)}
        y2={scale(warn)}
        stroke="#f59e0b"
        strokeOpacity={0.4}
        strokeDasharray="2 2"
      />
      <line
        x1={0}
        x2={width}
        y1={scale(alert)}
        y2={scale(alert)}
        stroke="#f43f5e"
        strokeOpacity={0.4}
        strokeDasharray="2 2"
      />
      <path d={path} fill="none" stroke="#0f172a" strokeWidth={1.5} />
      <circle cx={width - 1} cy={scale(last)} r={2.5} fill="#0f172a" />
    </svg>
  );
}

interface MetricCardProps {
  spec: MetricSpec;
  snapshot: MetricSnapshotDTO | null;
  deliberationId: string;
  onOpen: () => void;
}

function MetricCard({ spec, snapshot, deliberationId, onOpen }: MetricCardProps) {
  const { data: history } = useFacilitationMetricHistory(deliberationId, spec.kind, 30);
  const series = (history?.items ?? []).map((s) => s.value);
  const value = snapshot?.value ?? null;
  const sev = severity(spec, value);
  return (
    <Card
      className={`cursor-pointer p-3 transition hover:shadow-sm ${severityClasses(sev)}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`${spec.label} — open details`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${severityDot(sev)}`}
              aria-hidden="true"
            />
            <h4 className="text-xs font-medium text-slate-700">{spec.label}</h4>
          </div>
          <div className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
            {value == null ? "—" : spec.format(value)}
          </div>
        </div>
        <Sparkline
          values={series}
          warn={spec.warn}
          alert={spec.alert}
          invert={spec.invert}
        />
      </div>
    </Card>
  );
}

interface DrillDownProps {
  spec: MetricSpec | null;
  deliberationId: string;
  snapshot: MetricSnapshotDTO | null;
  onClose: () => void;
}

function DrillDown({ spec, deliberationId, snapshot, onClose }: DrillDownProps) {
  const { data } = useFacilitationMetricHistory(deliberationId, spec?.kind ?? null, 200);
  if (!spec) return null;
  const items = data?.items ?? [];
  return (
    <Dialog open={!!spec} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{spec.label}</DialogTitle>
          <DialogDescription>{spec.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-xs text-slate-500">Current</div>
              <div className="text-2xl font-semibold tabular-nums">
                {snapshot ? spec.format(snapshot.value) : "—"}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="outline">warn ≥ {spec.format(spec.warn)}</Badge>
              <Badge variant="outline">alert ≥ {spec.format(spec.alert)}</Badge>
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-2">
            <Sparkline
              values={items.map((s) => s.value)}
              warn={spec.warn}
              alert={spec.alert}
              invert={spec.invert}
              width={560}
              height={96}
            />
            <div className="mt-1 text-xs text-slate-500">
              {items.length} samples
            </div>
          </div>
          {snapshot?.breakdownJson != null && (
            <div>
              <h4 className="mb-1 text-xs font-medium text-slate-700">Breakdown</h4>
              <pre className="max-h-60 overflow-auto rounded bg-slate-900 p-2 text-xs text-slate-100">
                {JSON.stringify(snapshot.breakdownJson, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export interface EquityPanelProps {
  deliberationId: string;
  className?: string;
}

export function EquityPanel({ deliberationId, className }: EquityPanelProps) {
  const { data, error, isLoading } = useFacilitationCurrentMetrics(deliberationId);
  const [open, setOpen] = React.useState<MetricSpec | null>(null);
  const byKind = new Map<EquityMetricKind, MetricSnapshotDTO>();
  for (const s of data?.snapshots ?? []) {
    if (s) byKind.set(s.metricKind, s);
  }
  return (
    <section className={`flex h-full overflow-y-auto flex-col ${className ?? ""}`} aria-label="Equity metrics">
      <header className="border-b border-slate-200 px-3 py-2">
        <h3 className="text-sm font-medium text-slate-800">Equity metrics</h3>
        {data?.sessionId == null && (
          <p className="text-xs text-slate-500 italic">No active session.</p>
        )}
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar p-3">
        {isLoading && !data && <div className="text-sm text-slate-500">Loading…</div>}
        {error && (
          <div className="text-sm text-rose-600">
            Failed: {(error as Error).message}
          </div>
        )}
        {METRIC_SPECS.map((spec) => (
          <MetricCard
            key={spec.kind}
            spec={spec}
            snapshot={byKind.get(spec.kind) ?? null}
            deliberationId={deliberationId}
            onOpen={() => setOpen(spec)}
          />
        ))}
      </div>
      <DrillDown
        spec={open}
        deliberationId={deliberationId}
        snapshot={open ? byKind.get(open.kind) ?? null : null}
        onClose={() => setOpen(null)}
      />
    </section>
  );
}
