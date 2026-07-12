/**
 * Phase 4.3: ORCID Integration Service
 * Handles OAuth flow, work push, profile sync
 */

import { prisma } from "@/lib/prismaclient";
import { Prisma } from "@prisma/client";
import { OrcidConnectionSummary, OrcidWorkData, OrcidWorkType } from "./types";

// ORCID API configuration
const ORCID_API_BASE =
  process.env.ORCID_API_BASE || "https://api.orcid.org/v3.0";
const ORCID_AUTH_URL =
  process.env.ORCID_AUTH_URL || "https://orcid.org/oauth";
const ORCID_CLIENT_ID = process.env.ORCID_CLIENT_ID!;
const ORCID_CLIENT_SECRET = process.env.ORCID_CLIENT_SECRET!;
const ORCID_REDIRECT_URI = process.env.ORCID_REDIRECT_URI!;

/**
 * Generate ORCID OAuth authorization URL
 */
export function getOrcidAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: ORCID_CLIENT_ID,
    response_type: "code",
    scope: "/activities/update /read-limited",
    redirect_uri: ORCID_REDIRECT_URI,
    state,
  });

  return `${ORCID_AUTH_URL}/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeOrcidCode(code: string): Promise<{
  orcidId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const response = await fetch(`${ORCID_AUTH_URL}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: ORCID_CLIENT_ID,
      client_secret: ORCID_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: ORCID_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to exchange ORCID code");
  }

  const data = await response.json();

  return {
    orcidId: data.orcid,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Connect user's ORCID account
 */
export async function connectOrcid(
  userId: bigint,
  code: string
): Promise<OrcidConnectionSummary> {
  const tokens = await exchangeOrcidCode(code);

  const connection = await prisma.orcidConnection.upsert({
    where: { userId },
    create: {
      userId,
      orcidId: tokens.orcidId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    },
    update: {
      orcidId: tokens.orcidId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    },
    include: {
      syncedWorks: true,
    },
  });

  return {
    id: connection.id,
    userId: connection.userId,
    orcidId: connection.orcidId,
    autoSyncEnabled: connection.autoSyncEnabled,
    lastSyncAt: connection.lastSyncAt || undefined,
    syncedWorkCount: connection.syncedWorks.length,
    hasErrors: !!connection.syncErrors,
  };
}

/**
 * Get user's ORCID connection
 */
export async function getOrcidConnection(
  userId: bigint
): Promise<OrcidConnectionSummary | null> {
  const connection = await prisma.orcidConnection.findUnique({
    where: { userId },
    include: {
      syncedWorks: true,
    },
  });

  if (!connection) return null;

  return {
    id: connection.id,
    userId: connection.userId,
    orcidId: connection.orcidId,
    autoSyncEnabled: connection.autoSyncEnabled,
    lastSyncAt: connection.lastSyncAt || undefined,
    syncedWorkCount: connection.syncedWorks.length,
    hasErrors: !!connection.syncErrors,
  };
}

/**
 * Disconnect ORCID account
 */
export async function disconnectOrcid(userId: bigint): Promise<void> {
  await prisma.orcidConnection.delete({
    where: { userId },
  });
}

/**
 * Toggle auto-sync setting
 */
export async function toggleAutoSync(
  userId: bigint,
  enabled: boolean
): Promise<void> {
  await prisma.orcidConnection.update({
    where: { userId },
    data: { autoSyncEnabled: enabled },
  });
}

/**
 * Refresh ORCID access token
 */
async function refreshOrcidToken(connection: {
  id: string;
  refreshToken: string | null;
}): Promise<string> {
  if (!connection.refreshToken) {
    throw new Error("No refresh token available");
  }

  const response = await fetch(`${ORCID_AUTH_URL}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: ORCID_CLIENT_ID,
      client_secret: ORCID_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: connection.refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh ORCID token");
  }

  const data = await response.json();

  await prisma.orcidConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || connection.refreshToken,
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return data.access_token;
}

/**
 * Push a work to ORCID
 */
export async function pushWorkToOrcid(
  userId: bigint,
  workData: OrcidWorkData
): Promise<void> {
  const connection = await prisma.orcidConnection.findUnique({
    where: { userId },
  });

  if (!connection) {
    throw new Error("ORCID not connected");
  }

  // Refresh token if needed
  let accessToken = connection.accessToken;
  if (
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt < new Date(Date.now() + 60000)
  ) {
    accessToken = await refreshOrcidToken(connection);
  }

  // Convert to ORCID work format
  const orcidWork = formatOrcidWork(workData);

  // Push to ORCID
  const response = await fetch(
    `${ORCID_API_BASE}/${connection.orcidId}/work`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(orcidWork),
    }
  );

  // Track the sync
  const putCode = response.headers.get("Location")?.split("/").pop();

  await prisma.orcidWork.upsert({
    where: {
      connectionId_workType_sourceId: {
        connectionId: connection.id,
        workType: workData.type,
        sourceId: workData.sourceId,
      },
    },
    create: {
      connectionId: connection.id,
      workType: workData.type,
      sourceId: workData.sourceId,
      orcidPutCode: putCode,
      title: workData.title,
      description: workData.description,
      workDate: workData.workDate,
      externalUrl: workData.externalUrl,
      orcidSyncStatus: response.ok ? "SYNCED" : "FAILED",
      syncedAt: response.ok ? new Date() : undefined,
      errorMessage: response.ok ? undefined : await response.text(),
    },
    update: {
      orcidPutCode: putCode,
      title: workData.title,
      description: workData.description,
      orcidSyncStatus: response.ok ? "SYNCED" : "FAILED",
      syncedAt: response.ok ? new Date() : undefined,
      errorMessage: response.ok ? undefined : await response.text(),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to push work to ORCID: ${response.statusText}`);
  }
}

/**
 * Format work data for ORCID API
 */
function formatOrcidWork(workData: OrcidWorkData): object {
  const workType = mapWorkType(workData.type);

  return {
    title: {
      title: { value: workData.title },
    },
    type: workType,
    "publication-date": {
      year: { value: workData.workDate.getFullYear().toString() },
      month: {
        value: (workData.workDate.getMonth() + 1).toString().padStart(2, "0"),
      },
      day: {
        value: workData.workDate.getDate().toString().padStart(2, "0"),
      },
    },
    "short-description": workData.description,
    url: workData.externalUrl ? { value: workData.externalUrl } : undefined,
    "external-ids": {
      "external-id": [
        {
          "external-id-type": "source-work-id",
          "external-id-value": workData.sourceId,
          "external-id-relationship": "self",
        },
      ],
    },
  };
}

/**
 * Map internal work type to ORCID work type
 */
function mapWorkType(type: OrcidWorkType): string {
  const mapping: Record<OrcidWorkType, string> = {
    SCHOLARLY_ARGUMENT: "OTHER",
    PEER_REVIEW: "PEER_REVIEW",
    RESEARCH_SYNTHESIS: "OTHER",
    CITATION: "OTHER",
  };
  return mapping[type];
}

/**
 * Sync all eligible contributions to ORCID
 */
export async function syncAllToOrcid(userId: bigint): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> {
  const connection = await prisma.orcidConnection.findUnique({
    where: { userId },
  });

  if (!connection) {
    throw new Error("ORCID not connected");
  }

  // Get significant contributions
  const contributions = await getEligibleContributions(userId);

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const contrib of contributions) {
    try {
      await pushWorkToOrcid(userId, contrib);
      synced++;
    } catch (error) {
      failed++;
      errors.push(`${contrib.title}: ${(error as Error).message}`);
    }
  }

  // Update last sync time
  await prisma.orcidConnection.update({
    where: { id: connection.id },
    data: {
      lastSyncAt: new Date(),
      syncErrors: errors.length > 0 ? errors : Prisma.JsonNull,
    },
  });

  return { synced, failed, errors };
}

/**
 * Get contributions eligible for ORCID sync
 */
async function getEligibleContributions(
  userId: bigint
): Promise<OrcidWorkData[]> {
  const works: OrcidWorkData[] = [];

  // Get high-quality scholarly contributions (consensus-achieving)
  const contributions = await prisma.scholarContribution.findMany({
    where: {
      userId,
      type: {
        in: ["CONSENSUS_ACHIEVED", "REVIEW_COMPLETED", "CITATION_RECEIVED"],
      },
      isVerified: true,
    },
    include: {
      deliberation: { select: { title: true } },
      argument: { select: { id: true, text: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  contributions.forEach((c) => {
    const typeMap: Record<string, OrcidWorkType> = {
      CONSENSUS_ACHIEVED: "SCHOLARLY_ARGUMENT",
      REVIEW_COMPLETED: "PEER_REVIEW",
      CITATION_RECEIVED: "CITATION",
    };

    const workType = typeMap[c.type] || "SCHOLARLY_ARGUMENT";
    const title =
      c.type === "REVIEW_COMPLETED"
        ? `Peer Review: ${c.deliberation?.title || "Deliberation"}`
        : `Scholarly Argument in ${c.deliberation?.title || "Deliberation"}`;

    works.push({
      type: workType,
      sourceId: c.id,
      title: title.substring(0, 500),
      description: c.argument?.text?.substring(0, 500),
      workDate: c.createdAt,
      externalUrl: c.argumentId
        ? `${process.env.NEXT_PUBLIC_APP_URL}/argument/${c.argumentId}`
        : undefined,
    });
  });

  return works;
}

/**
 * Get synced works for a user's ORCID connection
 */
export async function getSyncedWorks(userId: bigint) {
  const connection = await prisma.orcidConnection.findUnique({
    where: { userId },
    include: {
      syncedWorks: {
        orderBy: { syncedAt: "desc" },
      },
    },
  });

  if (!connection) return [];
  return connection.syncedWorks;
}
