import type {
    AudienceEnv,
    AudienceSelector,
    AudienceMode,
    MessageFacet,
    Tri,
    UserContext,
  } from './types';

  /** Rank: lower is "more private" and wins as default */
  export function priorityRank(a: AudienceSelector): number {
    switch (a.kind) {
      case 'USERS':
        return 100;
      case 'LIST':
        return 200;
      case 'ROLE':
        return 300;
      case 'EVERYONE':
        return 400;
      default:
        return 999;
    }
  }
  
  function createdAtMs(f: MessageFacet): number {
    // Treat undefined createdAt as 0 for deterministic order in tests
    return typeof f.createdAt === 'number' ? f.createdAt : 0;
  }
  
  /** Sort by privacy rank (asc) then createdAt (asc) */
  export function sortFacetsForDefault(facets: MessageFacet[]): MessageFacet[] {
    return [...facets].sort((a, b) => {
      const ar = a.priorityRank ?? priorityRank(a.audience);
      const br = b.priorityRank ?? priorityRank(b.audience);
      if (ar !== br) return ar - br;
      return createdAtMs(a) - createdAtMs(b);
    });
  }
  
  /** Visible = union of facets the user qualifies for at view time */
  export function visibleFacetsFor(
    user: UserContext,
    facets: MessageFacet[]
  ): MessageFacet[] {
    const visible = facets.filter((f) => isUserInAudience(user, f.audience));
    return sortFacetsForDefault(visible);
  }
  
  /** Default facet = most private visible facet (or null) */
  export function defaultFacetFor(
    user: UserContext,
    facets: MessageFacet[]
  ): MessageFacet | null {
    const vis = visibleFacetsFor(user, facets);
    return vis.length ? vis[0] : null;
  }
  
  /** Core membership check for a user against an audience selector */
  export function isUserInAudience(
    user: UserContext,
    a: AudienceSelector
  ): boolean {
    switch (a.kind) {
      case 'EVERYONE':
        return true;
      case 'ROLE':
        return user.roles.has(a.role);
      case 'LIST':
        if (a.mode === 'SNAPSHOT') {
          const snap = a.snapshotMemberIds ?? [];
          return snap.includes(user.id);
        } else {
          return !!user.inList?.(a.listId);
        }
      case 'USERS':
        if (a.mode === 'SNAPSHOT') {
          const snap = a.snapshotMemberIds ?? [];
          return snap.includes(user.id);
        } else {
          const ids = a.userIds ?? [];
          return ids.includes(user.id);
        }
    }
  }
  
  /**
   * Does "target" form a subset of "original"? (i.e., can we forward from original → target?)
   * Returns tri-state: 'yes' | 'no' | 'indeterminate'.
   * For DYNAMIC audiences we need env resolvers to know the actual set; otherwise we return 'indeterminate'
   * except for trivial structural cases (e.g., X ⊆ EVERYONE).
   */
export function audienceSubsetOf(
  target: AudienceSelector,
  original: AudienceSelector,
  env?: AudienceEnv
): Tri {
  // ORIGINAL = EVERYONE ⇒ always superset
  if (original.kind === 'EVERYONE') return 'yes';

  // If TARGET = EVERYONE but ORIGINAL ≠ EVERYONE, it's never a subset
  if (target.kind === 'EVERYONE') return 'no';

  // Equal selectors are trivially subset
  if (audienceSelectorsEqual(target, original)) return 'yes';

  
    // If both sides can be materialized to explicit sets, compare sets
    const targetSet = materializeMembers(target, env);
    const originalSet = materializeMembers(original, env);
  
    if (targetSet && originalSet) {
      return isSubset(targetSet, originalSet) ? 'yes' : 'no';
    }
  
    // Structural subset rules that don't require full sets
    // USERS (any) ⊆ ROLE is 'indeterminate' unless env supplies role members
    // USERS (any) ⊆ LIST(DYNAMIC) is 'indeterminate' unless env supplies list members
  
    // LIST(DYNAMIC) same listId on both sides: equal sets → subset
    if (
      target.kind === 'LIST' &&
      original.kind === 'LIST' &&
      target.mode === 'DYNAMIC' &&
      original.mode === 'DYNAMIC' &&
      target.listId === original.listId
    ) {
      return 'yes';
    }
  
    // ROLE(DYNAMIC) same role is subset (equal)
    if (
      target.kind === 'ROLE' &&
      original.kind === 'ROLE' &&
      target.role === original.role
    ) {
      return 'yes';
    }
  
    // LIST(SNAPSHOT) ⊆ LIST(DYNAMIC same listId) is indeterminate without env (members may have changed)
    if (
      target.kind === 'LIST' &&
      original.kind === 'LIST' &&
      target.mode === 'SNAPSHOT' &&
      original.mode === 'DYNAMIC' &&
      target.listId === original.listId
    ) {
      return 'indeterminate';
    }
  
    // Otherwise we don't know without env
    return 'indeterminate';
  }
  
  /** Forwarding policy check based on original facet sharePolicy + subset relation */
  export function canForward(
    originalFacet: MessageFacet,
    target: AudienceSelector,
    env?: AudienceEnv
  ): 'ALLOW' | 'REDACT' | 'FORBID' {
    switch (originalFacet.sharePolicy) {
      case 'FORBID':
        return 'FORBID';
      case 'REDACT':
        return 'REDACT';
      case 'ALLOW': {
        const tri = audienceSubsetOf(target, originalFacet.audience, env);
        return tri === 'yes' ? 'ALLOW' : 'REDACT';
      }
    }
  }
  
  /* ------------------------ Helpers ------------------------ */
  
  function audienceSelectorsEqual(a: AudienceSelector, b: AudienceSelector): boolean {
    if (a.kind !== b.kind) return false;
    switch (a.kind) {
      case 'EVERYONE':
        return true;
      case 'ROLE':
        return b.kind === 'ROLE' && a.role === b.role;
      case 'LIST':
        return b.kind === 'LIST' && a.listId === b.listId && a.mode === b.mode &&
          (a.mode !== 'SNAPSHOT' ||
            arraysEqual(sorted(a.snapshotMemberIds), sorted((b as any).snapshotMemberIds)));
      case 'USERS':
        if (b.kind !== 'USERS' || a.mode !== b.mode) return false;
        if (a.mode === 'SNAPSHOT') {
          return arraysEqual(sorted(a.snapshotMemberIds), sorted(b.snapshotMemberIds));
        } else {
          return arraysEqual(sorted(a.userIds), sorted(b.userIds));
        }
    }
  }
  
  function arraysEqual(a?: readonly string[] | null, b?: readonly string[] | null): boolean {
    const aa = a ?? [];
    const bb = b ?? [];
    if (aa.length !== bb.length) return false;
    for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
    return true;
  }
  
  function sorted(a?: readonly string[] | null): string[] {
    return [...(a ?? [])].sort();
  }
  
  function isSubset(a: Set<string>, b: Set<string>): boolean {
    for (const x of a) if (!b.has(x)) return false;
    return true;
  }
  
  /**
   * Try to materialize the concrete set of userIds represented by an AudienceSelector.
   * Returns:
   *   - Set<string> when we can know the exact membership
   *   - null when it is dynamic/unknown without env
   */
  function materializeMembers(
    a: AudienceSelector,
    env?: AudienceEnv
  ): Set<string> | null {
    switch (a.kind) {
      case 'EVERYONE':
        return null; // infinite set, treat structurally elsewhere
      case 'ROLE': {
        const members = env?.resolveRoleMembers?.(a.role);
        return members ? new Set(members) : null;
      }
      case 'LIST':
        if (a.mode === 'SNAPSHOT') {
          return new Set(a.snapshotMemberIds ?? []);
        } else {
          const members = env?.resolveListMembers?.(a.listId);
          return members ? new Set(members) : null;
        }
      case 'USERS':
        if (a.mode === 'SNAPSHOT') return new Set(a.snapshotMemberIds ?? []);
        return new Set(a.userIds ?? []);
    }
  }
  