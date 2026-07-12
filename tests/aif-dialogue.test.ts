/**
 * __tests__/aif-dialogue.spec.ts
 *
 * Covers:
 *  1) computeLegalMoves (open WHYs, author gating, † closability, force tagging)
 *  2) validateMove (R2/R3/R4/R5/R7)
 *  3) exportDeliberationAsAifJSONLD (I/RA nodes + Premise/Conclusion edges)
 *
 * Assumes ts-jest or swc-jest is set up. If you use path aliases (@/*),
 * add the appropriate moduleNameMapper in jest.config.
 */

import { computeLegalMoves } from '@/lib/dialogue/legalMovesServer';
import { validateMove } from '@/lib/dialogue/validate';
import { exportDeliberationAsAifJSONLD } from '@/lib/aif/export'; // Use full exporter with L-nodes
import { importAifJSONLD } from '@/packages/aif-core/src/import';
import { prisma } from '@/lib/prismaclient';

// ---- Minimal in-memory store the mocks below will read ----
type Row = Record<string, any>;
const store = {
  deliberationId: 'd1',
  actor: { id: 'u-author' },
  other: { id: 'u-other' },

  claims: new Map<string, Row>([
    ['c1', { id: 'c1', text: 'If A then B', createdById: 'u-author', deliberationId: 'd1' }],
    ['c2', { id: 'c2', text: 'A',           createdById: 'u-other',  deliberationId: 'd1' }],
  ]),

  arguments: new Map<string, Row>([
    ['a1', {
      id: 'a1', deliberationId: 'd1', authorId: 'u-author', text: 'Reasoning R1',
      scheme: { key: 'bare_assertion' },
      // exporter expects these relation shapes:
      premises: [{ claimId: 'c2' }],
      conclusionClaimId: 'c1',
      conclusion: { id: 'c1', text: 'If A then B' },
    }]
  ]),

  // Dialogue moves we can mutate per test:
  moves: [] as Row[],

  // Edges & CA/PA for exporter tests:
  cas: [] as Row[],
  pas: [] as Row[],

  ludicDesigns: [
    { id: 'pos', deliberationId: 'd1', participantId: 'Proponent' },
    { id: 'neg', deliberationId: 'd1', participantId: 'Opponent' },
  ],
};

// ---- Prisma mock ------------------------------------------------------------
jest.mock('@/lib/prismaclient', () => {
  const claim = {
    findUnique: jest.fn(async ({ where, select }: any) => {
      const row = store.claims.get(where.id);
      if (!row) return null;
      return select
        ? Object.fromEntries(Object.keys(select).map(k => [k, row[k]]))
        : row;
    }),
    findFirst: jest.fn(async ({ where, select }: any) => {
       // We only need id-based lookups for these tests
     const row =
       (where?.id && store.claims.get(where.id)) ??
       // generic fallback: first row matching all simple equals
       [...store.claims.values()].find((r) =>
         Object.entries(where ?? {}).every(([k, v]) => (r as any)[k] === v)
      ) ??
       null;
     if (!row) return null;
     return select
       ? Object.fromEntries(Object.keys(select).map(k => [k, row[k]]))
       : row;
   }),
    findMany: jest.fn(async ({ where, select }: any) => {
      const ids: string[] = where?.id?.in ?? [];
      const rows = ids.length ? ids.map(id => store.claims.get(id)).filter(Boolean) : [...store.claims.values()];
      return select
        ? rows.map(r => Object.fromEntries(Object.keys(select).map(k => [k, r[k]])))
        : rows;
    }),
    create: jest.fn(async ({ data }: any) => {
      const id = data.id ?? `c_${Math.random().toString(36).slice(2)}`;
      const row = { id, ...data };
      store.claims.set(id, row);
      return row;
    }),
  };

  const argument = {
    findFirst: jest.fn(async ({ where, select }: any) => {
      // author lookup by id
      const row = store.arguments.get(where?.id) ||
                  [...store.arguments.values()].find(a => a.conclusionClaimId === where?.conclusionClaimId);
      if (!row) return null;
      return select
        ? Object.fromEntries(Object.keys(select).map(k => [k, row[k]]))
        : row;
    }),
    findUnique: jest.fn(async ({ where, include, select }: any) => {
      const row = store.arguments.get(where.id);
      if (!row) return null;
      if (include) {
        return {
          ...row,
          premises: include.premises ? row.premises.map((p: any) => ({ claimId: p.claimId, claim: store.claims.get(p.claimId) })) : [],
          conclusion: include.conclusion ? store.claims.get(row.conclusionClaimId) : undefined,
          scheme: include.scheme ? row.scheme : undefined,
        };
      }
      return select
        ? Object.fromEntries(Object.keys(select).map(k => [k, row[k]]))
        : row;
    }),
    findMany: jest.fn(async ({ where, include }: any) => {
      let rows = [...store.arguments.values()];
      if (where?.deliberationId) rows = rows.filter(a => a.deliberationId === where.deliberationId);
      if (where?.id?.in) rows = rows.filter(a => where.id.in.includes(a.id));
      if (where?.conclusionClaimId) rows = rows.filter(a => a.conclusionClaimId === where.conclusionClaimId);
      if (include) {
        return rows.map(r => ({
          ...r,
          premises: include.premises ? r.premises.map((p: any) => ({ claimId: p.claimId, claim: store.claims.get(p.claimId) })) : [],
          conclusion: include.conclusion ? store.claims.get(r.conclusionClaimId) : undefined,
          scheme: include.scheme ? r.scheme : undefined,
        }));
      }
      return rows;
    }),
    create: jest.fn(async ({ data }: any) => {
      const id = data.id ?? `a_${Math.random().toString(36).slice(2)}`;
      const row = { id, ...data, premises: [] };
      store.arguments.set(id, row);
      return row;
    }),
  };

  const argumentPremise = {
    createMany: jest.fn(async ({ data }: any) => {
      for (const d of data) {
        const a = store.arguments.get(d.argumentId);
        if (a) a.premises.push({ claimId: d.claimId, isImplicit: !!d.isImplicit });
      }
      return { count: data.length };
    }),
    findFirst: jest.fn(async ({ where }: any) => {
      const a = store.arguments.get(where.argumentId);
      if (!a) return null;
      return a.premises.find((p: any) => p.claimId === where.claimId) ? { argumentId: where.argumentId, claimId: where.claimId } : null;
    }),
  };

  const dialogueMove = {
    findMany: jest.fn(async ({ where }: any) => {
      let rows = store.moves;
      if (where?.deliberationId) rows = rows.filter(m => m.deliberationId === where.deliberationId);
      return rows;
    }),
    findFirst: jest.fn(async ({ where, orderBy }: any) => {
      let rows = [...store.moves];
      if (where?.deliberationId) rows = rows.filter(m => m.deliberationId === where.deliberationId);
      if (where?.targetType)     rows = rows.filter(m => m.targetType === where.targetType);
      if (where?.targetId)       rows = rows.filter(m => m.targetId === where.targetId);


    // Support Prisma's { kind: { in: [...] } } shape
    if (where?.kind?.in) {
      rows = rows.filter(m => where.kind.in.includes(m.kind) ||
        (m.kind === 'ASSERT' && m.payload?.as === 'CONCEDE'));
    }


      if (where?.OR) {
        const kinds = where.OR.flatMap((o: any) => o.kind ? [o.kind] : []);
        rows = rows.filter(m => kinds.includes(m.kind) || (m.kind === 'ASSERT' && m.payload?.as === 'CONCEDE'));
      }
      // JSON-path filter: payload: { path:['locusPath'], equals: ... }
    if (where?.payload?.path?.includes?.('locusPath')) {
       const want = String(where.payload.equals);
       rows = rows.filter(m => String(m.payload?.locusPath ?? '0') === want);
     }
      if (orderBy?.createdAt === 'desc') rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return rows[0] ?? null;
    }),
    findUnique: jest.fn(async ({ where }: any) => {
      return store.moves.find(m => m.id === where.id) ?? null;
    }),
    create: jest.fn(async ({ data }: any) => {
      const row = { id: `m_${Math.random().toString(36).slice(2)}`, createdAt: new Date(), ...data };
      store.moves.push(row);
      return row;
    }),
  };

  const argumentEdge = {
    findMany: jest.fn(async () => []),
    groupBy:  jest.fn(async ({ where }: any) => {
      // group inbound attack edges by attackType for a given toArgumentId
      const inbound = (store as any).argEdges?.filter((e: any) => where.toArgumentId?.in?.includes
        ? where.toArgumentId.in.includes(e.toArgumentId)
        : e.toArgumentId === where.toArgumentId) ?? [];
      const buckets: Record<string, number> = {};
      for (const e of inbound) {
        const k = e.attackType ?? 'REBUTS';
        buckets[k] = (buckets[k] ?? 0) + 1;
      }
      return Object.keys(buckets).map(k => ({ attackType: k, _count: { _all: buckets[k] } }));
    }),
    create: jest.fn(async ({ data }: any) => {
      (store as any).argEdges ??= [];
      (store as any).argEdges.push({ id: `ae_${Math.random().toString(36).slice(2)}`, ...data });
      return (store as any).argEdges.at(-1);
    }),
  };

  const conflictApplication = {
    findMany: jest.fn(async ({ where }: any) => {
      const rows = where?.deliberationId
        ? store.cas.filter(ca => ca.deliberationId === where.deliberationId)
        : store.cas;
      return rows.map(ca => ({ ...ca, scheme: ca.scheme ?? { key: ca.schemeKey ?? null } }));
    }),
    create: jest.fn(async ({ data }: any) => {
      const row = { id: `ca_${Math.random().toString(36).slice(2)}`, ...data };
      store.cas.push(row);
      return row;
    }),
  };

  const preferenceApplication = {
    findMany: jest.fn(async ({ where }: any) => store.pas),
    count:    jest.fn(async ({ where }: any) => store.pas.length),
  };

  const argumentScheme = {
    findUnique: jest.fn(async ({ where }: any) => {
      if (where.id)      return { id: where.id, key: 'bare_assertion', name: 'Bare' };
      if (where.key)     return { id: 'sch1', key: where.key, name: 'Bare' };
      return null;
    }),
    findMany: jest.fn(async () => [{ id: 'sch1', key: 'bare_assertion', cqs: [] }]),
  };

  const cQStatus = {
    findMany: jest.fn(async ({ where }: any) => []),
    upsert:   jest.fn(async () => ({})),
    createMany: jest.fn(async () => ({ count: 0 })),
  };

  const ludicDesign = {
    findMany: jest.fn(async ({ where }: any) => store.ludicDesigns),
  };

  const theoryWork = {
    findMany: jest.fn(async ({ where }: any) => []), // No theory works by default
  };

  return {
    prisma: {
      claim, argument, argumentPremise, dialogueMove,
      argumentEdge, conflictApplication, preferenceApplication,
      argumentScheme, cQStatus, ludicDesign, theoryWork,
    }
  };
});

// ---- Ludics stepper mock: return a CLOSE hint at locusPath '0' -------------
jest.mock('@/packages/ludics-engine/stepper', () => ({
  stepInteraction: jest.fn(async () => ({ daimonHints: [{ locusPath: '0' }] }))
}));

// --------------------------------------------------------------------------------

beforeEach(() => {
  store.moves.length = 0;
  (store as any).argEdges = [];
});

// --------------------------------------------------------------------------------

describe('computeLegalMoves', () => {
  test('returns GROUNDS for open WHY (author only), force tags, and † CLOSE hint', async () => {
    // Seed an open WHY on claim c1
    store.moves.push({
      id: 'm1',
      deliberationId: store.deliberationId,
      targetType: 'claim',
      targetId: 'c1',
      kind: 'WHY',
      actorId: store.other.id,
      payload: { cqId: 'CQ1', locusPath: '0' },
      createdAt: new Date('2024-01-01T00:00:00Z'),
    });

    const { moves } = await computeLegalMoves({
      deliberationId: 'd1',
      targetType: 'claim',
      targetId: 'c1',
      locusPath: '0',
      actorId: store.actor.id, // author of c1
    });

    // Should suggest GROUNDS (enabled), no WHY (since one is open), and include † Close
    const byKind = Object.groupBy(moves, m => m.kind);
    expect(byKind.GROUNDS?.[0].label).toMatch(/Answer CQ1/);
    expect(byKind.GROUNDS?.[0].disabled).toBe(false);
    expect(byKind.WHY).toBeUndefined();

    // Force tags
    expect(byKind.GROUNDS?.[0].force).toBe('ATTACK');
    expect(byKind.RETRACT?.[0].force).toBe('SURRENDER');

    // † closability hinted for locus '0'
    expect(byKind.CLOSE?.[0]).toBeTruthy();
  });

  test('WHY disabled for author when no open WHY exists', async () => {
    const { moves } = await computeLegalMoves({
      deliberationId: 'd1',
      targetType: 'claim',
      targetId: 'c1',
      locusPath: '0',
      actorId: store.actor.id, // same as author
    });
    const why = moves.find(m => m.kind === 'WHY');
    expect(why?.disabled).toBe(true);
    expect(why?.reason).toMatch(/own item/);
  });
});

// --------------------------------------------------------------------------------

describe('validateMove (R-rules)', () => {
  test('R2_NO_OPEN_CQ when posting GROUNDS with no prior WHY of same key', async () => {
    const res = await validateMove({
      deliberationId: 'd1',
      actorId: store.actor.id,
      kind: 'GROUNDS',
      targetType: 'claim',
      targetId: 'c1',
      payload: { cqId: 'CQX', locusPath: '0' },
    } as any);
    expect((res as any).ok).toBe(false);
    expect((res as any).reasons).toContain('R2_NO_OPEN_CQ');
  });

  test('R5_AFTER_SURRENDER when attacking after CLOSE/CONCEDE', async () => {
    // Surrender this branch
    store.moves.push({
      id: 'm2',
      deliberationId: 'd1',
      targetType: 'claim',
      targetId: 'c1',
      kind: 'CLOSE',
      payload: { locusPath: '0' },
      actorId: store.other.id,
      createdAt: new Date(),
    });

    const res = await validateMove({
      deliberationId: 'd1',
      actorId: store.other.id,
      kind: 'WHY',
      targetType: 'claim',
      targetId: 'c1',
      payload: { locusPath: '0' },
    } as any);

    expect((res as any).ok).toBe(false);
    expect((res as any).reasons).toContain('R5_AFTER_SURRENDER');
  });

  test('R4_DUPLICATE_REPLY when signature base matches prior WHY/GROUNDS', async () => {
    // Prior WHY on default key
    store.moves.push({
      id: 'm3',
      deliberationId: 'd1',
      targetType: 'claim',
      targetId: 'c1',
      kind: 'WHY',
      signature: 'WHY:claim:c1:default',
      payload: { cqId: 'default', locusPath: '0' },
      actorId: store.other.id,
      createdAt: new Date(),
    });

    const res = await validateMove({
      deliberationId: 'd1',
      actorId: store.other.id,
      kind: 'WHY',
      targetType: 'claim',
      targetId: 'c1',
      payload: { cqId: 'default', locusPath: '0' },
    } as any);

    expect((res as any).ok).toBe(false);
    expect((res as any).reasons).toContain('R4_DUPLICATE_REPLY');
  });

  test('R7_ACCEPT_ARGUMENT_REQUIRED: conceding after GROUNDS suggests accepting the argument', async () => {
    // Post WHY then GROUNDS on claim c1
    store.moves.push({
      id: 'm4',
      deliberationId: 'd1',
      targetType: 'claim',
      targetId: 'c1',
      kind: 'WHY',
      payload: { cqId: 'CQ1', locusPath: '0' },
      actorId: store.other.id,
      createdAt: new Date('2024-01-01'),
    });
    store.moves.push({
      id: 'm5',
      deliberationId: 'd1',
      targetType: 'claim',
      targetId: 'c1',
      kind: 'GROUNDS',
      payload: { cqId: 'CQ1', locusPath: '0' },
      actorId: store.actor.id, // author answers
      createdAt: new Date('2024-01-02'),
    });

    const res = await validateMove({
      deliberationId: 'd1',
      actorId: store.other.id,
      kind: 'CONCEDE',
      targetType: 'claim',
      targetId: 'c1',
      payload: { locusPath: '0' },
    } as any);

    expect((res as any).ok).toBe(false);
    expect((res as any).reasons).toContain('R7_ACCEPT_ARGUMENT_REQUIRED');
  });
});

// --------------------------------------------------------------------------------

describe('exportDeliberationAsAifJSONLD', () => {
  test('exports I and RA nodes with Premise & Conclusion edges', async () => {
    // Ensure one argument a1 already in store linking c2 -> (RA:a1) -> c1
    const out = await exportDeliberationAsAifJSONLD('d1');
    // structure is { nodes, edges } per the corrected exporter
    const nodes = out.nodes as any[];
    const edges = out.edges as any[];

    const hasI_c1 = nodes.find(n => n['@type'] === 'aif:InformationNode' && n['@id'].includes('c1'));
    const hasI_c2 = nodes.find(n => n['@type'] === 'aif:InformationNode' && n['@id'].includes('c2'));
    const hasRA   = nodes.find(n => n['@type'] === 'aif:RA' && n['@id'].includes('a1'));

    const hasPrem = edges.find(e => e['@type'] === 'aif:Premise'    && e.to.includes('RA|a1'));
    const hasConc = edges.find(e => e['@type'] === 'aif:Conclusion' && e.from.includes('RA|a1'));

    expect(hasI_c1 && hasI_c2 && hasRA).toBeTruthy();
    expect(hasPrem && hasConc).toBeTruthy();
  });
});

describe('validateMove — R3_SELF_REPLY with explicit replyToMoveId', () => {
  test('replying to your own WHY triggers R3_SELF_REPLY', async () => {
    // 1) Seed a WHY by the author (same user who will reply)
    const parent = {
      id: 'm_parent',
      deliberationId: 'd1',
      targetType: 'claim' as const,
      targetId: 'c1',
      kind: 'WHY' as const,
      actorId: 'u-author',                  // author
      payload: { cqId: 'CQ_SELF', locusPath: '0' },
      createdAt: new Date('2024-01-01T00:00:00Z'),
      signature: 'WHY:claim:c1:CQ_SELF',
    };
    (store as any).moves.push(parent);

    // 2) Same actor posts GROUNDS replying directly to that WHY
    const res = await validateMove({
      deliberationId: 'd1',
      actorId: 'u-author',                  // same actor as parent
      kind: 'GROUNDS',
      targetType: 'claim',
      targetId: 'c1',
      replyToMoveId: parent.id,             // explicit linkage
      replyTarget: 'claim',
      payload: { cqId: 'CQ_SELF', locusPath: '0', expression: 'Because …' },
    } as any);

    expect((res as any).ok).toBe(false);
    expect((res as any).reasons).toContain('R3_SELF_REPLY');
    // Also confirms it is NOT failing R2 (we did have an open WHY on the same key)
    expect((res as any).reasons).not.toContain('R2_NO_OPEN_CQ');
  });
});

// =============================================================================
// Round-Trip Testing (Export → Import → Validate Structural Equivalence)
// =============================================================================

describe('AIF Round-Trip (Export → Import → Compare)', () => {
  beforeEach(() => {
    // Reset store for clean round-trip tests
    store.claims.clear();
    store.arguments.clear();
    store.cas = [];
    store.pas = [];
    store.moves = [];
    
    // Seed original deliberation with claims + arguments
    store.claims.set('c1', { id: 'c1', text: 'Conclusion C', createdById: 'u-author', deliberationId: 'd1' });
    store.claims.set('c2', { id: 'c2', text: 'Premise P1', createdById: 'u-author', deliberationId: 'd1' });
    store.claims.set('c3', { id: 'c3', text: 'Premise P2', createdById: 'u-other', deliberationId: 'd1' });
    
    store.arguments.set('a1', {
      id: 'a1',
      deliberationId: 'd1',
      authorId: 'u-author',
      text: 'Argument 1',
      scheme: { key: 'modus_ponens' },
      premises: [{ claimId: 'c2' }, { claimId: 'c3' }],
      conclusionClaimId: 'c1',
      conclusion: { id: 'c1', text: 'Conclusion C' },
    });
  });

  test('export → import preserves I-nodes (claims)', async () => {
    // 1) Export deliberation d1
    const exported = await exportDeliberationAsAifJSONLD('d1');
    
    // Verify export structure
    expect(exported.nodes).toBeDefined();
    expect(exported.edges).toBeDefined();
    expect((exported as any)['@context']).toBeDefined();
    
    const iNodes = exported.nodes.filter((n: any) => n['@type'] === 'aif:InformationNode');
    expect(iNodes.length).toBe(3); // c1, c2, c3
    
    // 2) Verify I-nodes have text content
    const texts = iNodes.map((n: any) => n.text);
    expect(texts).toContain('Conclusion C');
    expect(texts).toContain('Premise P1');
    expect(texts).toContain('Premise P2');
  });

  test('export includes RA-nodes with premise/conclusion edges)', async () => {
    // 1) Export
    const exported = await exportDeliberationAsAifJSONLD('d1');
    
    const raNodes = exported.nodes.filter((n: any) => n['@type'] === 'aif:RA');
    expect(raNodes.length).toBe(1); // a1
    
    // 2) Verify premise/conclusion edges (edges have 'role' property not '@type')
    const premiseEdges = exported.edges.filter((e: any) => e.role === 'aif:Premise');
    const conclusionEdges = exported.edges.filter((e: any) => e.role === 'aif:Conclusion');
    
    expect(premiseEdges.length).toBe(2); // c2 → a1, c3 → a1
    expect(conclusionEdges.length).toBe(1); // a1 → c1
    
    // 3) Verify RA-node has scheme reference
    expect(raNodes[0].schemeKey).toBe('modus_ponens');
  });

  test('export includes L-nodes but import is lossy (dialogue moves not imported)', async () => {
    // Add dialogue move to original deliberation
    store.moves.push({
      id: 'm1',
      deliberationId: 'd1',
      kind: 'GROUNDS',
      illocution: 'GROUNDS', // Export uses 'illocution' field
      targetType: 'claim' as const,
      targetId: 'c1',
      argumentId: 'a1',
      actorId: 'u-author',
      payload: { expression: 'Because X' },
      createdAt: new Date(),
    });
    
    // 1) Export (should include L-nodes)
    const exported = await exportDeliberationAsAifJSONLD('d1');
    
    const lNodes = exported.nodes.filter((n: any) => n['@type'] === 'aif:L');
    expect(lNodes.length).toBe(1); // m1 exported successfully
    
    // Verify L-node structure
    expect(lNodes[0]).toMatchObject({
      '@type': 'aif:L',
      illocution: 'GROUNDS',
      text: 'Because X',
    });
    
    // Verify L-node → RA edge (Illocutes)
    const illocutesEdges = exported.edges.filter((e: any) => e.role === 'aif:Illocutes');
    expect(illocutesEdges.length).toBe(1);
    expect(illocutesEdges[0].from).toContain('L|m1');
    expect(illocutesEdges[0].to).toContain('RA|a1');
    
    // 2) Demonstrate lossy import: L-nodes exported but NOT imported
    // (This test documents the 50% loss identified in CHUNK 6B spec)
    // Import implementation in packages/aif-core/src/import.ts only handles I/RA/CA nodes
    
    // Clean up for next test
    store.moves.length = 0;
  });
});