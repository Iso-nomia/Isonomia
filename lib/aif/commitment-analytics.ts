// lib/aif/commitment-analytics.ts
/**
 * Commitment Analytics - Aggregate Metrics and Insights
 * 
 * Computes deliberation-wide commitment statistics for dashboard visualization:
 * - Participation metrics (rate, unique participants, activity distribution)
 * - Consensus metrics (claim agreement scores, polarization)
 * - Temporal patterns (velocity, acceleration, peak times)
 * - Retraction analysis (stability, commitment churn)
 */

export interface CommitmentStore {
  participantId: string;
  participantName: string;
  commitments: Array<{
    claimId: string;
    claimText: string;
    moveId: string;
    moveKind: "ASSERT" | "CONCEDE" | "RETRACT";
    timestamp: string;
    isActive: boolean;
  }>;
}

export interface ParticipationMetrics {
  totalParticipants: number;
  activeParticipants: number; // Have at least 1 active commitment
  totalCommitments: number;
  activeCommitments: number;
  totalRetractions: number;
  participationRate: number; // % of participants with commitments
  avgCommitmentsPerParticipant: number;
  medianCommitmentsPerParticipant: number;
}

export interface ClaimConsensus {
  claimId: string;
  claimText: string;
  commitmentCount: number;
  activeCount: number;
  retractedCount: number;
  consensusScore: number; // % of participants who committed
  activeConsensusScore: number; // % with active commitments
  isPolarizing: boolean; // High commitment + high retraction rate
  stability: number; // 1 - (retracted / total)
}

export interface TemporalMetrics {
  firstCommitment: string | null;
  lastCommitment: string | null;
  durationDays: number;
  commitmentsPerDay: number; // Velocity
  commitmentsByHour: Record<number, number>; // 0-23 hour distribution
  commitmentsByDayOfWeek: Record<number, number>; // 0-6 (Sun-Sat)
  peakActivityHour: number;
  peakActivityDay: number;
  recentTrend: "increasing" | "decreasing" | "stable"; // Last 7 days vs prior 7
}

export interface RetractionAnalysis {
  totalRetractions: number;
  retractionRate: number; // % of commitments that were retracted
  avgTimeToRetraction: number; // Hours between ASSERT and RETRACT
  participantsWithRetractions: number;
  mostRetractedClaims: Array<{
    claimId: string;
    claimText: string;
    retractionCount: number;
  }>;
  participantsWithMostRetractions: Array<{
    participantId: string;
    participantName: string;
    retractionCount: number;
  }>;
}

export interface ParticipantAgreement {
  participant1Id: string;
  participant1Name: string;
  participant2Id: string;
  participant2Name: string;
  sharedClaims: number; // Count of claims both committed to (active)
  totalClaims: number; // Union of claims either committed to
  agreementScore: number; // Jaccard similarity: shared / total (0-1)
  overlapCoefficient: number; // min(A,B) overlap: shared / min(|A|, |B|)
  sharedClaimIds: string[]; // IDs of shared claims
}

export interface ParticipantAgreementMatrix {
  participants: Array<{
    id: string;
    name: string;
    activeCommitmentCount: number;
  }>;
  matrix: ParticipantAgreement[][]; // N×N matrix where matrix[i][j] = agreement between i and j
  coalitions: Array<{
    memberIds: string[];
    memberNames: string[];
    avgInternalAgreement: number;
    size: number;
  }>;
  avgAgreement: number; // Average agreement across all pairs
  maxAgreement: number;
  minAgreement: number;
}

export interface CommitmentAnalytics {
  participation: ParticipationMetrics;
  consensus: ClaimConsensus[];
  temporal: TemporalMetrics;
  retractions: RetractionAnalysis;
  agreementMatrix: ParticipantAgreementMatrix;
  topClaims: ClaimConsensus[]; // Top 10 by consensus
  computedAt: string;
}

/**
 * Compute comprehensive analytics from commitment stores
 */
export function computeCommitmentAnalytics(
  stores: CommitmentStore[]
): CommitmentAnalytics {
  const participation = computeParticipationMetrics(stores);
  const consensus = computeClaimConsensus(stores);
  const temporal = computeTemporalMetrics(stores);
  const retractions = computeRetractionAnalysis(stores);
  const agreementMatrix = computeParticipantAgreementMatrix(stores);

  return {
    participation,
    consensus,
    temporal,
    retractions,
    agreementMatrix,
    topClaims: consensus
      .sort((a, b) => b.consensusScore - a.consensusScore)
      .slice(0, 10),
    computedAt: new Date().toISOString(),
  };
}

/**
 * Participation Metrics
 */
function computeParticipationMetrics(
  stores: CommitmentStore[]
): ParticipationMetrics {
  const totalParticipants = stores.length;
  const activeParticipants = stores.filter((s) =>
    s.commitments.some((c) => c.isActive)
  ).length;

  const allCommitments = stores.flatMap((s) => s.commitments);
  const totalCommitments = allCommitments.length;
  const activeCommitments = allCommitments.filter((c) => c.isActive).length;
  const totalRetractions = allCommitments.filter(
    (c) => c.moveKind === "RETRACT"
  ).length;

  const commitmentsPerParticipant = stores.map((s) => s.commitments.length);
  const avgCommitmentsPerParticipant =
    totalParticipants > 0
      ? commitmentsPerParticipant.reduce((a, b) => a + b, 0) / totalParticipants
      : 0;

  const sorted = [...commitmentsPerParticipant].sort((a, b) => a - b);
  const medianCommitmentsPerParticipant =
    sorted.length > 0
      ? sorted[Math.floor(sorted.length / 2)]
      : 0;

  const participationRate = totalParticipants > 0 ? activeParticipants / totalParticipants : 0;

  return {
    totalParticipants,
    activeParticipants,
    totalCommitments,
    activeCommitments,
    totalRetractions,
    participationRate,
    avgCommitmentsPerParticipant,
    medianCommitmentsPerParticipant,
  };
}

/**
 * Claim Consensus Analysis
 */
function computeClaimConsensus(
  stores: CommitmentStore[]
): ClaimConsensus[] {
  const totalParticipants = stores.length;
  const claimMap = new Map<
    string,
    {
      text: string;
      // Per-participant aggregation: per claimId, track which participants
      // have any commitment and which currently have an active one.
      // This is critical because `commitments` is move history — a single
      // participant asserting the same claim twice should count once for
      // consensus, not twice.
      participants: Set<string>;
      activeParticipants: Set<string>;
      commitments: Array<{ isActive: boolean; timestamp: string }>;
    }
  >();

  // Aggregate commitments by claim
  for (const store of stores) {
    // Per-claim, per-participant active flag (latest move wins for this
    // participant). `getCommitmentStores` already sets `isActive=false`
    // on history rows that were later retracted, and `isActive=true` on
    // rows that are currently in the active set, so a simple OR over the
    // participant's own rows for this claim is correct.
    const seenForParticipant = new Map<string, { active: boolean }>();
    for (const c of store.commitments) {
      const cur = seenForParticipant.get(c.claimId);
      if (!cur) seenForParticipant.set(c.claimId, { active: c.isActive });
      else if (c.isActive) cur.active = true;
    }

    for (const commitment of store.commitments) {
      if (!claimMap.has(commitment.claimId)) {
        claimMap.set(commitment.claimId, {
          text: commitment.claimText,
          participants: new Set(),
          activeParticipants: new Set(),
          commitments: [],
        });
      }
      const entry = claimMap.get(commitment.claimId)!;
      entry.commitments.push({
        isActive: commitment.isActive,
        timestamp: commitment.timestamp,
      });
      entry.participants.add(store.participantId);
      if (seenForParticipant.get(commitment.claimId)?.active) {
        entry.activeParticipants.add(store.participantId);
      }
    }
  }

  // Compute consensus metrics for each claim
  const result: ClaimConsensus[] = [];
  for (const [claimId, data] of claimMap.entries()) {
    const commitmentCount = data.commitments.length;
    const activeCount = data.commitments.filter((c) => c.isActive).length;
    const retractedCount = commitmentCount - activeCount;

    // Consensus = fraction of distinct participants who committed (or have
    // an active commitment). Bounded in [0, 1]. The previous formula used
    // raw move count and produced > 1 (e.g. 400%) when a single participant
    // re-asserted the same claim across multiple moves.
    const distinctCommitters = data.participants.size;
    const distinctActiveCommitters = data.activeParticipants.size;
    const consensusScore =
      totalParticipants > 0 ? distinctCommitters / totalParticipants : 0;
    const activeConsensusScore =
      totalParticipants > 0 ? distinctActiveCommitters / totalParticipants : 0;

    const stability = commitmentCount > 0 ? activeCount / commitmentCount : 1;
    const isPolarizing = commitmentCount >= 3 && retractedCount / commitmentCount > 0.3;

    result.push({
      claimId,
      claimText: data.text,
      commitmentCount,
      activeCount,
      retractedCount,
      consensusScore,
      activeConsensusScore,
      isPolarizing,
      stability,
    });
  }

  return result;
}

/**
 * Temporal Analysis
 */
function computeTemporalMetrics(
  stores: CommitmentStore[]
): TemporalMetrics {
  const allCommitments = stores.flatMap((s) => s.commitments);
  const timestamps = allCommitments.map((c) => new Date(c.timestamp));

  if (timestamps.length === 0) {
    return {
      firstCommitment: null,
      lastCommitment: null,
      durationDays: 0,
      commitmentsPerDay: 0,
      commitmentsByHour: {},
      commitmentsByDayOfWeek: {},
      peakActivityHour: 0,
      peakActivityDay: 0,
      recentTrend: "stable",
    };
  }

  timestamps.sort((a, b) => a.getTime() - b.getTime());
  const firstCommitment = timestamps[0].toISOString();
  const lastCommitment = timestamps[timestamps.length - 1].toISOString();
  const durationMs = timestamps[timestamps.length - 1].getTime() - timestamps[0].getTime();
  const durationDays = Math.max(1, durationMs / (1000 * 60 * 60 * 24));
  const commitmentsPerDay = timestamps.length / durationDays;

  // Distribution by hour
  const commitmentsByHour: Record<number, number> = {};
  const commitmentsByDayOfWeek: Record<number, number> = {};

  for (const ts of timestamps) {
    const hour = ts.getHours();
    const day = ts.getDay();
    commitmentsByHour[hour] = (commitmentsByHour[hour] || 0) + 1;
    commitmentsByDayOfWeek[day] = (commitmentsByDayOfWeek[day] || 0) + 1;
  }

  const peakActivityHour = Object.entries(commitmentsByHour).sort(
    ([, a], [, b]) => b - a
  )[0]?.[0] ? parseInt(Object.entries(commitmentsByHour).sort(
    ([, a], [, b]) => b - a
  )[0][0]) : 0;

  const peakActivityDay = Object.entries(commitmentsByDayOfWeek).sort(
    ([, a], [, b]) => b - a
  )[0]?.[0] ? parseInt(Object.entries(commitmentsByDayOfWeek).sort(
    ([, a], [, b]) => b - a
  )[0][0]) : 0;

  // Recent trend (last 7 days vs prior 7 days)
  const now = new Date();
  const last7Days = timestamps.filter(
    (ts) => now.getTime() - ts.getTime() <= 7 * 24 * 60 * 60 * 1000
  ).length;
  const prior7Days = timestamps.filter(
    (ts) =>
      now.getTime() - ts.getTime() > 7 * 24 * 60 * 60 * 1000 &&
      now.getTime() - ts.getTime() <= 14 * 24 * 60 * 60 * 1000
  ).length;

  let recentTrend: "increasing" | "decreasing" | "stable" = "stable";
  if (last7Days > prior7Days * 1.2) recentTrend = "increasing";
  else if (last7Days < prior7Days * 0.8) recentTrend = "decreasing";

  return {
    firstCommitment,
    lastCommitment,
    durationDays,
    commitmentsPerDay,
    commitmentsByHour,
    commitmentsByDayOfWeek,
    peakActivityHour,
    peakActivityDay,
    recentTrend,
  };
}

/**
 * Retraction Analysis
 */
function computeRetractionAnalysis(
  stores: CommitmentStore[]
): RetractionAnalysis {
  const allCommitments = stores.flatMap((s) =>
    s.commitments.map((c) => ({ ...c, participantId: s.participantId, participantName: s.participantName }))
  );

  const retractions = allCommitments.filter((c) => c.moveKind === "RETRACT");
  const totalRetractions = retractions.length;
  const totalCommitments = allCommitments.filter(
    (c) => c.moveKind !== "RETRACT"
  ).length;
  const retractionRate = totalCommitments > 0 ? totalRetractions / totalCommitments : 0;

  // Calculate time to retraction
  const timesToRetraction: number[] = [];
  const claimAssertions = new Map<string, Map<string, string>>(); // claimId -> participantId -> timestamp

  for (const commitment of allCommitments) {
    if (commitment.moveKind === "ASSERT" || commitment.moveKind === "CONCEDE") {
      if (!claimAssertions.has(commitment.claimId)) {
        claimAssertions.set(commitment.claimId, new Map());
      }
      claimAssertions.get(commitment.claimId)!.set(commitment.participantId, commitment.timestamp);
    } else if (commitment.moveKind === "RETRACT") {
      const assertTime = claimAssertions.get(commitment.claimId)?.get(commitment.participantId);
      if (assertTime) {
        const timeDiff = new Date(commitment.timestamp).getTime() - new Date(assertTime).getTime();
        timesToRetraction.push(timeDiff / (1000 * 60 * 60)); // Convert to hours
      }
    }
  }

  const avgTimeToRetraction =
    timesToRetraction.length > 0
      ? timesToRetraction.reduce((a, b) => a + b, 0) / timesToRetraction.length
      : 0;

  const participantsWithRetractions = new Set(retractions.map((r) => r.participantId)).size;

  // Most retracted claims
  const claimRetractionCounts = new Map<string, { text: string; count: number }>();
  for (const retraction of retractions) {
    if (!claimRetractionCounts.has(retraction.claimId)) {
      claimRetractionCounts.set(retraction.claimId, {
        text: retraction.claimText,
        count: 0,
      });
    }
    claimRetractionCounts.get(retraction.claimId)!.count++;
  }

  const mostRetractedClaims = Array.from(claimRetractionCounts.entries())
    .map(([claimId, data]) => ({
      claimId,
      claimText: data.text,
      retractionCount: data.count,
    }))
    .sort((a, b) => b.retractionCount - a.retractionCount)
    .slice(0, 5);

  // Participants with most retractions
  const participantRetractionCounts = new Map<string, { name: string; count: number }>();
  for (const retraction of retractions) {
    if (!participantRetractionCounts.has(retraction.participantId)) {
      participantRetractionCounts.set(retraction.participantId, {
        name: retraction.participantName,
        count: 0,
      });
    }
    participantRetractionCounts.get(retraction.participantId)!.count++;
  }

  const participantsWithMostRetractions = Array.from(participantRetractionCounts.entries())
    .map(([participantId, data]) => ({
      participantId,
      participantName: data.name,
      retractionCount: data.count,
    }))
    .sort((a, b) => b.retractionCount - a.retractionCount)
    .slice(0, 5);

  return {
    totalRetractions,
    retractionRate,
    avgTimeToRetraction,
    participantsWithRetractions,
    mostRetractedClaims,
    participantsWithMostRetractions,
  };
}

/**
 * Compute Participant Agreement Matrix
 * 
 * Builds an N×N matrix showing pairwise agreement between participants.
 * Agreement is calculated based on shared active commitments.
 * Also detects coalitions (groups with high internal agreement).
 */
function computeParticipantAgreementMatrix(
  stores: CommitmentStore[]
): ParticipantAgreementMatrix {
  // Build participant metadata
  const participants = stores.map((store) => ({
    id: store.participantId,
    name: store.participantName,
    activeCommitmentCount: store.commitments.filter((c) => c.isActive).length,
  }));

  // Build sets of active claim IDs for each participant
  const activeClaimSets = new Map<string, Set<string>>();
  for (const store of stores) {
    const activeClaimIds = new Set(
      store.commitments
        .filter((c) => c.isActive)
        .map((c) => c.claimId)
    );
    activeClaimSets.set(store.participantId, activeClaimIds);
  }

  // Build N×N agreement matrix
  const n = participants.length;
  const matrix: ParticipantAgreement[][] = [];
  const allAgreements: number[] = [];

  for (let i = 0; i < n; i++) {
    const row: ParticipantAgreement[] = [];
    const p1 = participants[i];
    const claims1 = activeClaimSets.get(p1.id) || new Set();

    for (let j = 0; j < n; j++) {
      const p2 = participants[j];
      const claims2 = activeClaimSets.get(p2.id) || new Set();

      // Calculate agreement metrics
      const sharedClaimIds = Array.from(claims1).filter((id) => claims2.has(id));
      const sharedCount = sharedClaimIds.length;
      const unionCount = new Set([...claims1, ...claims2]).size;
      
      // Jaccard similarity: intersection / union
      const agreementScore = unionCount > 0 ? sharedCount / unionCount : 0;
      
      // Overlap coefficient: intersection / min(|A|, |B|)
      const minSize = Math.min(claims1.size, claims2.size);
      const overlapCoefficient = minSize > 0 ? sharedCount / minSize : 0;

      const agreement: ParticipantAgreement = {
        participant1Id: p1.id,
        participant1Name: p1.name,
        participant2Id: p2.id,
        participant2Name: p2.name,
        sharedClaims: sharedCount,
        totalClaims: unionCount,
        agreementScore,
        overlapCoefficient,
        sharedClaimIds,
      };

      row.push(agreement);

      // Collect non-diagonal agreements for stats
      if (i !== j && agreementScore > 0) {
        allAgreements.push(agreementScore);
      }
    }

    matrix.push(row);
  }

  // Calculate aggregate statistics
  const avgAgreement =
    allAgreements.length > 0
      ? allAgreements.reduce((a, b) => a + b, 0) / allAgreements.length
      : 0;
  const maxAgreement = allAgreements.length > 0 ? Math.max(...allAgreements) : 0;
  const minAgreement = allAgreements.length > 0 ? Math.min(...allAgreements) : 0;

  // Detect coalitions using simple clustering
  // A coalition is a group where internal agreement > 0.7
  const coalitions = detectCoalitions(matrix, participants, 0.7);

  return {
    participants,
    matrix,
    coalitions,
    avgAgreement,
    maxAgreement,
    minAgreement,
  };
}

/**
 * Detect coalitions using greedy clustering
 * Groups participants with high mutual agreement (> threshold)
 */
function detectCoalitions(
  matrix: ParticipantAgreement[][],
  participants: ParticipantAgreementMatrix["participants"],
  threshold: number
): ParticipantAgreementMatrix["coalitions"] {
  const n = participants.length;
  const visited = new Set<number>();
  const coalitions: ParticipantAgreementMatrix["coalitions"] = [];

  for (let i = 0; i < n; i++) {
    if (visited.has(i)) continue;

    // Start a new potential coalition
    const coalition: number[] = [i];
    visited.add(i);

    // Find all participants with high agreement to this coalition
    for (let j = i + 1; j < n; j++) {
      if (visited.has(j)) continue;

      // Check if j has high agreement with all coalition members
      const avgAgreementWithCoalition =
        coalition.reduce((sum, memberIdx) => {
          return sum + matrix[memberIdx][j].agreementScore;
        }, 0) / coalition.length;

      if (avgAgreementWithCoalition >= threshold) {
        coalition.push(j);
        visited.add(j);
      }
    }

    // Only keep coalitions with 2+ members
    if (coalition.length >= 2) {
      // Calculate internal agreement
      const internalAgreements: number[] = [];
      for (let a = 0; a < coalition.length; a++) {
        for (let b = a + 1; b < coalition.length; b++) {
          internalAgreements.push(
            matrix[coalition[a]][coalition[b]].agreementScore
          );
        }
      }

      const avgInternalAgreement =
        internalAgreements.length > 0
          ? internalAgreements.reduce((sum, score) => sum + score, 0) /
            internalAgreements.length
          : 0;

      coalitions.push({
        memberIds: coalition.map((idx) => participants[idx].id),
        memberNames: coalition.map((idx) => participants[idx].name),
        avgInternalAgreement,
        size: coalition.length,
      });
    }
  }

  // Sort by size descending
  coalitions.sort((a, b) => b.size - a.size);

  return coalitions;
}
