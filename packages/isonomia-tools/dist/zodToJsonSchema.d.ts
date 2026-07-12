import { z } from "zod";
/**
 * Convert a Zod object schema into a JSON Schema acceptable to the MCP
 * tool registry (and to WebMCP registration). We avoid a heavy dependency
 * by handling the small set of types we actually use.
 *
 * KNOWN PITFALL (do not "fix" by adding .refine/.superRefine to registered
 * schemas): ZodEffects wrappers make this converter lose `type: "object"`,
 * which breaks tool registration. Cross-field validation belongs in-handler
 * (see dialecticMapping.ts attackArgsValidationError).
 */
export declare function zodToJsonSchema(schema: z.ZodType<any>): any;
