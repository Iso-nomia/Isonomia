// Boydstun-style policy frames (hand-pruned).
export const FRAMES = {
    economic: [
      'jobs','cost','costs','tax','taxes','market','growth','productivity','efficiency',
      'budget','deficit','inflation','spending','wages'
    ],
    morality: [
      'moral','immoral','right','wrong','duty','virtue','ethical','sin','values'
    ],
    security: [
      'security','safety','crime','threat','terror','war','border','cyber','attack'
    ],
    fairness: [
      'fair','unfair','equal','equity','justice','inequality','discrimination',
      'bias','privilege','access'
    ],
    capacity: [
      'capacity','resources','staff','infrastructure','funding','feasible','feasibility',
      'implementation','admin','bureaucracy','bottleneck'
    ],
  } as const;
  
  export type FrameKey = keyof typeof FRAMES; // 'economic'|'morality'|'security'|'fairness'|'capacity'
  