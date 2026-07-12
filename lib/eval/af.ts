// lib/eval/af.ts
export type AF = { 
  nodes: string[]; 
  attacks: [string, string][]; // [from, to]
  supports?: [string, string][]; // [from, to] - optional support edges
};
export type Label = 'IN'|'OUT'|'UNDEC';

/** 
 * Grounded labels via iterative characteristic function.
 * Enhanced with support-awareness: considers both attacks and support edges.
 * Support edges increase acceptance likelihood when attackers are defeated.
 */
export function groundedLabels(af: AF): Record<string, Label> {
  const { nodes, attacks, supports = [] } = af;
  const attackersOf = new Map<string, Set<string>>();
  const supportersOf = new Map<string, Set<string>>();
  
  for (const n of nodes) {
    attackersOf.set(n, new Set());
    supportersOf.set(n, new Set());
  }
  
  for (const [a,b] of attacks) attackersOf.get(b)!.add(a);
  for (const [a,b] of supports) supportersOf.get(b)!.add(a);

  const IN = new Set<string>();
  const OUT = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;
    
    // Accept unattacked or whose attackers are all OUT
    // Support-aware: also consider support strength
    for (const x of nodes) {
      if (!IN.has(x) && !OUT.has(x)) {
        const attackers = attackersOf.get(x)!;
        const supporters = supportersOf.get(x)!;
        const allOut = [...attackers].every(a => OUT.has(a));
        
        // Support strength: count IN supporters
        const supportStrength = [...supporters].filter(s => IN.has(s)).length;
        
        // Accept if: (no attacks OR all attackers OUT) AND has some support OR no attackers
        const shouldAccept = (attackers.size === 0 || allOut) && 
                           (supportStrength > 0 || attackers.size === 0);
        
        if (shouldAccept) { 
          IN.add(x); 
          changed = true; 
        }
      }
    }
    
    // Reject anything attacked by an IN
    for (const x of nodes) {
      if (!OUT.has(x)) {
        const hasIn = [...attackersOf.get(x)!].some(a => IN.has(a));
        if (hasIn) { OUT.add(x); changed = true; }
      }
    }
  }
  
  const labels: Record<string, Label> = {};
  for (const x of nodes) labels[x] = IN.has(x) ? 'IN' : OUT.has(x) ? 'OUT' : 'UNDEC';
  return labels;
}

/** Naive preferred (skeptical): powerset enumeration; OK for small graphs. */
export function preferredLabels(af: AF): Record<string, Label> {
  const { nodes, attacks } = af;
  const att = new Map<string, Set<string>>();
  const tgt = new Map<string, Set<string>>();
  for (const n of nodes) { att.set(n, new Set()); tgt.set(n, new Set()); }
  for (const [a,b] of attacks) { att.get(a)!.add(b); tgt.get(b)!.add(a); }

  const conflictFree = (S:Set<string>) => {
    for (const a of S) for (const b of S) if (att.get(a)!.has(b)) return false; return true;
  };
  const defends = (S:Set<string>, x:string) =>
    [...tgt.get(x)!].every(attacker => [...S].some(s => att.get(s)!.has(attacker)));

  // enumerate admissible sets
  const P: Set<string>[] = [];
  for (let m=0; m < (1<<nodes.length); m++) {
    const S = new Set<string>(nodes.filter((_,i)=> (m>>i)&1 ));
    if (!conflictFree(S)) continue;
    let ok = true;
    for (const x of S) if (!defends(S,x)) { ok = false; break; }
    if (ok) P.push(S);
  }
  const Preferred = P.filter(S => !P.some(T => S !== T && [...S].every(x=>T.has(x)) && T.size>S.size));
  const inAll = new Set(nodes.filter(n => Preferred.every(S => S.has(n))));
  const inSome = new Set(nodes.filter(n => Preferred.some(S => S.has(n))));
  const labels: Record<string, Label> = {};
  for (const n of nodes) labels[n] = inAll.has(n) ? 'IN' : inSome.has(n) ? 'UNDEC' : 'OUT';
  return labels;
}
