import type { SheafFacet, SheafAudienceList, User } from '@prisma/client';

import {
    AudienceSelector,
    AudienceEnv,
    priorityRank,
    MessageFacet as AclFacet,
  } from '@app/sheaf-acl';


  import type { UserContext } from '@app/sheaf-acl';



  export function toAudienceSelector(row: SheafFacet): AudienceSelector {
    let sel: AudienceSelector;
  
    switch (row.audienceKind) {
      case 'EVERYONE': {
        sel = { kind: 'EVERYONE' };
        break;
      }
  
      case 'ROLE': {
        sel = { kind: 'ROLE', role: row.audienceRole!, mode: 'DYNAMIC' };
        break;
      }
  
      case 'LIST': {
        sel = {
          kind: 'LIST',
          listId: row.audienceListId!,
          mode: row.audienceMode as 'DYNAMIC' | 'SNAPSHOT',
          snapshotMemberIds:
            row.audienceMode === 'SNAPSHOT' ? row.snapshotMemberIds ?? [] : undefined,
          listVersionAtSend: row.listVersionAtSend ?? undefined,
        };
        break;
      }
  
      case 'USERS': {
        sel =
          row.audienceMode === 'SNAPSHOT'
            ? { kind: 'USERS', mode: 'SNAPSHOT', snapshotMemberIds: row.snapshotMemberIds ?? [] }
            : { kind: 'USERS', mode: 'DYNAMIC', userIds: row.audienceUserIds ?? [] };
        break;
      }
  
      default: {
        // If the enum ever changes at runtime, fail safe:
        sel = { kind: 'EVERYONE' };
        break;
      }
    }
  
    return sel;
  }
  

export function toAclFacet(row: SheafFacet): AclFacet {
  const aud = toAudienceSelector(row);
  return {
    id: row.id.toString(),
    messageId: row.messageId.toString(),
    audience: aud,
    sharePolicy: row.sharePolicy,
    expiresAt: row.expiresAt ? row.expiresAt.getTime() : undefined,
    body: row.body,
    attachments: undefined, // you can fill from DB in your route if needed
    createdAt: row.createdAt?.getTime(),
    priorityRank: row.priorityRank ?? priorityRank(aud),
  };
}

export function userCtxFrom(
    user: User | null,
    roles: string[],
    lists: Map<string, Pick<SheafAudienceList, 'id' | 'memberIds'>>
  ): UserContext {
    return {
      id: user ? user.id.toString() : 'anon',
      roles: new Set(roles),
      inList: (listId: string) => {
        if (!user) return false;
        const l = lists.get(listId);
        return !!l && l.memberIds.includes(user.id.toString());
      },
    };
  }
  

export function buildAudienceEnv(
  dynamicLists: Map<string, SheafAudienceList>,
  roleMembers?: Map<string, string[]>
): AudienceEnv {
  return {
    resolveListMembers: (listId) => dynamicLists.get(listId)?.memberIds ?? null,
    resolveRoleMembers: (role) => roleMembers?.get(role) ?? null,
  };
}
