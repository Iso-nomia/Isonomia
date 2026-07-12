export function isAdmin(user: { role: string }): boolean {
  return user.role === "ADMIN" || user.role === "OWNER";
}

export function canManageWorkspace(
  user: { id: bigint; role: string },
  workspace: { ownerId: bigint }
): boolean {
  return isAdmin(user) || user.id === workspace.ownerId;
}
