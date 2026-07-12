 type BusEvent =
  | "dialogue:moves:refresh" | "dialogue:cs:refresh"
  | "claims:edges:changed"   | "cqs:changed" | "cards:changed"
  | "decision:changed"       | "votes:changed" | "stacks:changed"
  | "deliberations:created"  | "comments:changed" | "xref:changed" | "citations:changed";

 type AgoraEvent = {
  id: string;            // stable id for UI keys
  type: BusEvent | "dialogue:changed"; // normalized
  ts: number;            // epoch ms
  title: string;         // card title / summary
  meta?: string;         // one-liner detail
  chips?: string[];      // tags/labels
  link?: string;         // primary link (room/claim)
  deliberationId?: string;
  targetType?: string;
  targetId?: string;
  icon?: string;         // "move"|"link"|"check"|"vote"|"branch"
};
