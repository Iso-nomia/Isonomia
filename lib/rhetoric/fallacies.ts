// lib/rhetoric/fallacies.ts
export type FallacyKey = 'ad_hominem' | 'whataboutism' | 'strawman' | 'slippery';
export const FALLACY_LEX: Record<FallacyKey, string[]> = {
  ad_hominem: ['idiot','moron','stupid','liar','corrupt','crooked'],
  whataboutism: ['what about','and you say nothing when','why don’t you talk about'],
  strawman: ['so you’re saying','you believe that everyone','clearly you want'],
  slippery: ['if we allow this then','will inevitably','this will lead to'],
};
