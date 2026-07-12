// lib/article/wrapSections.ts
import { parseHTML } from 'linkedom';

export function wrapSections(html: string) {
  const { document } = parseHTML(`<div id="x">${html}</div>`);
  const root = document.getElementById('x')!;

  const kids = Array.from(root.childNodes);
  const sections: Node[][] = [];
  let bucket: Node[] = [];

  const isBreak = (n: any) =>
    n?.nodeType === 1 && (n as HTMLElement).matches?.('hr[data-section-break]');

  for (const n of kids) {
    if (isBreak(n)) {
      if (bucket.length) sections.push(bucket);
      bucket = [];
    } else {
      bucket.push(n);
    }
  }
  if (bucket.length) sections.push(bucket);

  const frag = document.createDocumentFragment();
  const mkSummary = (nodes: Node[]) => {
    const h = nodes.find(n => n.nodeType === 1 && /^H[1-4]$/.test((n as HTMLElement).tagName)) as HTMLElement | undefined;
    if (h?.textContent?.trim()) return h.textContent.trim().slice(0, 140);
    const p = nodes.find(n => n.nodeType === 1 && (n as HTMLElement).tagName === 'P') as HTMLElement | undefined;
    return (p?.textContent || 'Section').trim().replace(/\s+/g, ' ').slice(0, 140);
  };

  sections.forEach((nodes, idx) => {
    const details = document.createElement('details');
    details.className = 'article-section';
    details.setAttribute('data-section-index', String(idx)); // for persistence
    // ⚠️ No `open` attribute here — client initializer will set it

    const summary = document.createElement('summary');
    summary.className = 'article-section-summary';
    summary.textContent = mkSummary(nodes);

    details.appendChild(summary);
    nodes.forEach(n => details.appendChild(n));
    frag.appendChild(details);
  });

  root.innerHTML = '';
  root.appendChild(frag);
  return root.innerHTML;
}
