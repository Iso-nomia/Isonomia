// components/rhetoric/detect.ts
export const RX = {
    hedge: /\b(might|could|appears|seems|likely|suggests|perhaps|possibly|arguably)\b/gi,
    intensifier: /\b(very|extremely|incredibly|undeniably|obviously|clearly|highly|deeply)\b/gi,
    absolute: /\b(always|never|everyone|no one|all|none|entirely|completely|totally)\b/gi,
    analogy: /\b(like|as if|as though|akin to|is like)\b/gi,
    // very crude metaphor marker (linking verb + noun); kept conservative to reduce false positives
    metaphor: /\b(is|are|was|were)\s+(a|an)\s+[a-z][a-z-]+\b/gi,
    allcaps: /\b[A-Z]{3,}\b/g,
    exclaim: /!+/g,
  };
  
  export type Match = { start: number; end: number; kind: keyof typeof RX; text: string };
  