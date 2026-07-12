// lib/sheaf/visibility.ts
import { prisma } from "@/lib/prismaclient";

/**
 * These are the only fields we need from a facet to decide visibility.
 * They match your SheafFacet columns.
 */
export type AudienceKind = "EVERYONE" | "ROLE" | "LIST" | "USERS";
export type AudienceMode = "DYNAMIC" | "SNAPSHOT";

export type FacetVisibilityFields = {
  audienceKind: AudienceKind;
  audienceMode: AudienceMode;
  audienceRole: string | null;
  audienceListId: string | null;
  snapshotMemberIds: string[]; // snapshot of user IDs as strings
  audienceUserIds: string[];   // dynamic user IDs as strings
};

/**
 * Can `userId` see this facet *right now*?
 * - EVERYONE: always true
 * - USERS:   SNAPSHOT → in snapshotMemberIds; DYNAMIC → in audienceUserIds
 * - ROLE:    user has given role
 * - LIST:    SNAPSHOT → in snapshotMemberIds; DYNAMIC → in current SheafAudienceList.memberIds
 */
export async function canUserSeeFacetNow(
  userId: bigint,
  facet: FacetVisibilityFields
): Promise<boolean> {
  const uid = userId.toString();
  const mode: AudienceMode = facet.audienceMode ?? "DYNAMIC";

  switch (facet.audienceKind) {
    case "EVERYONE":
      return true;

    case "USERS":
      if (mode === "SNAPSHOT") {
        return Array.isArray(facet.snapshotMemberIds) && facet.snapshotMemberIds.includes(uid);
      }
      return Array.isArray(facet.audienceUserIds) && facet.audienceUserIds.includes(uid);

    case "ROLE": {
      const role = (facet.audienceRole || "").trim();
      if (!role) return false;
      // Composite PK exists in your schema: @@id([userId, role])
      const has = await prisma.userRole.findUnique({
        where: { userId_role: { userId, role } },
        select: { userId: true },
      });
      return !!has;
    }

    case "LIST": {
      if (mode === "SNAPSHOT") {
        return Array.isArray(facet.snapshotMemberIds) && facet.snapshotMemberIds.includes(uid);
      }
      const listId = facet.audienceListId;
      if (!listId) return false;
      const list = await prisma.sheafAudienceList.findUnique({
        where: { id: listId },
        select: { memberIds: true },
      });
      return !!list?.memberIds?.includes(uid);
    }

    default:
      return false;
  }
}
