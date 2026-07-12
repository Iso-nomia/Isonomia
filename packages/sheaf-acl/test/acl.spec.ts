import { describe, it, expect } from 'vitest';
import {
  AudienceSelector,
  MessageFacet,
  UserContext,
  audienceSubsetOf,
  canForward,
  defaultFacetFor,
  visibleFacetsFor,
} from '../src';

const facet = (a: AudienceSelector, extra?: Partial<MessageFacet>): MessageFacet => ({
  id: `f_${Math.random()}`,
  messageId: 'm1',
  audience: a,
  sharePolicy: 'ALLOW',
  body: {},
  createdAt: extra?.createdAt ?? 0,
  priorityRank: extra?.priorityRank,
  ...extra,
});

const U = (id: string, roles: string[] = [], inList?: (id: string) => boolean): UserContext => ({
  id,
  roles: new Set(roles),
  inList,
});

describe('visibleFacetsFor / defaultFacetFor', () => {
  it('EVERYONE facet is visible to all', () => {
    const f = [facet({ kind: 'EVERYONE' })];
    const user = U('u1');
    const vis = visibleFacetsFor(user, f);
    expect(vis.length).toBe(1);
    const def = defaultFacetFor(user, f);
    expect(def?.audience.kind).toBe('EVERYONE');
  });

  it('ROLE:MOD facet visible only to mods; default picks ROLE over EVERYONE', () => {
    const f = [facet({ kind: 'EVERYONE' }), facet({ kind: 'ROLE', role: 'MOD', mode: 'DYNAMIC' })];
    const mod = U('m1', ['MOD']);
    const normie = U('n1', []);
    expect(visibleFacetsFor(mod, f).map((x) => x.audience.kind)).toEqual(['ROLE', 'EVERYONE']);
    expect(defaultFacetFor(mod, f)?.audience.kind).toBe('ROLE');
    expect(visibleFacetsFor(normie, f).map((x) => x.audience.kind)).toEqual(['EVERYONE']);
  });

  it('LIST SNAPSHOT membership', () => {
    const f = [
      facet({ kind: 'EVERYONE' }),
      facet({
        kind: 'LIST',
        listId: 'core',
        mode: 'SNAPSHOT',
        snapshotMemberIds: ['u1', 'u2'],
      }),
    ];
    const u1 = U('u1');
    const u3 = U('u3');
    expect(visibleFacetsFor(u1, f).map((x) => x.audience.kind)).toEqual(['LIST', 'EVERYONE']);
    expect(defaultFacetFor(u1, f)?.audience.kind).toBe('LIST');
    expect(visibleFacetsFor(u3, f).map((x) => x.audience.kind)).toEqual(['EVERYONE']);
  });

  it('LIST DYNAMIC membership via user.inList', () => {
    const f = [
      facet({ kind: 'EVERYONE' }),
      facet({ kind: 'LIST', listId: 'core', mode: 'DYNAMIC' }),
    ];
    const inCore = U('u1', [], (id) => id === 'core');
    const notInCore = U('u2', [], () => false);
    expect(visibleFacetsFor(inCore, f).map((x) => x.audience.kind)).toEqual(['LIST', 'EVERYONE']);
    expect(visibleFacetsFor(notInCore, f).map((x) => x.audience.kind)).toEqual(['EVERYONE']);
  });

  it('USERS SNAPSHOT membership', () => {
    const f = [
      facet({ kind: 'USERS', mode: 'SNAPSHOT', snapshotMemberIds: ['u1'] }),
      facet({ kind: 'EVERYONE' }),
    ];
    const u1 = U('u1');
    const u2 = U('u2');
    expect(visibleFacetsFor(u1, f).map((x) => x.audience.kind)).toEqual(['USERS', 'EVERYONE']);
    expect(visibleFacetsFor(u2, f).map((x) => x.audience.kind)).toEqual(['EVERYONE']);
  });

  it('defaultFacetFor returns null when none visible', () => {
    const f = [facet({ kind: 'USERS', mode: 'SNAPSHOT', snapshotMemberIds: ['other'] })];
    expect(defaultFacetFor(U('u1'), f)).toBeNull();
  });

  it('sorting: same rank uses createdAt as tiebreaker', () => {
    const f1 = facet({ kind: 'USERS', mode: 'SNAPSHOT', snapshotMemberIds: ['u1'] }, { createdAt: 200 });
    const f2 = facet({ kind: 'USERS', mode: 'SNAPSHOT', snapshotMemberIds: ['u1'] }, { createdAt: 100 });
    const vis = visibleFacetsFor(U('u1'), [f1, f2]);
    expect(vis[0].createdAt).toBe(100);
    expect(vis[1].createdAt).toBe(200);
  });
});

describe('audienceSubsetOf (tri-state)', () => {
  it('trivial: X ⊆ EVERYONE', () => {
    const t: AudienceSelector = { kind: 'USERS', mode: 'SNAPSHOT', snapshotMemberIds: ['u1'] };
    expect(audienceSubsetOf(t, { kind: 'EVERYONE' })).toBe('yes');
  });

  it('EVERYONE ⊆ USERS is false', () => {
    const t: AudienceSelector = { kind: 'EVERYONE' };
    const o: AudienceSelector = { kind: 'USERS', mode: 'SNAPSHOT', snapshotMemberIds: ['u1'] };
    expect(audienceSubsetOf(t, o)).toBe('no');
  });

  it('USERS subset of USERS by set inclusion', () => {
    const t: AudienceSelector = { kind: 'USERS', mode: 'SNAPSHOT', snapshotMemberIds: ['u1'] };
    const o: AudienceSelector = { kind: 'USERS', mode: 'SNAPSHOT', snapshotMemberIds: ['u1', 'u2'] };
    expect(audienceSubsetOf(t, o)).toBe('yes');
  });

  it('LIST(SNAPSHOT) subset of LIST(SNAPSHOT) by set inclusion', () => {
    const t: AudienceSelector = { kind: 'LIST', listId: 'core', mode: 'SNAPSHOT', snapshotMemberIds: ['a'] };
    const o: AudienceSelector = { kind: 'LIST', listId: 'core', mode: 'SNAPSHOT', snapshotMemberIds: ['a', 'b'] };
    expect(audienceSubsetOf(t, o)).toBe('yes');
  });

  it('DYNAMIC comparisons without env are indeterminate (except trivial equals)', () => {
    const t: AudienceSelector = { kind: 'USERS', mode: 'DYNAMIC', userIds: ['u1'] };
    const o: AudienceSelector = { kind: 'ROLE', role: 'MOD', mode: 'DYNAMIC' };
    expect(audienceSubsetOf(t, o)).toBe('indeterminate');
  });

  it('DYNAMIC comparisons can resolve with env resolvers', () => {
    const t: AudienceSelector = { kind: 'USERS', mode: 'DYNAMIC', userIds: ['u1'] };
    const o: AudienceSelector = { kind: 'ROLE', role: 'MOD', mode: 'DYNAMIC' };
    const env = { resolveRoleMembers: (role: string) => (role === 'MOD' ? ['u1', 'u3'] : []) };
    expect(audienceSubsetOf(t, o, env)).toBe('yes');
  });

  it('LIST(DYNAMIC) same listId is subset (equal)', () => {
    const t: AudienceSelector = { kind: 'LIST', listId: 'core', mode: 'DYNAMIC' };
    const o: AudienceSelector = { kind: 'LIST', listId: 'core', mode: 'DYNAMIC' };
    expect(audienceSubsetOf(t, o)).toBe('yes');
  });
});

describe('canForward', () => {
  const of = (aud: AudienceSelector, policy = 'ALLOW' as const): MessageFacet =>
    facet(aud, { sharePolicy: policy });

  it('FORBID blocks', () => {
    const orig = of({ kind: 'EVERYONE' }, 'FORBID');
    const target: AudienceSelector = { kind: 'EVERYONE' };
    expect(canForward(orig, target)).toBe('FORBID');
  });

  it('REDACT always redacts', () => {
    const orig = of({ kind: 'EVERYONE' }, 'REDACT');
    const target: AudienceSelector = { kind: 'EVERYONE' };
    expect(canForward(orig, target)).toBe('REDACT');
  });

  it('ALLOW with proven subset → ALLOW', () => {
    const orig = of({ kind: 'USERS', mode: 'SNAPSHOT', snapshotMemberIds: ['u1', 'u2'] }, 'ALLOW');
    const target: AudienceSelector = { kind: 'USERS', mode: 'SNAPSHOT', snapshotMemberIds: ['u1'] };
    expect(canForward(orig, target)).toBe('ALLOW');
  });

  it('ALLOW with indeterminate subset → REDACT', () => {
    const orig = of({ kind: 'ROLE', role: 'MOD', mode: 'DYNAMIC' }, 'ALLOW');
    const target: AudienceSelector = { kind: 'USERS', mode: 'DYNAMIC', userIds: ['u1'] };
    expect(canForward(orig, target)).toBe('REDACT');
  });

  it('ALLOW when original is EVERYONE → ALLOW to anything', () => {
    const orig = of({ kind: 'EVERYONE' }, 'ALLOW');
    const target: AudienceSelector = { kind: 'USERS', mode: 'SNAPSHOT', snapshotMemberIds: ['x'] };
    expect(canForward(orig, target)).toBe('ALLOW');
  });
});
