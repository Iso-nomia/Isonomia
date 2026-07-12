// types/shared.ts
type ResourceRef =
  | { kind: 'uri'; url: string }
  | { kind: 'work'; id: string }                     // existing /works
  | { kind: 'stack:item'; stackId: string; itemId: string };  // NEW

// evidence payloads accept ResourceRef
// POST /api/claims/:id/evidence { ref: ResourceRef, role?: 'primary'|'secondary' }
