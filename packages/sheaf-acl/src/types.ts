/** Core types for Sheaf ACL */

export type AudienceKind = 'EVERYONE' | 'ROLE' | 'LIST' | 'USERS';
export type AudienceMode = 'DYNAMIC' | 'SNAPSHOT';
export type SharePolicy = 'ALLOW' | 'REDACT' | 'FORBID';

export type AudienceSelector =
  | { kind: 'EVERYONE'; mode?: 'DYNAMIC' } // implicit dynamic
  | { kind: 'ROLE'; role: string; mode: 'DYNAMIC' }
  | {
      kind: 'LIST';
      listId: string;
      mode: AudienceMode;
      /** When mode=SNAPSHOT, the frozen set at send time */
      snapshotMemberIds?: string[];
      /** Optional provenance for SNAPSHOT */
      listVersionAtSend?: number;
    }
  | {
      kind: 'USERS';
      mode: AudienceMode;
      /** When mode=DYNAMIC, explicit users */
      userIds?: string[];
      /** When mode=SNAPSHOT, the frozen set at send time */
      snapshotMemberIds?: string[];
    };

export interface AttachmentRef {
  id: string;
  name: string;
  mime: string;
  size: number;
  sha256: string;
}

export interface MessageFacet {
  id: string;
  messageId: string;
  audience: AudienceSelector;
  sharePolicy: SharePolicy;
  expiresAt?: number | null; // epoch ms
  body: unknown; // your tiptap JSON, etc.
  attachments?: AttachmentRef[];
  createdAt?: number; // epoch ms; used for tie-break in sorting
  /** Optional cached rank (lower = more private), but recomputed if absent */
  updatedAt?: number;
  priorityRank?: number;
}

export interface Message {
  id: string;
  threadId: string;
  authorId: string;
  createdAt: number;
  replyTo?: string | null;
  facets: MessageFacet[];
  defaultFacetId?: string | null;
}

export interface UserContext {
  id: string;
  roles: Set<string>;
  /**
   * Dynamic list membership resolver (server-side). If omitted, dynamic LIST checks
   * will be treated as false for visibility and "indeterminate" for subset checks.
   */
  inList?: (listId: string) => boolean;
}

/** Optional environment for subset checks across dynamic audiences */
export interface AudienceEnv {
  resolveListMembers?: (listId: string) => string[] | null | undefined;
  resolveRoleMembers?: (role: string) => string[] | null | undefined;
}

/** Tri-state for subset checks */
export type Tri = 'yes' | 'no' | 'indeterminate';
