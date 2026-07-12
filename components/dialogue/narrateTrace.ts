// components/dialogue/narrateTrace.ts
import type { StepResult } from "@/packages/ludics-core/types";
type Act = { polarity:'P'|'O'|'†'|null; locusPath?:string; expression?:string; meta?:any; isAdditive?:boolean };
 // type Pair = { posActId: string; negActId: string; ts?: number };
  // type StepResult = {
  //   status: 'ONGOING' | 'CONVERGENT' | 'DIVERGENT';
  //   pairs: Pair[];
  //   decisiveIndices?: number[];
  //   usedAdditive?: Record<string, string>;
  //   endedAtDaimonForParticipantId?: 'Proponent' | 'Opponent';
  //   endorsement?: { locusPath: string; byParticipantId: string; viaActId: string };
  // };
  export function classifyAct(act?: {
    kind?: 'PROPER'|'DAIMON';
    polarity?: 'P'|'O';
    expression?: string | null;
    locus?: { path?: string | null };
    metaJson?: any;
  }): { kind:'ASSERT'|'WHY'|'GROUNDS'|'DAIMON', locus: string, locusPath: string, cq?: string } {
    if (!act) return { kind: 'ASSERT', locus: '0', locusPath: '0' };
  
    if (act.kind === 'DAIMON') {
      const p = act.locus?.path ?? '0';
      return { kind: 'DAIMON', locus: p, locusPath: p };
    }
  
    const pol = act.polarity ?? 'P';
    const meta = (act.metaJson ?? {}) as any;
    const locusPath = act.locus?.path ?? '0';
    const just = typeof meta.justifiedByLocus === 'string' ? meta.justifiedByLocus.trim() : undefined;
    const cq = meta?.cqId ?? meta?.schemeKey ?? undefined;
  
    if (just && pol === 'O') return { kind: 'WHY', cq, locus: just, locusPath };
    if (just && pol === 'P') return { kind: 'GROUNDS', cq, locus: just, locusPath };
    return { kind: 'ASSERT', locus: locusPath, locusPath };
  }
// Null-safe classifier; supports WHY, GROUNDS, ASSERT, and †
function classify(act?: Act | null) {
  // Support both your old 'P'|'O'|null and a future '†'
  const rawPol = act?.polarity;
  const pol = rawPol === '†' ? '†' : (rawPol ?? 'P'); // default 'P'
  const meta = (act as any)?.meta ?? (act as any)?.metaJson ?? {};
  const locusPath = (act as any)?.locusPath ?? (act as any)?.locus?.path ?? '0';
  const locus = String(meta?.justifiedByLocus ?? locusPath);
  const cq = meta?.cqId ?? meta?.schemeKey ?? undefined;

  // † (daimon)
  if (pol === '†') {
    return { kind: 'DAIMON' as const, locus, locusPath };
  }

  // WHY (negative act anchored at justifiedByLocus)
  if (meta?.justifiedByLocus && pol === 'O') {
    return { kind: 'WHY' as const, cq, locus, locusPath };
  }

  // GROUNDS (positive act justified at some parent locus)
  if (meta?.justifiedByLocus && pol === 'P') {
    return { kind: 'GROUNDS' as const, cq, locus, locusPath };
  }

  // default — simple positive/neutral assertion
  return { kind: 'ASSERT' as const, locus, locusPath };
}
  
  export function narrateTrace(trace: StepResult, acts: Record<string, Act | undefined>) {
    const lines: { text:string; decisive?:boolean; hover?:string }[] = [];
    const decisive = new Set(trace.decisiveIndices ?? []);
  
    for (let i = 0; i < (trace.pairs ?? []).length; i++) {
          const p = trace.pairs[i];
          const A = p.posActId ? acts[p.posActId] : undefined;
          const B = p.negActId ? acts[p.negActId] : undefined;
      const a = classify(A);
      const b = classify(B);
      // const leftExpr = A?.expression ?? '—';
      // const rightExpr = B?.expression ?? '—';
//       const leftExpr  = A?.meta?.original ?? A?.expression ?? '—';
// const rightExpr = B?.meta?.original ?? B?.expression ?? '—';
      const mark = decisive.has(i);
      const leftExpr  = (A as any)?.meta?.original ?? (A as any)?.expression ?? '—';
          const rightExpr = (B as any)?.meta?.original ?? (B as any)?.expression ?? '—';
      const hover = `P: ${leftExpr} • O: ${rightExpr}`;
          const push = (t:string)=>lines.push({ text:t, decisive: mark, hover });
  
      if (a.kind === 'ASSERT')  push(`Proponent asserts at ${a.locus}: ${leftExpr}`);
      if (a.kind === 'WHY')     push(`Opponent challenges at ${a.locus}: ${leftExpr}${a.cq ? ` (${a.cq})` : ''}`);
      if (a.kind === 'GROUNDS') push(`Proponent supplies grounds at ${a.locusPath}: ${leftExpr} (answers ${a.locus}${a.cq ? ` • ${a.cq}` : ''})`);
  
      if (b.kind === 'ASSERT')  push(`Opponent asserts at ${b.locus}: ${rightExpr}`);
      if (b.kind === 'WHY')     push(`Proponent challenges at ${b.locus}: ${rightExpr}${b.cq ? ` (${b.cq})` : ''}`);
      if (b.kind === 'GROUNDS') push(`Opponent supplies grounds at ${b.locusPath}: ${rightExpr} (answers ${b.locus}${b.cq ? ` • ${b.cq}` : ''})`);
    }
  
    for (const [parent, child] of Object.entries(trace.usedAdditive ?? {})) {
      lines.push({ text: `Additive choice at ${parent}: chose branch ${child}` });
    }
  
    // Build detailed status summary
    const pairCount = trace.pairs?.length ?? 0;
    const lastPair = pairCount > 0 ? trace.pairs[pairCount - 1] : null;
    const lastLocus = lastPair?.locusPath ?? '0';
    
    if (trace.status === 'CONVERGENT') {
      const daimonBy = trace.endedAtDaimonForParticipantId;
      lines.push({ 
        text: `✓ Convergent: ${daimonBy ? `daimon (†) placed by ${daimonBy}` : 'interaction completed successfully'}`,
        hover: `The dialogue reached a successful termination point${lastLocus !== '0' ? ` at locus ${lastLocus}` : ''}.`
      });
      if (trace.endorsement) {
        lines.push({ 
          text: `  └─ Endorsed by ${trace.endorsement.byParticipantId} at locus ${trace.endorsement.locusPath}`,
          hover: 'This point was explicitly accepted/endorsed.'
        });
      }
    } else if (trace.status === 'DIVERGENT') {
      // Provide reason-specific messages
      const reasonMap: Record<string, string> = {
        'incoherent-move': pairCount === 0 
          ? 'No P↔O pairs at same locus (challenge/response creates child loci)'
          : `No matching response found at locus ${lastLocus}`,
        'additive-violation': 'Conflicting additive choices detected',
        'no-response': 'One party has no remaining moves',
        'consensus-draw': 'Reached a consensus draw point',
        'dir-collision': 'Directory collision in additive branches',
        'timeout': 'Traversal fuel exhausted',
      };
      const reasonText = trace.reason ? reasonMap[trace.reason] || trace.reason : 'unresolved obligations remain';
      lines.push({ 
        text: `✗ Divergent: ${reasonText}`,
        hover: pairCount === 0 
          ? 'The stepper requires P and O acts at the SAME locus. Challenge/response dialogues create child loci (e.g., 0.1 → 0.1.1), so no direct pairing is possible.'
          : `After ${pairCount} step(s), the interaction could not continue. Last active locus: ${lastLocus}`
      });
      
      // Add hint about what's needed
      if (trace.reason === 'incoherent-move' || trace.reason === 'no-response') {
        const hintText = pairCount === 0 
          ? '  └─ Hint: Use concessions to add O-acts at P-act loci, or use Analysis Panel (Views/Chronicles)'
          : `  └─ Hint: Add a response at locus ${lastLocus} or append a daimon (†) to close`;
        lines.push({
          text: hintText,
          hover: pairCount === 0
            ? 'The stepper is designed for direct P↔O interaction at same locus. For nested dialogues, use the Analysis Panel which handles parent-child relationships.'
            : 'The Opponent needs to respond to the Proponent\'s assertion, or the branch can be closed with a daimon.'
        });
      }
    } else if (trace.status === 'STUCK') {
      lines.push({ 
        text: `⏸ Stuck: ${trace.reason === 'no-response' ? 'awaiting next move' : 'traversal blocked'}`,
        hover: `The stepper paused at locus ${lastLocus}. More moves may be needed.`
      });
    } else {
      // ONGOING
      const reasonText = trace.reason 
        ? `paused (${trace.reason})` 
        : pairCount > 0 
          ? `${pairCount} interaction(s) processed, more moves possible`
          : 'awaiting dialogue moves';
      lines.push({ 
        text: `⋯ Ongoing: ${reasonText}`,
        hover: `Traversal is not complete. Last processed locus: ${lastLocus}. The dialogue can continue with additional moves.`
      });
      
      // Show daimon hints if available
      if (trace.daimonHints && trace.daimonHints.length > 0) {
        const hintLoci = trace.daimonHints.slice(0, 3).map(h => h.locusPath).join(', ');
        lines.push({
          text: `  └─ Daimon (†) available at: ${hintLoci}${trace.daimonHints.length > 3 ? ` (+${trace.daimonHints.length - 3} more)` : ''}`,
          hover: 'These loci have no remaining openings and can be closed with a daimon.'
        });
      }
    }
  
    return lines;
  }
  