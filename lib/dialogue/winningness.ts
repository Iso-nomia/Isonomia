// lib/dialogue/winningness.ts
export type Move = {
    id: string;
    targetType: 'argument'|'claim';
    targetId: string;
    kind: 'ASSERT'|'WHY'|'GROUNDS'|'RETRACT';
    actorId: string;
    createdAt: string; // ISO
  };
  
  export type Winningness = {
    targetId: string;
    unansweredAttacks: number;
    answeredAttacks: number;
    status: 'won'|'contested'|'open';
  };
  
  export function scoreWinningness(moves: Move[], byTargetId: string): Winningness {
    const M = moves.filter(m => m.targetId === byTargetId)
                   .sort((a,b)=> a.createdAt.localeCompare(b.createdAt));
    let pendingWHY = 0, answered = 0;
  
    for (const m of M) {
      if (m.kind === 'WHY') pendingWHY++;
      if (m.kind === 'GROUNDS' || m.kind === 'RETRACT') {
        if (pendingWHY > 0) { pendingWHY--; answered++; }
      }
    }
    const status: Winningness['status'] =
      pendingWHY === 0 && answered > 0 ? 'won'
      : pendingWHY > 0 ? 'contested'
      : 'open';
  
    return { targetId: byTargetId, unansweredAttacks: pendingWHY, answeredAttacks: answered, status };
  }
  