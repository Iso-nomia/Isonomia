export type EvalParams = { mode?: 'min'|'product'|'logodds'; tau?: number|null };

export type BaseBlock = {
  id: string;
  pageId: string;
  ord: number;
  type: KbBlockType;
  live: boolean;
  citations?: Array<{ kind?: string; id?: string; uri?: string; note?: string }>;
  data: any;          // normalized at edge (API normalizes Prisma's dataJson)
  pinned?: any|null;  // normalized from pinnedJson
};

export type KbBlockType =
  | 'text'|'image'|'link'
  | 'claim'|'claim_set'|'argument'|'sheet'|'room_summary'
  | 'transport'|'evidence_list'|'cq_tracker'|'plexus_tile'
    | 'theory_work'|'theory_section'; // NEW;


export type TheoryWorkData = {
  workId: string;
  workSlug?: string;
  lens?: 'summary'|'structure'|'full';
};

export type TheorySectionData = {
  workId: string;
  section:
    | 'dn'|'ih'|'tc'|'op'
    | 'hermeneutic'|'practical'|'pascal'
    | 'body';
};

export type TextData = { markdown: string };
export type ImageData = { url: string; alt?: string|null; caption?: string|null };
export type LinkData  = { url: string; title?: string|null };

export type ClaimData = {
  claimId: string;
  label?: string|null;
  eval?: EvalParams;
  lens?: 'statement'|'statement+belpl'|'statement+top3';
};

export type ArgumentData = { argumentId: string; lens?: 'diagram'|'diagram+text'|'compact' };
export type RoomSummaryData = { deliberationId: string; lens?: 'top'|'byTag'|'byThreshold'; eval?: EvalParams };
export type SheetData = { sheetId: string; lens?: 'nodes'|'nodes+edges'|'mini' };
export type TransportData = { fromId: string; toId: string; showProposals?: boolean };
export type ClaimSetData = {
  canonicalId?: string|null; roomId?: string|null; tags?: string[];
  lens?: 'bundle'|'bundle+belpl';
  eval?: EvalParams;
};

export type KbPageDTO = {
  id: string; spaceId: string; slug: string; title: string; summary?: string|null;
  tags: string[]; visibility: string; frontmatter?: any; updatedAt: string;
  blocks: BaseBlock[];
};
