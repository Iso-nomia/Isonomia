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
export function zodToJsonSchema(schema: z.ZodType<any>): any {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType<any>>;
    const properties: Record<string, any> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(shape)) {
      properties[k] = zodToJsonSchema(v);
      if (!v.isOptional()) required.push(k);
    }
    return {
      type: "object",
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties: false,
    };
  }
  if (schema instanceof z.ZodString) {
    const out: any = { type: "string" };
    if ((schema as any)._def?.description) out.description = (schema as any)._def.description;
    return out;
  }
  if (schema instanceof z.ZodNumber) {
    const out: any = { type: "number" };
    return out;
  }
  if (schema instanceof z.ZodBoolean) return { type: "boolean" };
  if (schema instanceof z.ZodArray) {
    return { type: "array", items: zodToJsonSchema((schema as any).element) };
  }
  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema((schema as any).unwrap());
  }
  if (schema instanceof z.ZodDefault) {
    const inner = zodToJsonSchema((schema as any)._def.innerType);
    inner.default = (schema as any)._def.defaultValue();
    return inner;
  }
  if (schema instanceof z.ZodEnum) {
    return { type: "string", enum: (schema as any)._def.values };
  }
  // Fallback
  return {};
}
