import { stepInteraction } from '../stepper';
import { Example_EnglishDrama_P, Example_EnglishDrama_O } from '../examples/dialoguesInLudics';

test('English drama example converges and yields †', async () => {
  const res = await stepInteraction({
    dialogueId: 'EXAMPLE:english-drama',
    posDesignActs: Example_EnglishDrama_P.acts,
    negDesignActs: Example_EnglishDrama_O.acts,
    phase: 'neutral',
    maxPairs: 256,
  });
  expect(res?.status).toBe('CONVERGENT');
  // If your stepper exports daimonHints, ensure base (or the focal locus) is closable.
  expect((res?.daimonHints ?? []).length).toBeGreaterThan(0);
});
