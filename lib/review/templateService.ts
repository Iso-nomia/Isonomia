/**
 * Phase 4.1: Review Template Service
 *
 * This service manages review templates - predefined configurations
 * for peer review processes that can be reused across multiple reviews.
 */

import { prisma } from "@/lib/prismaclient";
import { ReviewTemplateConfig, ReviewPhaseConfig } from "./types";

// ============================================================
// STANDARD TEMPLATES
// ============================================================

/**
 * Standard peer review template with traditional phases
 */
export const STANDARD_PEER_REVIEW_TEMPLATE: ReviewTemplateConfig = {
  phases: [
    {
      name: "Initial Review",
      type: "INITIAL_REVIEW",
      description: "Reviewers provide initial assessment of the manuscript",
      defaultDurationDays: 21,
      requiredForCompletion: true,
      allowedParticipants: ["reviewers"],
    },
    {
      name: "Author Response",
      type: "AUTHOR_RESPONSE",
      description: "Authors respond to reviewer comments and concerns",
      defaultDurationDays: 14,
      requiredForCompletion: true,
      allowedParticipants: ["authors"],
    },
    {
      name: "Revision",
      type: "REVISION",
      description: "Authors revise manuscript based on feedback",
      defaultDurationDays: 30,
      requiredForCompletion: false,
      allowedParticipants: ["authors"],
    },
    {
      name: "Second Review",
      type: "SECOND_REVIEW",
      description: "Reviewers evaluate revised manuscript",
      defaultDurationDays: 14,
      requiredForCompletion: false,
      allowedParticipants: ["reviewers"],
    },
    {
      name: "Final Decision",
      type: "FINAL_DECISION",
      description: "Editor makes final publication decision",
      defaultDurationDays: 7,
      requiredForCompletion: true,
      allowedParticipants: ["editors"],
    },
  ],
  defaultSettings: {
    isBlinded: false,
    isPublicReview: true,
    minReviewers: 2,
    maxReviewers: 4,
  },
};

/**
 * Open review template - faster, more collaborative
 */
export const OPEN_REVIEW_TEMPLATE: ReviewTemplateConfig = {
  phases: [
    {
      name: "Community Review",
      type: "INITIAL_REVIEW",
      description: "Open community discussion and critique of the work",
      defaultDurationDays: 14,
      requiredForCompletion: true,
      allowedParticipants: ["reviewers", "authors"],
    },
    {
      name: "Author Integration",
      type: "AUTHOR_RESPONSE",
      description: "Authors integrate community feedback",
      defaultDurationDays: 7,
      requiredForCompletion: true,
      allowedParticipants: ["authors"],
    },
    {
      name: "Final Assessment",
      type: "FINAL_DECISION",
      description: "Community consensus on acceptance",
      defaultDurationDays: 7,
      requiredForCompletion: true,
      allowedParticipants: ["reviewers", "editors"],
    },
  ],
  defaultSettings: {
    isBlinded: false,
    isPublicReview: true,
    minReviewers: 3,
    maxReviewers: 10,
  },
};

/**
 * Double-blind review template for traditional journals
 */
export const DOUBLE_BLIND_REVIEW_TEMPLATE: ReviewTemplateConfig = {
  phases: [
    {
      name: "Blind Review",
      type: "INITIAL_REVIEW",
      description: "Reviewers assess anonymized manuscript",
      defaultDurationDays: 28,
      requiredForCompletion: true,
      allowedParticipants: ["reviewers"],
    },
    {
      name: "Author Response",
      type: "AUTHOR_RESPONSE",
      description: "Anonymous author response to reviews",
      defaultDurationDays: 14,
      requiredForCompletion: true,
      allowedParticipants: ["authors"],
    },
    {
      name: "Revision",
      type: "REVISION",
      description: "Authors revise based on blind feedback",
      defaultDurationDays: 45,
      requiredForCompletion: false,
      allowedParticipants: ["authors"],
    },
    {
      name: "Final Review",
      type: "SECOND_REVIEW",
      description: "Reviewers assess revised manuscript",
      defaultDurationDays: 14,
      requiredForCompletion: false,
      allowedParticipants: ["reviewers"],
    },
    {
      name: "Editorial Decision",
      type: "FINAL_DECISION",
      description: "Editor makes final decision",
      defaultDurationDays: 7,
      requiredForCompletion: true,
      allowedParticipants: ["editors"],
    },
  ],
  defaultSettings: {
    isBlinded: true,
    isPublicReview: false,
    minReviewers: 2,
    maxReviewers: 3,
  },
};

/**
 * Quick preprint review template
 */
export const PREPRINT_REVIEW_TEMPLATE: ReviewTemplateConfig = {
  phases: [
    {
      name: "Quick Review",
      type: "INITIAL_REVIEW",
      description: "Rapid community assessment of preprint",
      defaultDurationDays: 7,
      requiredForCompletion: true,
      allowedParticipants: ["reviewers", "authors"],
    },
    {
      name: "Discussion",
      type: "AUTHOR_RESPONSE",
      description: "Open discussion between authors and reviewers",
      defaultDurationDays: 7,
      requiredForCompletion: true,
      allowedParticipants: ["reviewers", "authors"],
    },
    {
      name: "Summary",
      type: "FINAL_DECISION",
      description: "Moderator summarizes review outcome",
      defaultDurationDays: 3,
      requiredForCompletion: true,
      allowedParticipants: ["editors"],
    },
  ],
  defaultSettings: {
    isBlinded: false,
    isPublicReview: true,
    minReviewers: 1,
    maxReviewers: 10,
  },
};

/**
 * Map of built-in templates by name
 */
export const BUILT_IN_TEMPLATES: Record<string, ReviewTemplateConfig> = {
  standard: STANDARD_PEER_REVIEW_TEMPLATE,
  open: OPEN_REVIEW_TEMPLATE,
  double_blind: DOUBLE_BLIND_REVIEW_TEMPLATE,
  preprint: PREPRINT_REVIEW_TEMPLATE,
};

// ============================================================
// TEMPLATE CRUD OPERATIONS
// ============================================================

/**
 * Create a new review template
 */
export async function createReviewTemplate(
  name: string,
  config: ReviewTemplateConfig,
  userId: string,
  options?: {
    description?: string;
    isPublic?: boolean;
  }
) {
  return prisma.reviewTemplate.create({
    data: {
      name,
      description: options?.description,
      phases: config.phases as any,
      defaultSettings: config.defaultSettings as any,
      createdById: userId,
      isPublic: options?.isPublic ?? false,
    },
  });
}

/**
 * Get a template by ID
 */
export async function getTemplateById(templateId: string) {
  return prisma.reviewTemplate.findUnique({
    where: { id: templateId },
  });
}

/**
 * Get all templates available to a user
 * Includes public templates and templates created by the user
 */
export async function getAvailableTemplates(userId: string) {
  return prisma.reviewTemplate.findMany({
    where: {
      OR: [
        { isPublic: true },
        { createdById: userId },
      ],
    },
    orderBy: [
      { usageCount: "desc" },
      { name: "asc" },
    ],
    select: {
      id: true,
      name: true,
      description: true,
      phases: true,
      defaultSettings: true,
      isPublic: true,
      usageCount: true,
      createdById: true,
      createdAt: true,
    },
  });
}

/**
 * Get templates created by a specific user
 */
export async function getUserTemplates(userId: string) {
  return prisma.reviewTemplate.findMany({
    where: { createdById: userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Update a template (only by creator)
 */
export async function updateTemplate(
  templateId: string,
  userId: string,
  updates: {
    name?: string;
    description?: string;
    phases?: ReviewPhaseConfig[];
    defaultSettings?: ReviewTemplateConfig["defaultSettings"];
    isPublic?: boolean;
  }
) {
  // Verify ownership
  const existing = await prisma.reviewTemplate.findUnique({
    where: { id: templateId },
    select: { createdById: true },
  });

  if (!existing) {
    throw new Error("Template not found");
  }

  if (existing.createdById !== userId) {
    throw new Error("Not authorized to update this template");
  }

  return prisma.reviewTemplate.update({
    where: { id: templateId },
    data: {
      ...(updates.name && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.phases && { phases: updates.phases as any }),
      ...(updates.defaultSettings && { defaultSettings: updates.defaultSettings as any }),
      ...(updates.isPublic !== undefined && { isPublic: updates.isPublic }),
    },
  });
}

/**
 * Delete a template (only if not in use)
 */
export async function deleteTemplate(templateId: string, userId: string) {
  // Verify ownership
  const existing = await prisma.reviewTemplate.findUnique({
    where: { id: templateId },
    select: { createdById: true, usageCount: true },
  });

  if (!existing) {
    throw new Error("Template not found");
  }

  if (existing.createdById !== userId) {
    throw new Error("Not authorized to delete this template");
  }

  if (existing.usageCount > 0) {
    throw new Error("Cannot delete template that is in use by reviews");
  }

  return prisma.reviewTemplate.delete({
    where: { id: templateId },
  });
}

/**
 * Increment usage count for a template
 */
export async function incrementTemplateUsage(templateId: string) {
  return prisma.reviewTemplate.update({
    where: { id: templateId },
    data: { usageCount: { increment: 1 } },
  });
}

// ============================================================
// TEMPLATE PARSING UTILITIES
// ============================================================

/**
 * Parse phases from a template (handles both DB records and built-in configs)
 */
export function parseTemplatePhases(template: {
  phases?: unknown;
} | null): ReviewPhaseConfig[] {
  if (!template?.phases || !Array.isArray(template.phases)) {
    return STANDARD_PEER_REVIEW_TEMPLATE.phases;
  }
  return template.phases as ReviewPhaseConfig[];
}

/**
 * Parse default settings from a template
 */
export function parseTemplateSettings(template: {
  defaultSettings?: unknown;
} | null): ReviewTemplateConfig["defaultSettings"] {
  if (!template?.defaultSettings || typeof template.defaultSettings !== "object") {
    return STANDARD_PEER_REVIEW_TEMPLATE.defaultSettings;
  }
  return template.defaultSettings as ReviewTemplateConfig["defaultSettings"];
}

/**
 * Validate a template configuration
 */
export function validateTemplateConfig(config: ReviewTemplateConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Must have at least one phase
  if (!config.phases || config.phases.length === 0) {
    errors.push("Template must have at least one phase");
  }

  // Each phase must have a name and type
  config.phases?.forEach((phase, index) => {
    if (!phase.name?.trim()) {
      errors.push(`Phase ${index + 1} must have a name`);
    }
    if (!phase.type) {
      errors.push(`Phase ${index + 1} must have a type`);
    }
  });

  // Must have a final decision phase
  const hasFinalDecision = config.phases?.some(
    (p) => p.type === "FINAL_DECISION"
  );
  if (!hasFinalDecision) {
    errors.push("Template must include a Final Decision phase");
  }

  // Validate settings if provided
  if (config.defaultSettings) {
    const { minReviewers, maxReviewers } = config.defaultSettings;
    if (minReviewers !== undefined && minReviewers < 1) {
      errors.push("Minimum reviewers must be at least 1");
    }
    if (maxReviewers !== undefined && maxReviewers < 1) {
      errors.push("Maximum reviewers must be at least 1");
    }
    if (
      minReviewers !== undefined &&
      maxReviewers !== undefined &&
      minReviewers > maxReviewers
    ) {
      errors.push("Minimum reviewers cannot exceed maximum reviewers");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get a built-in template by name
 */
export function getBuiltInTemplate(
  name: keyof typeof BUILT_IN_TEMPLATES
): ReviewTemplateConfig | undefined {
  return BUILT_IN_TEMPLATES[name];
}

/**
 * Clone a template configuration (for customization)
 */
export function cloneTemplateConfig(
  config: ReviewTemplateConfig
): ReviewTemplateConfig {
  return JSON.parse(JSON.stringify(config));
}
