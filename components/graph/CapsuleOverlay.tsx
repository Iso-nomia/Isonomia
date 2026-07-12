// components/graph/CapsuleOverlay.tsx
'use client';
import { useRef, useEffect } from 'react';
import type cytoscape from 'cytoscape';

type Pt = { x: number; y: number };
type Capsule = { id: string; nodeIds: string[]; color: string; label?: string };

// Monotone chain convex hull over {x,y} points
function convexHull(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts;
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop();
    upper.push(pt);
  }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

export default function CapsuleOverlay({ cy, capsules }: { cy: cytoscape.Core | null; capsules: Capsule[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!cy || !ref.current) return;
    const ctx = ref.current.getContext('2d')!;
    const draw = () => {
      const container = cy.container();
      if (!container || !ref.current) return;
      const rect = container.getBoundingClientRect();
      ref.current.width = rect.width; ref.current.height = rect.height;
      ctx.clearRect(0, 0, rect.width, rect.height);
      const zoom = cy.zoom();
      const pan = cy.pan();
      capsules.forEach(({ nodeIds, color }) => {
        const pts: Pt[] = nodeIds
          .map(id => cy.getElementById(id))
          .filter(n => n.nonempty())
          .map(n => {
            const pos = n.position();
            return { x: pos.x * zoom + pan.x, y: pos.y * zoom + pan.y };
          });
        if (pts.length < 3) return;
        const hull = convexHull(pts); // monotone chain
        ctx.beginPath();
        ctx.moveTo(hull[0].x, hull[0].y);
        hull.slice(1).forEach((p: Pt) => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fillStyle = `${color}22`; // translucent fill
        ctx.strokeStyle = `${color}66`;
        ctx.lineWidth = 2;
        ctx.fill(); ctx.stroke();
      });
    };
    draw();
    cy.on('pan zoom drag free layoutstop add remove position', draw);
    return () => { cy.off('pan zoom drag free layoutstop add remove position', draw); };
  }, [cy, capsules]);
  return <canvas ref={ref} className="absolute inset-0 pointer-events-none" />;
}
