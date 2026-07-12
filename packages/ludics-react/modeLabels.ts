// packages/ludics-react/modeLabels.ts
export type Mode = 'assoc' | 'partial' | 'spiritual';

export const MODE_LABEL: Record<Mode, string> = {
  assoc: 'Associative',
  partial: 'Strict',
  spiritual: 'Delocated',
};

export const MODE_DESC: Record<Mode, string> = {
  assoc: 'Overlay both designs; conflicts may appear during stepping.',
  partial: 'Fail fast if both chose different additive branches.',
  spiritual: 'Resolve conflicts by delocating one branch, then proceed.',
};
