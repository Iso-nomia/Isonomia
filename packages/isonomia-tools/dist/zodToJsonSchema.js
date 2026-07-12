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
export function zodToJsonSchema(schema) {
    if (schema instanceof z.ZodObject) {
        const shape = schema.shape;
        const properties = {};
        const required = [];
        for (const [k, v] of Object.entries(shape)) {
            properties[k] = zodToJsonSchema(v);
            if (!v.isOptional())
                required.push(k);
        }
        return {
            type: "object",
            properties,
            ...(required.length ? { required } : {}),
            additionalProperties: false,
        };
    }
    if (schema instanceof z.ZodString) {
        const out = { type: "string" };
        if (schema._def?.description)
            out.description = schema._def.description;
        return out;
    }
    if (schema instanceof z.ZodNumber) {
        const out = { type: "number" };
        return out;
    }
    if (schema instanceof z.ZodBoolean)
        return { type: "boolean" };
    if (schema instanceof z.ZodArray) {
        return { type: "array", items: zodToJsonSchema(schema.element) };
    }
    if (schema instanceof z.ZodOptional) {
        return zodToJsonSchema(schema.unwrap());
    }
    if (schema instanceof z.ZodDefault) {
        const inner = zodToJsonSchema(schema._def.innerType);
        inner.default = schema._def.defaultValue();
        return inner;
    }
    if (schema instanceof z.ZodEnum) {
        return { type: "string", enum: schema._def.values };
    }
    // Fallback
    return {};
}
