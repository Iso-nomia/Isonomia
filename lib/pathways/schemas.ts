/**
 * Pathways — Zod request/response schemas
 *
 * Source of truth for API validation. These will be exported into an OpenAPI
 * document in A2.2.
 */

import { z } from "zod";
import {
  InstitutionKind,
  PacketItemKind,
  SubmissionChannel,
  InstitutionalDisposition,
  InstitutionalResponseStatus,
} from "./types";

const cuid = z.string().min(1);

export const CreateInstitutionSchema = z.object({
  slug: z.string().min(1).max(128),
  name: z.string().min(1).max(256),
  kind: z.nativeEnum(InstitutionKind),
  jurisdiction: z.string().max(128).nullish(),
  contact: z.record(z.unknown()).nullish(),
  linkedDeliberationId: cuid.nullish(),
});
export type CreateInstitutionInput = z.infer<typeof CreateInstitutionSchema>;

export const ListInstitutionsQuerySchema = z.object({
  kind: z.nativeEnum(InstitutionKind).optional(),
  jurisdiction: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const OpenPathwaySchema = z.object({
  institutionId: cuid,
  subject: z.string().min(1).max(512),
  isPublic: z.boolean().optional(),
});

export const RevisePathwaySchema = z.object({
  title: z.string().min(1).max(512),
  summary: z.string().max(4096).nullish(),
});

export const ClosePathwaySchema = z.object({
  reason: z.string().max(2048).nullish(),
});

export const ListEventsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  eventType: z.string().optional(),
});

export const CreatePacketSchema = z.object({
  title: z.string().min(1).max(512),
  summary: z.string().max(4096).nullish(),
});

export const AddPacketItemSchema = z.object({
  kind: z.nativeEnum(PacketItemKind),
  targetType: z.string().min(1).max(64),
  targetId: z.string().min(1).max(128),
  orderIndex: z.number().int().min(0).optional(),
  commentary: z.string().max(4096).nullish(),
});

export const EditPacketItemSchema = z
  .object({
    orderIndex: z.number().int().min(0).optional(),
    commentary: z.string().max(4096).nullish(),
  })
  .refine((v) => v.orderIndex !== undefined || v.commentary !== undefined, {
    message: "At least one of orderIndex or commentary is required",
  });

export const SubmitPacketSchema = z.object({
  channel: z.nativeEnum(SubmissionChannel).optional(),
  externalReference: z.string().max(512).nullish(),
});

export const AcknowledgeSubmissionSchema = z.object({
  acknowledgedAt: z.string().datetime().optional(),
  channelOverride: z.nativeEnum(SubmissionChannel).nullish(),
  note: z.string().max(2048).nullish(),
});

export const RecordResponseSchema = z.object({
  respondedAt: z.string().datetime().optional(),
  dispositionSummary: z.string().max(4096).nullish(),
  responseStatus: z.nativeEnum(InstitutionalResponseStatus).optional(),
  channelHint: z.nativeEnum(SubmissionChannel).nullish(),
});

const EvidenceCitationSchema = z.object({
  uri: z.string().url(),
  title: z.string().max(512).optional(),
});

export const AddResponseItemsSchema = z.object({
  items: z
    .array(
      z.object({
        packetItemId: cuid.nullish(),
        targetType: z.string().min(1).max(64).optional(),
        targetId: z.string().min(1).max(128).optional(),
        disposition: z.nativeEnum(InstitutionalDisposition),
        rationaleText: z.string().max(8192).nullish(),
        evidenceCitations: z.array(EvidenceCitationSchema).nullish(),
      }),
    )
    .min(1),
});
