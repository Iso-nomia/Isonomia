/**
 * Pathways — Domain types
 *
 * Pure TypeScript types mirroring the proposed Prisma schema in
 * `docs/pathways/MIGRATION_DRAFT.md`. These types let us build and unit-test
 * the snapshot serializer, hash-chain logic, and service contracts before the
 * schema is applied. After A1 schema migration, these types should be aligned
 * with (or replaced by) Prisma-generated types.
 *
 * Status: A0 scaffold. Do not import into production code paths until A1.
 */

export type Cuid = string;

export type AuthId = string;

export enum InstitutionKind {
  legislature = "legislature",
  agency = "agency",
  sponsor = "sponsor",
  internal_governance = "internal_governance",
  advisory_board = "advisory_board",
  other = "other",
}

export enum PacketStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  RESPONDED = "RESPONDED",
  REVISED = "REVISED",
  CLOSED = "CLOSED",
}

export enum PacketItemKind {
  CLAIM = "CLAIM",
  ARGUMENT = "ARGUMENT",
  CITATION = "CITATION",
  NOTE = "NOTE",
}

export enum SubmissionChannel {
  in_platform = "in_platform",
  email = "email",
  formal_intake = "formal_intake",
  api = "api",
}

export enum InstitutionalResponseStatus {
  PENDING = "PENDING",
  RECEIVED = "RECEIVED",
  PARTIAL = "PARTIAL",
  COMPLETE = "COMPLETE",
}

export enum InstitutionalDisposition {
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  MODIFIED = "MODIFIED",
  DEFERRED = "DEFERRED",
  NO_RESPONSE = "NO_RESPONSE",
}

export enum PathwayStatus {
  OPEN = "OPEN",
  AWAITING_RESPONSE = "AWAITING_RESPONSE",
  IN_REVISION = "IN_REVISION",
  CLOSED = "CLOSED",
}

export enum PathwayEventType {
  DRAFT_OPENED = "DRAFT_OPENED",
  ITEM_ADDED = "ITEM_ADDED",
  ITEM_REMOVED = "ITEM_REMOVED",
  PACKET_FINALIZED = "PACKET_FINALIZED",
  SUBMITTED = "SUBMITTED",
  ACKNOWLEDGED = "ACKNOWLEDGED",
  RESPONSE_RECEIVED = "RESPONSE_RECEIVED",
  ITEM_DISPOSITIONED = "ITEM_DISPOSITIONED",
  REVISED = "REVISED",
  CLOSED = "CLOSED",
}

export interface Institution {
  id: Cuid;
  slug: string;
  name: string;
  kind: InstitutionKind;
  jurisdiction: string | null;
  contactJson: Record<string, unknown> | null;
  verifiedAt: Date | null;
  createdById: AuthId;
  linkedDeliberationId: Cuid | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InstitutionMember {
  id: Cuid;
  institutionId: Cuid;
  userId: AuthId | null;
  displayName: string;
  role: string | null;
  verifiedAt: Date | null;
  verifiedById: AuthId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InstitutionalPathway {
  id: Cuid;
  deliberationId: Cuid;
  institutionId: Cuid;
  subject: string;
  currentPacketId: Cuid | null;
  status: PathwayStatus;
  isPublic: boolean;
  openedAt: Date;
  closedAt: Date | null;
  openedById: AuthId;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecommendationPacket {
  id: Cuid;
  pathwayId: Cuid;
  parentPacketId: Cuid | null;
  version: number;
  title: string;
  summary: string | null;
  status: PacketStatus;
  createdById: AuthId;
  submittedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecommendationPacketItem {
  id: Cuid;
  packetId: Cuid;
  kind: PacketItemKind;
  targetType: string;
  targetId: string;
  orderIndex: number;
  commentary: string | null;
  /** Set on packet submission; immutable thereafter. */
  snapshotJson: Record<string, unknown> | null;
  /** sha256 of canonical JSON of snapshotJson. */
  snapshotHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InstitutionalSubmission {
  id: Cuid;
  packetId: Cuid;
  institutionId: Cuid;
  submittedById: AuthId;
  submittedAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedById: AuthId | null;
  channel: SubmissionChannel;
  externalReference: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InstitutionalResponse {
  id: Cuid;
  submissionId: Cuid;
  respondedById: AuthId;
  respondedAt: Date;
  dispositionSummary: string | null;
  responseStatus: InstitutionalResponseStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface InstitutionalResponseItem {
  id: Cuid;
  responseId: Cuid;
  packetItemId: Cuid | null;
  targetType: string;
  targetId: string;
  disposition: InstitutionalDisposition;
  rationaleText: string | null;
  evidenceCitations: Array<{ uri: string; title?: string }> | null;
  createdById: AuthId;
  createdAt: Date;
  updatedAt: Date;
}

export interface PathwayEvent {
  id: Cuid;
  pathwayId: Cuid;
  packetId: Cuid | null;
  submissionId: Cuid | null;
  responseId: Cuid | null;
  eventType: PathwayEventType;
  actorId: AuthId;
  actorRole: string | null;
  payloadJson: Record<string, unknown>;
  /** null only for the genesis (DRAFT_OPENED) event of a pathway. */
  hashChainPrev: string | null;
  hashChainSelf: string;
  createdAt: Date;
}

/** Input shape for appending a new event before hashing. */
export interface PathwayEventInput {
  pathwayId: Cuid;
  packetId?: Cuid | null;
  submissionId?: Cuid | null;
  responseId?: Cuid | null;
  eventType: PathwayEventType;
  actorId: AuthId;
  actorRole?: string | null;
  payloadJson: Record<string, unknown>;
}

/** Snapshot input for a packet item, used by the snapshot serializer. */
export interface PacketItemSnapshotInput {
  kind: PacketItemKind;
  targetType: string;
  targetId: string;
  orderIndex: number;
  commentary: string | null;
  /** Resolved content payload at submission time (claim text, argument structure, citation metadata, or note text). */
  content: Record<string, unknown>;
}
