/**
 * Pathways — Role gating and access checks
 *
 * Resolves the calling user against:
 *   - Platform admin allowlist (env: `MESH_PATHWAYS_ADMIN_AUTH_IDS`,
 *     comma-separated auth_ids). Pilot-grade gate; replace with proper RBAC
 *     when Mesh introduces a User.role column.
 *   - Deliberation host (`Deliberation.createdById`).
 *   - Deliberation roles (`DeliberationRole.role`).
 *   - Institution membership (`InstitutionMember.userId`).
 *
 * Convention: `userId` arguments here are the stringified internal User.id
 * bigint, matching `Deliberation.createdById` and Pathways `*ById` fields.
 *
 * All helpers return plain booleans; route handlers wrap them with
 * `apiError("FORBIDDEN", ...)` from `apiHelpers.ts`.
 */

import { prisma } from "@/lib/prismaclient";

const FACILITATOR_ROLES = new Set([
  "facilitator",
  "host",
  "moderator",
  "owner",
]);

const SUBMITTER_ROLES = new Set([
  "facilitator",
  "host",
  "moderator",
  "owner",
  "submitter",
]);

export function isPlatformAdmin(authId: string | null | undefined): boolean {
  if (!authId) return false;
  const raw = process.env.MESH_PATHWAYS_ADMIN_AUTH_IDS ?? "";
  const allow = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return allow.includes(authId);
}

export async function isDeliberationHost(
  deliberationId: string,
  userId: string,
): Promise<boolean> {
  const d = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { createdById: true },
  });
  return !!d && d.createdById === userId;
}

async function getDeliberationRoles(
  deliberationId: string,
  userId: string,
): Promise<string[]> {
  const rows = await prisma.deliberationRole.findMany({
    where: { deliberationId, userId },
    select: { role: true },
  });
  return rows.map((r) => r.role.toLowerCase());
}

export async function isFacilitator(
  deliberationId: string,
  userId: string,
): Promise<boolean> {
  if (await isDeliberationHost(deliberationId, userId)) return true;
  const roles = await getDeliberationRoles(deliberationId, userId);
  return roles.some((r) => FACILITATOR_ROLES.has(r));
}

/** Any deliberation participant: host or has at least one DeliberationRole. */
export async function canEditPacket(
  deliberationId: string,
  userId: string,
): Promise<boolean> {
  if (await isDeliberationHost(deliberationId, userId)) return true;
  const roles = await getDeliberationRoles(deliberationId, userId);
  return roles.length > 0;
}

export async function canSubmitPacket(
  deliberationId: string,
  userId: string,
): Promise<boolean> {
  if (await isDeliberationHost(deliberationId, userId)) return true;
  const roles = await getDeliberationRoles(deliberationId, userId);
  return roles.some((r) => SUBMITTER_ROLES.has(r));
}

export interface InstitutionMembershipOptions {
  requireVerified?: boolean;
}

export async function isInstitutionMember(
  institutionId: string,
  userId: string,
  opts: InstitutionMembershipOptions = {},
): Promise<boolean> {
  const member = await prisma.institutionMember.findFirst({
    where: {
      institutionId,
      userId,
      ...(opts.requireVerified ? { verifiedAt: { not: null } } : {}),
    },
    select: { id: true },
  });
  return !!member;
}

/**
 * Acknowledge / respond capability: either a verified institution member or
 * a facilitator on the originating deliberation (assisted intake).
 */
export async function canActAsInstitution(
  institutionId: string,
  deliberationId: string,
  userId: string,
): Promise<boolean> {
  if (await isInstitutionMember(institutionId, userId, { requireVerified: true })) {
    return true;
  }
  return isFacilitator(deliberationId, userId);
}

export interface PathwayContext {
  id: string;
  deliberationId: string;
  institutionId: string;
  isPublic: boolean;
  status: string;
  currentPacketId: string | null;
}

export async function loadPathwayContext(
  pathwayId: string,
): Promise<PathwayContext | null> {
  const row = await prisma.institutionalPathway.findUnique({
    where: { id: pathwayId },
    select: {
      id: true,
      deliberationId: true,
      institutionId: true,
      isPublic: true,
      status: true,
      currentPacketId: true,
    },
  });
  return row;
}

export interface PacketContext {
  id: string;
  pathwayId: string;
  status: string;
  pathway: PathwayContext;
}

export async function loadPacketContext(
  packetId: string,
): Promise<PacketContext | null> {
  const row = await prisma.recommendationPacket.findUnique({
    where: { id: packetId },
    select: {
      id: true,
      pathwayId: true,
      status: true,
      pathway: {
        select: {
          id: true,
          deliberationId: true,
          institutionId: true,
          isPublic: true,
          status: true,
          currentPacketId: true,
        },
      },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    pathwayId: row.pathwayId,
    status: row.status,
    pathway: row.pathway,
  };
}

export async function loadSubmissionContext(submissionId: string) {
  return prisma.institutionalSubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      institutionId: true,
      packetId: true,
      packet: {
        select: {
          pathway: {
            select: {
              id: true,
              deliberationId: true,
              institutionId: true,
              isPublic: true,
            },
          },
        },
      },
    },
  });
}

export async function loadResponseContext(responseId: string) {
  return prisma.institutionalResponse.findUnique({
    where: { id: responseId },
    select: {
      id: true,
      respondedById: true,
      submission: {
        select: {
          id: true,
          institutionId: true,
          packetId: true,
          packet: {
            select: {
              pathway: {
                select: {
                  id: true,
                  deliberationId: true,
                  institutionId: true,
                  isPublic: true,
                },
              },
            },
          },
        },
      },
    },
  });
}
