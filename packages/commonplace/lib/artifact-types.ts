import { z } from "zod";

/**
 * Artifact body shape — an ordered list of blocks. All cross-references to
 * entries are by id; we resolve and render at read time so the source of
 * truth (the entry itself) can keep evolving.
 */

export const HeadingBlockSchema = z.object({
  kind: z.literal("heading"),
  text: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export const ProseBlockSchema = z.object({
  kind: z.literal("prose"),
  text: z.string(),
});

export const EntryBlockSchema = z.object({
  kind: z.literal("entry"),
  entryId: z.string(),
  includeProvenance: z.boolean().default(true),
});

export const ArtifactBlockSchema = z.discriminatedUnion("kind", [
  HeadingBlockSchema,
  ProseBlockSchema,
  EntryBlockSchema,
]);

export const ArtifactBodySchema = z.object({
  blocks: z.array(ArtifactBlockSchema),
});

export type HeadingBlock = z.infer<typeof HeadingBlockSchema>;
export type ProseBlock = z.infer<typeof ProseBlockSchema>;
export type EntryBlock = z.infer<typeof EntryBlockSchema>;
export type ArtifactBlock = z.infer<typeof ArtifactBlockSchema>;
export type ArtifactBody = z.infer<typeof ArtifactBodySchema>;

export const EMPTY_BODY: ArtifactBody = { blocks: [] };
