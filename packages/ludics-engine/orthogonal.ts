import { stepInteraction } from './stepper';
 
export async function checkOrthogonal(params: {
  dialogueId: string; posDesignId: string; negDesignId: string;
}) {
  const res = await stepInteraction({ ...params, maxPairs: 10000, phase: 'neutral' });
  const orthogonal = res.status === 'CONVERGENT';
  return { orthogonal, ...res };
}
