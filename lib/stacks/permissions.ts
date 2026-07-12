/**
 * Stack Permissions
 * 
 * Phase 1.1 + 1.5 of Stacks Improvement Roadmap
 * 
 * Centralized permission checks for stack operations.
 * 
 * Visibility modes (Phase 1.5):
 * - public_open: Anyone can view + any logged-in user can add blocks
 * - public_closed: Anyone can view; only owner/collaborators can add
 * - private: Only owner/collaborators can view and add
 * - unlisted: Link access only; not in search/discovery
 */

import { prisma } from "@/lib/prismaclient";
import { StackVisibility, StackRole } from "@prisma/client";

export interface StackPermissions {
  canView: boolean;
  canEdit: boolean;
  canAdd: boolean;
  canDelete: boolean;
  canManageCollaborators: boolean;
  visibility: StackVisibility;
  isOwner: boolean;
  isCollaborator: boolean;
  collaboratorRole: StackRole | null;
}

/**
 * Get comprehensive permissions for a user on a stack
 */
export async function getStackPermissions(
  stackId: string,
  userId: bigint | null
): Promise<StackPermissions> {
  const stack = await prisma.stack.findUnique({
    where: { id: stackId },
    select: {
      owner_id: true,
      visibility: true,
      is_public: true, // Keep for backward compatibility
      collaborators: userId
        ? { where: { user_id: userId }, select: { role: true } }
        : undefined,
    },
  });

  // Stack not found - no permissions
  if (!stack) {
    return {
      canView: false,
      canEdit: false,
      canAdd: false,
      canDelete: false,
      canManageCollaborators: false,
      visibility: "private" as StackVisibility,
      isOwner: false,
      isCollaborator: false,
      collaboratorRole: null,
    };
  }

  const isOwner = userId !== null && stack.owner_id === userId;
  const collaborator = stack.collaborators?.[0];
  const collaboratorRole = collaborator?.role ?? null;
  const isEditor = collaboratorRole === "EDITOR";
  const isViewer = collaboratorRole === "VIEWER";
  const isCollaborator = isOwner || isEditor || isViewer;

  // Use visibility field, fall back to is_public for un-migrated stacks
  const visibility = stack.visibility ?? (stack.is_public ? "public_closed" : "private") as StackVisibility;

  // Build permissions based on visibility and role
  const perms: StackPermissions = {
    canView: false,
    canEdit: false,
    canAdd: false,
    canDelete: false,
    canManageCollaborators: false,
    visibility,
    isOwner,
    isCollaborator,
    collaboratorRole,
  };

  switch (visibility) {
    case "public_open":
      perms.canView = true;
      perms.canAdd = userId !== null; // Any logged-in user can add
      perms.canEdit = isOwner || isEditor;
      perms.canDelete = isOwner;
      perms.canManageCollaborators = isOwner;
      break;

    case "public_closed":
      perms.canView = true;
      perms.canAdd = isOwner || isEditor;
      perms.canEdit = isOwner || isEditor;
      perms.canDelete = isOwner;
      perms.canManageCollaborators = isOwner;
      break;

    case "unlisted":
      perms.canView = true; // Anyone with link can view
      perms.canAdd = isOwner || isEditor;
      perms.canEdit = isOwner || isEditor;
      perms.canDelete = isOwner;
      perms.canManageCollaborators = isOwner;
      break;

    case "private":
      perms.canView = isCollaborator;
      perms.canAdd = isOwner || isEditor;
      perms.canEdit = isOwner || isEditor;
      perms.canDelete = isOwner;
      perms.canManageCollaborators = isOwner;
      break;
  }

  return perms;
}

/**
 * Check if a user can view a stack
 */
export async function canViewStack(stackId: string, userId: bigint | null): Promise<boolean> {
  const perms = await getStackPermissions(stackId, userId);
  return perms.canView;
}

/**
 * Check if a user can edit a stack (settings, description, visibility)
 */
export async function canEditStack(stackId: string, userId: bigint | null): Promise<boolean> {
  const perms = await getStackPermissions(stackId, userId);
  return perms.canEdit;
}

/**
 * Check if a user can add blocks/items to a stack
 */
export async function canAddToStack(stackId: string, userId: bigint | null): Promise<boolean> {
  const perms = await getStackPermissions(stackId, userId);
  return perms.canAdd;
}

/**
 * Check if a user can delete a stack
 */
export async function canDeleteStack(stackId: string, userId: bigint | null): Promise<boolean> {
  const perms = await getStackPermissions(stackId, userId);
  return perms.canDelete;
}

/**
 * Throws if user cannot edit the stack
 */
export async function assertCanEditStack(stackId: string, userId: bigint): Promise<void> {
  const canEdit = await canEditStack(stackId, userId);
  if (!canEdit) {
    throw new Error("Forbidden: You don't have permission to edit this stack");
  }
}

/**
 * Check if a user owns a stack
 */
export async function isStackOwner(stackId: string, userId: bigint): Promise<boolean> {
  const stack = await prisma.stack.findUnique({
    where: { id: stackId },
    select: { owner_id: true },
  });

  return stack?.owner_id === userId;
}
/**
 * Get visibility label for display
 */
export function getVisibilityLabel(visibility: StackVisibility): string {
  switch (visibility) {
    case "public_open":
      return "Public Open";
    case "public_closed":
      return "Public";
    case "private":
      return "Private";
    case "unlisted":
      return "Unlisted";
    default:
      return "Unknown";
  }
}

/**
 * Get visibility description for display
 */
export function getVisibilityDescription(visibility: StackVisibility): string {
  switch (visibility) {
    case "public_open":
      return "Anyone can view and add blocks";
    case "public_closed":
      return "Anyone can view; only collaborators can add";
    case "private":
      return "Only you and collaborators can access";
    case "unlisted":
      return "Only people with the link can view";
    default:
      return "";
  }
}

/**
 * Check if a visibility mode is discoverable in search/feeds
 */
export function isDiscoverable(visibility: StackVisibility): boolean {
  return visibility === "public_open" || visibility === "public_closed";
}