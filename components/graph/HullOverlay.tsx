'use client';
import * as React from 'react';
import type cytoscape from 'cytoscape';

type Props = {
  cy: cytoscape.Core | null;
  height: number;                 // same height as your graph canvas
  enabled?: boolean;              // show/hide
  fill?: string;                  // css color
  fillAlpha?: number;             // 0..1
  stroke?: string;                // css color
  strokeAlpha?: number;           // 0..1
  padding?: number;               // visual padding in px (approx)
};

const DPR = () => (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

// Monotone chain convex hull
function convexHull(pts: Array<[number, number]>) {
  if (pts.length < 3) return pts;
  const p = [...pts].sort((a,b)=>a[0]-b[0] || a[1]-b[1]);
  const cross = (o:[number,number], a:[number,number], b:[number,number]) =>
    (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]);
  const lower: [number,number][] = [];
  for (const pt of p){ while(lower.length>=2 && cross(lower[lower.length-2], lower[lower.length-1], pt) <= 0) lower.pop(); lower.push(pt as [number,number]); }
  const upper: [number,number][] = [];
  for (let i=p.length-1;i>=0;i--){ const pt=p[i] as [number,number]; while(upper.length>=2 && cross(upper[upper.length-2], upper[upper.length-1], pt) <= 0) upper.pop(); upper.push(pt); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

export default function HullOverlay({
  cy,
  height,
  enabled = true,
  fill = '#60a5fa',        // slate-leaning blue
  fillAlpha = 0.12,
  stroke = '#3b82f6',
  strokeAlpha = 0.6,
  padding = 12,
}: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = React.useState<number>(0);

  // Size canvas to parent width
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas?.parentElement) return;
    const ro = new ResizeObserver(() => {
      const w = canvas.parentElement!.clientWidth;
      setWidth(w);
    });
    ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, []);

  // Repaint hull on cy events
  React.useEffect(() => {
    if (!cy) return;
    let raf = 0;
    const request = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = DPR();
      // clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!enabled) return;

      const nodes = cy.nodes(); // for focused cluster views, all nodes belong to the cluster
      if (!nodes || nodes.length === 0) return;

      const zoom = cy.zoom();
      const pan = cy.pan();
      const pts: Array<[number, number]> = [];
      nodes.forEach((n) => {
        const p = n.position(); // model coords
        const x = p.x * zoom + pan.x;
        const y = p.y * zoom + pan.y;
        pts.push([x, y]);
      });
      if (pts.length < 2) return;

      const hull = convexHull(pts);
      if (hull.length < 2) return;

      // draw with approximate "padding" by using a fat stroke behind fill
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.beginPath();
      ctx.moveTo(hull[0][0], hull[0][1]);
      for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i][0], hull[i][1]);
      ctx.closePath();

      // fat stroke to simulate padding
      if (padding > 0) {
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = stroke;
        ctx.globalAlpha = strokeAlpha * 0.35;
        ctx.lineWidth = Math.max(1, padding * 2);
        ctx.stroke();
      }

      // fill
      ctx.fillStyle = fill;
      ctx.globalAlpha = fillAlpha;
      ctx.fill();

      // border
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = stroke;
      ctx.globalAlpha = strokeAlpha;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    };

    // Important: listen to cy viewport + data changes
    cy.on('render pan zoom resize add remove position layoutstop', request);
    request();
    return () => {
      cancelAnimationFrame(raf);
      cy.off('render pan zoom resize add remove position layoutstop', request);
    };
  }, [cy, enabled]);

  // reflect current size / DPR
  const dpr = DPR();
  const w = Math.max(0, width);
  const h = Math.max(0, height);

  return (
    <canvas
      ref={canvasRef}
      width={Math.floor(w * dpr)}
      height={Math.floor(h * dpr)}
      style={{
        position: 'absolute',
        inset: 0,
        width: `${w}px`,
        height: `${h}px`,
        pointerEvents: 'none',
      }}
      aria-hidden
    />
  );
}
