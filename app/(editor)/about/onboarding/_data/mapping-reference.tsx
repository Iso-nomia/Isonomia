
export const STEP_1_COMPONENTS = {
  primary: 'DiscussionView',
  path: '@/components/discussions/DiscussionView',
  description: 'Displays conversation thread with upgrade controls',
  
  supporting: [
    {
      name: 'Message',
      path: '@/components/discussions/Message',
      purpose: 'Individual message cards in thread'
    },
    {
      name: 'ThreadUpgradeButton',
      path: '@/components/discussions/ThreadUpgradeButton',
      purpose: 'Trigger for upgrading thread to Deliberation'
    }
  ],
  
  demo_approach: 'Simplified mock: show 4-5 message cards with engagement indicators, working upgrade button that displays confirmation modal',
  
  screenshot_notes: 'Capture DiscussionView with active thread (10+ messages), highlight upgrade button and participant/message counts'
}

/* ======================== STEP 2: COMPOSE PROPOSITION ======================== */

export const STEP_2_COMPONENTS = {
  primary: 'PropositionComposerPro',
  path: '@/components/propositions/PropositionComposer', // May need Pro version
  description: 'Form for creating structured propositions',
  
  supporting: [
    {
      name: 'RichTextEditor',
      path: '@/components/ui/RichTextEditor',
      purpose: 'Text input with formatting for claim/rationale'
    },
    {
      name: 'SourceAttacher',
      path: '@/components/evidence/SourceAttacher',
      purpose: 'URL input for evidence citations'
    }
  ],
  
  demo_approach: 'Fully functional composer with local state, validates character limits, shows real-time validation feedback',
  
  screenshot_notes: 'Capture composer with partially filled form: claim text, expanded rationale section, one source added, validation indicators visible'
}

/* ======================== STEP 3: WORKSHOP (VOTE, ENDORSE, REPLY) ======================== */

export const STEP_3_COMPONENTS = {
  primary: 'PropositionsList',
  path: '@/components/propositions/PropositionsList',
  description: 'List view of propositions with interaction controls',
  
  supporting: [
    {
      name: 'PropositionCard',
      path: '@/components/propositions/PropositionCard',
      purpose: 'Individual proposition display with vote/endorse/reply buttons'
    },
    {
      name: 'VoteButton',
      path: '@/components/propositions/VoteButton',
      purpose: 'Upvote toggle with count'
    },
    {
      name: 'EndorseModal',
      path: '@/components/propositions/EndorseModal',
      purpose: 'Endorsement form with optional reasoning'
    },
    {
      name: 'ReplyThread',
      path: '@/components/propositions/ReplyThread',
      purpose: 'Threaded reply system'
    }
  ],
  
  demo_approach: 'Interactive list with 3-4 mock propositions, working vote buttons (toggle state), endorsement modal (submit adds to count), expandable reply threads',
  
  screenshot_notes: 'Capture PropositionsList with: one highly-voted prop (showing promotion readiness), one with expanded replies, endorsement modal open'
}

/* ======================== STEP 4: PROMOTE TO CLAIM ======================== */

export const STEP_4_COMPONENTS = {
  primary: 'ClaimElevator',
  path: '@/components/claims/ClaimElevator', // May need to be created
  description: 'Modal for promoting propositions to claims',
  
  supporting: [
    {
      name: 'PromotionCriteria',
      path: '@/components/propositions/PromotionCriteria',
      purpose: 'Checklist showing vote/endorsement thresholds'
    },
    {
      name: 'PropositionCard',
      path: '@/components/propositions/PropositionCard',
      purpose: 'Shows promotion-eligible badge'
    }
  ],
  
  demo_approach: 'Modal with promotion criteria checklist (all green checks), editable claim text preview, working submit button that shows success state',
  
  screenshot_notes: 'Capture proposition card with green eligibility badge + ClaimElevator modal showing criteria met, claim preview, warning message'
}

/* ======================== STEP 5: VIEW CLAIMS (MINIMAP / CEG MINIMAP) ======================== */

export const STEP_5_COMPONENTS = {
  primary: 'ClaimMiniMap',
  primaryPath: '@/components/claims/ClaimMiniMap',
  primaryDescription: 'Force-directed graph visualization of claims',
  
  secondary: 'CegMiniMap',
  secondaryPath: '@/components/deepdive/CegMiniMap',
  secondaryDescription: 'Hierarchical tree view showing Claims → Arguments → Evidence',
  
  supporting: [
    {
      name: 'AFMinimap',
      path: '@/components/dialogue/minimap/AFMinimap',
      purpose: 'Alternative argument framework minimap'
    },
    {
      name: 'MinimapNode',
      path: '@/components/claims/MinimapNode',
      purpose: 'Individual claim node rendering'
    }
  ],
  
  demo_approach: 'Both minimaps side-by-side with 6-8 mock claims, clickable nodes that sync selection across both views, zoom/pan working',
  
  screenshot_notes: 'Capture both minimaps in top-right position with: nodes colored by support level, one node selected (blue outline), edges visible'
}

/* ======================== STEP 6: COMPOSE ARGUMENT (SCHEME COMPOSER) ======================== */

export const STEP_6_COMPONENTS = {
  primary: 'SchemeComposer',
  path: '@/components/arguments/SchemeComposer',
  description: 'Slot-filling interface for structured arguments',
  
  supporting: [
    {
      name: 'SchemeComposerPicker',
      path: '@/components/arguments/SchemeComposerPicker',
      purpose: 'Modal for selecting argumentation scheme'
    },
    {
      name: 'DiagramViewer',
      path: '@/components/dialogue/deep-dive/DiagramViewer',
      purpose: 'Embedded AIF diagram showing argument structure'
    },
    {
      name: 'ClaimPicker',
      path: '@/components/claims/ClaimPicker',
      purpose: 'Search/select claims for premise slots'
    },
    {
      name: 'EntityPicker',
      path: '@/components/kb/EntityPicker',
      purpose: 'Attach evidence to premises'
    },
    {
      name: 'CriticalQuestions',
      path: '@/components/arguments/CriticalQuestions',
      purpose: 'Display CQs for selected scheme'
    }
  ],
  
  demo_approach: 'Full composer with scheme selection (5-6 schemes in modal), slot-filling for 3 premises, embedded diagram updates as slots filled, CQ preview expandable',
  
  screenshot_notes: 'Capture SchemeComposer with: scheme selected (Expert Opinion), all 3 slots filled, diagram preview showing, CQ section expanded'
}

/* ======================== STEP 7: VIEW ARGUMENTS (AIF ARGUMENTS LIST) ======================== */

export const STEP_7_COMPONENTS = {
  primary: 'AIFArgumentsListPro',
  path: '@/components/arguments/AIFArgumentsListPro',
  description: 'Filterable list of all arguments with metadata',
  
  supporting: [
    {
      name: 'ArgumentCard',
      path: '@/components/arguments/ArgumentCard',
      purpose: 'Individual argument display with scheme badge'
    },
    {
      name: 'ArgumentFilter',
      path: '@/components/arguments/ArgumentFilter',
      purpose: 'Filter bar for scheme/CQ/claim/author'
    },
    {
      name: 'SchemeTypeBadge',
      path: '@/components/arguments/SchemeTypeBadge',
      purpose: 'Color-coded scheme indicator'
    }
  ],
  
  demo_approach: 'List with 6-8 mock arguments, working filters (scheme dropdown, CQ toggle), expandable cards showing premises, scheme badges color-coded',
  
  screenshot_notes: 'Capture list view with: filter bar active, 2-3 collapsed cards, 1 expanded showing full premises + evidence, CQ badges visible'
}

/* ======================== STEP 8: DIALOGUE MOVE (ATTACK MENU) ======================== */

export const STEP_8_COMPONENTS = {
  primary: 'AttackMenuPro',
  path: '@/components/arguments/AttackMenuPro',
  description: 'Modal for creating rebuts/undercuts/undermines',
  
  supporting: [
    {
      name: 'AttackTypeSelector',
      path: '@/components/arguments/AttackTypeSelector',
      purpose: 'Three-button choice for attack type'
    },
    {
      name: 'RebutForm',
      path: '@/components/arguments/RebutForm',
      purpose: 'Sub-form for rebuttal attacks'
    },
    {
      name: 'UndercutForm',
      path: '@/components/arguments/UndercutForm',
      purpose: 'Sub-form for undercut attacks'
    },
    {
      name: 'UndermineForm',
      path: '@/components/arguments/UndermineForm',
      purpose: 'Sub-form for undermining attacks'
    },
    {
      name: 'ClaimPicker',
      path: '@/components/claims/ClaimPicker',
      purpose: 'Select counter-claim for rebuts'
    }
  ],
  
  demo_approach: 'Full modal with three attack types selectable, forms switch based on selection, RebutForm shows target + ClaimPicker, UndercutForm shows CQ list, UndermineForm shows evidence inspector',
  
  screenshot_notes: 'Capture AttackMenuPro with: all three attack type buttons visible, Rebut selected showing target selector + claim picker, validation feedback'
}

/* ======================== STEP 9: NAVIGATE DEBATE SHEET ======================== */

export const STEP_9_COMPONENTS = {
  primary: 'LudicsPanel',
  path: '@/components/deepdive/LudicsPanel',
  description: 'Debate sheet showing commitments and obligations',
  
  secondary: 'BehaviourInspectorCard',
  secondary_path: '@/components/ludics/BehaviourInspectorCard',
  secondary_description: 'Advanced ludics design tree viewer',
  
  supporting: [
    {
      name: 'CommitmentStore',
      path: '@/components/dialogue/CommitmentStore',
      purpose: 'Table of participant commitments'
    },
    {
      name: 'ObligationQueue',
      path: '@/components/dialogue/ObligationQueue',
      purpose: 'List of pending obligations with status'
    },
    {
      name: 'MoveHistory',
      path: '@/components/dialogue/MoveHistory',
      purpose: 'Chronological dialogue move log'
    },
    {
      name: 'PhaseIndicator',
      path: '@/components/dialogue/PhaseIndicator',
      purpose: 'Shows current protocol phase'
    }
  ],
  
  demo_approach: 'Tabbed interface with Commitments tab (table with 8-10 entries), Obligations tab (queue with 5 items, 1 overdue), Move History feed at bottom, phase indicator at top',
  
  screenshot_notes: 'Capture LudicsPanel with: Obligations tab active showing queue with priority badges, one obligation expanded, phase indicator showing "Argumentation 2/4"'
}

/* ======================== STEP 10: PUBLISH TO KNOWLEDGE BASE ======================== */

export const STEP_10_COMPONENTS = {
  primary: 'KBPageEditor',
  path: '@/components/kb/KBPageEditor', // May need to be created
  description: 'Rich editor for publishing deliberation outputs',
  
  supporting: [
    {
      name: 'TemplateSelector',
      path: '@/components/kb/TemplateSelector',
      purpose: 'Choose KB page template type'
    },
    {
      name: 'ArgumentBlock',
      path: '@/components/kb/ArgumentBlock',
      purpose: 'Embeddable argument structure in KB page'
    },
    {
      name: 'ProvenancePanel',
      path: '@/components/kb/ProvenancePanel',
      purpose: 'Metadata configuration sidebar'
    },
    {
      name: 'AccessControls',
      path: '@/components/kb/AccessControls',
      purpose: 'Set visibility and permissions'
    }
  ],
  
  demo_approach: 'Split-screen editor: left = content sections (title, summary, claims list, arguments), right = provenance panel. Template selector at top. Working preview button.',
  
  screenshot_notes: 'Capture editor with: template selected, 3-4 sections populated, embedded argument block visible, provenance panel showing metadata'
}

/* ======================== STEP 11: EXPLORE NETWORK (PLEXUS) ======================== */

export const STEP_11_COMPONENTS = {
  primary: 'Plexus',
  path: '@/components/network/Plexus', // May be under different name
  description: 'Network graph visualization across deliberations',
  
  supporting: [
    {
      name: 'GraphCanvas',
      path: '@/components/network/GraphCanvas',
      purpose: 'Force-directed graph rendering'
    },
    {
      name: 'NetworkFilter',
      path: '@/components/network/NetworkFilter',
      purpose: 'Filter panel for entity types, dates, tags'
    },
    {
      name: 'PathTracer',
      path: '@/components/network/PathTracer',
      purpose: 'Highlight connection paths between nodes'
    },
    {
      name: 'NodeContextMenu',
      path: '@/components/network/NodeContextMenu',
      purpose: 'Right-click actions on nodes'
    },
    {
      name: 'TimelineScrubber',
      path: '@/components/network/TimelineScrubber',
      purpose: 'Filter by date range'
    }
  ],
  
  demo_approach: '3D force-directed graph with 30-50 mock nodes (KB pages, Claims, Deliberations), view mode switcher working, filters functional, clickable nodes with tooltips, path tracing between two selected nodes',
  
  screenshot_notes: 'Capture Plexus in Knowledge view with: 40+ nodes visible, clusters color-coded, path trace active between 2 nodes, filter panel open, timeline scrubber set to Oct 2025'
}

/* ======================== CROSS-REFERENCE: COMPONENTS USED IN MULTIPLE STEPS ======================== */

export const SHARED_COMPONENTS = {
  'ClaimPicker': {
    used_in: ['Step 6: SchemeComposer', 'Step 8: AttackMenuPro'],
    path: '@/components/claims/ClaimPicker',
    notes: 'Critical shared component—ensure demo version is consistent across steps'
  },
  
  'DiagramViewer': {
    used_in: ['Step 6: SchemeComposer', 'Step 7: ArgumentsList (via modal)'],
    path: '@/components/dialogue/deep-dive/DiagramViewer',
    notes: 'Shows AIF argument structure with I-nodes, S-nodes, and Claims'
  },
  
  'EntityPicker': {
    used_in: ['Step 6: SchemeComposer (evidence)', 'Step 10: KBPageEditor'],
    path: '@/components/kb/EntityPicker',
    notes: 'Generic picker for Works, URLs, and other knowledge entities'
  },
  
  'MinimapFamily': {
    components: ['ClaimMiniMap', 'CegMiniMap', 'AFMinimap'],
    used_in: ['Step 5: View Claims', 'Throughout interface (sticky)'],
    notes: 'All minimaps share similar interaction patterns—unified demo approach'
  }
}

/* ======================== IMPLEMENTATION PRIORITY ======================== */

export const DEMO_IMPLEMENTATION_PRIORITY = [
  {
    step: 2,
    component: 'PropositionComposerPro',
    priority: 'HIGH',
    reason: 'Core UX, frequently used, good example of form validation'
  },
  {
    step: 3,
    component: 'PropositionsList + interactions',
    priority: 'HIGH',
    reason: 'Shows graduated engagement model, multiple interaction patterns'
  },
  {
    step: 5,
    component: 'ClaimMiniMap + CegMiniMap',
    priority: 'HIGH',
    reason: 'Visual showcase, demonstrates argument graph concept'
  },
  {
    step: 6,
    component: 'SchemeComposer',
    priority: 'MEDIUM',
    reason: 'Complex but important—shows formal argumentation in action'
  },
  {
    step: 8,
    component: 'AttackMenuPro',
    priority: 'MEDIUM',
    reason: 'Unique feature, teaches attack type distinctions'
  },
  {
    step: 7,
    component: 'AIFArgumentsListPro',
    priority: 'LOW',
    reason: 'Similar to PropositionsList pattern, less critical for understanding'
  },
  {
    step: 4,
    component: 'ClaimElevator',
    priority: 'LOW',
    reason: 'Simple modal, can be mocked easily'
  },
  {
    step: 9,
    component: 'LudicsPanel',
    priority: 'LOW',
    reason: 'Advanced feature, most users wont need initially'
  },
  {
    step: 10,
    component: 'KBPageEditor',
    priority: 'LOW',
    reason: 'End-of-workflow feature, moderator-only'
  },
  {
    step: 11,
    component: 'Plexus',
    priority: 'LOW',
    reason: 'Complex visualization, static screenshots may suffice for onboarding'
  },
  {
    step: 1,
    component: 'DiscussionView',
    priority: 'LOW',
    reason: 'Standard chat UI, familiar pattern'
  }
]

/* ======================== SCREENSHOT CHECKLIST ======================== */

export const SCREENSHOT_REQUIREMENTS = {
  resolution: '1920x1080 or 1440x900',
  format: 'WebP (compressed)',
  max_file_size: '150KB',
  naming: 'step-{number}-{description}.webp',
  
  preparation: [
    'Use consistent test data (see mock-data.ts)',
    'Clear browser cache before capturing',
    'Use same browser/OS for consistency',
    'Capture at 2x resolution then downscale for sharpness'
  ],
  
  annotations: [
    'Add after screenshots captured',
    'Use percentage-based positioning (not pixels)',
    'Keep annotations minimal (4-7 per screenshot)',
    'Ensure numbered labels are clearly visible'
  ]
}

export default {
  STEP_1_COMPONENTS,
  STEP_2_COMPONENTS,
  STEP_3_COMPONENTS,
  STEP_4_COMPONENTS,
  STEP_5_COMPONENTS,
  STEP_6_COMPONENTS,
  STEP_7_COMPONENTS,
  STEP_8_COMPONENTS,
  STEP_9_COMPONENTS,
  STEP_10_COMPONENTS,
  STEP_11_COMPONENTS,
  SHARED_COMPONENTS,
  DEMO_IMPLEMENTATION_PRIORITY,
  SCREENSHOT_REQUIREMENTS
}
