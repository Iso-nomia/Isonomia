// packages/ludics-engine/testers.ts
export type TesterPlan =
  | { kind: 'herd-to', parentPath: string, child: string }  // ensure O at parent.child
  | { kind: 'timeout-draw', atPath: string };               // classify no-response as draw

export function buildVirtuals(plans: TesterPlan[]) {
  const virtualNegPaths = new Set<string>();
  const drawAtPaths     = new Set<string>();
  for (const p of plans) {
    if (p.kind === 'herd-to') virtualNegPaths.add(`${p.parentPath}.${p.child}`);
    else if (p.kind === 'timeout-draw') drawAtPaths.add(p.atPath);
  }
  return {
    virtualNegPaths: Array.from(virtualNegPaths),
    drawAtPaths: Array.from(drawAtPaths),
  };
}
