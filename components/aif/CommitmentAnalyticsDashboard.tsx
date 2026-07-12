// components/aif/CommitmentAnalyticsDashboard.tsx
"use client";
import * as React from "react";
import useSWR from "swr";
import { Chart as ChartJS, registerables } from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Clock,
  AlertTriangle,
  Loader2,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import type { CommitmentAnalytics } from "@/lib/aif/commitment-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ParticipantAgreementMatrixView from "./ParticipantAgreementMatrixView";

ChartJS.register(...registerables);

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface CommitmentAnalyticsDashboardProps {
  deliberationId: string;
  className?: string;
}

/**
 * CommitmentAnalyticsDashboard
 * 
 * Comprehensive analytics dashboard for commitment activity:
 * - Overview metrics cards (participation, velocity, retractions)
 * - Temporal activity chart (commitments over time)
 * - Consensus distribution (top claims by commitment)
 * - Retraction analysis (stability metrics)
 * - Activity heatmap (hour/day distribution)
 * 
 * Data cached with 5-minute TTL via Redis on server
 */
export function CommitmentAnalyticsDashboard({
  deliberationId,
  className = "",
}: CommitmentAnalyticsDashboardProps) {
  const [refreshKey, setRefreshKey] = React.useState(0);

  const { data: analytics, error, isLoading, mutate } = useSWR<CommitmentAnalytics>(
    `/api/aif/dialogue/${deliberationId}/commitment-analytics${refreshKey > 0 ? '?refresh=true' : ''}`,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 300000, // 5 minutes
    }
  );

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Loading analytics...</span>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="flex items-center justify-center py-12 text-red-600">
        <AlertCircle className="h-5 w-5 mr-2" />
        <span className="text-sm">Failed to load analytics</span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Commitment Analytics</h2>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Commitments"
          value={analytics.participation.totalCommitments}
          subtitle={`${analytics.participation.activeCommitments} active`}
          icon={<Target className="h-5 w-5" />}
          trend={analytics.temporal.recentTrend}
        />
        <MetricCard
          title="Participants"
          value={analytics.participation.totalParticipants}
          subtitle={`${(analytics.participation.participationRate * 100).toFixed(0)}% participation`}
          icon={<Users className="h-5 w-5" />}
        />
        <MetricCard
          title="Commitment Velocity"
          value={analytics.temporal.commitmentsPerDay.toFixed(1)}
          subtitle="per day"
          icon={<TrendingUp className="h-5 w-5" />}
          trend={analytics.temporal.recentTrend}
        />
        <MetricCard
          title="Retraction Rate"
          value={`${(analytics.retractions.retractionRate * 100).toFixed(1)}%`}
          subtitle={`${analytics.retractions.totalRetractions} total`}
          icon={<AlertTriangle className="h-5 w-5" />}
          warning={analytics.retractions.retractionRate > 0.3}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity by Hour */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Activity by Hour
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityByHourChart data={analytics.temporal.commitmentsByHour} />
          </CardContent>
        </Card>

        {/* Activity by Day of Week */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Activity by Day of Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityByDayChart data={analytics.temporal.commitmentsByDayOfWeek} />
          </CardContent>
        </Card>
      </div>

      {/* Top Claims by Consensus */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Top Claims by Consensus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TopClaimsTable claims={analytics.topClaims} />
        </CardContent>
      </Card>

      {/* Retraction Analysis */}
      {analytics.retractions.totalRetractions > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Retraction Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RetractionAnalysisView retractions={analytics.retractions} />
          </CardContent>
        </Card>
      )}

      {/* Participant Agreement Matrix */}
      {analytics.agreementMatrix && <AgreementMatrixSection agreementMatrix={analytics.agreementMatrix} />}
    </div>
  );
}

/**
 * Metric Card Component
 */
function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  warning = false,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: "increasing" | "decreasing" | "stable";
  warning?: boolean;
}) {
  const trendIcon = trend === "increasing" 
    ? <TrendingUp className="h-3.5 w-3.5 text-green-600" />
    : trend === "decreasing"
    ? <TrendingDown className="h-3.5 w-3.5 text-red-600" />
    : null;

  return (
    <Card className={warning ? "border-orange-300 bg-orange-50/30" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              {subtitle}
              {trendIcon}
            </p>
          </div>
          <div className={`p-2 rounded-lg ${warning ? "bg-orange-100" : "bg-sky-100"}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Activity by Hour Chart
 */
function ActivityByHourChart({ data }: { data: Record<number, number> }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const counts = hours.map((h) => data[h] || 0);

  const chartData = {
    labels: hours.map((h) => `${h}:00`),
    datasets: [
      {
        label: "Commitments",
        data: counts,
        backgroundColor: "rgba(56, 189, 248, 0.5)",
        borderColor: "rgba(56, 189, 248, 1)",
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="h-48">
      <Bar
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } },
          },
        }}
      />
    </div>
  );
}

/**
 * Activity by Day of Week Chart
 */
function ActivityByDayChart({ data }: { data: Record<number, number> }) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const counts = days.map((_, i) => data[i] || 0);

  const chartData = {
    labels: days,
    datasets: [
      {
        label: "Commitments",
        data: counts,
        backgroundColor: [
          "rgba(239, 68, 68, 0.5)",
          "rgba(249, 115, 22, 0.5)",
          "rgba(234, 179, 8, 0.5)",
          "rgba(34, 197, 94, 0.5)",
          "rgba(59, 130, 246, 0.5)",
          "rgba(168, 85, 247, 0.5)",
          "rgba(236, 72, 153, 0.5)",
        ],
        borderColor: [
          "rgb(239, 68, 68)",
          "rgb(249, 115, 22)",
          "rgb(234, 179, 8)",
          "rgb(34, 197, 94)",
          "rgb(59, 130, 246)",
          "rgb(168, 85, 247)",
          "rgb(236, 72, 153)",
        ],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="h-48">
      <Bar
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } },
          },
        }}
      />
    </div>
  );
}

/**
 * Top Claims Table
 */
function TopClaimsTable({ claims }: { claims: CommitmentAnalytics["topClaims"] }) {
  return (
    <div className="space-y-2">
      {claims.map((claim, index) => (
        <div
          key={claim.claimId}
          className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
        >
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-900 truncate">{claim.claimText}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-slate-600">
                {claim.commitmentCount} commitments
              </span>
              <span className="text-xs text-slate-600">
                {(claim.consensusScore * 100).toFixed(0)}% consensus
              </span>
              {claim.isPolarizing && (
                <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                  Polarizing
                </span>
              )}
            </div>
          </div>
          <div className="flex-shrink-0">
            <div className="h-2 w-20 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 rounded-full"
                style={{ width: `${claim.consensusScore * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Retraction Analysis View
 */
function RetractionAnalysisView({ retractions }: { retractions: CommitmentAnalytics["retractions"] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-600 uppercase tracking-wide">Avg Time to Retraction</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {retractions.avgTimeToRetraction.toFixed(1)}h
          </p>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-600 uppercase tracking-wide">Participants with Retractions</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {retractions.participantsWithRetractions}
          </p>
        </div>
      </div>

      {retractions.mostRetractedClaims.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
            Most Retracted Claims
          </h4>
          <div className="space-y-2">
            {retractions.mostRetractedClaims.map((claim) => (
              <div
                key={claim.claimId}
                className="flex items-center justify-between p-2 bg-white rounded border border-slate-200"
              >
                <p className="text-xs text-slate-900 truncate flex-1">{claim.claimText}</p>
                <span className="text-xs font-medium text-orange-600 ml-2">
                  {claim.retractionCount} retractions
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Agreement Matrix Section
 */
function AgreementMatrixSection({ agreementMatrix }: { agreementMatrix: CommitmentAnalytics["agreementMatrix"] }) {
  if (!agreementMatrix) {
    return null;
  }

  return (
    <div className="mt-6">
      <ParticipantAgreementMatrixView agreementMatrix={agreementMatrix} />
    </div>
  );
}
