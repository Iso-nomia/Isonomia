"use client";

/**
 * FacilitationReport — C3.7
 *
 * Renders the post-session report from
 * GET /api/deliberations/:id/facilitation/report.
 */

import * as React from "react";
import { useFacilitationReport } from "@/components/facilitation/hooks";
import { ChainValidityBadge } from "@/components/facilitation/ChainValidityBadge";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { METRIC_SPECS } from "@/components/facilitation/EquityPanel";

interface ReportDTO {
  sessionId: string;
  deliberationId: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  durationMs: number | null;
  questions: Array<{
    id: string;
    version: number;
    text: string;
    framingType: string;
    lockedAt: string | null;
    authoredById: string;
    lockedById: string | null;
    checkSummary: { block: number; warn: number; info: number };
  }>;
  interventions: {
    total: number;
    applied: number;
    dismissed: number;
    pending: number;
    applyRateByKind: Record<string, { applied: number; total: number }>;
    dismissalTagDistribution: Record<string, number>;
  };
  metrics: Array<{
    metricKind: string;
    finalValue: number | null;
    finalSnapshotId: string | null;
    finalAt: string | null;
    seriesCount: number;
  }>;
  hashChain: { valid: boolean; failedIndex?: number; eventCount: number };
  scopeAReportUrl: string | null;
}

function formatDuration(ms: number | null) {
  if (ms == null) return "—";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export interface FacilitationReportProps {
  deliberationId: string;
  sessionId?: string | null;
}

export function FacilitationReport({
  deliberationId,
  sessionId,
}: FacilitationReportProps) {
  const { data, error, isLoading } = useFacilitationReport(deliberationId, sessionId);
  const report = (data?.report ?? null) as ReportDTO | null;

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">Loading report…</div>;
  }
  if (error) {
    return (
      <div className="p-6 text-sm text-rose-600">
        Failed to load report: {(error as Error).message}
      </div>
    );
  }
  if (!report) {
    return (
      <div className="p-6 text-sm text-slate-500">
        No closed session found for this deliberation.
      </div>
    );
  }

  return (
    <article className="mx-auto w-full space-y-4 p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">
            Facilitation report
          </h1>
          <Badge variant="outline">{report.status}</Badge>
          <ChainValidityBadge
            valid={report.hashChain.valid}
            failedIndex={report.hashChain.failedIndex}
            chainLabel="session chain"
          />
        </div>
        <div className="text-xs text-slate-500">
          Opened {new Date(report.openedAt).toLocaleString()} ·{" "}
          {report.closedAt ? `closed ${new Date(report.closedAt).toLocaleString()}` : "in progress"} ·{" "}
          duration {formatDuration(report.durationMs)} ·{" "}
          {report.hashChain.eventCount} events
        </div>
      </header>

      {/* Metrics */}
      <Card className="p-4 bg-white">
        <h2 className="mb-2 text-sm font-medium text-slate-800">Final metrics</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {report.metrics.map((m) => {
            const spec = METRIC_SPECS.find((s) => s.kind === m.metricKind);
            const label = spec?.label ?? m.metricKind;
            const fmt = spec?.format ?? ((v: number) => v.toFixed(2));
            return (
              <div
                key={m.metricKind}
                className="rounded border border-slate-200 bg-slate-50 p-2"
              >
                <div className="text-xs text-slate-500">{label}</div>
                <div className="text-lg font-semibold tabular-nums text-slate-900">
                  {m.finalValue == null ? "—" : fmt(m.finalValue)}
                </div>
                <div className="text-[10px] text-slate-400">
                  {m.seriesCount} samples
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Interventions */}
      <Card className="p-4 bg-white">
        <h2 className="mb-2 text-sm font-medium text-slate-800">Interventions</h2>
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">Total {report.interventions.total}</Badge>
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            Applied {report.interventions.applied}
          </Badge>
          <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
            Dismissed {report.interventions.dismissed}
          </Badge>
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
            Pending {report.interventions.pending}
          </Badge>
        </div>

        <h3 className="mb-1 text-xs font-medium  text-slate-700">Apply rate by kind</h3>
        <ul className="mb-3 space-y-1 text-xs">
          {Object.entries(report.interventions.applyRateByKind).map(([k, v]) => {
            const rate = v.total === 0 ? 0 : (v.applied / v.total) * 100;
            return (
              <li key={k} className="flex items-center gap-2">
                <span className="w-56 text-slate-700">
                  {k.toLowerCase().replace(/_/g, " ")}
                </span>
                <div className="h-2 flex-1 rounded bg-slate-100">
                  <div
                    className="h-full rounded bg-emerald-400"
                    style={{ width: `${Math.min(100, rate)}%` }}
                  />
                </div>
                <span className="w-20 text-right text-slate-500 tabular-nums">
                  {v.applied}/{v.total}
                </span>
              </li>
            );
          })}
        </ul>

        <h3 className="mb-1 text-xs font-medium text-slate-700">
          Dismissal reasons
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(report.interventions.dismissalTagDistribution).length === 0 && (
            <span className="text-xs italic text-slate-500">No dismissals.</span>
          )}
          {Object.entries(report.interventions.dismissalTagDistribution).map(
            ([tag, n]) => (
              <Badge key={tag} variant="outline">
                {tag}: {n}
              </Badge>
            ),
          )}
        </div>
      </Card>

      {/* Questions */}
      <Card className="p-4 bg-white">
        <h2 className="mb-2 text-sm font-medium text-slate-800">
          Locked questions ({report.questions.length})
        </h2>
        {report.questions.length === 0 && (
          <div className="text-xs italic text-slate-500">
            No questions were locked during this session.
          </div>
        )}
        <ul className="space-y-2">
          {report.questions.map((q) => (
            <li
              key={q.id}
              className="rounded border border-slate-200 p-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline">v{q.version}</Badge>
                <Badge variant="outline">{q.framingType}</Badge>
                {q.lockedAt && (
                  <span className="text-xs text-slate-500">
                    locked {new Date(q.lockedAt).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="mt-1 text-slate-800">{q.text}</div>
              <div className="mt-1 flex gap-1.5 text-xs">
                <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">
                  BLOCK {q.checkSummary.block}
                </Badge>
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                  WARN {q.checkSummary.warn}
                </Badge>
                <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                  INFO {q.checkSummary.info}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Hash chain attestation */}
      <Card className="p-4 bg-white">
        <h2 className="mb-2 text-sm font-medium text-slate-800">
          Hash-chain attestation
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <ChainValidityBadge
            valid={report.hashChain.valid}
            failedIndex={report.hashChain.failedIndex}
            chainLabel="session chain"
          />
          <span className="text-slate-600">
            {report.hashChain.eventCount} events on chain
          </span>
        </div>
        {!report.hashChain.valid && (
          <p className="mt-2 text-xs text-rose-700">
            Chain failed at index {report.hashChain.failedIndex}. This report
            should not be relied upon for downstream consumers.
          </p>
        )}
        {report.scopeAReportUrl && (
          <p className="mt-2 text-xs">
            <a
              href={report.scopeAReportUrl}
              className="text-indigo-700 underline"
            >
              View linked Scope A pathway report →
            </a>
          </p>
        )}
      </Card>
    </article>
  );
}
