// lib/dialogue/codes.ts
export type RCode =
  | 'R1_TURN_VIOLATION'
  | 'R2_NO_OPEN_CQ'
  | 'R3_SELF_REPLY'
  | 'R4_DUPLICATE_REPLY'
  | 'R5_AFTER_SURRENDER'
  | 'R6_COMMITMENT_INCOHERENCE'
  | 'R7_ACCEPT_ARGUMENT_REQUIRED'
  | 'R8_NO_OPEN_SUPPOSE';

  

export type WCode =
  | 'W0_NO_INITIAL_THEREFORE'
  | 'W1_UNKNOWN_LABEL'
  | 'W2_SCOPE_VIOLATION'
  | 'W3_RIGHT_FRONTIER'
  | 'W4_PARENTHETICAL_SCOPE'
  | 'W5_THEREFORE_TEST_FAIL'
  | 'W6_IDLE_SUPPOSITION';

  export type HCode = 'H1_SHAPE_ATTACK_SUGGESTION' | 'H2_CLOSABLE' | 'H1_GENERIC_CHALLENGE' | 'H1_OPEN_SUPPOSE' | 'R2_OPEN_CQ_SATISFIED' | 'R4_ROLE_GUARD';


// Helper for UI tooltips
export const codeHelp: Record<RCode | WCode, string> = {
  R1_TURN_VIOLATION: 'Illegal turn or reply target for this move.',
  R2_NO_OPEN_CQ: 'This GROUNDS does not answer an open WHY with the same key.',
  R3_SELF_REPLY: 'You cannot reply to your own challenge in this context.',
  R4_DUPLICATE_REPLY: 'Duplicate reply (idempotent move already recorded).',
  R5_AFTER_SURRENDER: 'Branch already surrendered or closed (†).',
  R6_COMMITMENT_INCOHERENCE: 'Would render your public commitments inconsistent.',
  R7_ACCEPT_ARGUMENT_REQUIRED: 'Accept the argument (not just the conclusion).',
  R8_NO_OPEN_SUPPOSE: 'Cannot discharge: no open SUPPOSE at this locus.',
  W0_NO_INITIAL_THEREFORE: '"Therefore …" cannot start a discourse.',
  W1_UNKNOWN_LABEL: 'Unknown label; open it with SUPPOSE before using it.',
  W2_SCOPE_VIOLATION: 'Move crosses out of the active scope improperly.',
  W3_RIGHT_FRONTIER: 'Targets a non-ancestral branch (right-frontier violation).',
  W4_PARENTHETICAL_SCOPE: 'Parenthetical opened/closed at different scopes.',
  W5_THEREFORE_TEST_FAIL: 'Test fails: active state does not entail the conclusion.',
  W6_IDLE_SUPPOSITION: 'Supposition opened but never used (consider discharging).',
};
