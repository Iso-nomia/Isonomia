// Public, LIWC-adjacent categories (we can’t ship LIWC).
export const LIWC_LITE = {
    certainty: ['undeniably','certainly','clearly','must','will','always'],
    tentative: ['maybe','perhaps','possibly','might','could','seems','appears','likely'],
    negation:  ['no','not','never','without'],
    // Pronouns are already handled in Layer B, but included for dashboards:
    pronoun_first:  ['we','us','our','ours','ourselves'],
    pronoun_second: ['you','your','yours','yourself','yourselves'],
  } as const;
  