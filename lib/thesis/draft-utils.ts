/**
 * Utilities for extracting and managing draft objects in thesis content
 * Used during publication workflow to convert draft nodes into real deliberation objects
 */

import { JSONContent } from "@tiptap/core";

export type DraftType = "claim" | "proposition" | "argument";

export interface DraftClaim {
  type: "claim";
  draftId: string;
  text: string;
  position: "IN" | "OUT" | "UNDEC";
  deliberationId: string;
}

export interface DraftProposition {
  type: "proposition";
  draftId: string;
  text: string;
  mediaType?: string;
  mediaUrl?: string;
  deliberationId: string;
}

export interface DraftArgument {
  type: "argument";
  draftId: string;
  conclusion: string;
  schemeId?: string;
  premises: Array<{
    text: string;
    type: string;
  }>;
  deliberationId: string;
}

export type DraftObject = DraftClaim | DraftProposition | DraftArgument;

export interface DraftInventory {
  propositions: DraftProposition[];
  claims: DraftClaim[];
  arguments: DraftArgument[];
  total: number;
}

export interface ValidationError {
  draftId: string;
  type: DraftType;
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Recursively traverse TipTap JSONContent tree to find all draft nodes
 */
function traverseContent(node: JSONContent, drafts: DraftObject[] = []): DraftObject[] {
  // Check if current node is a draft node
  if (node.type === "draftClaim" && node.attrs) {
    const { draftId, text, position, deliberationId } = node.attrs;
    drafts.push({
      type: "claim",
      draftId,
      text: text || "",
      position: position || "UNDEC",
      deliberationId,
    });
  } else if (node.type === "draftProposition" && node.attrs) {
    const { draftId, text, mediaType, mediaUrl, deliberationId } = node.attrs;
    drafts.push({
      type: "proposition",
      draftId,
      text: text || "",
      mediaType,
      mediaUrl,
      deliberationId,
    });
  } else if (node.type === "draftArgument" && node.attrs) {
    const { draftId, conclusion, schemeId, premises, deliberationId } = node.attrs;
    drafts.push({
      type: "argument",
      draftId,
      conclusion: conclusion || "",
      schemeId,
      premises: premises || [],
      deliberationId,
    });
  }

  // Recursively traverse children
  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      traverseContent(child, drafts);
    }
  }

  return drafts;
}

/**
 * Extract all draft objects from thesis content
 */
export function extractDraftObjects(content: JSONContent): DraftInventory {
  const allDrafts = traverseContent(content);

  const inventory: DraftInventory = {
    propositions: allDrafts.filter((d) => d.type === "proposition") as DraftProposition[],
    claims: allDrafts.filter((d) => d.type === "claim") as DraftClaim[],
    arguments: allDrafts.filter((d) => d.type === "argument") as DraftArgument[],
    total: allDrafts.length,
  };

  return inventory;
}

/**
 * Validate that all draft objects have required fields and are ready for publication
 */
export function validateDraftObjects(inventory: DraftInventory): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate propositions
  for (const prop of inventory.propositions) {
    if (!prop.text || prop.text.trim().length === 0) {
      errors.push({
        draftId: prop.draftId,
        type: "proposition",
        field: "text",
        message: "Proposition text is required",
      });
    }
    if (prop.text && prop.text.length > 500) {
      errors.push({
        draftId: prop.draftId,
        type: "proposition",
        field: "text",
        message: "Proposition text exceeds maximum length (500 characters)",
      });
    }
    if (prop.mediaUrl && !prop.mediaType) {
      errors.push({
        draftId: prop.draftId,
        type: "proposition",
        field: "mediaType",
        message: "Media type is required when media URL is provided",
      });
    }
  }

  // Validate claims
  for (const claim of inventory.claims) {
    if (!claim.text || claim.text.trim().length === 0) {
      errors.push({
        draftId: claim.draftId,
        type: "claim",
        field: "text",
        message: "Claim text is required",
      });
    }
    if (claim.text && claim.text.length > 500) {
      errors.push({
        draftId: claim.draftId,
        type: "claim",
        field: "text",
        message: "Claim text exceeds maximum length (500 characters)",
      });
    }
    if (!["IN", "OUT", "UNDEC"].includes(claim.position)) {
      errors.push({
        draftId: claim.draftId,
        type: "claim",
        field: "position",
        message: "Claim position must be IN, OUT, or UNDEC",
      });
    }
  }

  // Validate arguments
  for (const arg of inventory.arguments) {
    if (!arg.conclusion || arg.conclusion.trim().length === 0) {
      errors.push({
        draftId: arg.draftId,
        type: "argument",
        field: "conclusion",
        message: "Argument conclusion is required",
      });
    }
    if (arg.conclusion && arg.conclusion.length > 500) {
      errors.push({
        draftId: arg.draftId,
        type: "argument",
        field: "conclusion",
        message: "Argument conclusion exceeds maximum length (500 characters)",
      });
    }
    if (!arg.premises || arg.premises.length === 0) {
      errors.push({
        draftId: arg.draftId,
        type: "argument",
        field: "premises",
        message: "At least one premise is required",
      });
    }
    // Validate each premise
    if (arg.premises) {
      for (let i = 0; i < arg.premises.length; i++) {
        const premise = arg.premises[i];
        if (!premise.text || premise.text.trim().length === 0) {
          errors.push({
            draftId: arg.draftId,
            type: "argument",
            field: `premises[${i}].text`,
            message: `Premise ${i + 1} text is required`,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Replace draft nodes with real object references in content
 * Used after publication to update thesis with actual IDs
 */
export function replaceDraftWithReal(
  content: JSONContent,
  draftId: string,
  realId: string,
  nodeType: "claim" | "proposition" | "argument"
): JSONContent {
  // Deep clone to avoid mutations
  const newContent = JSON.parse(JSON.stringify(content)) as JSONContent;

  function traverse(node: JSONContent): void {
    // Check if this is the draft node we're replacing
    const draftNodeType = `draft${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}`;
    const realNodeType = nodeType === "proposition" ? "claim" : nodeType; // propositions become claims in real nodes

    if (node.type === draftNodeType && node.attrs?.draftId === draftId) {
      // Convert draft node to real reference node
      node.type = realNodeType;
      delete node.attrs.draftId;
      node.attrs[`${nodeType}Id`] = realId;
      return;
    }

    // Recursively traverse children
    if (node.content && Array.isArray(node.content)) {
      for (const child of node.content) {
        traverse(child);
      }
    }
  }

  traverse(newContent);
  return newContent;
}

/**
 * Replace all draft nodes with real object references
 * Takes a mapping of draftId -> realId and updates the entire content tree
 */
export function replaceAllDraftsWithReal(
  content: JSONContent,
  mapping: Record<string, { realId: string; type: DraftType }>
): JSONContent {
  let updatedContent = content;

  for (const [draftId, { realId, type }] of Object.entries(mapping)) {
    updatedContent = replaceDraftWithReal(updatedContent, draftId, realId, type);
  }

  return updatedContent;
}

/**
 * Generate a summary string for display in UI
 */
export function getDraftSummary(inventory: DraftInventory): string {
  const parts: string[] = [];

  if (inventory.propositions.length > 0) {
    parts.push(`${inventory.propositions.length} proposition${inventory.propositions.length === 1 ? "" : "s"}`);
  }
  if (inventory.claims.length > 0) {
    parts.push(`${inventory.claims.length} claim${inventory.claims.length === 1 ? "" : "s"}`);
  }
  if (inventory.arguments.length > 0) {
    parts.push(`${inventory.arguments.length} argument${inventory.arguments.length === 1 ? "" : "s"}`);
  }

  if (parts.length === 0) {
    return "No draft objects";
  }

  return parts.join(", ");
}

/**
 * Check if thesis has any unsaved draft objects
 */
export function hasUnsavedDrafts(content: JSONContent): boolean {
  const inventory = extractDraftObjects(content);
  return inventory.total > 0;
}
