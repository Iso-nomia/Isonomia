export const LudicsPolicies = {
    enforceAlternationByDefault: false,
    additiveEnforcement: 'off' as 'off'|'append'|'travel',
    nliThresholdCQ: Number(process.env.CQ_NLI_THRESHOLD ?? '0.72'),
  };
  