// lib/events/topics.ts
export const BUS_EVENTS = [
  'dialogue:moves:refresh',
  'dialogue:cs:refresh',
  'claims:edges:changed',
  'cqs:changed',
  'cards:changed',
  'decision:changed',
  'votes:changed',
  'stacks:changed',
  'deliberations:created',
  'comments:changed',
  'xref:changed',
  'citations:changed',
  'dialogue:changed',
  'issues:changed',
] as const;

export type BusEvent = typeof BUS_EVENTS[number];
