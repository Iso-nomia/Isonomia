import { presetsForCQ } from './cqPresets';

/**
 * Generate attack suggestion for a critical question
 * 
 * FIXED: Returns properly typed discriminated union based on attack type:
 * - For 'undercut': Returns object WITHOUT scope property
 * - For 'rebut': Returns object WITH scope property ('premise' | 'conclusion')
 * 
 * This ensures type safety when passed to createClaimAttack which expects
 * a discriminated union type.
 */
export function suggestionForCQ(schemeKey: string, cqKey?: string) {
  const presets = presetsForCQ(schemeKey, cqKey);
  
  if (!presets.length) {
    return null;
  }

  // pick first preset's primary option as default suggestion
  const primary = presets[0].options[0];
  
  // Return properly typed suggestion based on attack type
  if (primary.type === 'undercut') {
    return {
      type: 'undercut' as const,
      template: primary.template,
      shape: presets[0].shape,
      options: presets.flatMap(p => p.options),
    };
  } else {
    return {
      type: 'rebut' as const,
      scope: (primary.targetScope ?? 'conclusion') as 'premise' | 'conclusion',
      template: primary.template,
      shape: presets[0].shape,
      options: presets.flatMap(p => p.options),
    };
  }
}
