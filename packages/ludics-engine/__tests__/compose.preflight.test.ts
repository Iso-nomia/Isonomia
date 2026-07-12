// packages/ludics-engine/__tests__/compose.preflight.test.ts
import { expect, test } from 'vitest';
import { preflightComposition } from '../compose';

// pseudo seeded ids
const dialogueId = 'dlg_123'; const pos = 'des_P'; const neg = 'des_O';

test('partial: blocks directory collisions', async () => {
  const out = await preflightComposition({ dialogueId, posDesignId: pos, negDesignId: neg, mode: 'partial' });
  if (out.ok) throw new Error('expected collision');
  expect(out.reason).toBe('dir-collision');
  expect(Array.isArray(out.collisions)).toBe(true);
});

test('spiritual: auto-shifts on collision', async () => {
  const out = await preflightComposition({ dialogueId, posDesignId: pos, negDesignId: neg, mode: 'spiritual' });
  expect(out.ok).toBe(true);
  expect(out.note).toBe('shift-inserted');
  expect(out.shifted?.posTag).toBe('L');
  expect(out.shifted?.negTag).toBe('R');
});
