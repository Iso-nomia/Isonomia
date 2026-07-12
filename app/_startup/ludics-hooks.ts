import { Hooks } from '@/packages/ludics-engine/hooks';
import { registerNLITraversalPlugin } from '@/packages/ludics-engine/plugins/nli';

Hooks.onTraversal(({ dialogueId, status, pairs }) => {
  console.debug('[ludics] traversal', { dialogueId, status, pairs: pairs.length });
});
Hooks.onActAppended(({ dialogueId, designId, act }) => {
  console.debug('[ludics] appended', { dialogueId, designId, kind: act.kind, expr: act.expression });
});

// Enable traversal-time NLI tagging (uses env CQ_NLI_THRESHOLD; safe if adapter missing)
registerNLITraversalPlugin();
