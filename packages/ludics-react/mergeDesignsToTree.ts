import type { LociNode } from './LociTree';

type RawAct = {
  id: string;
  kind?: 'PROPER'|'DAIMON'|string;
  expression?: string;
  isAdditive?: boolean;
  additive?: boolean;             // legacy flag
  locus?: { path?: string | null };
};

type RawDesign = {
  id: string;
  participantId: 'Proponent' | 'Opponent' | string;
  acts?: RawAct[];
};

export function mergeDesignsToTree(designs: RawDesign[]): LociNode {
  const byPath = new Map<string, LociNode>();
  const ensure = (path: string) => {
    if (!byPath.has(path)) byPath.set(path, { id: path, path, acts: [], children: [] });
    return byPath.get(path)!;
  };

  const addAct = (side: 'P'|'O', a: RawAct) => {
    const path = a?.locus?.path ?? '0';
    const node = ensure(path);
    const isDaimon = (a.kind ?? '').toUpperCase() === 'DAIMON';
    node.acts.push({
      id: a.id,
      polarity: isDaimon ? null : side,             // † if daimon
      expression: a.expression,
      isAdditive: !!(a.isAdditive || a.additive),
    });
    // ensure ancestors exist to draw connectors
    const parts = path.split('.');
    for (let i = 1; i < parts.length; i++) ensure(parts.slice(0, i).join('.'));
  };

  for (const d of designs) {
    const side: 'P'|'O' = d.participantId === 'Proponent' ? 'P' : 'O';
    (d.acts ?? []).forEach((a) => addAct(side, a));
  }

  // stitch children
  const dict = Object.fromEntries(Array.from(byPath.entries()));
  for (const n of byPath.values()) {
    const parent = n.path.includes('.') ? n.path.split('.').slice(0, -1).join('.') : null;
    if (parent && dict[parent]) dict[parent].children.push(n);
  }
  return dict['0'] || { id: '0', path: '0', acts: [], children: [] };
}
