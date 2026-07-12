// engine/presets/dialogical.ts
export type DialogicalPreset = 'dialogue:intuitionistic'|'dialogue:classical';

export interface EngineDialogicalPolicy {
  kind: DialogicalPreset;
  repetitionRankP: number;     // SR0
  repetitionRankO: number;     // SR0
  enforceCopyCatSR2: boolean;  // SR2
  lastDutyFirst: boolean;      // SR1i / SR1c scheduling
}

export const DIALOGICAL_PRESETS = {
  'dialogue:intuitionistic': {
    kind: 'dialogue:intuitionistic',
    enforceCopyCatSR2: true,
    lastDutyFirst: true,
  },
  'dialogue:classical': {
    kind: 'dialogue:classical',
    enforceCopyCatSR2: true,
    lastDutyFirst: true,
  },
} as const;
