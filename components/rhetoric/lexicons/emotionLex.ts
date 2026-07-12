// Very small, hand-picked lists (precision > recall).
export const EMOTION = {
    positive: [
      'benefit','improve','progress','success','support','protect','thriving',
      'hope','promising','opportunity','effective'
    ],
    negative: [
      'harm','damage','collapse','crisis','fail','threat','risk','danger',
      'burden','catastrophe','devastating'
    ],
    joy: ['celebrate','joy','relief','cheer','delight','glad','proud'],
    anger: ['outrage','furious','betrayal','corrupt','injustice','rage'],
    fear: ['fear','worry','afraid','unsafe','threat','danger','panic','anxiety'],
    sadness: ['sad','grief','mourning','heartbreaking','tragic','loss']
  } as const;
  
  export type EmotionKey = keyof typeof EMOTION; // 'positive'|'negative'|'joy'|'anger'|'fear'|'sadness'
  
