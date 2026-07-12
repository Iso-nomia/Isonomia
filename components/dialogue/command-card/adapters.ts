// /components/dialogue/command-card/adapters.ts
import type { CommandCardAction, TargetRef } from './types';
import type { MinimapNode, MinimapEdge } from '@/components/dialogue/minimap/types';

export type ServerMove = {
  kind: 'ASSERT'|'WHY'|'GROUNDS'|'RETRACT'|'CONCEDE'|'CLOSE';
  label: string;
  payload?: any;
  disabled?: boolean;
  reason?: string;
  force?: 'ATTACK'|'SURRENDER'|'NEUTRAL';
  relevance?: 'likely'|'unlikely'|null;
  postAs?: { targetType:'argument'|'claim'|'card'; targetId:string };
};

export function legalMovesToCommandCard(
  serverMoves: ServerMove[],
  target: TargetRef,
  includeScaffolds = true
): CommandCardAction[] {
  const actions: CommandCardAction[] = [];

  for (const m of serverMoves) {
    const id = m.kind.toLowerCase();
    const a: CommandCardAction = {
      id,
      kind:
        m.kind === 'WHY' ? 'WHY' :
        m.kind === 'GROUNDS' ? 'GROUNDS' :
        m.kind === 'CONCEDE' ? 'CONCEDE' :
        m.kind === 'RETRACT' ? 'RETRACT' :
        m.kind === 'CLOSE' ? 'CLOSE' : 'WHY',
      label: m.label,
      force: (m.force ?? 'NEUTRAL') as any,
      disabled: m.disabled,
      reason: m.reason,
      relevance: m.relevance ?? null,
      move: {
        kind: (m.kind as any),
        payload: m.payload ?? {},
        postAs: m.postAs ? { ...target, ...m.postAs } : undefined,
      },
      target,
      group:
        m.kind === 'WHY' || m.kind === 'GROUNDS' || m.kind === 'CLOSE' ? 'top' :
        m.kind === 'CONCEDE' || m.kind === 'RETRACT' ? 'mid' :
        'mid',
      tone:
        m.kind === 'RETRACT' ? 'danger' :
        m.kind === 'CLOSE' ? 'primary' : 'default',
    };
    actions.push(a);
  }

  if (includeScaffolds) {
    actions.push(
      {
        id: 'why-forall',
        kind: 'FORALL_INSTANTIATE',
        label: '∀‑instantiate',
        force: 'ATTACK',
        target,
        group: 'bottom',
        scaffold: { template: 'Instantiate with…', analyticsName: 'scaffold:forall' },
      },
      {
        id: 'why-exists',
        kind: 'EXISTS_WITNESS',
        label: '∃‑witness',
        force: 'ATTACK',
        target,
        group: 'bottom',
        scaffold: { template: 'Provide witness…', analyticsName: 'scaffold:exists' },
      },
      {
        id: 'why-presup',
        kind: 'PRESUP_CHALLENGE',
        label: 'Presupposition?',
        force: 'ATTACK',
        target,
        group: 'bottom',
        scaffold: { template: 'Justify presupposition...', analyticsName: 'scaffold:presup' },
      }
    );
  }

  return actions;
}


const asNodeStatus = (label?: string): 'IN'|'OUT'|'UNDEC' => (
  label === 'IN' ? 'IN' : label === 'OUT' ? 'OUT' : 'UNDEC'
);

export type GraphResp = {
  nodes: Array<{ id: string; type: 'claim'; text: string; label?: 'IN'|'OUT'|'UNDEC'; approvals: number; schemeIcon?: string|null }>;
  edges: Array<{ id: string; source: string; target: string; type: 'supports'|'rebuts'; attackType?: 'SUPPORTS'|'REBUTS'|'UNDERCUTS'|'UNDERMINES'; targetScope?: 'premise'|'inference'|'conclusion'|null }>;
  version: number;
  lens: 'af'|'bipolar';
  capped: boolean;
};

export function adaptGraphToMinimap(g: GraphResp): { nodes: MinimapNode[]; edges: MinimapEdge[] } {
  const nodes: MinimapNode[] = (g.nodes || []).map(n => ({
    id: String(n.id),
    kind: 'claim',
    label: (n.text || '').slice(0, 80),
    status: asNodeStatus(n.label),
    endorsements: n.approvals ?? 0,
    // † closable will be computed separately; fogged & hasOpenCq too
  }));

  const edges: MinimapEdge[] = (g.edges || []).map((e, i) => {
    const kind =
      e.attackType === 'UNDERCUTS' ? 'undercut' :
      (e.type === 'rebuts' || e.attackType === 'REBUTS' || e.attackType === 'UNDERMINES') ? 'rebut' :
      'support';
    return {
      id: e.id || `e${i}`,
      from: String(e.source),
      to: String(e.target),
      kind,
    };
  });

  return { nodes, edges };
}
