// components/rhetoric/RhetoricHtml.tsx
'use client';
import { useMemo } from 'react';
import { useRhetoric } from './RhetoricContext';
import { RX } from './detect';

export default function RhetoricHtml({ html }: { html: string }) {
  const { mode, enabled } = useRhetoric();

  const rendered = useMemo(() => {
    if (mode === 'content') return html;

    try {
      const div = document.createElement('div');
      div.innerHTML = html; // assume sanitized upstream
      const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);

      // pass 1: CI cats (gi)
      const CI = ['hedge','intensifier','absolute','analogy','metaphor'].filter(k => enabled[k as keyof typeof RX]);
      if (CI.length) {
        const alts = CI.map((k, i) => `(?<g${i}>${RX[k as keyof typeof RX].source})`).join('|');
        const re = new RegExp(alts, 'gi');
        const texts: Text[] = [];
        while (walker.nextNode()) texts.push(walker.currentNode as Text);

        texts.forEach((node) => {
          const t = node.nodeValue || '';
          re.lastIndex = 0;
          let idx = 0; let frag: DocumentFragment | null = null; let m: RegExpExecArray | null;

          while ((m = re.exec(t))) {
            const start = m.index, end = re.lastIndex;
            if (!frag) frag = document.createDocumentFragment();
            if (start > idx) frag.append(document.createTextNode(t.slice(idx, start)));

            // figure which group
            let gi = -1; const groups = m.groups ?? {};
            Object.keys(groups).forEach((g, _i) => groups[g] && (gi = _i));
            const kind = CI[gi];

            const mark = document.createElement('mark');
            mark.dataset.rhetoric = kind;
            mark.title = title(kind);
            mark.textContent = t.slice(start, end);
            frag.append(mark);
            idx = end;
          }
          if (frag) {
            if (idx < t.length) frag.append(document.createTextNode(t.slice(idx)));
            node.replaceWith(frag);
          }
        });
      }

      // pass 2: CS cats on non-mark text nodes only
      const csCats: Array<{ kind: 'allcaps'|'exclaim'; re: RegExp }> = [];
      if (enabled.allcaps) csCats.push({ kind: 'allcaps', re: /\b[A-Z]{3,}\b/g });
      if (enabled.exclaim) csCats.push({ kind: 'exclaim', re: /!+/g });

      if (csCats.length) {
        const walker2 = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
        const textNodes: Text[] = [];
        while (walker2.nextNode()) {
          const n = walker2.currentNode as Text;
          // skip inside an existing <mark>
          if ((n.parentNode as HTMLElement)?.tagName === 'MARK') continue;
          textNodes.push(n);
        }

        textNodes.forEach((node) => {
          const t = node.nodeValue || '';
          let fr: DocumentFragment | null = null;
          let chunks: Array<string | HTMLElement> = [t];

          csCats.forEach(({ kind, re }) => {
            const next: Array<string | HTMLElement> = [];
            chunks.forEach((chunk) => {
              if (typeof chunk !== 'string') { next.push(chunk); return; }
              let idx = 0; let m: RegExpExecArray | null; re.lastIndex = 0;
              while ((m = re.exec(chunk))) {
                const start = m.index, end = re.lastIndex;
                if (start > idx) next.push(chunk.slice(idx, start));
                const mark = document.createElement('mark');
                mark.dataset.rhetoric = kind;
                mark.title = title(kind);
                mark.textContent = chunk.slice(start, end);
                next.push(mark);
                idx = end;
              }
              if (idx < chunk.length) next.push(chunk.slice(idx));
            });
            chunks = next;
          });

          if (chunks.some((c) => typeof c !== 'string')) {
            fr = document.createDocumentFragment();
            chunks.forEach((c) => {
              if (typeof c === 'string') fr!.append(document.createTextNode(c));
              else fr!.append(c);
            });
            node.replaceWith(fr);
          }
        });
      }

      return div.innerHTML;
    } catch {
      return html;
    }
  }, [html, mode, enabled]);

  return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: rendered }} />;
}

function title(k: string) {
  switch (k) {
    case 'hedge': return 'Hedge / cautious language';
    case 'intensifier': return 'Intensifier';
    case 'absolute': return 'Absolute / sweeping claim';
    case 'analogy': return 'Analogy marker';
    case 'metaphor': return 'Possible metaphor';
    case 'allcaps': return 'ALL CAPS (shouting)';
    case 'exclaim': return 'Exclamatory punctuation';
    default: return 'Rhetorical device';
  }
}
